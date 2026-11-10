import test from "node:test";
import assert from "node:assert/strict";
import { normalizeClaims, citableSources, normalizeEvaluation, evaluationSchema, MAX_CLAIMS, METHODOLOGY_VERSION, methodology } from "../lib/research-core.ts";
import { opportunitySchema } from "../lib/workspace-schema.ts";

const citable = { supporting: ["c1-s1", "c1-s2"], contradicting: ["c1-s3"] };
const claim = (overrides = {}) => ({ text: "Agencies spend ten hours a week on proposals.", kind: "observed", section: "pain", source_keys: ["c1-s1"], ...overrides });

test("unknown and ineligible source keys are dropped, at most four kept, each once", () => {
  const [kept] = normalizeClaims([claim({ source_keys: ["c1-s1", "c9-s1", "c1-s1", " c1-s2 ", "c2-s1"] })], citable);
  assert.deepEqual(kept.source_keys, ["c1-s1", "c1-s2"]);
  const many = normalizeClaims([claim({ section: "risk", source_keys: ["c1-s1", "c1-s2", "c1-s3", "c1-s1", "c1-s2"] })], { supporting: ["c1-s1", "c1-s2", "c1-s4", "c1-s5"], contradicting: ["c1-s3"] });
  assert.deepEqual(many[0].source_keys, ["c1-s1", "c1-s2", "c1-s3"]);
  const five = normalizeClaims([claim({ source_keys: ["a", "b", "c", "d", "e"] })], { supporting: ["a", "b", "c", "d", "e"], contradicting: [] });
  assert.equal(five[0].source_keys.length, 4);
});

test("an observed claim without a remaining supporting or neutral source becomes an inference", () => {
  assert.equal(normalizeClaims([claim({ source_keys: ["c9-s9"] })], citable)[0].kind, "inference", "only invalid keys");
  assert.equal(normalizeClaims([claim({ source_keys: [] })], citable)[0].kind, "inference", "no keys");
  // A risk claim may cite counter-evidence, but counter-evidence alone never makes a claim "observed".
  const [risk] = normalizeClaims([claim({ section: "risk", source_keys: ["c1-s3"] })], citable);
  assert.deepEqual([risk.kind, risk.source_keys], ["inference", ["c1-s3"]]);
  assert.equal(normalizeClaims([claim()], citable)[0].kind, "observed", "a valid supporting key keeps it observed");
});

test("contradicting sources may be cited only by risk claims", () => {
  for (const section of ["buyer", "pain", "demand", "competition", "economics"]) {
    const [kept] = normalizeClaims([claim({ section, kind: "inference", source_keys: ["c1-s3", "c1-s1"] })], citable);
    assert.deepEqual(kept.source_keys, ["c1-s1"], section);
  }
  assert.deepEqual(normalizeClaims([claim({ section: "risk", kind: "inference", source_keys: ["c1-s3"] })], citable)[0].source_keys, ["c1-s3"]);
});

test("assumptions cite nothing and keep what would confirm them; kinds and sections are normalised", () => {
  const [assumption] = normalizeClaims([claim({ kind: "Assumption", section: " Buyer ", source_keys: ["c1-s1"], confirm: "Ten interviews with agency owners." })], citable);
  assert.deepEqual(assumption, { text: "Agencies spend ten hours a week on proposals.", kind: "assumption", section: "buyer", source_keys: [], confirm: "Ten interviews with agency owners." });
  assert.equal("confirm" in normalizeClaims([claim({ confirm: "ignored" })], citable)[0], false, "only assumptions carry a confirmation");
  assert.equal(normalizeClaims([claim({ kind: "guess" })], citable)[0].kind, "inference", "an unknown kind is treated as an inference");
  assert.deepEqual(normalizeClaims([claim({ section: "vibes" }), claim({ text: "   " })], citable), [], "unknown sections and empty text are dropped");
});

