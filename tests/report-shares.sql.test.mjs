// Runs every migration against a throwaway PostgreSQL database and checks WP-26's links, to a report or to one opportunity in it: a founder makes one
// live link per completed report of their own, can only turn it off (never back on or onto another report), nobody
// else can see or touch it, and deleting the report removes its links.
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
const token = c => c.repeat(43);

test("report links: one live link per own completed report, turned off for good, private to their owner", { skip }, async t => {
  const name = `vl_shares_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  const fails = (query, pattern, message) => assert.throws(() => sql(query), error => pattern.test(String(error.stderr ?? error.message)), message);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const other = sql(`insert into auth.users (email, email_confirmed_at) values ('other@example.com', now()) returning id`);
  const run = (owner, status = "completed") => {
    const project = sql(`insert into public.research_projects (user_id, name, sector, model, geography) values ('${owner}', 'p', 's', 'm', 'g') returning id`);
    return sql(`insert into public.research_runs (user_id, project_id, status) values ('${owner}', '${project}', '${status}') returning id`);
  };
  const mine = run(user);
  const running = run(user, "running");
  const theirs = run(other);
  const as = (id, query) => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`);
  const asFails = (id, query, pattern, message) => fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`, pattern, message);
  const share = (id, runId, tok) => `insert into public.report_shares (user_id, run_id, token) values ('${id}', '${runId}', '${tok}')`;

  as(user, share(user, mine, token("a")));
  asFails(user, share(user, mine, token("b")), /report_shares_one_live/, "one live link per report");
  asFails(user, share(user, running, token("c")), /row-level security/, "not for a run that is still working");
  asFails(user, share(user, theirs, token("d")), /row-level security|foreign key/, "not for someone else's report");
  asFails(other, share(user, mine, token("e")), /row-level security/, "not on someone else's behalf");
  asFails(user, share(user, mine, "short"), /check constraint/, "tokens are 43 base64url characters");

  assert.equal(as(other, `select count(*) from public.report_shares`), "0", "nobody else sees the link");
  fails(`begin; set local role anon; select count(*) from public.report_shares; commit;`, /permission denied/, "anonymous readers go through the server, never the table");
  as(other, `update public.report_shares set revoked_at = now()`);
  assert.equal(sql(`select count(*) from public.report_shares where revoked_at is null`), "1", "nobody else can turn it off");

  asFails(user, `update public.report_shares set token = '${token("f")}'`, /permission denied/, "a link's token never changes");
  as(user, `update public.report_shares set revoked_at = now() where run_id = '${mine}'`);
  asFails(user, `update public.report_shares set revoked_at = null where run_id = '${mine}'`, /row-level security/, "a link turned off stays off");
  as(user, share(user, mine, token("g")));
  assert.equal(sql(`select string_agg(left(token, 1) || ':' || (revoked_at is null)::text, ',' order by created_at, token) from public.report_shares`), "a:false,g:true", "turning it on again makes a new link");

  // Links expire 90 days after they are made; the founder cannot choose a later expiry or an earlier creation time.
  assert.equal(sql(`select (expires_at - created_at = interval '90 days')::text from public.report_shares where token = '${token("g")}'`), "true");
  asFails(user, `insert into public.report_shares (user_id, run_id, token, expires_at) values ('${user}', '${running}', '${token("h")}', now() + interval '10 years')`, /permission denied/, "no custom expiry");
  asFails(user, `insert into public.report_shares (user_id, run_id, token, created_at) values ('${user}', '${running}', '${token("i")}', now())`, /permission denied/, "no custom creation time");
  asFails(user, `update public.report_shares set expires_at = now() + interval '10 years' where run_id = '${mine}'`, /permission denied/, "an expiry never moves");

  sql(`delete from public.research_runs where id = '${mine}'`);
  assert.equal(sql(`select count(*) from public.report_shares`), "0", "deleting the report deletes its links");
});

test("opportunity links: one live link per own opportunity, from its own completed report, apart from the report's link", { skip }, async t => {
  const name = `vl_opp_shares_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  const fails = (query, pattern, message) => assert.throws(() => sql(query), error => pattern.test(String(error.stderr ?? error.message)), message);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const other = sql(`insert into auth.users (email, email_confirmed_at) values ('other@example.com', now()) returning id`);
  const run = (owner, status = "completed") => {
    const project = sql(`insert into public.research_projects (user_id, name, sector, model, geography) values ('${owner}', 'p', 's', 'm', 'g') returning id`);
    return sql(`insert into public.research_runs (user_id, project_id, status) values ('${owner}', '${project}', '${status}') returning id`);
  };
  const opportunity = (owner, runId) => sql(`insert into public.opportunities (user_id, run_id, title, score, payload) values ('${owner}', '${runId}', 't', 50, '{}') returning id`);
  const mine = run(user);
  const second = run(user);
  const theirs = run(other);
  const o1 = opportunity(user, mine);
  const o2 = opportunity(user, mine);
  const elsewhere = opportunity(user, second);
  const theirOpportunity = opportunity(other, theirs);
  const as = (id, query) => sql(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`);
  const asFails = (id, query, pattern, message) => fails(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}'; ${query}; commit;`, pattern, message);
  const share = (id, runId, opp, tok) => `insert into public.report_shares (user_id, run_id, opportunity_id, token) values ('${id}', '${runId}', ${opp ? `'${opp}'` : "null"}, '${tok}')`;

  // A report link and links to two of its opportunities can all be live at once.
  as(user, share(user, mine, null, token("a")));
  as(user, share(user, mine, o1, token("b")));
  as(user, share(user, mine, o2, token("c")));
  asFails(user, share(user, mine, o1, token("d")), /report_shares_one_live_opportunity/, "one live link per opportunity");
  asFails(user, share(user, mine, null, token("e")), /report_shares_one_live"/, "still one live link per report");

  // The opportunity must be the founder's own and come from the report the link names.
  asFails(user, share(user, mine, elsewhere, token("f")), /report_shares_opportunity_fkey/, "not paired with another report");
  asFails(user, share(user, mine, theirOpportunity, token("g")), /report_shares_opportunity_fkey/, "not someone else's opportunity");
  asFails(user, share(user, theirs, theirOpportunity, token("h")), /row-level security|foreign key/, "not on someone else's report");
  asFails(other, share(user, mine, o1, token("i")), /row-level security/, "not on someone else's behalf");
  asFails(user, `update public.report_shares set opportunity_id = '${o2}' where token = '${token("b")}'`, /permission denied/, "a link never moves to another opportunity");
  assert.equal(as(other, `select count(*) from public.report_shares`), "0", "nobody else sees the links");

  // Turning off the opportunity's link leaves the report's link on; sharing again makes a new link.
  as(user, `update public.report_shares set revoked_at = now() where opportunity_id = '${o1}'`);
  assert.equal(sql(`select count(*) from public.report_shares where revoked_at is null`), "2");
  as(user, share(user, mine, o1, token("j")));

  // Deleting an opportunity deletes only its links; deleting the report deletes the rest.
  sql(`delete from public.opportunities where id = '${o2}'`);
  assert.equal(sql(`select count(*) from public.report_shares where opportunity_id = '${o2}'`), "0");
  assert.equal(sql(`select count(*) from public.report_shares where run_id = '${mine}'`), "3", "the report's link and o1's two links remain");
  sql(`delete from public.research_runs where id = '${mine}'`);
  assert.equal(sql(`select count(*) from public.report_shares`), "0");
});
