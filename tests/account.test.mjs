import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as accountCore from "../lib/account-core.ts";
import * as libraryCore from "../lib/library-core.ts";

const require = createRequire(import.meta.url);
const { buildAccountExport, exportFileName, ownTables, serviceTables } = accountCore;
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("the export covers every table that stores a founder's rows", () => {
  // Every table any migration creates with a user_id column, except the hashed sign-up record, which has none.
  const migrations = readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter(f => f.endsWith(".sql")).map(f => read(`../supabase/migrations/${f}`)).join("\n");
  const withUser = [...migrations.matchAll(/create table public\.([a-z_]+)\s*\(([\s\S]*?)\);/g)]
    .filter(([, , body]) => /\buser_id uuid\b/.test(body)).map(([, name]) => name);
  const exported = new Set([...ownTables, ...serviceTables, "research_stages"]);
  for (const table of withUser) assert.ok(exported.has(table), `${table} stores founder rows but is not exported`);
  assert.ok(withUser.length >= 14);
});

test("the export file names the format, the account and each table, and nothing about tokens", () => {
  const now = new Date("2026-11-12T08:00:00Z");
  const file = buildAccountExport({
    user: { id: "u1", email: "founder@example.com", created_at: "2026-11-01", email_confirmed_at: "2026-11-01", last_sign_in_at: "2026-11-12", app_metadata: { role: "admin" }, identities: [{ provider: "email" }] },
    tables: { founder_profiles: [{ user_id: "u1", name: "A" }], research_runs: undefined },
    now,
  });
  assert.equal(file.format, "venturelens-account-export");
  assert.equal(file.version, 1);
  assert.deepEqual(file.account, { id: "u1", email: "founder@example.com", created_at: "2026-11-01", email_confirmed_at: "2026-11-01", last_sign_in_at: "2026-11-12" });
  assert.deepEqual(file.tables.research_runs, [], "a table that could not be read is an empty list, never missing");
  assert.equal(exportFileName(now), "venturelens-export-2026-11-12.json");
});

function load(file, dependencies) {
  const source = read(file);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  new Function("require", "exports", "module", outputText)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module.exports, module);
  return module.exports;
}
const account = () => load("../lib/account.ts", {
  "server-only": {}, "@/lib/account-core": accountCore,
  "@/lib/supabase/admin": { createAdminClient: () => { throw new Error("tests pass their own"); } },
  "@/lib/supabase/server": { createClient: () => { throw new Error("tests pass their own"); } },
});
/** A client whose tables hold `rows`, honouring eq filters and range, and recording every read. */
function fakeClient(rows, log, name) {
  return {
    from(table) {
      const filters = [];
      const query = {
        select: () => query, order: () => query,
        eq: (key, value) => { filters.push([key, value]); return query; },
        range: (from, to) => {
          log.push({ client: name, table, filters: [...filters], from });
          const found = (rows[table] ?? []).filter(row => filters.every(([key, value]) => row[key] === value));
          return Promise.resolve({ data: found.slice(from, to + 1), error: null });
        },
      };
      return query;
    },
  };
}

test("the export reads the founder's tables with their own session, pages past 1,000 rows, and filters service tables to them", async () => {
  const { exportAccount } = account();
  const evidence = Array.from({ length: 2345 }, (_, i) => ({ id: `e${i}`, user_id: "u1" }));
  const log = [];
  const user = fakeClient({ research_evidence: [...evidence, { id: "other", user_id: "u2" }], founder_profiles: [{ user_id: "u1" }] }, log, "user");
  const admin = fakeClient({ product_events: [{ id: "p1", user_id: "u1" }, { id: "p2", user_id: "u2" }] }, log, "admin");
  const file = await exportAccount(user, { id: "u1", email: "f@example.com" }, new Date("2026-11-12T00:00:00Z"), admin);
  assert.equal(file.tables.research_evidence.length, 2345, "every row, across three pages");
  assert.deepEqual(log.filter(r => r.table === "research_evidence").map(r => r.from), [0, 1000, 2000]);
  assert.deepEqual(file.tables.product_events, [{ id: "p1", user_id: "u1" }], "only the founder's events");
  assert.ok(log.every(r => r.filters.some(([key, value]) => key === "user_id" && value === "u1")), "every read is filtered to the founder");
  assert.deepEqual([...new Set(log.filter(r => r.client === "admin").map(r => r.table))].sort(), ["product_events", "weekly_emails"], "the service role reads only the two service tables");
});

