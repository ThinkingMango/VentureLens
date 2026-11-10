import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { profileSchema, emptyProfile, profileV2FromRow, profileColumns, profileV2Fields, revenueTargetOptions, strengthOptions, riskOptions, profileLanguages } from "../lib/workspace-schema.ts";
import { founderContext } from "../lib/research-core.ts";
import { starterProfiles, starterProfileIds } from "../lib/starter-profiles.ts";
import { founderRoles, founderIndustries, founderGoals } from "../lib/profile-options.ts";
import { eventProps } from "../lib/events-core.ts";

const v1 = { name: "Ada", role: "Aspiring founder", industry: "Healthcare", skills: "Operations", hours: "5–10 hours", budget: "Under $1,000", goal: "Build a sustainable side business" };

test("an old profile payload without the v2 fields still parses, and adds no v2 keys", () => {
  const parsed = profileSchema.parse(v1);
  assert.deepEqual(parsed, v1, "nothing is defaulted in: a save from an older client leaves stored v2 answers alone");
  assert.equal(profileSchema.safeParse(emptyProfile).success, false, "the empty profile still needs a name and skills");
  assert.equal(profileSchema.safeParse({ ...emptyProfile, name: "Ada", skills: "Ops" }).success, true, "blank v2 answers are valid");
});

test("v2 answers are bounded, and choices only accept their options or blank", () => {
  const ok = { ...v1, interests: "i".repeat(500), pain_points: "p".repeat(500), distribution: "d".repeat(500), exclusions: "e".repeat(300), revenue_target: "$1–5k/mo", strength: "Technical", risk_tolerance: "High", languages: ["English", "Japanese"] };
  assert.equal(profileSchema.safeParse(ok).success, true);
  for (const [field, value] of [["interests", "i".repeat(501)], ["pain_points", "p".repeat(501)], ["distribution", "d".repeat(501)], ["exclusions", "e".repeat(301)], ["revenue_target", "$1m/mo"], ["strength", "Charm"], ["risk_tolerance", "Extreme"], ["languages", ["Klingon"]], ["languages", ["English", "English"]], ["languages", profileLanguages.slice(0, 6)]])
    assert.equal(profileSchema.safeParse({ ...ok, [field]: value }).success, false, `${field} = ${JSON.stringify(value).slice(0, 40)}`);
  assert.deepEqual([...revenueTargetOptions], ["Side income (<$1k/mo)", "$1–5k/mo", "$5–20k/mo", "$20k+/mo"]);
  assert.deepEqual([...strengthOptions], ["Technical", "Sales & marketing", "Operations", "Balanced"]);
  assert.deepEqual([...riskOptions], ["Low", "Medium", "High"]);
});

test("a stored row reads stale or missing v2 answers as not answered", () => {
  assert.deepEqual(profileV2FromRow({ ...v1 }), { interests: "", pain_points: "", distribution: "", strength: "", revenue_target: "", risk_tolerance: "", exclusions: "", languages: [] }, "a database without the migration");
  const row = { ...v1, strength: "Retired option", languages: ["English", "Cantonese"], distribution: "Newsletter", risk_tolerance: null };
  const read = profileV2FromRow(row);
  assert.equal(read.strength, "");
  assert.deepEqual(read.languages, ["English", "Cantonese"]);
  assert.equal(read.distribution, "Newsletter");
  assert.equal(read.risk_tolerance, "");
  for (const field of profileV2Fields) assert.ok(profileColumns.split(",").includes(field), `${field} is read from the database`);
});

test("the founder context includes v2 answers only when given, and is null in market mode", () => {
  assert.deepEqual(founderContext(v1, "founder"), { industry: "Healthcare", skills: "Operations", hours: "5–10 hours", budget: "Under $1,000", goal: "Build a sustainable side business" });
  const full = { ...v1, interests: " Climbing ", distribution: "", strength: "Operations", languages: [], exclusions: "No hardware" };
  assert.deepEqual(founderContext(full, "combined"), { ...founderContext(v1, "combined"), interests: "Climbing", strength: "Operations", exclusions: "No hardware" });
  assert.deepEqual(founderContext(full, "verify"), founderContext(full, "combined"), "a check of the founder's own idea sees the same context");
  assert.equal(founderContext(full, "market"), null);
  assert.equal("name" in founderContext(full, "founder"), false, "the name is never sent");
});

test("starter profiles are four valid templates that never set the name or languages", () => {
  assert.deepEqual(starterProfiles.map(s => s.title), ["Engineer, 5–10 h/week", "Consultant leaving corporate", "Creator with an audience", "Operator in a traditional industry"]);
  for (const starter of starterProfiles) {
    assert.ok(eventProps("starter_profile_used", { id: starter.id }), `${starter.id} is a valid event id`);
    assert.equal(profileSchema.safeParse({ name: "Ada", ...starter.profile }).success, true, starter.id);
    assert.equal("name" in starter.profile || "languages" in starter.profile, false);
    assert.ok(founderRoles.includes(starter.profile.role) && founderIndustries.includes(starter.profile.industry) && founderGoals.includes(starter.profile.goal), `${starter.id} uses the form's suggested answers`);
  }
  assert.deepEqual(starterProfileIds, starterProfiles.map(s => s.id));
});

test("saving records starter_profile_used after the response, only for a known starter", () => {
  const route = readFileSync(new URL("../app/api/workspace/route.ts", import.meta.url), "utf8");
  assert.match(route, /starter: z\.enum\(starterProfileIds\)\.optional\(\)/);
  assert.match(route, /if \(starter\) after\(\(\) => track\("starter_profile_used", \{ userId: user\.id, props: \{ id: starter \} \}\)\)/);
});

test("starter and v2 text that reaches copy() through variables is translated in every catalogue", async () => {
  const { messageKey } = await import("../i18n/config.ts");
  const catalogs = ["en", "zh-Hans", "zh-Hant"].map(locale => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")).ui);
  const sources = [
    ...starterProfiles.flatMap(s => [s.title, s.description, s.profile.skills, s.profile.interests, s.profile.pain_points, s.profile.distribution, s.profile.exclusions]),
    ...revenueTargetOptions, ...strengthOptions, ...riskOptions, ...profileLanguages,
  ];
  for (const source of sources) for (const ui of catalogs) assert.ok(ui[messageKey(source)], source);
});
