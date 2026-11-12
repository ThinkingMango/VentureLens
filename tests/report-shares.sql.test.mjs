// Runs every migration against a throwaway PostgreSQL database and checks WP-26's report links: a founder makes one
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

  sql(`delete from public.research_runs where id = '${mine}'`);
  assert.equal(sql(`select count(*) from public.report_shares`), "0", "deleting the report deletes its links");
});
