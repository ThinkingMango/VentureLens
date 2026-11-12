// Runs every migration against a throwaway PostgreSQL database and checks the per-run research budget, including
// "No budget": a research policy with `budgetUsd: null` starts runs with no budget, and reserve_research_usage then
// stops them only at the safety ceiling (NO_BUDGET_CEILING_USD). Capped runs keep their exact limit.
//
// Needs `psql` and TEST_DATABASE_URL pointing at a PostgreSQL 15+ server where the user may create databases, e.g.
//   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm test:sql
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NO_BUDGET_CEILING_USD } from "../lib/provider-settings-core.ts";

const server = process.env.TEST_DATABASE_URL;
const hasPsql = (() => { try { execFileSync("psql", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } })();
const skip = !server ? "set TEST_DATABASE_URL to run the SQL tests" : !hasPsql ? "psql is not installed" : false;
const root = new URL("../", import.meta.url);
const path = relative => fileURLToPath(new URL(relative, root));
const psql = (url, args) => execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-A", "-t", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const sqlError = fn => { try { fn(); } catch (error) { return String(error.stderr ?? error.message); } return ""; };

test("No budget starts runs without a cap, which then stop only at the safety ceiling; capped runs are unchanged", { skip }, async t => {
  const name = `vl_budget_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  sql(`update public.research_dev_access set max_runs = 20, expires_at = now() + interval '30 days' where user_id = '${user}'`);
  const policy = value => sql(`insert into public.app_settings (key, value) values ('research', '${value}'::jsonb) on conflict (key) do update set value = excluded.value`);
  const budget = () => sql(`select coalesce(public.research_budget_usd()::text, 'null')`);
  const brief = `'{"name":"Budget run","sectors":["Healthcare"],"models":["B2B subscription"],"geography":"Japan","context":"","discovery_mode":"combined","language":"en"}'::jsonb`;
  // Enqueue a run, mark it running, and close it again afterwards so the next one may start.
  const start = () => {
    const run = sql(`select public.enqueue_research('${user}', ${brief}, '{}'::jsonb, gen_random_uuid())`);
    sql(`update public.research_runs set status = 'running', workflow_id = 'wf' where id = '${run}'`);
    return run;
  };
  const finish = run => sql(`update public.research_runs set status = 'completed' where id = '${run}'`);
  const reserve = (run, usd) => sql(`select public.reserve_research_usage('${run}', '${user}', 'stage-' || gen_random_uuid(), 'claude-opus-5-5', ${usd}, '{}'::jsonb) is not null`);
  const settle = run => sql(`update public.research_usage set status = 'completed', estimated_usd = reserved_usd where run_id = '${run}'`);

  // The budget the policy sets: the default without a row or key, numbers clamped to 0.05–5, and null for No budget.
  sql(`delete from public.app_settings where key = 'research'`);
  assert.equal(budget(), "0.25", "no research row: the default");
  policy(`{"primary":"qwen","autoFallback":true}`);
  assert.equal(budget(), "0.25", "a row saved before budgets existed: the default");
  policy(`{"primary":"qwen","autoFallback":true,"budgetUsd":9}`);
  assert.equal(budget(), "5", "numbers stay clamped");
  policy(`{"primary":"qwen","autoFallback":true,"budgetUsd":0.4}`);
  assert.equal(budget(), "0.4");

  // A capped run is stopped at its own budget, exactly as before.
  const capped = start();
  assert.equal(sql(`select budget_usd from public.research_runs where id = '${capped}'`), "0.4");
  assert.equal(reserve(capped, 0.3), "t");
  assert.match(sqlError(() => reserve(capped, 0.11)), /BUDGET_EXCEEDED/);
  assert.equal(reserve(capped, 0.1), "t", "exactly at the budget is allowed");
  finish(capped);

  // No budget: the run records none, spends past the old $5 maximum, and stops only at the ceiling.
  policy(`{"primary":"claude","autoFallback":true,"budgetUsd":null}`);
  assert.equal(budget(), "null");
  const open = start();
  assert.equal(sql(`select budget_usd is null from public.research_runs where id = '${open}'`), "t");
  assert.equal(reserve(open, 4.5), "t", "the costliest configurable run fits");
  assert.equal(reserve(open, 4), "t", "past the $5 that capped runs may never exceed");
  settle(open);
  assert.equal(reserve(open, NO_BUDGET_CEILING_USD - 8.5), "t", "up to the ceiling");
  assert.match(sqlError(() => reserve(open, 0.01)), /BUDGET_EXCEEDED/, "a runaway stops at the ceiling");
  assert.match(sqlError(() => reserve(open, 0)), /BUDGET_EXCEEDED/, "a reservation must still be positive");
  finish(open);

  // A numeric budget is still bounded by the table itself; null is allowed only as No budget.
  const project = sql(`select project_id from public.research_runs where id = '${open}'`);
  assert.match(sqlError(() => sql(`insert into public.research_runs (user_id, project_id, budget_usd) values ('${user}', '${project}', 6)`)), /research_runs_budget_usd_check/);
  assert.match(sqlError(() => sql(`insert into public.research_runs (user_id, project_id, budget_usd) values ('${user}', '${project}', 0)`)), /research_runs_budget_usd_check/);

  // Switching back to a budget applies to new runs only; the run started with none keeps none.
  policy(`{"primary":"claude","autoFallback":true,"budgetUsd":2}`);
  const again = start();
  assert.equal(sql(`select budget_usd from public.research_runs where id = '${again}'`), "2");
  assert.equal(sql(`select budget_usd is null from public.research_runs where id = '${open}'`), "t");
});