test("text is clipped at a sentence boundary, and at most twelve claims are kept", () => {
  const long = `${"Agencies spend many hours on proposals every week. ".repeat(10)}And then some more text that runs on and on and on.`;
  const [clipped] = normalizeClaims([claim({ text: long })], citable);
  assert.ok(clipped.text.length <= 400);
  assert.match(clipped.text, /\.…$/, "cut after a full sentence");
  assert.equal(normalizeClaims(Array.from({ length: 20 }, () => claim()), citable).length, MAX_CLAIMS);
});

test("citable sources split a candidate's gated sources by stance", () => {
  assert.deepEqual(citableSources([{ source_key: "a", stance: "supports" }, { source_key: "b", stance: "neutral" }, { source_key: "c", stance: "contradicts" }]), { supporting: ["a", "b"], contradicting: ["c"] });
});

test("evaluations keep claims only when told what is citable, and older checkpoints and payloads stay valid", () => {
  const item = { candidate_id: "c1", description: "d", category: "Services", revenue: "r", cost: "c", risk: "k", assumptions: ["a"], validation: ["v"], dimensions: { pain: 50, demand: 50, economics: 50, feasibility: 50, advantage: 50 }, rationale: "r", claims: [claim()] };
  assert.equal("claims" in normalizeEvaluation({ items: [item] }, ["c1"]).items[0], false, "no citable map, no claims");
  assert.equal(normalizeEvaluation({ items: [item] }, ["c1"], "combined", { c1: citable }).items[0].claims.length, 1);
  assert.equal("claims" in normalizeEvaluation({ items: [{ ...item, claims: [claim({ section: "vibes" })] }] }, ["c1"], "combined", { c1: citable }).items[0], false, "no valid claims, no field");
  const { claims: _claims, ...old } = item;
  assert.equal(evaluationSchema.safeParse({ items: [old] }).success, true, "a pre-v3 evaluation checkpoint");
  // Opportunity payloads from v1 and v2 (no claims, no version) still parse; scores keep exactly five dimensions.
  const v1 = { id: "o", title: "t", category: "c", description: "d", buyer: "b", pain: "p", score: 50, confidence: "limited", revenue: "r", cost: "c", risk: "k", scores: [50, 50, 50, 50, 50], icon: "workflow" };
  assert.equal(opportunitySchema.safeParse(v1).success, true);
  assert.equal(opportunitySchema.safeParse({ ...v1, score_before_review: 60, score_cap: 70 }).success, true, "v2");
  assert.equal(opportunitySchema.safeParse({ ...v1, methodology_version: 3, claims: [claim()] }).success, true, "v3");
  assert.equal(opportunitySchema.safeParse({ ...v1, scores: [50, 50, 50, 50] }).success, false, "scores stay length 5");
  assert.equal(METHODOLOGY_VERSION, 3);
  assert.equal(methodology, "evidence-driven-v3");
});

test("citation numbers follow the order sources are listed, not the order claims cite them", async () => {
  const { citationNumbers, claimsBySection, sourceAnchor } = await import("../lib/report-presentation.ts");
  const evidence = ["c1-s2", "c1-s1", "c1-s3", "c1-s1"].map(source_key => ({ source_key, url: "https://example.org", title: source_key, retrieved_at: "2026-11-10", published_at: null }));
  assert.deepEqual([...citationNumbers(evidence)], [["c1-s2", 1], ["c1-s1", 2], ["c1-s3", 3]], "listed order; a repeated key keeps its first number");
  assert.equal(citationNumbers(undefined).size, 0);
  assert.equal(sourceAnchor("c1-s1"), "source-c1-s1");
  assert.equal(sourceAnchor('c1"><x'), "source-c1---x", "safe as an element id");
  const groups = claimsBySection([claim({ section: "risk" }), claim({ section: "buyer", text: "b1" }), claim({ section: "buyer", text: "b2" })]);
  assert.deepEqual(groups.map(g => [g.section, g.claims.map(c => c.text)]), [["buyer", ["b1", "b2"]], ["risk", ["Agencies spend ten hours a week on proposals."]]]);
  assert.deepEqual(claimsBySection(undefined), []);
});
