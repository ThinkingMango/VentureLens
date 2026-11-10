// Runs every migration against a throwaway PostgreSQL database and checks WP-02's founder profile v2 columns:
// existing profiles get the "not answered" defaults, each column's length bound holds, languages hold at most five
// non-null names, and row-level security still limits founders to their own profile.
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
function sqlError(fn) {
  try { fn(); } catch (error) { return String(error.stderr ?? error.message); }
  return "";
}

test("profile v2 columns default to 'not answered', keep their bounds, and stay private to each founder", { skip }, async t => {
  const name = `vl_profile_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  const files = readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort();
  const before = files.filter(f => f < "20261110140000");
  for (const file of before) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  // A profile saved before the migration...
  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const other = sql(`insert into auth.users (email, email_confirmed_at) values ('other@example.com', now()) returning id`);
  sql(`update public.founder_profiles set name = 'Ada', skills = 'Operations', onboarding_completed = true where user_id = '${user}'`);
  for (const file of files.filter(f => f >= "20261110140000")) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  // ...is unchanged and reads every new field as "not answered".
  assert.equal(
    sql(`select concat_ws('|', name, skills, onboarding_completed, interests, pain_points, revenue_target, strength, distribution, cardinality(languages), exclusions, risk_tolerance) from public.founder_profiles where user_id = '${user}'`),
    "Ada|Operations|t||||||0||",
  );

  // Values within the bounds are stored as given.
  sql(`update public.founder_profiles set interests = repeat('i', 500), pain_points = repeat('p', 500), distribution = repeat('d', 500), exclusions = repeat('e', 300), revenue_target = '$1–5k/mo', strength = 'Sales & marketing', risk_tolerance = 'Medium', languages = '{English,Cantonese,Japanese,Korean,Thai}' where user_id = '${user}'`);
  assert.equal(sql(`select array_to_string(languages, ',') || ' ' || risk_tolerance from public.founder_profiles where user_id = '${user}'`), "English,Cantonese,Japanese,Korean,Thai Medium");

  // Each bound is enforced.
  const update = set => sqlError(() => sql(`update public.founder_profiles set ${set} where user_id = '${user}'`));
  for (const [column, limit] of [["interests", 500], ["pain_points", 500], ["distribution", 500], ["exclusions", 300], ["revenue_target", 50], ["strength", 30], ["risk_tolerance", 20]]) {
    assert.match(update(`${column} = repeat('x', ${limit + 1})`), new RegExp(`founder_profiles_${column}_check`), column);
  }
  assert.match(update(`languages = '{a,b,c,d,e,f}'`), /founder_profiles_languages_check/, "at most five languages");
  assert.match(update(`languages = array['English', null]`), /founder_profiles_languages_check/, "no null entries");
  assert.match(update(`languages = array[repeat('x', 201)]`), /founder_profiles_languages_check/, "bounded total length");
  assert.match(update(`interests = null`), /null value in column "interests"/);

  // Row-level security still applies to the new columns: a founder reads and updates only their own row.
  const as = (id, query) => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`);
  assert.equal(as(other, `select count(*) from public.founder_profiles where user_id = '${user}'`), "0");
  as(other, `update public.founder_profiles set interests = 'hijacked' where user_id = '${user}'`);
  assert.notEqual(sql(`select interests from public.founder_profiles where user_id = '${user}'`), "hijacked");
  as(user, `update public.founder_profiles set interests = 'Climbing gyms' where user_id = '${user}'`);
  assert.equal(sql(`select interests from public.founder_profiles where user_id = '${user}'`), "Climbing gyms");
});
