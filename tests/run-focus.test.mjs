import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectSchema, researchRequestSchema, emptyBrief } from "../lib/workspace-schema.ts";
import { angleOptions, maxAngles, visibleAngles, briefFocus, researchSectors, businessModels } from "../lib/research-options.ts";

const brief = { ...emptyBrief, name: "Focused research" };

test("run focus defaults to no angles and explore-new off, and older briefs parse unchanged", () => {
  const old = { name: "Old", sectors: ["Healthcare"], models: ["B2B subscription"], geography: "Japan", context: "" };
  assert.deepEqual(projectSchema.parse(old), { ...old, angles: [], explore_new: false });
  assert.deepEqual(researchRequestSchema.parse({ ...old, language: "en" }).angles, []);
  // Saved projects return the columns; a legacy single sector/model brief still parses.
  assert.equal(projectSchema.parse({ name: "Legacy", sector: "Healthcare", model: "B2B subscription", geography: "Japan", context: "" }).explore_new, false);
});

test("angles are the spec's fourteen constraints, at most six, each once", () => {
  assert.equal(angleOptions.length, 14);
  assert.equal(maxAngles, 6);
  assert.equal(visibleAngles, 8);
  for (const angle of angleOptions) assert.ok(!researchSectors.includes(angle) && !businessModels.includes(angle), `${angle} does not overlap industries or models`);
  assert.equal(projectSchema.safeParse({ ...brief, angles: angleOptions.slice(0, 6), explore_new: true }).success, true);
  assert.equal(projectSchema.safeParse({ ...brief, angles: angleOptions.slice(0, 7) }).success, false, "seven is too many");
  assert.equal(projectSchema.safeParse({ ...brief, angles: ["Privacy-first", "Privacy-first"] }).success, false, "each once");
  assert.equal(projectSchema.safeParse({ ...brief, angles: ["Cheap"] }).success, false, "only listed angles");
  assert.equal(projectSchema.safeParse({ ...brief, explore_new: "yes" }).success, false);
});

test("briefFocus spells out angles only when there are some", () => {
  assert.doesNotMatch(briefFocus({ sectors: ["Healthcare"], models: ["B2B subscription"] }), /Constraints/);
  assert.doesNotMatch(briefFocus({ sectors: ["Healthcare"], models: ["B2B subscription"], angles: [] }), /Constraints/);
  assert.match(briefFocus({ sectors: ["Healthcare"], models: ["B2B subscription"], angles: ["Remote-only", "Privacy-first"] }), /Constraints for this run: Remote-only; Privacy-first\. Every hypothesis must satisfy all of them\.$/);
});

test("angle labels are translated in every catalogue", async () => {
  const { messageKey } = await import("../i18n/config.ts");
  const catalogs = ["en", "zh-Hans", "zh-Hant"].map(locale => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")).ui);
  for (const angle of angleOptions) for (const ui of catalogs) assert.ok(ui[messageKey(angle)], angle);
});
