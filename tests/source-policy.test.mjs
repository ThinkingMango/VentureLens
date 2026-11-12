import test from "node:test";
import assert from "node:assert/strict";
import * as policy from "../lib/source-policy.ts";
import { estimateRunCost, stageCalls, defaultRunShape } from "../lib/research-budget.ts";
import { researchSettingsSchema, providerSettingsSchema, readStoredProviderSettings, runCostEstimates, assertBudgetFits, recommendedBudget } from "../lib/provider-settings-core.ts";
import { researchSectors, anySector } from "../lib/research-options.ts";
import { candidateDiagnosisSchema, classificationSchema, MAX_CLASSIFIED_SOURCES } from "../lib/research-core.ts";

const { defaultSourcePolicy, legacySourcePolicy, sourcePolicySchema, resolveSourcePolicy, searchGuidance, queryEvidence, queryGuidance, retrievalLimits, runShape, communityHint } = policy;
const at = new Date("2026-11-06T00:00:00Z");
const custom = (patch) => ({ ...defaultSourcePolicy, kinds: [...defaultSourcePolicy.kinds], ...patch });

const original = "Prefer sources that are not selling a product in this space: buyer forums and communities, industry associations, surveys and research, news and analyst coverage, government or regulatory pages, and job postings. Include at most one vendor product page.";
test("the legacy source policy reproduces the engine's original prompts and depth exactly", () => {
  assert.equal(searchGuidance(legacySourcePolicy), original);
  assert.equal(queryEvidence(legacySourcePolicy), "surveys, industry reports, forum discussions, news");
  assert.equal(queryGuidance(legacySourcePolicy, ["Healthcare"]), "");
  assert.deepEqual(retrievalLimits(legacySourcePolicy, "combined"), { evidence: 4, sources: 10 });
  assert.deepEqual(retrievalLimits(legacySourcePolicy, "verify"), { evidence: 8, sources: 16 });
  assert.deepEqual(runShape(legacySourcePolicy), defaultRunShape);
});

test("new runs default to sector communities, and differ from the legacy policy in nothing else", () => {
  assert.equal(defaultSourcePolicy.sectorCommunities, true);
  assert.deepEqual({ ...defaultSourcePolicy, sectorCommunities: false }, legacySourcePolicy);
  const guidance = searchGuidance(defaultSourcePolicy, ["Healthcare"]);
  assert.ok(guidance.startsWith(original), "the original guidance is kept; the community hint is added after it");
  assert.match(guidance, /Look first where these buyers discuss their own work: clinician and practice-manager forums/);
  assert.match(queryGuidance(defaultSourcePolicy, ["Healthcare"]), /Phrase each query the way these buyers describe the problem/);
  // Same depth and searches, so the same cost.
  assert.deepEqual(runShape(defaultSourcePolicy), runShape(legacySourcePolicy));
  assert.deepEqual(resolveSourcePolicy(undefined), defaultSourcePolicy, "a row with no saved policy uses the new default");
  assert.deepEqual(resolveSourcePolicy(undefined, legacySourcePolicy), legacySourcePolicy, "the engine's fallback for older runs");
});

test("source policies are validated strictly and source types are kept in canonical order", () => {
  const parsed = sourcePolicySchema.parse(custom({ kinds: ["jobs", "communities", "jobs"] }));
  assert.deepEqual(parsed.kinds, ["communities", "jobs"]);
  for (const bad of [
    { kinds: [] }, { kinds: ["blogs"] }, { vendorPages: 2 }, { vendorPages: "1" }, { recency: "5y" },
    { candidates: 4 }, { candidates: 9 }, { candidates: 6.5 }, { pagesPerIdea: 1 }, { pagesPerIdea: 7 }, { sectorCommunities: "true" },
  ]) assert.equal(sourcePolicySchema.safeParse(custom(bad)).success, false, JSON.stringify(bad));
  assert.equal(sourcePolicySchema.safeParse({ ...custom({}), extra: true }).success, false, "unknown keys are rejected");
  const { recency: _omitted, ...missing } = custom({});
  assert.equal(sourcePolicySchema.safeParse(missing).success, false, "a stored policy is complete");
});

test("an invalid or missing policy resolves to fresh defaults and never throws", () => {
  for (const value of [undefined, null, "broad", { kinds: [] }, { ...custom({}), candidates: 99 }]) {
    assert.deepEqual(resolveSourcePolicy(value), defaultSourcePolicy);
  }
  const resolved = resolveSourcePolicy(undefined);
  resolved.kinds.push("jobs");
  assert.equal(defaultSourcePolicy.kinds.length, policy.sourceKinds.length, "callers cannot mutate the defaults");
  resolveSourcePolicy(null, legacySourcePolicy).kinds.push("jobs");
  assert.equal(legacySourcePolicy.kinds.length, policy.sourceKinds.length);
  assert.ok(policy.sameSourcePolicy(undefined, defaultSourcePolicy));
  assert.ok(!policy.sameSourcePolicy(custom({ candidates: 6 }), undefined));
});

