// Runs every migration against a throwaway PostgreSQL database and checks WP-12's library functions: a founder can
// archive and restore only their own opportunities, and delete only their own finished runs, which removes everything
// made from the run while its usage rows are kept, detached from the run and the founder (decision D6).
//
// Needs `psql` and TEST_DATABASE_URL pointing at a PostgreSQL 15+ server where the user may create databases, e.g.
//   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm test:sql
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const server = process.env.TEST_DATABASE_URL;
const hasPsql = (() => { try { execFileSync("psql", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } })();
const skip = !server ? "set TEST_DATABASE_URL to run the SQL tests" : !hasPsql ? "psql is not installed" : false;
const root = new URL("../", import.meta.url);
const path = relative => fileURLToPath(new URL(relative, root));
const psql = (url, args) => execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-A", "-t", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

test("archive and delete act only on the founder's own rows; deleting a run cascades and detaches its usage", { skip }, async t => {
  const name = `vl_library_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const other = sql(`insert into auth.users (email, email_confirmed_at) values ('other@example.com', now()) returning id`);
  sql(`update public.research_dev_access set max_runs = 3, runs_used = 2, expires_at = now() + interval '30 days' where user_id = '${user}'`);
  const project = owner => sql(`insert into public.research_projects (user_id, name, sector, model, geography) values ('${owner}', 'brief', 's', 'm', 'g') returning id`);
  const seedRun = (owner, status, projectId = project(owner)) => {
    const run = sql(`insert into public.research_runs (user_id, project_id, status) values ('${owner}', '${projectId}', '${status}') returning id`);
    const opportunity = sql(`insert into public.opportunities (user_id, run_id, title, score, payload) values ('${owner}', '${run}', 't', 50, '{}') returning id`);
    sql(`insert into public.research_usage (run_id, user_id, stage_key, provider, model, status, reserved_usd, estimated_usd, pricing) values ('${run}', '${owner}', 'discovery', 'p', 'm', 'completed', 0.02, 0.0125, '{}')`);
    sql(`insert into public.research_stages (run_id, user_id, stage_key, output) values ('${run}', '${owner}', 'discovery', '{}')`);
    sql(`insert into public.research_evidence (run_id, user_id, source_key, candidate_id, url, title, excerpt) values ('${run}', '${owner}', 's1', 'c1', 'https://e.org', 'T', 'x')`);
    return { run, opportunity };
  };
  const as = (id, query) => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`);
  const asFails = (id, query, pattern, message) => assert.throws(() => as(id, query), error => pattern.test(String(error.stderr ?? error.message)), message);

  // Founders still cannot write opportunities or runs directly.
  const mine = seedRun(user, "completed");
  const theirs = seedRun(other, "completed");
  asFails(user, `update public.opportunities set archived_at = now() where id = '${mine.opportunity}'`, /permission denied/, "no direct update on opportunities");
  asFails(user, `delete from public.research_runs where id = '${mine.run}'`, /permission denied/, "no direct delete on runs");
  assert.equal(sql(`select string_agg(r.rolname, ',' order by r.rolname) from pg_proc p, aclexplode(p.proacl) a join pg_roles r on r.oid = a.grantee where p.proname in ('set_opportunity_archived', 'delete_research_run') and a.privilege_type = 'EXECUTE' and r.rolname in ('anon', 'authenticated', 'public')`), "authenticated,authenticated", "callable by founders, not anon");

  // Archive, archive again (keeps the first time), restore; another founder's opportunity is "not found".
  const first = as(user, `select public.set_opportunity_archived('${mine.opportunity}', true)`);
  assert.ok(first, "returns the archive time");
  assert.equal(as(user, `select public.set_opportunity_archived('${mine.opportunity}', true)`), first, "archiving twice keeps the first time");
  assert.equal(as(user, `select archived_at is not null from public.opportunities where id = '${mine.opportunity}'`), "t");
  assert.equal(as(user, `select coalesce(public.set_opportunity_archived('${mine.opportunity}', false)::text, 'null')`), "null", "restored");
  asFails(user, `select public.set_opportunity_archived('${theirs.opportunity}', true)`, /OPPORTUNITY_NOT_FOUND/, "another founder's opportunity");
  assert.equal(sql(`select archived_at is null from public.opportunities where id = '${theirs.opportunity}'`), "t");
  assert.throws(() => sql(`begin; set local role anon; select public.set_opportunity_archived('${mine.opportunity}', true); commit;`), /permission denied/);

  // Deleting refuses another founder's run and an active run.
  asFails(user, `select public.delete_research_run('${theirs.run}')`, /RUN_NOT_FOUND/, "another founder's run");
  for (const status of ["pending", "running"]) {
    const active = seedRun(user, status);
    asFails(user, `select public.delete_research_run('${active.run}')`, /RUN_ACTIVE/, `a ${status} run`);
    assert.equal(sql(`select count(*) from public.research_runs where id = '${active.run}'`), "1");
    sql(`update public.research_runs set status = 'failed' where id = '${active.run}'`);
  }

  // Everything made from the run goes with it: saves, flags, sprints and tasks too.
  sql(`insert into public.saved_opportunities (user_id, opportunity_id) values ('${user}', '${mine.opportunity}')`);
  sql(`insert into public.report_feedback (user_id, run_id, opportunity_id, target, target_key, reason) values ('${user}', '${mine.run}', '${mine.opportunity}', 'claim', 'claim-0', 'wrong')`);
  const sprint = as(user, `select public.start_validation_sprint('${mine.opportunity}', 7, array['Write it down'])`);
  const shared = project(user);
  const sibling = seedRun(user, "completed", shared);
  const lastOfShared = seedRun(user, "failed", shared);
  const before = sql(`select runs_used || '/' || runs_refunded from public.research_dev_access where user_id = '${user}'`);
  as(user, `select public.delete_research_run('${mine.run}')`);
  for (const [table, column, id] of [["research_runs", "id", mine.run], ["opportunities", "run_id", mine.run], ["research_stages", "run_id", mine.run], ["research_evidence", "run_id", mine.run], ["saved_opportunities", "opportunity_id", mine.opportunity], ["report_feedback", "run_id", mine.run], ["validation_sprints", "id", sprint], ["validation_tasks", "sprint_id", sprint]]) {
    assert.equal(sql(`select count(*) from public.${table} where ${column} = '${id}'`), "0", `${table} cascades`);
  }
  assert.equal(sql(`select count(*) from public.research_projects where user_id = '${user}' and id not in (select project_id from public.research_runs)`), "0", "the run's own brief record goes too");
  assert.equal(sql(`select runs_used || '/' || runs_refunded from public.research_dev_access where user_id = '${user}'`), before, "deleting never hands a run slot back");

  // D6: the usage row is kept for cost accounting, with nothing linking it to the run or the founder.
  assert.equal(sql(`select count(*) || '|' || bool_and(user_id is null) || '|' || bool_and(detached_at is not null) || '|' || sum(estimated_usd) from public.research_usage where run_id is null`), "1|true|true|0.0125");
  assert.equal(as(user, `select count(*) from public.research_usage where run_id is null`), "0", "founders cannot see detached rows");
  assert.throws(() => sql(`insert into public.research_usage (run_id, user_id, stage_key, provider, model, reserved_usd, pricing) values (null, '${user}', 'x', 'p', 'm', 0.01, '{}')`), /research_usage_attached/, "a row is attached to both or neither");

  // A brief shared with another run stays until its last run is deleted.
  as(user, `select public.delete_research_run('${sibling.run}')`);
  assert.equal(sql(`select count(*) from public.research_projects where id = '${shared}'`), "1", "the brief stays while another run uses it");
  as(user, `select public.delete_research_run('${lastOfShared.run}')`);
  assert.equal(sql(`select count(*) from public.research_projects where id = '${shared}'`), "0");
  asFails(user, `select public.delete_research_run('${mine.run}')`, /RUN_NOT_FOUND/, "deleting twice is 'not found'");

  // The other founder's run, opportunity and usage are untouched.
  assert.equal(sql(`select count(*) from public.research_usage where user_id = '${other}'`), "1");
  assert.equal(sql(`select count(*) from public.opportunities where user_id = '${other}'`), "1");

  // Deleting an account still deletes its attached usage rows (privacy notice); only founder-deleted runs are kept.
  sql(`delete from auth.users where id = '${other}'`);
  assert.equal(sql(`select count(*) from public.research_usage where user_id = '${other}'`), "0", "account deletion removes usage");
  assert.equal(sql(`select count(*) from public.research_usage where run_id is null`), "3", "the detached rows of deleted runs stay");
});
