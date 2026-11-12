import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeSteps, normalizeEvaluation, evaluationSchema, MAX_STEPS, STEP_DAYS } from "../lib/research-core.ts";
import { liveSteps, liveOpportunityView } from "../lib/opportunity-view.ts";
import { opportunitySchema } from "../lib/workspace-schema.ts";
import { sprintRequestSchema } from "../lib/sprint-core.ts";

const draft = (overrides = {}) => ({ action: "Ask five clinic owners how they book appointments", where: "c1-s1", where_hint: "", done_when: "Five conversations held", stop_if: "Fewer than two describe the problem", tests_assumption: 0, day: 5, ...overrides });

test("a step keeps a source only when it is one of the candidate's supporting sources", () => {
  const [kept, contradicting, unknown] = normalizeSteps([draft(), draft({ where: "c1-s3", where_hint: "Practice managers' forum" }), draft({ where: "c2-s1" })], ["c1-s1", "c1-s2"], 2);
  assert.equal(kept.where, "c1-s1");
  assert.equal(kept.where_hint, "", "no hint once a source is cited");
  assert.equal(contradicting.where, null, "a contradicting source is not a place to find buyers");
  assert.equal(contradicting.where_hint, "Practice managers' forum");
  assert.equal(unknown.where, null, "another candidate's source is dropped");
});

test("a step needs an action, a done-when and a stop-if; at most four are kept", () => {
  const steps = normalizeSteps([draft({ action: " " }), draft({ done_when: "" }), draft({ stop_if: undefined }), ...Array.from({ length: 6 }, (_, i) => draft({ action: `Step ${i}`, day: i + 1 }))], ["c1-s1"], 1);
  assert.equal(steps.length, MAX_STEPS);
  assert.deepEqual(steps.map(step => step.action), ["Step 0", "Step 1", "Step 2", "Step 3"]);
});

test("days are clamped to the 14-day plan, spread when missing, and never go backwards", () => {
  const days = steps => normalizeSteps(steps, [], 1).map(step => step.day);
  assert.deepEqual(days([draft({ day: 0 }), draft({ day: 40 })]), [1, STEP_DAYS]);
  assert.deepEqual(days([draft({ day: 9 }), draft({ day: 3 }), draft({ day: 12 })]), [9, 9, 12]);
  assert.deepEqual(days([draft({ day: undefined }), draft({ day: "soon" }), draft({ day: Number.NaN })]), [5, 9, 14]);
});

test("an assumption index outside the candidate's assumptions becomes null; long text is clipped", () => {
  const [step] = normalizeSteps([draft({ tests_assumption: 3, action: "x".repeat(400), stop_if: "y".repeat(300) })], [], 2);
  assert.equal(step.tests_assumption, null);
  assert.ok(step.action.length <= 300 && step.stop_if.length <= 200);
});

const evaluationDraft = (steps, validation = ["Interview ten owners"]) => ({ items: [{
  candidate_id: "c1", description: "d", category: "c", revenue: "r (unverified)", cost: "c (unverified)", risk: "k",
  assumptions: ["Owners book by phone", "They pay for software"], validation, rationale: "why",
  dimensions: { pain: 60, demand: 50, economics: 40, feasibility: 70, advantage: 30 }, steps,
}] });
const citable = { c1: { supporting: ["c1-s1"], contradicting: ["c1-s3"] } };

test("the evaluation keeps two to four steps; one step is not a plan, and old checkpoints without steps still parse", () => {
  const two = normalizeEvaluation(evaluationDraft([draft(), draft({ action: "Offer a paid pilot", day: 12 })]), ["c1"], "combined", citable).items[0];
  assert.equal(two.steps.length, 2);
  const one = normalizeEvaluation(evaluationDraft([draft()]), ["c1"], "combined", citable).items[0];
  assert.equal(one.steps, undefined);
  assert.deepEqual(one.validation, ["Interview ten owners"]);
  assert.equal(normalizeEvaluation(evaluationDraft([draft(), draft()]), ["c1"], "combined").items[0].steps, undefined, "no citable sources, no steps");
  assert.doesNotThrow(() => evaluationSchema.parse({ items: [{ ...one, steps: undefined }] }));
});

test("when the model leaves validation empty, the steps' actions stand in for it", () => {
  const item = normalizeEvaluation(evaluationDraft([draft(), draft({ action: "Offer a paid pilot" })], []), ["c1"], "combined", citable).items[0];
  assert.deepEqual(item.validation, ["Ask five clinic owners how they book appointments", "Offer a paid pilot"]);
  assert.equal(normalizeEvaluation(evaluationDraft([], []), ["c1"], "combined", citable).items.length, 0, "no validation and no steps: unusable");
});