test("breadth options only steer the search; the vendor option can tighten but never loosen", () => {
  const none = searchGuidance(custom({ vendorPages: 0 }));
  assert.match(none, /Do not include vendor product pages\./);
  assert.doesNotMatch(none, /at most one/);
  for (const vendorPages of [0, 1]) for (const kinds of [["communities"], [...policy.sourceKinds]]) {
    const text = searchGuidance(custom({ vendorPages, kinds }), ["Healthcare"]);
    assert.doesNotMatch(text, /two vendor|more vendor|several vendor|vendor pages are fine/i);
    assert.match(text, /not selling a product in this space/);
  }
  assert.equal(searchGuidance(custom({ kinds: ["communities", "government"] })).split(".")[0], "Prefer sources that are not selling a product in this space: buyer forums and communities and government or regulatory pages");
  assert.equal(queryEvidence(custom({ kinds: ["government", "communities"] })), "forum discussions, government or regulator data");
  assert.match(searchGuidance(custom({ recency: "1y" })), /last 12 months/);
  assert.match(searchGuidance(custom({ recency: "3y" })), /last three years/);
  assert.doesNotMatch(searchGuidance(custom({ recency: "any" })), /published in the last/);
  const communities = searchGuidance(custom({ sectorCommunities: true }), ["Healthcare", "Legal & compliance"]);
  assert.match(communities, /clinician and practice-manager forums/);
  assert.match(communities, /compliance-officer forums/);
  assert.match(queryGuidance(custom({ sectorCommunities: true }), ["Professional services"]), /accountants, lawyers and consultants/);
});

