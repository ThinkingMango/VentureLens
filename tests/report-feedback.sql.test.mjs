// Runs every migration against a throwaway PostgreSQL database and checks WP-13's report feedback: founders flag claims
// and sources on their own opportunities and rate their own reports once, and nobody can read or write anyone else's.
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

test("founders flag and rate only their own reports, once each, and cannot read anyone else's feedback", { skip }, async t => {
  const name = `vl_feedback_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  const fails = (query, pattern, message) => assert.throws(() => sql(query), error => pattern.test(String(error.stderr ?? error.message)), message);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const other = sql(`insert into auth.users (email, email_confirmed_at) values ('other@example.com', now()) returning id`);
  const seed = (owner, status) => {
    const project = sql(`insert into public.research_projects (user_id, name, sector, model, geography) values ('${owner}', 'p', 's', 'm', 'g') returning id`);
    const run = sql(`insert into public.research_runs (user_id, project_id, status) values ('${owner}', '${project}', '${status}') returning id`);
    const opportunity = sql(`insert into public.opportunities (user_id, run_id, title, score, payload) values ('${owner}', '${run}', 't', 50, '{}') returning id`);
    return { run, opportunity };
  };
  const mine = seed(user, "completed");
  const second = seed(user, "completed");
  const running = seed(user, "running");
  const theirs = seed(other, "completed");
  const as = (id, query) => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`);
  const flag = (run, opportunity, key = "claim-0", target = "claim") =>
    `insert into public.report_feedback (user_id, run_id, opportunity_id, target, target_key, reason, comment) values (auth.uid(), '${run}', '${opportunity}', '${target}', '${key}', 'wrong', 'Not what the source says')`;

  assert.equal(sql(`select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.report_feedback'::regclass`), "t", "RLS enabled and forced");
  assert.equal(sql(`select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_name = 'report_feedback' and grantee = 'authenticated'`), "INSERT,SELECT", "no update or delete in v1");
  assert.equal(sql(`select count(*) from information_schema.role_table_grants where table_name = 'report_feedback' and grantee = 'anon'`), "0");

  // Flags: on one's own opportunity, under its own run, once per claim or source.
  as(user, flag(mine.run, mine.opportunity));
  as(user, flag(mine.run, mine.opportunity, "c1-s2", "source"));
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; ${flag(mine.run, mine.opportunity)}; commit;`, /report_feedback_one_flag/, "the same claim cannot be flagged twice");
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; ${flag(theirs.run, theirs.opportunity)}; commit;`, /row-level security|foreign key/, "not another founder's opportunity");
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; ${flag(second.run, mine.opportunity)}; commit;`, /row-level security/, "the opportunity must belong to the run named");
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; insert into public.report_feedback (user_id, run_id, opportunity_id, target, target_key, reason) values ('${other}', '${theirs.run}', '${theirs.opportunity}', 'claim', 'claim-0', 'wrong'); commit;`, /row-level security/, "not in another founder's name");
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; insert into public.report_feedback (user_id, run_id, target, rating) values (auth.uid(), '${mine.run}', 'report', 5); commit;`, /row-level security/, "ratings go through rate_report only");
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; insert into public.report_feedback (user_id, run_id, opportunity_id, target, target_key, reason, rating) values (auth.uid(), '${mine.run}', '${mine.opportunity}', 'claim', 'claim-1', 'wrong', 3); commit;`, /check constraint/, "a flag has no rating");
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; insert into public.report_feedback (user_id, run_id, opportunity_id, target, target_key, reason) values (auth.uid(), '${mine.run}', '${mine.opportunity}', 'claim', 'claim-2', 'boring'); commit;`, /check constraint/, "reasons are a fixed list");
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; insert into public.report_feedback (user_id, run_id, opportunity_id, target, target_key, reason, comment) values (auth.uid(), '${mine.run}', '${mine.opportunity}', 'claim', 'claim-3', 'other', repeat('x', 1001)); commit;`, /check constraint/, "comments are at most 1000 characters");

  // Ratings: once per finished report, changed in place; never another founder's report or an unfinished run.
  as(user, `select public.rate_report('${mine.run}', 4, ' Useful ')`);
  as(user, `select public.rate_report('${mine.run}', 2, 'Changed my mind')`);
  assert.equal(sql(`select count(*) || ' ' || max(rating) || ' ' || max(comment) from public.report_feedback where target = 'report' and user_id = '${user}'`), "1 2 Changed my mind", "one rating per report, updated in place");
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; select public.rate_report('${theirs.run}', 5); commit;`, /REPORT_NOT_FOUND/, "not another founder's report");
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; select public.rate_report('${running.run}', 5); commit;`, /REPORT_NOT_FOUND/, "not a run still in progress");
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; select public.rate_report('${mine.run}', 6); commit;`, /INVALID_RATING/);
  fails(`begin; set local role anon; select public.rate_report('${mine.run}', 5); commit;`, /permission denied/, "anonymous visitors cannot rate");

  // Reading: each founder sees only their own feedback; nobody can edit or delete it.
  as(other, flag(theirs.run, theirs.opportunity));
  as(other, `select public.rate_report('${theirs.run}', 5)`);
  assert.equal(as(user, `select count(*) from public.report_feedback`), "3", "the founder's two flags and one rating");
  assert.equal(as(other, `select count(*) from public.report_feedback where user_id = '${user}'`), "0", "another founder sees none of them");
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; update public.report_feedback set reason = 'other'; commit;`, /permission denied/);
  fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${user}'; delete from public.report_feedback; commit;`, /permission denied/);
  assert.equal(sql(`begin; set local role service_role; select count(*) from public.report_feedback; commit;`), "5", "the operator page reads every row with the service role");

  // Deleting a run removes its feedback with it.
  sql(`delete from public.research_runs where id = '${mine.run}'`);
  assert.equal(sql(`select count(*) from public.report_feedback where user_id = '${user}'`), "0");
});
