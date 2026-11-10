// Runs every migration against a throwaway PostgreSQL database and checks WP-04's idea-memory marker:
// founder_profiles.history_reset_at starts empty for existing profiles, a founder can set their own, and nobody else's.
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

test("the idea-memory marker starts empty and only its owner can set it", { skip }, async t => {
  const name = `vl_memory_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  const files = readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort();
  for (const file of files.filter(f => f < "20261110150000")) psql(db, ["-f", path(`supabase/migrations/${file}`)]);
  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const other = sql(`insert into auth.users (email, email_confirmed_at) values ('other@example.com', now()) returning id`);
  for (const file of files.filter(f => f >= "20261110150000")) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  assert.equal(sql(`select data_type || ' ' || is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'founder_profiles' and column_name = 'history_reset_at'`), "timestamp with time zone YES");
  assert.equal(sql(`select count(*) from public.founder_profiles where history_reset_at is null`), "2", "existing profiles start with no marker");

  const as = (id, query) => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`);
  as(other, `update public.founder_profiles set history_reset_at = now() where user_id = '${user}'`);
  assert.equal(sql(`select history_reset_at is null from public.founder_profiles where user_id = '${user}'`), "t", "another founder cannot clear it");
  as(user, `update public.founder_profiles set history_reset_at = now() where user_id = '${user}'`);
  assert.equal(sql(`select history_reset_at is not null from public.founder_profiles where user_id = '${user}'`), "t", "the founder can");
});
