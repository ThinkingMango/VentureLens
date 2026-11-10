// Runs every migration against a throwaway PostgreSQL database and checks WP-03's run focus in the database: existing
// briefs read as no angles and the switch off, the angle bounds hold, and enqueue_research stores angles and
// explore_new on the project while keeping the whole brief, unchanged, in the run's configuration.
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

test("run focus is stored on the project, bounded, and kept unchanged in the run configuration", { skip }, async t => {
  const name = `vl_focus_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  const files = readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort();
  for (const file of files.filter(f => f < "20261110160000")) psql(db, ["-f", path(`supabase/migrations/${file}`)]);
  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  sql(`update public.research_dev_access set max_runs = 5 where user_id = '${user}'`);
  // A brief saved before WP-03.
  sql(`insert into public.research_projects (user_id, name, sectors, models, geography) values ('${user}', 'Old brief', '{Healthcare}', '{B2B subscription}', 'Japan')`);
  for (const file of files.filter(f => f >= "20261110160000")) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  assert.equal(sql(`select cardinality(angles) || ' ' || explore_new from public.research_projects where name = 'Old brief'`), "0 false", "existing briefs: no angles, switch off");

  const project = angles => sql(`insert into public.research_projects (user_id, name, sectors, models, geography, angles) values ('${user}', 'P', '{Healthcare}', '{B2B subscription}', 'Japan', ${angles}) returning id`);
  project(`'{Privacy-first,Mobile-first,Remote-only,Sells to consumers,Local / in-person,Can launch in 30 days}'`);
  assert.match(sqlError(() => project(`'{a,b,c,d,e,f,g}'`)), /research_projects_angles_check/, "at most six");
  assert.match(sqlError(() => project(`array['Privacy-first', null]`)), /research_projects_angles_check/, "no nulls");
  assert.match(sqlError(() => project(`array[repeat('x', 301)]`)), /research_projects_angles_check/, "bounded length");

  // enqueue_research stores both on the project, and the configuration keeps the brief exactly as given.
  const brief = `'{"name":"Focused run","sectors":["Healthcare"],"models":["B2B subscription"],"geography":"Japan","context":"","discovery_mode":"combined","language":"en","angles":["No paid ads to start","Sells to professionals"],"explore_new":true}'::jsonb`;
  const run = sql(`select public.enqueue_research('${user}', ${brief}, '{}'::jsonb, gen_random_uuid())`);
  assert.equal(sql(`select array_to_string(p.angles, '|') || ' ' || p.explore_new from public.research_projects p join public.research_runs r on r.project_id = p.id where r.id = '${run}'`), "No paid ads to start|Sells to professionals true");
  assert.equal(sql(`select configuration -> 'brief' = ${brief} from public.research_runs where id = '${run}'`), "t", "the run's configuration keeps the brief unchanged");
  sql(`update public.research_runs set status = 'completed' where id = '${run}'`);
  // A brief from an older client (no angles, no switch) is enqueued with the defaults.
  const older = sql(`select public.enqueue_research('${user}', '{"name":"Older client","sectors":["Healthcare"],"models":["B2B subscription"],"geography":"Japan"}'::jsonb, '{}'::jsonb, gen_random_uuid())`);
  assert.equal(sql(`select cardinality(p.angles) || ' ' || p.explore_new from public.research_projects p join public.research_runs r on r.project_id = p.id where r.id = '${older}'`), "0 false");
});