test("every named industry has a community hint, and others fall back to a generic one", () => {
  for (const sector of researchSectors) {
    if (sector === anySector) continue;
    assert.ok(policy.sectorCommunityHints[sector], `missing community hint for ${sector}`);
  }
  assert.deepEqual(Object.keys(policy.sectorCommunityHints).sort(), researchSectors.filter(sector => sector !== anySector).sort(), "no hints for industries the brief cannot name");
  assert.match(communityHint([anySector]), /buyer's own profession/);
  assert.match(communityHint([]), /buyer's own profession/);
  assert.doesNotMatch(Object.values(policy.sectorCommunityHints).join(" "), /\.(com|org|net|co)\b|https?:/, "hints name kinds of place, never sites");
});

test("depth stays inside the limits the rest of the pipeline enforces", () => {
  for (let pages = policy.MIN_PAGES_PER_IDEA; pages <= policy.MAX_PAGES_PER_IDEA; pages++) {
    const discovery = retrievalLimits(custom({ pagesPerIdea: pages }), "combined");
    const verify = retrievalLimits(custom({ pagesPerIdea: pages }), "verify");
    assert.ok(discovery.sources > discovery.evidence && verify.sources > verify.evidence);
    // The outcome diagnosis lists each candidate's sources and accepts at most 16 of them.
    assert.ok(verify.evidence <= 16 && discovery.evidence <= 16);
    assert.equal(candidateDiagnosisSchema.shape.sources.safeParse(Array.from({ length: verify.evidence }, () => ({ url: "https://a.org", title: "t", domain: "a.org", reliability: null, stance: null, relevant: null }))).success, true);
  }
});

test("the cost estimate follows breadth and depth, and the default shape is unchanged", () => {
  for (const model of ["qwen3.8-flash", "gemini-3.5-flash-lite"]) {
    assert.deepEqual(estimateRunCost(model, at, "combined", defaultRunShape), estimateRunCost(model, at));
    assert.deepEqual(estimateRunCost(model, at, "verify", defaultRunShape), estimateRunCost(model, at, "verify"));
    const narrow = estimateRunCost(model, at, "combined", { candidates: 5, pagesPerIdea: 2, alternativesSearch: false });
    const wide = estimateRunCost(model, at, "combined", { candidates: 8, pagesPerIdea: 6, alternativesSearch: true });
    const base = estimateRunCost(model, at);
    assert.ok(narrow.expectedUsd < base.expectedUsd && base.expectedUsd < wide.expectedUsd);
    assert.ok(narrow.requiredUsd < base.requiredUsd && base.requiredUsd < wide.requiredUsd);
  }
  assert.deepEqual(stageCalls(defaultRunShape), { searches: 8, classification: 4, evaluation: 4, review: 4 });
  assert.deepEqual(stageCalls({ candidates: 5, pagesPerIdea: 6, alternativesSearch: true }), { searches: 10, classification: 4, evaluation: 3, review: 3 });
  assert.deepEqual(stageCalls({ candidates: 8, pagesPerIdea: 6, alternativesSearch: true }, "verify"), { searches: 2, classification: 2, evaluation: 1, review: 1 });
});

test("the admin budget check refuses a breadth the budget cannot pay for", () => {
  // Budgets are derived from the estimate plus the required headroom (recommendedBudget), not hard-coded, so this tests
  // the rule rather than today's prices.
  const gemini = { primary: "gemini", autoFallback: false, qwenModel: "qwen3.8-flash", geminiModel: "gemini-3.5-flash-lite" };
  const needs = sources => recommendedBudget(runCostEstimates({ ...gemini, budgetUsd: 5, sources }, at).primary.requiredUsd);
  const atDefault = needs(undefined);
  assert.doesNotThrow(() => assertBudgetFits({ ...gemini, budgetUsd: atDefault }, at));
  // A second search per idea roughly doubles Google Search grounding, the largest Gemini cost.
  const wider = custom({ alternativesSearch: true });
  assert.ok(needs(wider) > atDefault * 1.4);
  assert.throws(() => assertBudgetFits({ ...gemini, budgetUsd: atDefault, sources: wider }, at), /BUDGET_TOO_LOW/);
  assert.doesNotThrow(() => assertBudgetFits({ ...gemini, budgetUsd: needs(wider), sources: wider }, at));
  // A narrower run fits a budget the default depth cannot.
  const narrow = custom({ candidates: 5, pagesPerIdea: 2 });
  assert.ok(needs(narrow) < atDefault);
  assert.throws(() => assertBudgetFits({ ...gemini, budgetUsd: needs(narrow) }, at), /BUDGET_TOO_LOW/);
  assert.doesNotThrow(() => assertBudgetFits({ ...gemini, budgetUsd: needs(narrow), sources: narrow }, at));
  // Sector communities change the prompt, not the cost.
  assert.equal(needs(defaultSourcePolicy), needs(legacySourcePolicy));
});

test("the stored research settings carry an optional source policy beside the provider policy", () => {
  const routing = { primary: "qwen", autoFallback: true, qwenModel: "qwen3.8-flash", geminiModel: "gemini-3.5-flash-lite", claudeModel: "claude-opus-5-5", budgetUsd: 0.25 };
  const sources = custom({ candidates: 6, vendorPages: 0 });
  assert.deepEqual(researchSettingsSchema.parse({ ...routing, sources }), { ...routing, sources });
  assert.deepEqual(researchSettingsSchema.parse(routing), routing, "omitting the policy adds nothing");
  assert.equal(researchSettingsSchema.safeParse({ ...routing, sources: { ...sources, pagesPerIdea: 9 } }).success, false);
  assert.equal(providerSettingsSchema.safeParse({ ...routing, sources }).success, false, "the provider policy the engine snapshots stays routing-only");
  const stored = { ...routing, sources, updatedAt: "2026-11-11T00:00:00.000Z" };
  assert.deepEqual(readStoredProviderSettings(stored), stored);
  assert.equal("sources" in readStoredProviderSettings({ ...routing, updatedAt: stored.updatedAt }), false);
  assert.throws(() => readStoredProviderSettings({ ...stored, sources: { kinds: [] } }), /PROVIDER_CONFIGURATION/);
});

// Production 2026-11-11: with 6 pages per idea, a run read 37 pages and classified 36, over the old literal cap of 32.
// The classification was saved, then failed to parse at evaluation (INVALID_OUTPUT), and its retry failed the same way.
test("a classification at the source policy's deepest setting can be saved and read back", () => {
  const deepest = custom({ candidates: policy.MAX_CANDIDATES, pagesPerIdea: policy.MAX_PAGES_PER_IDEA });
  assert.equal(sourcePolicySchema.safeParse(deepest).success, true);
  const discovery = deepest.candidates * retrievalLimits(deepest, "combined").evidence;
  const verify = retrievalLimits(deepest, "verify").evidence;
  assert.ok(discovery <= MAX_CLASSIFIED_SOURCES && verify <= MAX_CLASSIFIED_SOURCES);
  const item = (n) => ({ source_key: `c${n % 8 + 1}-s${n}`, relevant: true, kind: "pain", reliability: "secondary", stance: "supports", quote: "A quote copied from the page itself.", claim: "A claim." });
  for (const count of [36, discovery]) {
    assert.equal(classificationSchema.safeParse({ items: Array.from({ length: count }, (_, n) => item(n)) }).success, true, `${count} classified sources`);
  }
});
