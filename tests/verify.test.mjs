import test from "node:test";
import assert from "node:assert/strict";
import { projectSchema, researchRequestSchema, emptyBrief } from "../lib/workspace-schema.ts";
import { normalizeVerifyDiscovery, mergeSearchSources, verifyDiscoverySchema, discoveryCheckpointSchema, discoverySchema, scoringWeights, outcomeSchema } from "../lib/research-core.ts";
import { estimateRunCost } from "../lib/research-budget.ts";
import { researchModels } from "../lib/research-models.ts";
import { eventProps } from "../lib/events-core.ts";

const idea = { title: "Appointment reminders for physio clinics", buyer: "Owners of small physiotherapy clinics", pain: "Missed appointments cost clinics revenue every week.", offer: "SMS and WhatsApp reminders", price_hint: "$49/month" };
const brief = { ...emptyBrief, name: "Check my idea", discovery_mode: "verify", idea };

test("an idea is required for verify briefs and forbidden for discovery briefs", () => {
  assert.equal(projectSchema.safeParse(brief).success, true);
  assert.equal(projectSchema.safeParse({ ...brief, idea: undefined }).success, false, "verify needs an idea");
  assert.equal(projectSchema.safeParse({ ...brief, discovery_mode: "combined" }).success, false, "discovery briefs carry no idea");
  assert.equal(projectSchema.safeParse({ ...brief, discovery_mode: "combined", idea: undefined }).success, true);
  assert.equal(researchRequestSchema.safeParse({ ...brief, language: "zh-Hant" }).success, true);
  assert.equal(researchRequestSchema.safeParse({ ...brief, idea: undefined, language: "en" }).success, false);
  assert.equal(projectSchema.safeParse({ ...brief, discovery_mode: "explore" }).success, false, "unknown modes are rejected");
  // Field bounds, and defaults for the optional fields.
  for (const [field, value] of [["title", "ab"], ["buyer", "x"], ["pain", "too short"], ["title", "x".repeat(181)], ["price_hint", "x".repeat(101)]])
    assert.equal(projectSchema.safeParse({ ...brief, idea: { ...idea, [field]: value } }).success, false, `${field} = ${value.length} chars`);
  assert.deepEqual(projectSchema.parse({ ...brief, idea: { title: idea.title, buyer: idea.buyer, pain: idea.pain } }).idea, { title: idea.title, buyer: idea.buyer, pain: idea.pain, offer: "", price_hint: "" });
});

test("older briefs and saved projects keep parsing: no mode, legacy single values, and a null idea column", () => {
  const legacy = { name: "Old brief", sector: "Healthcare", model: "B2B subscription", geography: "Japan", context: "" };
  assert.equal(projectSchema.parse(legacy).idea, undefined);
  assert.equal(researchRequestSchema.parse({ ...legacy, language: "en" }).discovery_mode, undefined);
  const row = { ...emptyBrief, name: "Saved", discovery_mode: "market", idea: null };
  assert.equal(projectSchema.parse(row).idea, undefined, "a database null is read as no idea");
});

test("the verify candidate keeps the founder's text exactly; only the queries come from the model", () => {
  const unusual = { ...idea, title: "  ignored: the schema trims  ", buyer: "Clinic owners — 1–2 rooms (UK)", pain: "患者爽約令診所每週損失收入，前台要逐一致電提醒。" };
  const output = normalizeVerifyDiscovery({ query: "UK physiotherapy clinic missed appointment cost survey", query_alt: "how UK physio clinics remind patients about appointments" }, unusual);
  assert.deepEqual(Object.keys(output.candidates[0]).sort(), ["advantage", "buyer", "key", "pain", "query", "query_alt", "solution", "title"]);
  const [c1] = output.candidates;
  assert.equal(c1.key, "c1");
  assert.equal(c1.title, unusual.title, "title as given, not clipped or re-spaced");
  assert.equal(c1.buyer, unusual.buyer);
  assert.equal(c1.pain, unusual.pain);
  assert.equal(c1.solution, unusual.offer);
  assert.equal(c1.advantage, "");
  // Missing or too-short queries fall back to the founder's words.
  const fallback = normalizeVerifyDiscovery({ query: "x", query_alt: "" }, idea).candidates[0];
  assert.equal(fallback.query, `${idea.title} ${idea.buyer}`);
  assert.equal(fallback.query_alt, idea.pain);
  assert.ok(verifyDiscoverySchema.safeParse(output).success);
});

