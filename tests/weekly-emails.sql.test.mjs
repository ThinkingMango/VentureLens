// Runs every migration against a throwaway PostgreSQL database and checks WP-17: weekly emails are on by default, the
// founder can change only their own choice, and the once-a-week record is invisible and unwritable to founders.
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

test("weekly emails are on by default, each founder sets only their own, and the weekly record is service-only", { skip }, async t => {
  const name = `vl_weekly_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  const fails = (query, pattern, message) => assert.throws(() => sql(query), error => pattern.test(String(error.stderr ?? error.message)), message);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const other = sql(`insert into auth.users (email, email_confirmed_at) values ('other@example.com', now()) returning id`);
  for (const id of [user, other]) sql(`insert into public.founder_profiles (user_id) values ('${id}') on conflict (user_id) do nothing`);
  assert.equal(sql(`select string_agg(notify_weekly::text, ',') from public.founder_profiles`), "true,true", "on by default");

  const as = (id, query) => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`);
  as(user, `update public.founder_profiles set notify_weekly = false where user_id = auth.uid()`);
  as(other, `update public.founder_profiles set notify_weekly = true where user_id = '${user}'`);
  assert.equal(sql(`select notify_weekly from public.founder_profiles where user_id = '${user}'`), "f", "another founder cannot turn it back on");

  assert.equal(sql(`select (relrowsecurity and relforcerowsecurity)::text from pg_class where relname = 'weekly_emails'`), "true");
  assert.equal(sql(`select count(*) from information_schema.role_table_grants where table_name = 'weekly_emails' and grantee in ('anon', 'authenticated')`), "0");
  sql(`insert into public.weekly_emails (user_id, week) values ('${user}', '2026-11-16')`);
  fails(`insert into public.weekly_emails (user_id, week) values ('${user}', '2026-11-16')`, /duplicate key/, "one per founder per week");
  fails(`insert into public.weekly_emails (user_id, week) values ('${user}', '2026-11-18')`, /check constraint/, "weeks start on Monday");
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; select count(*) from public.weekly_emails; commit;`, /permission denied/);
  sql(`delete from auth.users where id = '${user}'`);
  assert.equal(sql(`select count(*) from public.weekly_emails`), "0", "deleted with the account");
});
