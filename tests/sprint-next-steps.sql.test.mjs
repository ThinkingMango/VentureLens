// Runs every migration against a throwaway PostgreSQL database and checks WP-16: a sprint started on an opportunity
// with next steps is seeded from those steps (details labelled in the founder's language, due dates from each step's
// day, earlier ticks carried over by position, go criteria from the done-when lines); opportunities without steps keep
// the WP-10 behaviour; the function stays callable by founders only.
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

test("a sprint is seeded from a report's next steps, with labelled details, scaled days and earlier ticks", { skip }, async t => {
  const name = `vl_next_steps_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  const fails = (query, pattern, message) => assert.throws(() => sql(query), error => pattern.test(String(error.stderr ?? error.message)), message);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const seed = payload => {
    const project = sql(`insert into public.research_projects (user_id, name, sector, model, geography) values ('${user}', 'p', 's', 'm', 'g') returning id`);
    const run = sql(`insert into public.research_runs (user_id, project_id, status) values ('${user}', '${project}', 'completed') returning id`);
    return sql(`insert into public.opportunities (user_id, run_id, title, score, payload) values ('${user}', '${run}', 't', 50, '${JSON.stringify(payload).replace(/'/g, "''")}') returning id`);
  };
  const step = (action, day, extra = {}) => ({ action, where: null, where_hint: "", done_when: `${action}: done`, stop_if: `${action}: stop`, tests_assumption: 0, day, ...extra });
  const withSteps = seed({
    validation: ["Plain validation step"],
    evidence: [{ source_key: "c1-s2", url: "https://forum.example.org/t/1", title: "Clinic owners on scheduling", retrieved_at: "2026-11-01" }],
    steps: [
      step("Ask five clinic owners", 4, { where: "c1-s2" }),
      step("Ask about current spend", 9, { where: "c1-s9", where_hint: "" }), // cited source no longer listed: no where line
      step("Offer a paid pilot", 14, { where_hint: "Local practice managers' group" }),
    ],
  });
  const plain = seed({ validation: ["Interview ten clinic owners"] });
  // Ticks are stored by position on the page: the founder ticked the second step.
  sql(`insert into public.saved_opportunities (user_id, opportunity_id, completed_tasks) values ('${user}', '${withSteps}', array['${withSteps}-1'])`);
  const as = query => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; ${query}; commit;`);
  const labels = `array['Où', 'Où chercher (suggestion)', 'Terminé quand', 'Arrêter si']`;

  // The page sends no first steps for a report with next steps; any it sent would be ignored.
  const sprint = as(`select public.start_validation_sprint('${withSteps}', 30, array['Write down the riskiest assumption'], ${labels})`);
  const tasks = sql(`select string_agg(position || '|' || title || '|' || (due_on - current_date) || '|' || (done_at is not null)::text, E'\\n' order by position) from public.validation_tasks where sprint_id = '${sprint}'`).split("\n");
  assert.deepEqual(tasks, [
    "0|Ask five clinic owners|9|false",
    "1|Ask about current spend|19|true",
    "2|Offer a paid pilot|30|false",
  ], "one task per step, no first steps or plain validation steps; day d of 14 scaled to 30 days; the ticked step stays ticked");
  const detail = position => sql(`select detail from public.validation_tasks where sprint_id = '${sprint}' and position = ${position}`);
  assert.equal(detail(0), "Où: Clinic owners on scheduling\nTerminé quand: Ask five clinic owners: done\nArrêter si: Ask five clinic owners: stop");
  assert.equal(detail(1), "Terminé quand: Ask about current spend: done\nArrêter si: Ask about current spend: stop", "a source that is not listed is not named");
  assert.equal(detail(2), "Où chercher (suggestion): Local practice managers' group\nTerminé quand: Offer a paid pilot: done\nArrêter si: Offer a paid pilot: stop");
  assert.equal(sql(`select go_criteria from public.validation_sprints where id = '${sprint}'`), "- Ask five clinic owners: done\n- Ask about current spend: done\n- Offer a paid pilot: done");

  // Without labels the details are in English; a 7-day sprint compresses the days.
  sql(`update public.validation_sprints set status = 'abandoned' where id = '${sprint}'`);
  const short = as(`select public.start_validation_sprint('${withSteps}', 7)`);
  assert.equal(sql(`select string_agg((due_on - current_date)::text, ',' order by position) from public.validation_tasks where sprint_id = '${short}'`), "2,5,7");
  assert.match(sql(`select detail from public.validation_tasks where sprint_id = '${short}' and position = 0`), /^Where: Clinic owners on scheduling\nDone when: /);

  // An opportunity without steps behaves exactly as in WP-10, and its sprint starts with no go criteria.
  const old = as(`select public.start_validation_sprint('${plain}', 14, array['Write down the riskiest assumption', 'Find five potential buyers'], ${labels})`);
  assert.equal(sql(`select string_agg(position || '|' || title || '|' || (due_on - current_date) || '|' || detail, E'\\n' order by position) from public.validation_tasks where sprint_id = '${old}'`),
    "0|Write down the riskiest assumption|5|\n1|Find five potential buyers|9|\n2|Interview ten clinic owners|14|");
  assert.equal(sql(`select go_criteria from public.validation_sprints where id = '${old}'`), "");

  // The three-argument call the WP-10 page made still works, and only founders may call the function.
  assert.equal(sql(`select count(*) from pg_proc where proname = 'start_validation_sprint'`), "1", "the old signature is gone, not overloaded");
  fails(`begin; set local role anon; select public.start_validation_sprint('${plain}', 7); commit;`, /permission denied/);
});
