// Runs every migration in supabase/migrations against a throwaway PostgreSQL database and checks that the free-run
// grant on signup recognises one Gmail inbox under its dotted and googlemail.com spellings.
//
// Needs `psql` and TEST_DATABASE_URL pointing at a PostgreSQL 15+ server where the user may create databases, e.g.
//   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres node --test tests/signup-grant.sql.test.mjs
// A fresh database is created for the run and dropped afterwards; the target database itself is never modified.
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

test("one Gmail inbox gets one free grant, whatever dots, case, +tags or googlemail.com it signs up with", { skip }, async t => {
  const name = `vl_signup_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);
  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  for (const file of readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()) {
    psql(db, ["-f", path(`supabase/migrations/${file}`)]);
  }

  const normalized = email => sql(`select public.normalized_email('${email}')`);
  assert.equal(normalized("Jane.Doe+ideas@GMail.com"), "janedoe@gmail.com");
  assert.equal(normalized("j.a.n.e.doe@googlemail.com"), "janedoe@gmail.com");
  // Elsewhere dots can be significant, so only +tags and case are folded.
  assert.equal(normalized("Jane.Doe+ideas@Example.com"), "jane.doe@example.com");

  const signUp = email => {
    const id = sql(`insert into auth.users (email, email_confirmed_at) values ('${email}', now()) returning id`);
    return sql(`select count(*) from public.research_dev_access where user_id = '${id}'`) === "1";
  };
  assert.equal(signUp("janedoe@gmail.com"), true, "the first account for an inbox gets the free run");
  // 20261111140000: the grant is 10 runs, valid for 90 days.
  assert.equal(
    sql(`select max_runs || ' ' || runs_used || ' ' || (expires_at - now() between interval '89 days 23 hours' and interval '90 days') from public.research_dev_access a join auth.users u on u.id = a.user_id where u.email = 'janedoe@gmail.com'`),
    "10 0 true",
  );
  for (const alias of ["jane.doe@gmail.com", "Jane.Doe+second@gmail.com", "janedoe@googlemail.com"])
    assert.equal(signUp(alias), false, `${alias} is the same inbox`);
  assert.equal(signUp("jane.doe@example.com"), true);
  assert.equal(signUp("janedoe@example.com"), true, "a different address at a non-Gmail provider is a different person");
});
