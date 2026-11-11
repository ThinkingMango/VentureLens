// Runs every migration in supabase/migrations against a throwaway PostgreSQL database, then exercises the run-quota
// functions for real: enqueue_research, the release_failed_research_run trigger and retry_research.
//
// Needs `psql` and TEST_DATABASE_URL pointing at a PostgreSQL 15+ server where the user may create databases, e.g.
//   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres pnpm test:sql
// A fresh database is created for the run and dropped afterwards; the target database itself is never modified.
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
function psql(url, args) {
  return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-A", "-t", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function sqlError(fn) {
  try { fn(); } catch (error) { return String(error.stderr ?? error.message); }
  return "";
}

test("failed-run refunds are capped per account, except for our failures and runs that cost nothing", { skip }, async t => {
  const name = `vl_quota_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);

  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) {
    psql(db, ["-f", path(`supabase/migrations/${file}`)]);
  }

  // Confirming an address grants 10 free runs (zz_grant_signup_research_run, 20261111140000).
  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const grant = () => sql(`select runs_used || '/' || max_runs || ' refunded ' || runs_refunded || '/' || max_refunds from public.research_dev_access where user_id = '${user}'`);
  assert.equal(grant(), "0/10 refunded 0/3");
  // The ledger below is easiest to follow with a single run: narrow this account to one, as an operator could.
  sql(`update public.research_dev_access set max_runs = 1 where user_id = '${user}'`);
  assert.equal(grant(), "0/1 refunded 0/3");

  const brief = `'{"name":"Agency research","sector":"Professional services","model":"B2B subscription","geography":"United States"}'::jsonb`;
  const start = () => sql(`select public.enqueue_research('${user}', ${brief}, '{}'::jsonb, gen_random_uuid())`);
  const spend = (run, usd) => sql(`insert into public.research_usage (run_id, user_id, stage_key, provider, model, status, estimated_usd, reserved_usd, pricing) values ('${run}', '${user}', 'discovery', 'dashscope-beijing', 'qwen3.8-flash', 'completed', ${usd}, ${usd}, '{}')`);
  const fail = (run, code) => {
    sql(`update public.research_runs set status = 'running' where id = '${run}'`);
    sql(`update public.research_runs set status = 'failed', error_code = '${code}', completed_at = now() where id = '${run}'`);
    return sql(`select quota_released from public.research_runs where id = '${run}'`) === "t";
  };

  // Content failures that spent money are returned while the allowance lasts...
  for (let i = 1; i <= 3; i++) {
    const run = start();
    spend(run, 0.04);
    assert.equal(fail(run, i === 2 ? "INVALID_OUTPUT" : "INSUFFICIENT_EVIDENCE"), true, `refund ${i} is returned`);
    assert.equal(grant(), `0/1 refunded ${i}/3`);
  }
  // ...and the next one keeps its slot, so the account cannot start another paid run.
  const capped = start();
  spend(capped, 0.04);
  assert.equal(fail(capped, "INVALID_OUTPUT"), false, "the fourth paid content failure is not returned");
  assert.equal(grant(), "1/1 refunded 3/3");
  assert.match(sqlError(start), /DEV_QUOTA_EXCEEDED/);

  // Retrying the run that kept its slot (INVALID_OUTPUT is retryable) is free: retry_research takes no second slot.
  assert.equal(sql(`select public.retry_research('${capped}', '${user}')`), "t");
  assert.equal(grant(), "1/1 refunded 3/3");
  // If that retry then fails because of a provider outage, the slot comes back without using the allowance.
  assert.equal(fail(capped, "TRANSIENT_PROVIDER"), true);
  assert.equal(grant(), "0/1 refunded 3/3");

  // Our failures are always returned, even after a paid request and with the allowance used up.
  for (const code of ["DISPATCH_FAILED", "WORKFLOW_INTERRUPTED", "TRANSIENT_PROVIDER", "PROVIDER_CONFIGURATION", "PROVIDER_CREDITS_REQUIRED"]) {
    const run = start();
    spend(run, 0.04);
    assert.equal(fail(run, code), true, `${code} is always returned`);
    assert.equal(grant(), "0/1 refunded 3/3");
  }
  // A run that stopped before any paid request cost nothing and is always returned.
  const free = start();
  assert.equal(fail(free, "BUDGET_EXCEEDED"), true);
  // A request whose cost is still unknown counts at its full reservation, as reserve_research_usage counts it.
  const unknown = start();
  sql(`insert into public.research_usage (run_id, user_id, stage_key, provider, model, status, reserved_usd, pricing) values ('${unknown}', '${user}', 'retrieval:c1', 'google-gemini', 'gemini-3.5-flash-lite', 'unknown', 0.02, '{}')`);
  assert.equal(fail(unknown, "RETRIEVAL_UNAVAILABLE"), false);
  assert.equal(grant(), "1/1 refunded 3/3");

  // An operator can raise one account's allowance; a completed run is never refunded.
  sql(`update public.research_dev_access set max_refunds = 4, runs_used = 0 where user_id = '${user}'`);
  const raised = start();
  spend(raised, 0.04);
  assert.equal(fail(raised, "INSUFFICIENT_EVIDENCE"), true);
  assert.equal(grant(), "0/1 refunded 4/4");

  // Founders can read their allowance but never change it.
  assert.equal(sql(`set role authenticated; set request.jwt.claim.sub = '${user}'; select max_refunds - runs_refunded from public.research_dev_access`), "0");
  assert.match(sqlError(() => sql(`set role authenticated; set request.jwt.claim.sub = '${user}'; update public.research_dev_access set runs_refunded = 0`)), /permission denied/);
  assert.match(sqlError(() => sql(`set role authenticated; set request.jwt.claim.sub = '${user}'; update public.research_runs set quota_released = true`)), /permission denied/);
});
