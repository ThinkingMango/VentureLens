// Runs the migrations in supabase/migrations against a throwaway PostgreSQL database and checks the multi-choice
// research brief (20261110025844_multi_choice_brief.sql): existing briefs are backfilled, new and legacy writers both
// produce consistent rows, and the database bounds the selections.
//
// Needs `psql` and TEST_DATABASE_URL, as tests/quota-ledger.sql.test.mjs describes.
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
const multiChoice = "20261110025844_multi_choice_brief.sql";
function psql(url, args) {
  return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-A", "-t", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function sqlError(fn) {
  try { fn(); } catch (error) { return String(error.stderr ?? error.message); }
  return "";
}

test("briefs hold several industries and models, and single-value briefs keep working", { skip }, async t => {
  const name = `vl_brief_${process.pid}_${Date.now()}`;
  psql(server, ["-c", `create database ${name}`]);
  t.after(() => psql(server, ["-c", `drop database if exists ${name} with (force)`]));
  const db = Object.assign(new URL(server), { pathname: `/${name}` }).href;
  const sql = query => psql(db, ["-c", query]);

  psql(db, ["-f", path("tests/sql/supabase-auth-stub.sql")]);
  const files = readdirSync(path("supabase/migrations")).filter(f => f.endsWith(".sql")).sort();
  const at = files.indexOf(multiChoice);
  assert.ok(at >= 0, "the multi-choice migration exists");
  for (const file of files.slice(0, at)) psql(db, ["-f", path(`supabase/migrations/${file}`)]);

  // A brief saved before the migration is backfilled as one-item selections.
  const user = sql(`insert into auth.users (email, email_confirmed_at) values ('founder@example.com', now()) returning id`);
  const old = sql(`insert into public.research_projects (user_id, name, sector, model, geography) values ('${user}', 'Old brief', 'Healthcare', 'Productized service', 'Japan') returning id`);
  for (const file of files.slice(at)) psql(db, ["-f", path(`supabase/migrations/${file}`)]);
  const row = id => sql(`select sector || '|' || model || '|' || array_to_string(sectors, ',') || '|' || array_to_string(models, ',') from public.research_projects where id = '${id}'`);
  assert.equal(row(old), "Healthcare|Productized service|Healthcare|Productized service");

  // enqueue_research stores the selections; the single-value columns hold the first of each.
  const brief = JSON.stringify({ name: "Clinic research", sectors: ["Healthcare", "Legal & compliance"], models: ["B2B subscription", "Productized service"], geography: "Hong Kong", context: "" });
  const run = sql(`select public.enqueue_research('${user}', '${brief}'::jsonb, '{}'::jsonb, gen_random_uuid())`);
  const project = sql(`select project_id from public.research_runs where id = '${run}'`);
  assert.equal(row(project), "Healthcare|B2B subscription|Healthcare,Legal & compliance|B2B subscription,Productized service");
  assert.equal(sql(`select configuration -> 'brief' -> 'sectors' ->> 1 from public.research_runs where id = '${run}'`), "Legal & compliance");

  // A writer that only knows the single-value shape (an older deployment) still produces a complete row.
  const legacy = sql(`insert into public.research_projects (user_id, name, sector, model, geography) values ('${user}', 'Legacy writer', 'Education', 'Open to possibilities', 'India') returning id`);
  assert.equal(row(legacy), "Education|Open to possibilities|Education|Open to possibilities");

  // The workspace route saves a brief as the signed-in founder, sending only the selections.
  const saved = psql(db, ["-c", `set role authenticated; set request.jwt.claim.sub = '${user}'; insert into public.research_projects (user_id, name, sectors, models, geography) values ('${user}', 'Saved brief', '{B2B SaaS,Education}', '{API or data product}', 'Singapore') returning id;`]);
  assert.equal(row(saved), "B2B SaaS|API or data product|B2B SaaS,Education|API or data product");

  // Changing the selections keeps the single-value columns in step.
  sql(`update public.research_projects set sectors = '{Education,Healthcare}' where id = '${saved}'`);
  assert.equal(row(saved), "Education|API or data product|Education,Healthcare|API or data product");

  // The database bounds the selections as it bounds the single values.
  const insert = (sectors, models) => sqlError(() => sql(`insert into public.research_projects (user_id, name, sectors, models, geography) values ('${user}', 'Bounds', ${sectors}, ${models}, 'Japan')`));
  assert.match(insert(`'{Healthcare,Education,B2B SaaS,Legal & compliance}'`, `'{B2B subscription}'`), /research_projects_sectors_check/);
  assert.match(insert(`'{Healthcare,NULL}'`, `'{B2B subscription}'`), /research_projects_sectors_check/);
  assert.match(insert(`'{Healthcare}'`, `array_fill('B2B subscription'::text, array[11])`), /research_projects_models_check/);
  assert.match(insert(`'{}'`, `'{B2B subscription}'`), /null value in column "sector"/);
  assert.equal(insert(`'{Healthcare,Education,B2B SaaS}'`, `array_fill('B2B subscription'::text, array[10])`), "");
});
