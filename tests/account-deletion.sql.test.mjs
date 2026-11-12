// Runs every migration against a throwaway PostgreSQL database and checks WP-25's account deletion: the founder must
// stop active research first; usage rows are kept, detached (D6); deleting the auth user removes every founder table;
// product events stay without the user; and the same address cannot collect a second sign-up grant for 12 months.
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

test("deleting an account removes the founder's data, keeps usage detached, and blocks a second sign-up grant", { skip }, async t => {
  const name = `vl_account_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  const fails = (query, pattern, message) => assert.throws(() => sql(query), error => pattern.test(String(error.stderr ?? error.message)), message);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('Founder+vl@Example.com', now()) returning id`);
  const other = sql(`insert into auth.users (email, email_confirmed_at) values ('other@example.com', now()) returning id`);
  assert.equal(sql(`select count(*) from public.research_dev_access where user_id = '${user}' and source = 'signup'`), "1", "the sign-up grant");
  const seed = owner => {
    sql(`insert into public.founder_profiles (user_id) values ('${owner}') on conflict do nothing`);
    const project = sql(`insert into public.research_projects (user_id, name, sector, model, geography) values ('${owner}', 'p', 's', 'm', 'g') returning id`);
    const run = sql(`insert into public.research_runs (user_id, project_id, status) values ('${owner}', '${project}', 'completed') returning id`);
    const opportunity = sql(`insert into public.opportunities (user_id, run_id, title, score, payload) values ('${owner}', '${run}', 't', 50, '{}') returning id`);
    sql(`insert into public.research_usage (run_id, user_id, stage_key, provider, model, status, reserved_usd, estimated_usd, pricing) values ('${run}', '${owner}', 'discovery', 'p', 'm', 'completed', 0.02, 0.0125, '{}')`);
    sql(`insert into public.saved_opportunities (user_id, opportunity_id) values ('${owner}', '${opportunity}')`);
    sql(`insert into public.product_events (user_id, event) values ('${owner}', 'task_completed')`);
    return { project, run, opportunity };
  };
  const mine = seed(user);
  seed(other);
  const as = (id, query) => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`);

  // Not while research is still running.
  sql(`update public.research_runs set status = 'running' where id = '${mine.run}'`);
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; select public.prepare_account_deletion(); commit;`, /RUN_ACTIVE/);
  sql(`update public.research_runs set status = 'completed' where id = '${mine.run}'`);
  fails(`begin; set local role anon; select public.prepare_account_deletion(); commit;`, /permission denied/);

  as(user, `select public.prepare_account_deletion()`);
  assert.equal(sql(`select count(*) || '|' || bool_and(detached_at is not null) from public.research_usage where run_id is null and user_id is null`), "1|true", "usage detached (D6)");
  assert.equal(sql(`select count(*) from public.deleted_signup_grants where email_hash = public.signup_email_hash('founder@example.com')`), "1", "the normalised address is hashed (case and +tag ignored)");
  assert.equal(sql(`select count(*) from public.deleted_signup_grants where email_hash like '%@%'`), "0", "no address is stored");

  // What the admin API's deleteUser does: delete the auth user. Everything of the founder's goes; nobody else's does.
  sql(`delete from auth.users where id = '${user}'`);
  const tables = ["founder_profiles", "research_projects", "research_runs", "opportunities", "saved_opportunities", "research_dev_access", "research_stages", "research_evidence", "research_usage", "report_feedback", "validation_sprints", "validation_tasks", "weekly_emails"];
  for (const table of tables) assert.equal(sql(`select count(*) from public.${table} where user_id = '${user}'`), "0", table);
  assert.equal(sql(`select count(*) from public.research_usage`), "2", "the other founder's usage and the detached row remain");
  // The founder's own events (one recorded here, plus the run events the database records) stay, with no user.
  assert.equal(sql(`select count(*) from public.product_events where user_id = '${user}'`), "0");
  assert.equal(sql(`select count(*) from public.product_events where user_id is null and event = 'task_completed'`), "1", "events stay, without the deleted user");
  assert.equal(sql(`select count(*) from public.product_events where user_id = '${other}' and event = 'task_completed'`), "1");
  assert.equal(sql(`select count(*) from public.opportunities where user_id = '${other}'`), "1");

  // Signing up again with the same address (any case or +tag) gets no new grant; a different address does.
  const again = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  assert.equal(sql(`select count(*) from public.research_dev_access where user_id = '${again}'`), "0", "no second grant");
  const fresh = sql(`insert into auth.users (email, email_confirmed_at) values ('new@example.com', now()) returning id`);
  assert.equal(sql(`select count(*) from public.research_dev_access where user_id = '${fresh}'`), "1");
  // After 12 months the record no longer counts.
  sql(`update public.deleted_signup_grants set deleted_at = now() - interval '13 months'`);
  sql(`delete from auth.users where id = '${again}'`);
  const later = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  assert.equal(sql(`select count(*) from public.research_dev_access where user_id = '${later}'`), "1", "granted again after 12 months");

  assert.equal(sql(`select (relrowsecurity and relforcerowsecurity)::text from pg_class where relname = 'deleted_signup_grants'`), "true");
  assert.equal(sql(`select count(*) from information_schema.role_table_grants where table_name = 'deleted_signup_grants' and grantee in ('anon', 'authenticated')`), "0");
});
