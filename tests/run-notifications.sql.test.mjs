// Runs every migration against a throwaway PostgreSQL database and checks WP-08's notification columns: existing
// founders are opted in, a founder can change only their own preference, and only the service role can mark a run
// as notified, once.
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

test("founders start opted in, change only their own preference, and only the service role marks a run notified", { skip }, async t => {
  const name = `vl_notify_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  const files = readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort();
  for (const file of files.filter(f => f < "20261110180000")) psql(db, ["-f", path(`supabase/migrations/${file}`)]);
  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const other = sql(`insert into auth.users (email, email_confirmed_at) values ('other@example.com', now()) returning id`);
  const project = sql(`insert into public.research_projects (user_id, name, sector, model, geography) values ('${user}', 'p', 's', 'm', 'g') returning id`);
  const run = sql(`insert into public.research_runs (user_id, project_id, status) values ('${user}', '${project}', 'completed') returning id`);
  for (const file of files.filter(f => f >= "20261110180000")) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  assert.equal(sql(`select count(*) from public.founder_profiles where notify_on_complete`), "2", "existing founders are opted in");
  assert.equal(sql(`select notified_at is null from public.research_runs where id = '${run}'`), "t", "existing runs are not marked notified");

  const as = (role, id, query) => sql(`begin; set local role ${role}; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`);
  as("authenticated", other, `update public.founder_profiles set notify_on_complete = false where user_id = '${user}'`);
  assert.equal(sql(`select notify_on_complete from public.founder_profiles where user_id = '${user}'`), "t", "another founder cannot turn it off");
  as("authenticated", user, `update public.founder_profiles set notify_on_complete = false where user_id = '${user}'`);
  assert.equal(sql(`select notify_on_complete from public.founder_profiles where user_id = '${user}'`), "f", "the founder can");

  assert.throws(() => as("authenticated", user, `update public.research_runs set notified_at = now() where id = '${run}'`), /permission denied/, "founders cannot mark runs notified");
  // The workflow's claim (made with the service role, which bypasses RLS; the test stub does not copy Supabase's default
  // table grants for it, so the owner runs it here): only the first update from null returns the row.
  const claim = `update public.research_runs set notified_at = now() where id = '${run}' and notified_at is null returning id`;
  assert.equal(sql(claim), run);
  assert.equal(sql(claim), "", "a second claim finds nothing to send");
});
