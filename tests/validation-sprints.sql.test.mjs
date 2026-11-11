// Runs every migration against a throwaway PostgreSQL database and checks WP-10's validation sprints: a founder starts
// one sprint per opportunity, seeded from the page's first steps and the research's validation steps with spread due
// dates and earlier ticks carried over; nobody can see or change anyone else's sprint or tasks.
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

test("sprints are seeded, spread, carry earlier ticks, stay one per opportunity, and stay private", { skip }, async t => {
  const name = `vl_sprints_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  const fails = (query, pattern, message) => assert.throws(() => sql(query), error => pattern.test(String(error.stderr ?? error.message)), message);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const other = sql(`insert into auth.users (email, email_confirmed_at) values ('other@example.com', now()) returning id`);
  const seed = (owner, validation) => {
    const project = sql(`insert into public.research_projects (user_id, name, sector, model, geography) values ('${owner}', 'p', 's', 'm', 'g') returning id`);
    const run = sql(`insert into public.research_runs (user_id, project_id, status) values ('${owner}', '${project}', 'completed') returning id`);
    return sql(`insert into public.opportunities (user_id, run_id, title, score, payload) values ('${owner}', '${run}', 't', 50, '${JSON.stringify({ validation }).replace(/'/g, "''")}') returning id`);
  };
  const mine = seed(user, ["Interview ten clinic owners", "  ", "Run a paid pilot with two clinics"]);
  const unsaved = seed(user, []);
  const theirs = seed(other, ["Their step"]);
  // The founder ticked first steps 0 and 2 on the old checklist, and saved the opportunity.
  sql(`insert into public.saved_opportunities (user_id, opportunity_id, completed_tasks) values ('${user}', '${mine}', array['${mine}-0', '${mine}-2', '${unsaved}-1'])`);

  const as = (id, query) => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`);
  const asFails = (id, query, pattern, message) => fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`, pattern, message);
  const checklist = `array['Write down the riskiest assumption', 'Find five potential buyers', 'Run problem-discovery conversations', 'Test a small, paid manual pilot']`;

  assert.equal(sql(`select string_agg(relname || ':' || (relrowsecurity and relforcerowsecurity)::text, ',' order by relname) from pg_class where relname in ('validation_sprints', 'validation_tasks')`), "validation_sprints:true,validation_tasks:true");
  assert.equal(sql(`select count(*) from information_schema.role_table_grants where table_name in ('validation_sprints', 'validation_tasks') and grantee = 'anon'`), "0");

  const sprint = as(user, `select public.start_validation_sprint('${mine}', 14, ${checklist})`);
  const tasks = sql(`select string_agg(position || '|' || title || '|' || (due_on - current_date) || '|' || (done_at is not null)::text || '|' || origin, E'\\n' order by position) from public.validation_tasks where sprint_id = '${sprint}'`).split("\n");
  assert.deepEqual(tasks, [
    "0|Write down the riskiest assumption|2|true|report",
    "1|Find five potential buyers|5|false|report",
    "2|Run problem-discovery conversations|7|true|report",
    "3|Test a small, paid manual pilot|9|false|report",
    "4|Interview ten clinic owners|12|false|report",
    "5|Run a paid pilot with two clinics|14|false|report",
  ], "first steps then validation steps (blank ones skipped), ticks carried over by index, due dates spread to the last day");
  assert.equal(sql(`select completed_tasks::text from public.saved_opportunities where opportunity_id = '${mine}'`), `{${mine}-0,${mine}-2,${unsaved}-1}`, "completed_tasks is read, never rewritten");
  assert.equal(sql(`select length_days || ' ' || status || ' ' || (started_on = current_date)::text from public.validation_sprints where id = '${sprint}'`), "14 active true");

  // One active sprint per opportunity; an unsaved opportunity is saved when its sprint starts.
  asFails(user, `select public.start_validation_sprint('${mine}', 7, ${checklist})`, /SPRINT_ACTIVE/, "one active sprint per opportunity");
  asFails(user, `select public.start_validation_sprint('${unsaved}', 10, ${checklist})`, /INVALID_LENGTH/);
  const second = as(user, `select public.start_validation_sprint('${unsaved}', 7, ${checklist})`);
  assert.equal(sql(`select count(*) from public.saved_opportunities where user_id = '${user}' and opportunity_id = '${unsaved}'`), "1", "saved on start");
  assert.equal(sql(`select string_agg((due_on - current_date)::text, ',' order by position) from public.validation_tasks where sprint_id = '${second}'`), "2,4,5,7", "first steps only when the research has none");
  asFails(user, `select public.start_validation_sprint('${theirs}', 7, ${checklist})`, /OPPORTUNITY_NOT_FOUND/, "not another founder's opportunity");
  fails(`begin; set local role anon; select public.start_validation_sprint('${mine}', 7); commit;`, /permission denied/);

  // The founder manages their own tasks and records a decision; the decision completes the sprint.
  as(user, `insert into public.validation_tasks (user_id, sprint_id, title, position, origin) values (auth.uid(), '${sprint}', 'Call the clinic association', 6, 'user')`);
  as(user, `update public.validation_tasks set done_at = now(), title = 'Find five potential buyers in Leeds' where sprint_id = '${sprint}' and position = 1`);
  as(user, `delete from public.validation_tasks where sprint_id = '${sprint}' and position = 3`);
  assert.equal(sql(`select count(*) || '/' || count(*) filter (where done_at is not null) from public.validation_tasks where sprint_id = '${sprint}'`), "6/3");
  asFails(user, `update public.validation_sprints set decision = 'keep' where id = '${sprint}'`, /check constraint/, "a decision needs the sprint completed");
  asFails(user, `update public.validation_sprints set length_days = 30 where id = '${sprint}'`, /permission denied/, "the length cannot change after the start");
  as(user, `update public.validation_sprints set status = 'completed', decision = 'keep', decision_note = 'Three clinics paid', go_criteria = '3 of 10 pay' where id = '${sprint}'`);
  assert.equal(sql(`select status || ' ' || decision from public.validation_sprints where id = '${sprint}'`), "completed keep");
  const next = as(user, `select public.start_validation_sprint('${mine}', 30, ${checklist})`);
  assert.ok(next && next !== sprint, "a new sprint can start once the last one is decided");

  // Nobody else can read, change or add to the founder's sprint.
  assert.equal(as(other, `select count(*) from public.validation_sprints`), "0");
  assert.equal(as(other, `select count(*) from public.validation_tasks`), "0");
  as(other, `update public.validation_tasks set title = 'hijacked' where sprint_id = '${sprint}'`);
  as(other, `delete from public.validation_tasks where sprint_id = '${sprint}'`);
  assert.equal(sql(`select count(*) from public.validation_tasks where sprint_id = '${sprint}' and title <> 'hijacked'`), "6", "other founders' updates and deletes touch nothing");
  asFails(other, `insert into public.validation_tasks (user_id, sprint_id, title, position, origin) values (auth.uid(), '${sprint}', 'x', 9, 'user')`, /row-level security|foreign key/);
  asFails(other, `insert into public.validation_sprints (user_id, opportunity_id, length_days) values (auth.uid(), '${mine}', 7)`, /row-level security|foreign key/);

  // At most 50 tasks a sprint; deleting the opportunity removes its sprints and tasks.
  asFails(user, `insert into public.validation_tasks (user_id, sprint_id, title, position, origin) select auth.uid(), '${next}', 'Task ' || n, n, 'user' from generate_series(10, 60) n`, /TOO_MANY_TASKS/);
  sql(`delete from public.opportunities where id = '${mine}'`);
  assert.equal(sql(`select count(*) from public.validation_sprints where opportunity_id = '${mine}'`), "0");
  assert.equal(sql(`select count(*) from public.validation_tasks where sprint_id in ('${sprint}', '${next}')`), "0");
});
