// Runs every migration against a throwaway PostgreSQL database and checks WP-05's verify mode in the database:
// research_projects accepts 'verify' only with an idea (and an idea only with 'verify'), enqueue_research stores the
// idea, unknown modes are still rejected, and a verify run records run_started, verify_started and run_finished.
//
// Needs `psql` and TEST_DATABASE_URL pointing at a PostgreSQL 15+ server where the user may create databases, e.g.
//   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm test:sql
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eventProps } from "../lib/events-core.ts";

const server = process.env.TEST_DATABASE_URL;
const hasPsql = (() => { try { execFileSync("psql", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } })();
const skip = !server ? "set TEST_DATABASE_URL to run the SQL tests" : !hasPsql ? "psql is not installed" : false;
const root = new URL("../", import.meta.url);
const path = relative => fileURLToPath(new URL(relative, root));
const psql = (url, args) => execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-A", "-t", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
function sqlError(fn) {
  try { fn(); } catch (error) { return String(error.stderr ?? error.message); }
  return "";
}

test("verify briefs need an idea, store it, and record their own lifecycle events", { skip }, async t => {
  const name = `vl_verify_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) {
    psql(db, ["-f", path(`supabase/migrations/${file}`)]);
  }
  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  sql(`update public.research_dev_access set max_runs = 5 where user_id = '${user}'`);
  const project = (mode, idea) => `insert into public.research_projects (user_id, name, sectors, models, geography, discovery_mode, idea) values ('${user}', 'P', '{Healthcare}', '{B2B subscription}', 'Japan', '${mode}', ${idea})`;
  const idea = `'{"title":"Reminders for clinics","buyer":"Clinic owners","pain":"No-shows cost clinics money every week","offer":"","price_hint":"$49/month"}'::jsonb`;

  // Mode and idea stay in step; unknown modes are still rejected; the idea is a bounded object.
  sql(project("verify", idea));
  sql(project("combined", "null"));
  assert.match(sqlError(() => sql(project("verify", "null"))), /research_projects_idea_check/, "verify needs an idea");
  assert.match(sqlError(() => sql(project("market", idea))), /research_projects_idea_check/, "only verify carries an idea");
  assert.match(sqlError(() => sql(project("explore", "null"))), /research_projects_discovery_mode_check/, "unknown modes are rejected");
  assert.match(sqlError(() => sql(project("verify", `'["not","an","object"]'::jsonb`))), /research_projects_idea_check/);
  assert.match(sqlError(() => sql(project("verify", `jsonb_build_object('title', repeat('x', 5000))`))), /research_projects_idea_check/);

  // enqueue_research stores the idea on the project and keeps it, unchanged, in the run's configuration.
  const brief = `'{"name":"Clinic reminders","sectors":["Open to any industry"],"models":["Open to possibilities"],"geography":"United Kingdom","context":"","discovery_mode":"verify","language":"en","idea":{"title":"Reminders for clinics","buyer":"Clinic owners","pain":"No-shows cost clinics money every week","offer":"SMS reminders","price_hint":"$49/month"}}'::jsonb`;
  const run = sql(`select public.enqueue_research('${user}', ${brief}, '{}'::jsonb, gen_random_uuid())`);
  assert.equal(sql(`select p.idea ->> 'title' || ' / ' || p.discovery_mode from public.research_projects p join public.research_runs r on r.project_id = p.id where r.id = '${run}'`), "Reminders for clinics / verify");
  assert.equal(sql(`select configuration -> 'brief' -> 'idea' ->> 'price_hint' from public.research_runs where id = '${run}'`), "$49/month");
  assert.equal(sql(`select runs_used from public.research_dev_access where user_id = '${user}'`), "1", "a verify run uses one run slot (owner decision D2)");
  // A verify brief without an idea never reaches the table.
  assert.match(sqlError(() => sql(`select public.enqueue_research('${user}', '{"name":"x","sectors":["Healthcare"],"models":["B2B subscription"],"geography":"Japan","discovery_mode":"verify"}'::jsonb, '{}'::jsonb, gen_random_uuid())`)), /research_projects_idea_check|RUN_ALREADY_ACTIVE/);

  // Lifecycle events: run_started with mode verify, verify_started, and run_finished with mode verify.
  const events = kind => JSON.parse(sql(`select coalesce(json_agg(props order by created_at), '[]') from public.product_events where event = '${kind}' and user_id = '${user}'`));
  assert.deepEqual(events("run_started"), [{ mode: "verify", language: "en" }]);
  assert.deepEqual(events("verify_started"), [{}]);
  sql(`update public.research_runs set status = 'running' where id = '${run}'`);
  sql(`update public.research_runs set status = 'failed', error_code = 'INSUFFICIENT_EVIDENCE', completed_at = now() where id = '${run}'`);
  assert.deepEqual(events("run_finished"), [{ status: "failed", error_code: "INSUFFICIENT_EVIDENCE", opportunities: 0, mode: "verify" }]);
  for (const kind of ["run_started", "verify_started", "run_finished"]) for (const props of events(kind)) assert.ok(eventProps(kind, props), `${kind}: ${JSON.stringify(props)}`);

  // Discovery runs record no verify_started.
  const discovery = sql(`select public.enqueue_research('${user}', '{"name":"d","sectors":["Healthcare"],"models":["B2B subscription"],"geography":"Japan","discovery_mode":"market","language":"en"}'::jsonb, '{}'::jsonb, gen_random_uuid())`);
  assert.ok(discovery);
  assert.equal(events("verify_started").length, 1);
});
