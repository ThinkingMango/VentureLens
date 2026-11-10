// Runs every migration against a throwaway PostgreSQL database and checks public.product_events (spec WP-01 §4):
// founders cannot read or write it, its bounds hold, and run lifecycle events are recorded exactly once per transition,
// with props that pass the same validation as lib/events-core.ts.
//
// Needs `psql` and TEST_DATABASE_URL pointing at a PostgreSQL 15+ server where the user may create databases, e.g.
//   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm test:sql
// A fresh database is created for the run and dropped afterwards; the target database itself is never modified.
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

test("product events are private to the server, bounded, and record each run start and finish once", { skip }, async t => {
  const name = `vl_events_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) {
    psql(db, ["-f", path(`supabase/migrations/${file}`)]);
  }

  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const as = (role, query) => sql(`set role ${role}; set request.jwt.claim.sub = '${user}'; ${query}`);

  // Founders and anonymous visitors can neither read nor write events, not even their own.
  for (const role of ["authenticated", "anon"]) {
    assert.match(sqlError(() => as(role, "select count(*) from public.product_events")), /permission denied/, `${role} cannot read`);
    assert.match(sqlError(() => as(role, `insert into public.product_events (user_id, event) values ('${user}', 'task_completed')`)), /permission denied/, `${role} cannot insert`);
  }

  // The service role records and reads events, but cannot edit or delete them.
  const id = as("service_role", `insert into public.product_events (user_id, event, props) values ('${user}', 'report_rated', '{"rating":4}') returning id`);
  assert.equal(as("service_role", `select props->>'rating' from public.product_events where id = '${id}'`), "4");
  assert.match(sqlError(() => as("service_role", `update public.product_events set event = 'x' where id = '${id}'`)), /permission denied/);
  assert.match(sqlError(() => as("service_role", `delete from public.product_events where id = '${id}'`)), /permission denied/);

  // Bounds: props are an object of at most 8 KB, and event names are lower-case identifiers.
  assert.match(sqlError(() => sql(`insert into public.product_events (event, props) values ('task_completed', jsonb_build_object('x', repeat('a', 8200)))`)), /product_events_props_check/);
  assert.match(sqlError(() => sql(`insert into public.product_events (event, props) values ('task_completed', '[]')`)), /product_events_props_check/);
  assert.match(sqlError(() => sql(`insert into public.product_events (event) values ('Run Started')`)), /product_events_event_check/);

  // Lifecycle: enqueue_research records run_started; each finish records run_finished once.
  const events = kind => JSON.parse(sql(`select coalesce(json_agg(props order by created_at), '[]') from public.product_events where event = '${kind}' and user_id = '${user}'`));
  sql(`update public.research_dev_access set max_runs = 5 where user_id = '${user}'`);
  const brief = `'{"name":"Agency research","sectors":["Professional services"],"models":["B2B subscription"],"geography":"United States","discovery_mode":"market","language":"zh-Hant"}'::jsonb`;
  const run = sql(`select public.enqueue_research('${user}', ${brief}, '{}'::jsonb, gen_random_uuid())`);
  assert.deepEqual(events("run_started"), [{ mode: "market", language: "zh-Hant" }]);

  sql(`update public.research_runs set status = 'running', workflow_id = 'wf-1', started_at = now() where id = '${run}'`);
  assert.deepEqual(events("run_finished"), [], "running is not a finish");
  sql(`update public.research_runs set status = 'failed', error_code = 'INVALID_OUTPUT', completed_at = now() where id = '${run}'`);
  sql(`update public.research_runs set stage = 'failed' where id = '${run}'`);
  assert.deepEqual(events("run_finished"), [{ status: "failed", error_code: "INVALID_OUTPUT", opportunities: 0, mode: "market" }], "one event per transition, not per update");

  // A retried attempt (INVALID_OUTPUT is retryable) that completes through finish_research records its own finish, counting saved opportunities.
  assert.equal(sql(`select public.retry_research('${run}', '${user}')`), "t");
  sql(`update public.research_runs set status = 'running', workflow_id = 'wf-2' where id = '${run}'`);
  sql(`insert into public.research_evidence (run_id, user_id, source_key, candidate_id, url, title, excerpt) values ('${run}', '${user}', 'c1-s1', 'c1', 'https://example.org/a', 'A', 'Excerpt')`);
  const opportunity = `{"id":"${sql("select gen_random_uuid()")}","title":"Supported idea","score":61}`;
  sql(`select public.finish_research('${run}', '${user}', 'wf-2', '{"summary":"s","opportunities":[${opportunity}]}'::jsonb)`);
  const finished = events("run_finished");
  assert.deepEqual(finished.at(-1), { status: "completed", error_code: null, opportunities: 1, mode: "market" });
  assert.equal(events("run_started").length, 1, "a retry is not a new start");

  // Everything the database records passes the same validation as events written by the server code.
  for (const props of events("run_started")) assert.ok(eventProps("run_started", props), JSON.stringify(props));
  for (const props of finished) assert.ok(eventProps("run_finished", props), JSON.stringify(props));

  // Recording an event never blocks a run: with inserts into product_events failing, the run still finishes.
  sql(`alter table public.product_events add constraint reject_all check (false) not valid`);
  const second = sql(`select public.enqueue_research('${user}', ${brief}, '{}'::jsonb, gen_random_uuid())`);
  sql(`update public.research_runs set status = 'failed', error_code = 'DISPATCH_FAILED', completed_at = now() where id = '${second}'`);
  assert.equal(sql(`select status from public.research_runs where id = '${second}'`), "failed");
  sql(`alter table public.product_events drop constraint reject_all`);

  // Deleting the account keeps the anonymous events and clears their user id.
  sql(`delete from auth.users where id = '${user}'`);
  assert.equal(sql(`select count(*) from public.product_events where user_id is not null`), "0");
  assert.ok(Number(sql(`select count(*) from public.product_events`)) >= 4);
});