test("a stored discovery checkpoint is read with the schema for its mode", () => {
  const verifyCheckpoint = normalizeVerifyDiscovery({ query: "physio clinic missed appointment cost", query_alt: "physio clinic reminder alternatives" }, idea);
  assert.ok(discoveryCheckpointSchema("verify").safeParse(verifyCheckpoint).success);
  assert.equal(discoveryCheckpointSchema("combined").safeParse(verifyCheckpoint).success, false, "discovery still needs 5–8 candidates");
  assert.equal(discoveryCheckpointSchema("combined"), discoverySchema);
  assert.equal(verifyDiscoverySchema.safeParse({ candidates: [...verifyCheckpoint.candidates, verifyCheckpoint.candidates[0]] }).success, false, "verify holds exactly one candidate");
});

test("merging two searches keeps the first copy of each URL, in search order, and drops unsafe ones", () => {
  const merged = mergeSearchSources(
    [{ url: "https://a.org/1", title: "A" }, { url: "https://b.org/2#section", title: "B" }, { url: "javascript:alert(1)" }],
    [{ url: "https://b.org/2", title: "B again" }, { url: "https://c.org/3", title: "C" }, { url: "https://a.org/1", title: "A again" }],
  );
  assert.deepEqual(merged.map(s => s.title), ["A", "B", "C"]);
  assert.deepEqual(mergeSearchSources([], []), []);
});

test("verify runs score like combined discovery and are recorded as verify everywhere", () => {
  assert.deepEqual(scoringWeights.verify, scoringWeights.combined);
  assert.ok(Math.abs(Object.values(scoringWeights.verify).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.equal(outcomeSchema.shape.mode.safeParse("verify").success, true);
  assert.ok(eventProps("run_started", { mode: "verify", language: "en" }));
  assert.ok(eventProps("run_finished", { status: "completed", error_code: null, opportunities: 1, mode: "verify" }));
});

test("a verify run is estimated to cost less than a discovery run, on every model", () => {
  const at = new Date("2026-11-10T00:00:00Z");
  for (const model of Object.keys(researchModels)) {
    const verify = estimateRunCost(model, at, "verify");
    const combined = estimateRunCost(model, at, "combined");
    assert.ok(verify.expectedUsd < combined.expectedUsd, `${model}: expected ${verify.expectedUsd} < ${combined.expectedUsd}`);
    assert.ok(verify.requiredUsd < combined.requiredUsd, `${model}: required ${verify.requiredUsd} < ${combined.requiredUsd}`);
    assert.deepEqual(estimateRunCost(model, at), combined, "the default stays the discovery estimate");
  }
});

test("strings that reach copy() through variables are translated in every catalogue", async () => {
  // The literal-call catalogue test cannot see these: idea error messages come from ideaSchema, the demo example's
  // title and buyer from demo data, and the history status from a table.
  const { readFileSync } = await import("node:fs");
  const { messageKey } = await import("../i18n/config.ts");
  const { ideaSchema } = await import("../lib/workspace-schema.ts");
  const { demoVerifyOutcome } = await import("../lib/demo-data.ts");
  const catalogs = ["en", "zh-Hans", "zh-Hant"].map(locale => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")).ui);
  const ideaErrors = ideaSchema.safeParse({ title: "", buyer: "", pain: "" }).error.issues.map(issue => issue.message);
  assert.equal(ideaErrors.length, 3);
  const sources = [...ideaErrors, "Not yet supported", "Idea check", ...demoVerifyOutcome.candidates.flatMap(c => [c.title, c.buyer])];
  for (const source of sources) for (const ui of catalogs) assert.ok(ui[messageKey(source)], source);
});
