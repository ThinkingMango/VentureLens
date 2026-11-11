// Runs every migration against a throwaway PostgreSQL database and checks cancel_research_run: a founder can stop only
// their own active run; it ends as failed/CANCELLED, which frees the active-run slot, refunds it only by the existing
// refund rules, blocks the workflow's next paid request and its report, records run_finished once, and is deletable.
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

test("a founder stops only their own active run, under the existing refund and lock-out rules", { skip }, async t => {
  const name = `vl_cancel_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const other = sql(`insert into auth.users (email, email_confirmed_at) values ('other@example.com', now()) returning id`);
  sql(`update public.research_dev_access set max_runs = 10, runs_used = 2, runs_refunded = 0, max_refunds = 3, expires_at = now() + interval '30 days' where user_id = '${user}'`);
  const seedRun = (owner, status, { spent = 0, workflow = null } = {}) => {
    const project = sql(`insert into public.research_projects (user_id, name, sector, model, geography) values ('${owner}', 'brief', 's', 'm', 'g') returning id`);
    const run = sql(`insert into public.research_runs (user_id, project_id, status, workflow_id) values ('${owner}', '${project}', '${status}', ${workflow ? `'${workflow}'` : "null"}) returning id`);
    if (spent) sql(`insert into public.research_usage (run_id, user_id, stage_key, provider, model, status, reserved_usd, estimated_usd, pricing) values ('${run}', '${owner}', 'discovery', 'p', 'm', 'completed', ${spent}, ${spent}, '{}')`);
    return run;
  };
  const as = (id, query) => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`);
  const asFails = (id, query, pattern, message) => assert.throws(() => as(id, query), error => pattern.test(String(error.stderr ?? error.message)), message);
  const ledger = () => sql(`select runs_used || '/' || runs_refunded from public.research_dev_access where user_id = '${user}'`);

  assert.equal(sql(`select string_agg(r.rolname, ',') from pg_proc p, aclexplode(p.proacl) a join pg_roles r on r.oid = a.grantee where p.proname = 'cancel_research_run' and a.privilege_type = 'EXECUTE' and r.rolname in ('anon', 'authenticated', 'public')`), "authenticated", "callable by founders, not anon");

  // A pending run that spent nothing: stopped, slot freed, refunded without using the refund allowance.
  const pending = seedRun(user, "pending");
  assert.equal(as(user, `select coalesce(public.cancel_research_run('${pending}'), 'none')`), "none", "no workflow yet");
  assert.equal(sql(`select status || '|' || error_code || '|' || quota_released || '|' || (completed_at is not null) from public.research_runs where id = '${pending}'`), "failed|CANCELLED|true|true");
  assert.equal(ledger(), "1/0", "a run that spent nothing is always returned");
  assert.equal(sql(`select count(*) from public.product_events where event = 'run_finished' and user_id = '${user}'`), "1", "run_finished is recorded once");

  // A running run that already spent: returns its workflow id; the refund uses the allowance.
  const running = seedRun(user, "running", { spent: 0.01, workflow: "wrun_123" });
  assert.equal(as(user, `select public.cancel_research_run('${running}')`), "wrun_123", "returns the workflow to stop");
  assert.equal(ledger(), "0/1", "a run that spent counts against the refund allowance");
  // The workflow is locked out: no new paid request, no report, no retry.
  assert.throws(() => sql(`select public.reserve_research_usage('${running}', '${user}', 'evaluation', 'm', 0.01, '{}')`), /RUN_NOT_ACTIVE/, "no new paid request");
  assert.throws(() => sql(`select public.finish_research('${running}', '${user}', 'wrun_123', '{}')`), /RUN_NOT_ACTIVE|RUN_NOT_FOUND|not active/i, "no report");
  assert.equal(sql(`select public.retry_research('${running}', '${user}')`), "f", "a cancelled run is not retried");
  // Cancelling again, or a finished run, is refused; so is another founder's run.
  asFails(user, `select public.cancel_research_run('${running}')`, /RUN_NOT_ACTIVE/, "already stopped");
  const theirs = seedRun(other, "running");
  asFails(user, `select public.cancel_research_run('${theirs}')`, /RUN_NOT_FOUND/, "another founder's run");
  assert.equal(sql(`select status from public.research_runs where id = '${theirs}'`), "running");
  assert.throws(() => sql(`begin; set local role anon; select public.cancel_research_run('${theirs}'); commit;`), /permission denied/);

  // The slot is free again and the stopped run can be deleted.
  assert.equal(sql(`select count(*) from public.research_runs where user_id = '${user}' and status in ('pending', 'running')`), "0");
  as(user, `select public.delete_research_run('${running}')`);
  assert.equal(sql(`select count(*) from public.research_runs where id = '${running}'`), "0", "deleted");
});