const opportunity = (extra = {}) => opportunitySchema.parse({
  id: "o1", title: "t", category: "c", description: "d", buyer: "Clinic owners", pain: "p", score: 50, confidence: "Limited", revenue: "r", cost: "c", risk: "k",
  scores: [50, 50, 50, 50, 50], icon: "workflow", assumptions: ["Owners book by phone"],
  evidence: [{ source_key: "c1-s1", url: "https://forum.example.org/t/1", title: "Clinic owners on scheduling", retrieved_at: "2026-11-01", published_at: null, stance: "supports" }],
  ...extra,
});

test("the page shows each step with its numbered source, or its hint as a suggestion, and the assumption it tests", () => {
  const view = liveOpportunityView(opportunity({ steps: [
    { action: "Ask five owners", where: "c1-s1", where_hint: "", done_when: "5 held", stop_if: "<2 confirm", tests_assumption: 0, day: 5 },
    { action: "Offer a pilot", where: null, where_hint: "Local practice groups", done_when: "1 pays", stop_if: "none pay", tests_assumption: null, day: 14 },
    { action: "Ask about spend", where: "c1-s9", where_hint: "", done_when: "3 figures", stop_if: "none", tests_assumption: 4, day: 9 },
  ], steps_version: 1 }));
  assert.deepEqual(view.steps[0].source, { key: "c1-s1", number: 1, title: "Clinic owners on scheduling", url: "https://forum.example.org/t/1", domain: "forum.example.org" });
  assert.equal(view.steps[0].assumption, "Owners book by phone");
  assert.deepEqual([view.steps[1].source, view.steps[1].hint, view.steps[1].assumption], [null, "Local practice groups", null]);
  assert.deepEqual([view.steps[2].source, view.steps[2].hint, view.steps[2].assumption], [null, null, null], "a source no longer listed and a bad index show nothing rather than something wrong");
  assert.deepEqual(liveSteps(opportunity(), []), [], "reports made before WP-16 have no steps and keep the fixed first steps");
});

test("starting a sprint sends the founder's labels; old clients that send none still validate", () => {
  const start = { action: "start", opportunity_id: "5f0c8a9e-1f6b-4f8e-9a77-1f2d3c4b5a69", length: 14 };
  assert.deepEqual(sprintRequestSchema.parse(start).labels, []);
  assert.deepEqual(sprintRequestSchema.parse({ ...start, labels: ["Where", "Where to look (suggestion)", "Done when", "Stop if"] }).labels.length, 4);
  assert.equal(sprintRequestSchema.safeParse({ ...start, labels: ["a", "b", "c", "d", "e"] }).success, false);
});

test("the evaluation prompt asks for compact steps, past behaviour, and no ads, scraping or bulk messages", () => {
  const engine = readFileSync(new URL("../lib/research-engine.ts", import.meta.url), "utf8");
  assert.match(engine, /const STEP_RULES = `"steps": 2–3 next steps/);
  assert.match(engine, /never suggest paid ads, scraping personal data or bulk messaging/);
  assert.match(engine, /\$\{CLAIM_RULES\} \$\{STEP_RULES\}/);
  assert.match(engine, /steps: e\.steps, steps_version: STEPS_VERSION/);
});

test("the Markdown export lists next steps with where, done-when and stop-if", async () => {
  const exporter = await import("../lib/report-export.ts");
  const item = opportunity({ steps: [
    { action: "Ask five owners", where: "c1-s1", where_hint: "", done_when: "5 held", stop_if: "<2 confirm", tests_assumption: 0, day: 5 },
    { action: "Offer a pilot", where: null, where_hint: "Local practice groups", done_when: "1 pays", stop_if: "none pay", tests_assumption: null, day: 14 },
  ], steps_version: 1 });
  const markdown = exporter.opportunityMarkdown(exporter.buildOpportunityExport(item, { copy: (text, values) => text.replace(/\{(\w+)\}/g, (_, k) => String(values?.[k] ?? "")), locale: "en", generatedAt: "2026-11-12T00:00:00Z" }));
  // Markdown special characters in the text are escaped, as everywhere in the export.
  assert.match(markdown, /## Next steps\n\n1\. Ask five owners · Where: \\\[1\\\] Clinic owners on scheduling · Done when: 5 held · Stop if: \\<2 confirm\n2\. Offer a pilot · Where to look \(suggestion\): Local practice groups · Done when: 1 pays · Stop if: none pay/);
});
