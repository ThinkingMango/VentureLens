import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as workspaceSchema from "../lib/workspace-schema.ts";

const require = createRequire(import.meta.url);
function loadModule(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const module = { exports: {} };
  const dependency = name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
  new Function("require", "exports", "module", outputText)(dependency, module.exports, module);
  return module.exports;
}

const OPPORTUNITY = "11111111-1111-4111-8111-111111111111";
const USER = "user-a";
// In-memory saved_opportunities with the migration's semantics: saved defaults to true, an upsert updates only
// the columns it names, and inserting a duplicate key fails with 23505.
function fakeDatabase({ raceOnInsert = false } = {}) {
  const rows = [];
  const find = filters => rows.find(row => row.user_id === filters.user_id && row.opportunity_id === filters.opportunity_id);
  function from(table) {
    const filters = {};
    let action = "select", value;
    const run = () => {
      if (table === "opportunities") return { data: { id: filters.id }, error: null };
      const existing = find(filters);
      if (action === "select") return { data: existing ? { completed_tasks: existing.completed_tasks } : null, error: null };
      if (action === "update") { if (existing) Object.assign(existing, value); return { error: null }; }
      if (action === "insert") {
        if (raceOnInsert && !find(value)) rows.push({ saved: true, completed_tasks: [], ...{ user_id: value.user_id, opportunity_id: value.opportunity_id } });
        if (find(value)) return { error: { code: "23505" } };
        rows.push({ saved: true, completed_tasks: [], ...value });
        return { error: null };
      }
      if (action === "upsert") {
        const current = find(value);
        if (current) Object.assign(current, value); else rows.push({ saved: true, completed_tasks: [], ...value });
        return { error: null };
      }
      throw new Error(`unexpected ${action}`);
    };
    const query = {
      select: () => query,
      eq: (key, v) => { filters[key] = v; return query; },
      maybeSingle: async () => run(),
      update: v => { action = "update"; value = v; return query; },
      insert: v => { action = "insert"; value = v; return query; },
      upsert: v => { action = "upsert"; value = v; return query; },
      delete: () => { action = "delete"; return query; },
      then: (resolve, reject) => { try { resolve(run()); } catch (error) { reject(error); } },
    };
    return query;
  }
  return { rows, client: { from, auth: { getUser: async () => ({ data: { user: { id: USER } } }) } } };
}
function routeFor(db) {
  return loadModule("../app/api/workspace/route.ts", {
    "next/server": { NextResponse: { json: (value, init) => new Response(JSON.stringify(value), init) } },
    "@/lib/supabase/server": { createClient: async () => db.client },
    "@/lib/workspace": { readWorkspace: async () => ({ ok: true }) },
    "@/lib/workspace-schema": workspaceSchema,
  });
}
const post = (route, body) => route.POST(new Request("https://venturelens.test/api/workspace", {
  method: "POST", headers: { Origin: "https://venturelens.test", Host: "venturelens.test", "Content-Type": "application/json" }, body: JSON.stringify(body),
}));
const tick = (completed, task = "0") => ({ action: "task", id: OPPORTUNITY, task, completed });
const save = saved => ({ action: "save", id: OPPORTUNITY, saved });

test("ticking a checklist step records progress without saving the opportunity", async () => {
  const db = fakeDatabase();
  const route = routeFor(db);
  assert.equal((await post(route, tick(true))).status, 200);
  assert.deepEqual(db.rows, [{ saved: false, completed_tasks: [`${OPPORTUNITY}-0`], user_id: USER, opportunity_id: OPPORTUNITY }]);
});

test("unsaving and saving again keeps checklist progress", async () => {
  const db = fakeDatabase();
  const route = routeFor(db);
  await post(route, save(true));
  await post(route, tick(true, "0"));
  await post(route, tick(true, "2"));
  assert.equal(db.rows[0].saved, true, "a tick on a saved opportunity keeps it saved");
  await post(route, save(false));
  assert.equal(db.rows.length, 1, "unsaving keeps the row");
  assert.equal(db.rows[0].saved, false);
  await post(route, save(true));
  assert.equal(db.rows[0].saved, true);
  assert.deepEqual(db.rows[0].completed_tasks, [`${OPPORTUNITY}-0`, `${OPPORTUNITY}-2`]);
});

test("a tick that loses an insert race records progress on the row that won", async () => {
  const db = fakeDatabase({ raceOnInsert: true });
  const route = routeFor(db);
  assert.equal((await post(route, tick(true))).status, 200);
  assert.equal(db.rows.length, 1);
  assert.deepEqual(db.rows[0].completed_tasks, [`${OPPORTUNITY}-0`]);
});

test("the workspace lists only flagged rows as saved but keeps progress from every row", async () => {
  const opportunity = { id: OPPORTUNITY, title: "Idea", score: 60, payload: { category: "c", description: "d", buyer: "b", pain: "p", confidence: "limited", revenue: "r", cost: "c", risk: "r", scores: [1, 2, 3, 4, 5], icon: "workflow" } };
  const tables = {
    founder_profiles: { data: null }, research_projects: { data: [] }, research_runs: { data: [] }, research_dev_access: { data: null },
    opportunities: { data: [opportunity] },
    saved_opportunities: { data: [{ opportunity_id: OPPORTUNITY, completed_tasks: [`${OPPORTUNITY}-1`], saved: false }, { opportunity_id: "other", completed_tasks: [], saved: true }] },
  };
  const selected = [];
  const supabase = { from: table => {
    const query = { select: columns => { if (table === "saved_opportunities") selected.push(columns); return query; }, eq: () => query, order: () => query, maybeSingle: async () => ({ ...tables[table], error: null }), then: resolve => resolve({ ...tables[table], error: null }) };
    return query;
  } };
  const workspace = loadModule("../lib/workspace.ts", {
    "server-only": {}, react: { cache: fn => fn }, "next/navigation": { redirect: () => {} }, "@/lib/supabase/server": {}, "@/lib/workspace-schema": workspaceSchema,
  });
  const data = await workspace.readWorkspace(supabase, { id: USER });
  assert.match(selected[0], /\bsaved\b/);
  assert.deepEqual(data.saved, ["other"]);
  assert.deepEqual(data.completed, [`${OPPORTUNITY}-1`]);
});
