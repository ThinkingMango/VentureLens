import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as shareCore from "../lib/share-core.ts";
import * as researchCore from "../lib/research-core.ts";

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const { newShareToken, isShareToken, sharePath } = shareCore;

test("links carry a fresh 43-character secret and nothing else", () => {
  const tokens = new Set(Array.from({ length: 200 }, newShareToken));
  assert.equal(tokens.size, 200);
  for (const token of tokens) assert.ok(isShareToken(token), token);
  assert.equal(isShareToken("short"), false);
  assert.equal(isShareToken(`${"a".repeat(42)}/`), false);
  assert.equal(isShareToken(undefined), false);
  assert.equal(sharePath("abc"), "/s/abc");
});

function load(file, dependencies) {
  const { outputText } = ts.transpileModule(read(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const module = { exports: {} };
  new Function("require", "exports", "module", outputText)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module.exports, module);
  return module.exports;
}
const shares = () => load("../lib/shares.ts", {
  "server-only": {}, "@/lib/share-core": shareCore, "@/lib/research-core": researchCore,
  "@/lib/supabase/admin": { createAdminClient: () => { throw new Error("tests pass their own"); } },
});
/** A client over `tables`, honouring eq and is(null), recording each table and the columns it selected. */
function fakeDb(tables, { insertError = null } = {}) {
  const reads = [];
  return {
    reads,
    from(table) {
      const filters = [];
      let columns = "", inserting = null;
      const run = () => (tables[table] ?? []).filter(row => filters.every(([key, value]) => (typeof value === "function" ? value(row) : value === null ? row[key] == null : row[key] === value)));
      const query = {
        select: c => { columns = c; reads.push({ table, columns }); return query; },
        eq: (k, v) => { filters.push([k, v]); return query; },
        is: (k, v) => { filters.push([k, v]); return query; },
        gt: (k, v) => { filters.push([k, row => row[k] > v]); return query; },
        lte: (k, v) => { filters.push([k, row => row[k] <= v]); return query; },
        insert: row => { inserting = row; return query; },
        update: values => { query.updating = values; return query; },
        maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
        single: async () => {
          if (insertError) return { data: null, error: insertError };
          (tables[table] ??= []).push({ ...inserting, created_at: "now", expires_at: LATER, revoked_at: null });
          return { data: { token: inserting.token, created_at: "now", expires_at: LATER }, error: null };
        },
        then: resolve => {
          if (query.updating) { run().forEach(row => Object.assign(row, query.updating)); return resolve({ data: null, error: null }); }
          return resolve({ data: run(), error: null });
        },
      };
      return query;
    },
  };
}
const TOKEN = "A".repeat(43);
const LATER = "2099-01-01T00:00:00.000Z";
const EARLIER = "2020-01-01T00:00:00.000Z";
const report = { mode: "combined", opportunities: [], summary: "s" };

test("a shared page reads only the report, its dates and outcome, never the brief, profile or founder", async () => {
  const { loadSharedReport } = shares();
  const db = fakeDb({
    report_shares: [{ token: TOKEN, run_id: "r1", user_id: "u1", revoked_at: null, expires_at: LATER }],
    research_runs: [{ id: "r1", user_id: "u1", status: "completed", report, created_at: "c", completed_at: "d", configuration: { brief: { name: "Secret" } } }],
    research_stages: [],
  });
  const shared = await loadSharedReport(TOKEN, db);
  assert.deepEqual(shared, { id: "r1", created_at: "c", completed_at: "d", report, outcome: null });
  const runRead = db.reads.find(r => r.table === "research_runs");
  assert.doesNotMatch(runRead.columns, /configuration|user_id|budget/, "the brief is never read");
  assert.ok(db.reads.every(r => !["founder_profiles", "auth.users"].includes(r.table)));
});

test("an unknown, malformed or turned-off link, or a report that is no longer complete, shows nothing", async () => {
  const { loadSharedReport } = shares();
  const tables = () => ({
    report_shares: [{ token: TOKEN, run_id: "r1", user_id: "u1", revoked_at: "2026-11-12" }, { token: "B".repeat(43), run_id: "r2", user_id: "u1", revoked_at: null, expires_at: LATER }, { token: "D".repeat(43), run_id: "r3", user_id: "u1", revoked_at: null, expires_at: EARLIER }],
    research_runs: [{ id: "r2", user_id: "u1", status: "failed", report: null }, { id: "r3", user_id: "u1", status: "completed", report: { mode: "combined" }, created_at: "c", completed_at: "d" }],
    research_stages: [],
  });
  const db = fakeDb(tables());
  assert.equal(await loadSharedReport("../../etc/passwd", db), null);
  assert.equal(db.reads.length, 0, "a malformed token never reaches the database");
  assert.equal(await loadSharedReport(TOKEN, fakeDb(tables())), null, "turned off");
  assert.equal(await loadSharedReport("C".repeat(43), fakeDb(tables())), null, "unknown");
  assert.equal(await loadSharedReport("B".repeat(43), fakeDb(tables())), null, "not a completed report");
  assert.equal(await loadSharedReport("D".repeat(43), fakeDb(tables())), null, "expired after 90 days, though the report is complete");
});

test("making a link returns the live one if it exists, survives a race, and treats a refused run as not found", async () => {
  const { createShare } = shares();
  const live = fakeDb({ report_shares: [{ user_id: "u1", run_id: "r1", token: TOKEN, created_at: "then", expires_at: LATER, revoked_at: null }] });
  assert.deepEqual(await createShare(live, "u1", "r1"), { ok: true, token: TOKEN, created_at: "then", expires_at: LATER });
  // An expired link is retired, and sharing again makes a new one.
  const expired = { report_shares: [{ user_id: "u1", run_id: "r1", token: TOKEN, created_at: "then", expires_at: EARLIER, revoked_at: null }] };
  const renewed = await createShare(fakeDb(expired), "u1", "r1");
  assert.ok(renewed.ok && renewed.token !== TOKEN && renewed.expires_at === LATER);
  assert.ok(expired.report_shares[0].revoked_at, "the expired link is turned off");
  const fresh = await createShare(fakeDb({ report_shares: [] }), "u1", "r1");
  assert.ok(fresh.ok && isShareToken(fresh.token));
  assert.deepEqual(await createShare(fakeDb({ report_shares: [] }, { insertError: { code: "42501" } }), "u1", "r1"), { ok: false, code: "NOT_FOUND" });
  assert.deepEqual(await createShare(fakeDb({ report_shares: [] }, { insertError: { code: "XX000" } }), "u1", "r1"), { ok: false, code: "SAVE_FAILED" });
});

test("routes and page: same-origin writes, signed-in owners only, unlisted with no referrer, shared export only", () => {
  const route = read("../app/api/research/[id]/share/route.ts");
  for (const method of ["POST", "DELETE"]) assert.match(route, new RegExp(`export async function ${method}[\\s\\S]*?if \\(!sameOrigin\\(request\\)\\) return json\\(\\{ code: "INVALID_ORIGIN"`));
  assert.match(route, /if \(!user\) return \{ error: json\(\{ code: "AUTH_REQUIRED"/);
  const layout = read("../app/(shared)/layout.tsx");
  assert.match(layout, /robots: \{ index: false, follow: false, nocache: true \}/);
  assert.match(layout, /referrer: "no-referrer"/, "sources never receive the link's secret");
  const page = read("../app/(shared)/s/[token]/page.tsx");
  assert.match(page, /shared: true/);
  assert.doesNotMatch(page, /includeBrief|brief:/);
  assert.doesNotMatch(read("../proxy.ts"), /\|s\|/, "shared pages need no sign-in");
});

test("the page's 90 days matches the expiry the database sets", () => {
  assert.equal(shareCore.SHARE_DAYS, 90);
  const migration = read("../supabase/migrations/20261112140000_report_share_expiry.sql");
  assert.match(migration, new RegExp(`set default \\(now\\(\\) \\+ interval '${shareCore.SHARE_DAYS} days'\\)`));
  assert.match(migration, /grant insert \(user_id, run_id, token\) on public\.report_shares to authenticated/);
});
