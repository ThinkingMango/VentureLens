// Runs every migration against a throwaway PostgreSQL database and checks the saved flag (ported from #20): checklist
// progress and saving are independent, existing rows stay saved, and starting a sprint saves the opportunity.
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

test("saving and checklist progress are independent; a sprint saves its opportunity", { skip }, async t => {
  const name = `vl_saved_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  const files = readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort();
  const flag = files.indexOf("20261112150000_saved_opportunity_flag.sql");
  assert.ok(flag > 0);
  // Everything before the flag, then a row saved the old way, then the flag: existing rows must stay saved.
  for (const file of files.slice(0, flag)) psql(db, ["-f", path(`supabase/migrations/${file}`)]);
  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const opportunity = () => {
    const project = sql(`insert into public.research_projects (user_id, name, sector, model, geography) values ('${user}', 'p', 's', 'm', 'g') returning id`);
    const run = sql(`insert into public.research_runs (user_id, project_id, status) values ('${user}', '${project}', 'completed') returning id`);
    return sql(`insert into public.opportunities (user_id, run_id, title, score, payload) values ('${user}', '${run}', 't', 50, '{"validation":["Step"]}') returning id`);
  };
  const before = opportunity();
  sql(`insert into public.saved_opportunities (user_id, opportunity_id, completed_tasks) values ('${user}', '${before}', array['${before}-0'])`);
  for (const file of files.slice(flag)) psql(db, ["-f", path(`supabase/migrations/${file}`)]);
  assert.equal(sql(`select saved from public.saved_opportunities where opportunity_id = '${before}'`), "t", "rows saved before the flag stay saved");

  const as = query => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; ${query}; commit;`);
  const row = id => sql(`select saved || '|' || array_to_string(completed_tasks, ',') from public.saved_opportunities where opportunity_id = '${id}'`);

  // What the API does: a tick on an unsaved opportunity adds an unsaved row with the progress.
  const ticked = opportunity();
  as(`insert into public.saved_opportunities (user_id, opportunity_id, completed_tasks, saved) values (auth.uid(), '${ticked}', array['${ticked}-1'], false)`);
  assert.equal(row(ticked), `false|${ticked}-1`, "ticking does not save");
  // Saving keeps the progress; unsaving clears the flag and keeps the progress.
  as(`insert into public.saved_opportunities (user_id, opportunity_id, saved) values (auth.uid(), '${ticked}', true) on conflict (user_id, opportunity_id) do update set saved = excluded.saved`);
  assert.equal(row(ticked), `true|${ticked}-1`);
  as(`update public.saved_opportunities set saved = false where opportunity_id = '${ticked}'`);
  assert.equal(row(ticked), `false|${ticked}-1`, "unsaving keeps the checklist progress");

  // Starting a sprint saves the opportunity and keeps the earlier tick.
  const sprint = as(`select public.start_validation_sprint('${ticked}', 7, array['First', 'Second'])`);
  assert.equal(row(ticked), `true|${ticked}-1`, "a sprint saves its opportunity");
  assert.equal(sql(`select string_agg((done_at is not null)::text, ',' order by position) from public.validation_tasks where sprint_id = '${sprint}'`), "false,true,false", "the earlier tick carries into the sprint");
  // On an opportunity with no row at all, the sprint creates a saved one.
  const fresh = opportunity();
  as(`select public.start_validation_sprint('${fresh}', 7, array['First'])`);
  assert.equal(row(fresh), "true|");
});
