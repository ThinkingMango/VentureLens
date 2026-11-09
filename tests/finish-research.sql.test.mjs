// Runs every migration in supabase/migrations against a throwaway PostgreSQL database, then saves real reports with
// finish_research. The number of hypotheses a run explores follows its budget (5 to MAX_CANDIDATES), so a report can
// hold up to MAX_CANDIDATES opportunities and the database must accept that many.
//
// Needs `psql` and TEST_DATABASE_URL pointing at a PostgreSQL 15+ server where the user may create databases, e.g.
//   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm test:sql
// A fresh database is created for the run and dropped afterwards; the target database itself is never modified.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MAX_CANDIDATES } from "../lib/research-budget.ts";

const server = process.env.TEST_DATABASE_URL;
const hasPsql = (() => { try { execFileSync("psql", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } })();
const skip = !server ? "set TEST_DATABASE_URL to run the SQL tests" : !hasPsql ? "psql is not installed" : false;

const root = new URL("../", import.meta.url);
const path = relative => fileURLToPath(new URL(relative, root));
function psql(url, args) {
  return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-A", "-t", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function sqlError(fn) {
  try { fn(); } catch (error) { return String(error.stderr ?? error.message); }
  return "";
}

test("finish_research saves a report as large as the largest run, and still rejects a larger one", { skip }, async t => {
  const name = `vl_finish_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);

  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) {
    psql(db, ["-f", path(`supabase/migrations/${file}`)]);
  }

  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  sql(`update public.research_dev_access set max_runs = 10 where user_id = '${user}'`);
  const brief = `'{"name":"Agency research","sector":"Professional services","model":"B2B subscription","geography":"United States"}'::jsonb`;
  // A run in the state the engine leaves it before finalizing: running under one workflow, with saved evidence.
  const running = () => {
    const run = sql(`select public.enqueue_research('${user}', ${brief}, '{}'::jsonb, gen_random_uuid())`);
    sql(`update public.research_runs set status = 'running', workflow_id = 'wf-${run}', started_at = now() where id = '${run}'`);
    sql(`insert into public.research_evidence (run_id, user_id, source_key, candidate_id, url, title, excerpt) values ('${run}', '${user}', 'c1-s1', 'c1', 'https://example.org/a', 'A', 'Buyers describe the pain.')`);
    return run;
  };
  const report = count => `jsonb_build_object('summary', 's', 'opportunities', (select jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'title', 'Opportunity ' || i, 'score', 50)) from generate_series(1, ${count}) i))`;
  const finish = (run, count) => sql(`select public.finish_research('${run}', '${user}', 'wf-${run}', ${report(count)})`);
  const status = run => sql(`select status || ' ' || (select count(*) from public.opportunities where run_id = '${run}') from public.research_runs where id = '${run}'`);

  const largest = running();
  finish(largest, MAX_CANDIDATES);
  assert.equal(status(largest), `completed ${MAX_CANDIDATES}`, "every opportunity of the largest run is saved");

  const oversized = running();
  assert.match(sqlError(() => finish(oversized, MAX_CANDIDATES + 1)), /EVIDENCE_REQUIRED/);
  assert.equal(status(oversized), "running 0", "a rejected report saves nothing");
  // A report without opportunities is refused, whether the list is empty or missing altogether.
  assert.match(sqlError(() => sql(`select public.finish_research('${oversized}', '${user}', 'wf-${oversized}', '{"summary":"s","opportunities":[]}'::jsonb)`)), /EVIDENCE_REQUIRED/);
  assert.match(sqlError(() => sql(`select public.finish_research('${oversized}', '${user}', 'wf-${oversized}', '{"summary":"s"}'::jsonb)`)), /EVIDENCE_REQUIRED/);
  assert.equal(status(oversized), "running 0");
});