test("deleting an account prepares first, refuses while research runs, and only then deletes the auth user", async () => {
  const { deleteAccount } = account();
  const calls = [];
  const user = error => ({ rpc: async name => { calls.push(name); return { error }; } });
  const admin = (error = null) => ({ auth: { admin: { deleteUser: async id => { calls.push(`delete:${id}`); return { error }; } } } });
  assert.deepEqual(await deleteAccount(user(null), "u1", admin()), { ok: true });
  assert.deepEqual(calls, ["prepare_account_deletion", "delete:u1"]);
  calls.length = 0;
  assert.deepEqual(await deleteAccount(user({ code: "55000" }), "u1", admin()), { ok: false, code: "RUN_ACTIVE" });
  assert.deepEqual(calls, ["prepare_account_deletion"], "the account is never deleted while research runs");
  assert.deepEqual(await deleteAccount(user({ code: "XX000" }), "u1", admin()), { ok: false, code: "DELETE_FAILED" });
  assert.deepEqual(await deleteAccount(user(null), "u1", admin({ message: "boom" })), { ok: false, code: "DELETE_FAILED" });
});

test("the routes: deletion needs the same origin, the typed word and a session, and signs out; export needs a session", () => {
  const remove = read("../app/api/account/route.ts");
  assert.match(remove, /export async function DELETE/);
  assert.doesNotMatch(remove, /export async function (GET|POST)/);
  assert.match(remove, /if \(!sameOrigin\) return json\(\{ code: "INVALID_ORIGIN"/);
  assert.match(remove, /\.confirm !== DELETE_CONFIRMATION/);
  assert.match(remove, /if \(!user\) return json\(\{ code: "AUTH_REQUIRED"/);
  assert.match(remove, /deleteAccount\(supabase, user\.id\)/, "only the signed-in founder's own account");
  assert.match(remove, /auth\.signOut\(/);
  const exporter = read("../app/api/account/export/route.ts");
  assert.match(exporter, /if \(!user\) return NextResponse\.json\(\{ code: "AUTH_REQUIRED"/);
  assert.match(exporter, /exportAccount\(supabase, user, now\)/);
  assert.match(exporter, /"Cache-Control": "private, no-store"/);
});

test("the profile shows download and delete, with a typed confirmation, and nothing in the demo", () => {
  const copy = (text, values = {}) => text.replace(/\{(\w+)\}/g, (_m, key) => values[key] ?? key);
  const pass = tag => ({ children, asChild, ...props }) => (asChild ? children : createElement(tag, props, children));
  const component = demo => load("../components/account-data.tsx", {
    "@/i18n/use-copy": { useCopy: () => copy }, "@/i18n/errors": { feedbackSource: code => String(code) },
    "@/components/demo-provider": { useDemo: () => ({ data: demo ? null : { email: "f@example.com" }, isDemo: demo }) },
    "@/lib/supabase/client": { createClient: () => ({ auth: { signOut: async () => ({}) } }) },
    "@/lib/library-core": libraryCore, "sonner": { toast: { success() {}, error() {} } },
    "@/components/ui/button": { Button: pass("button") }, "@/components/ui/input": { Input: pass("input") },
    "@/components/ui/dialog": { Dialog: ({ children }) => createElement("div", null, children), DialogContent: pass("div"), DialogHeader: pass("div"), DialogTitle: pass("h2"), DialogDescription: pass("p"), DialogFooter: pass("div") },
  }).AccountData;
  const html = renderToStaticMarkup(createElement(component(false)));
  assert.match(html, /Download my data/);
  assert.match(html, /Delete my account/);
  assert.match(html, /Type DELETE to confirm/);
  assert.match(html, /one-way code made from your email address is kept for 12 months/);
  assert.equal(renderToStaticMarkup(createElement(component(true))), "");
});
