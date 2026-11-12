import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateRunCost, fitsBudget, reservationFor } from '../lib/research-budget.ts';
import { researchModelPricing, qwenModelIds, geminiModelIds } from '../lib/research-models.ts';
import { runCostEstimates, assertBudgetFits } from '../lib/provider-settings-core.ts';
import {
  normalizeDiscovery, normalizeClassification, normalizeEvaluation, normalizeReview, clipText,
  discoveryDraftSchema, evaluationSchema, groundedClassifications,
} from '../lib/research-core.ts';

const november = new Date('2026-11-06T00:00:00Z');

test('estimates reproduce the production usage ledger of 2026-11-05', () => {
  // Run 11436d76: Gemini Flash-Lite spent $0.19 on its first seven searches, then could not reserve the eighth.
  const pricing = researchModelPricing('gemini-3.5-flash-lite', november);
  const search = 400 * pricing.input + 512 * pricing.output + 2 * pricing.search;
  assert.ok(Math.abs(7 * search - 0.19) < 0.03, `seven searches ≈ $0.19, estimated ${7 * search}`);
  // Runs 8740abe9 / ae402dc2: Gemini 4 Argon discovery cost $0.045–$0.051.
  const argon = researchModelPricing('gemini-4-argon', november);
  const discovery = 1_500 * argon.input + Math.min(10_000, 2_000 + 4_000) * argon.output;
  assert.ok(discovery > 0.04 && discovery < 0.07);
});

test('at the $0.25 default only Qwen Flash can finish a run; the live production policy cannot finish at all', () => {
  const fits = [...qwenModelIds, ...geminiModelIds].filter(model => fitsBudget(model, 0.25, november));
  assert.deepEqual(fits, ['qwen3.8-flash']);
  // Live policy on 2026-11-05: Gemini 4 Argon primary, Qwen 3.8 Max fallback, $0.25 per run.
  const live = runCostEstimates({ primary: 'gemini', autoFallback: true, qwenModel: 'qwen3.8-max', geminiModel: 'gemini-4-argon', budgetUsd: 0.25 }, november);
  assert.ok(live.primary.requiredUsd > 1, 'Argon needs more than $1 per run');
  assert.ok(live.fallback.requiredUsd > 0.25, 'Qwen Max cannot finish within $0.25 either');
  assert.throws(() => assertBudgetFits({ primary: 'gemini', autoFallback: true, qwenModel: 'qwen3.8-max', geminiModel: 'gemini-4-argon', budgetUsd: 0.25 }, november), /BUDGET_TOO_LOW/);
  assert.doesNotThrow(() => assertBudgetFits({ primary: 'qwen', autoFallback: true, qwenModel: 'qwen3.8-flash', geminiModel: 'gemini-3.5-flash-lite', budgetUsd: 0.25 }, november));
  assert.doesNotThrow(() => assertBudgetFits({ primary: 'gemini', autoFallback: false, qwenModel: 'qwen3.8-flash', geminiModel: 'gemini-3.5-flash-lite', budgetUsd: 0.5 }, november));
});

test('estimates follow scheduled price changes and never fall below the expected spend', () => {
  assert.ok(estimateRunCost('gemini-4-argon', new Date('2026-12-02')).requiredUsd > estimateRunCost('gemini-4-argon', november).requiredUsd * 1.5);
  for (const model of [...qwenModelIds, ...geminiModelIds]) {
    const estimate = estimateRunCost(model, november);
    assert.ok(estimate.requiredUsd >= estimate.expectedUsd, model);
    assert.ok(estimate.expectedUsd > 0, model);
  }
});

test('reservations bound input by prompt bytes and reserve every paid query a search may issue', () => {
  const pricing = researchModelPricing('qwen3.8-flash');
  const structured = reservationFor('qwen3.8-flash', pricing, { promptBytes: 10_000, systemBytes: 500, schemaBytes: 2_000, search: false });
  assert.equal(structured.inputBound, 10_000 + 500 + 12_000 + 2_000);
  assert.equal(structured.searchAllowance, 0);
  const search = reservationFor('gemini-3.5-flash-lite', researchModelPricing('gemini-3.5-flash-lite'), { promptBytes: 700, search: true });
  assert.equal(search.searchAllowance, 4);
  assert.equal(search.outputBound, 512);
  assert.ok(search.usd < 0.1, 'a Gemini search must not hold a third of a $0.25 run');
});

const candidate = n => ({ key: `x${n}`, title: `Opportunity ${n}`, buyer: 'Clinic managers', pain: 'Manual intake', solution: 'Intake automation', advantage: 'Operator network', query: `clinic intake automation buyers ${n}` });

test('discovery keys are assigned by position and long or extra fields are trimmed instead of failing the run', () => {
  const draft = discoveryDraftSchema.parse({ candidates: [...Array.from({ length: 9 }, (_, i) => candidate(i)), candidate(10)] });
  draft.candidates[0].buyer = 'word '.repeat(400);
  draft.candidates[1].query = 'short';
  const result = normalizeDiscovery(draft);
  assert.deepEqual(result.candidates.map(c => c.key), ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']);
  assert.ok(result.candidates[0].buyer.length <= 800 && result.candidates[0].buyer.endsWith('…'));
  assert.ok(result.candidates[1].query.length >= 10);
  assert.throws(() => normalizeDiscovery({ candidates: [candidate(1), candidate(2)] }), /INVALID_OUTPUT/);
});

test('classification ignores unknown and repeated sources and keeps long quotes verbatim', () => {
  const excerpt = 'Practice managers say intake paperwork takes nine hours a week. '.repeat(20);
  const evidence = [{ source_key: 'c1-s1', candidate_id: 'c1', url: 'https://a.org/1', title: 'A', excerpt, retrieved_at: '', published_at: null }];
  const item = { relevant: true, kind: 'pain', reliability: 'primary', stance: 'supports', claim: 'Real pain' };
  const result = normalizeClassification({ items: [
    { ...item, source_key: 'c1-s1', quote: excerpt.slice(0, 700) },
    { ...item, source_key: 'c1-s1', quote: 'duplicate entry ignored here' },
    { ...item, source_key: 'invented', quote: 'not a requested source' },
  ] }, ['c1-s1', 'c1-s2']);
  assert.equal(result.items.length, 1);
  assert.ok(result.items[0].quote.length <= 500);
  assert.equal(groundedClassifications(evidence, result.items).length, 1, 'a trimmed quote is still found verbatim in the excerpt');
});

test('evaluation and review clamp scores, cap lists and drop unusable items instead of failing', () => {
  const base = { description: 'd', category: 'Services', revenue: 'Unverified assumption', cost: 'Unverified assumption', risk: 'r', rationale: 'x'.repeat(2600), assumptions: ['a', 'b', 'c', 'd', 'e'], validation: ['interview'], dimensions: { pain: 72.6, demand: 140, economics: -5, feasibility: 50, advantage: 0 } };
  const evaluation = normalizeEvaluation({ items: [
    { ...base, candidate_id: 'c1' },
    { ...base, candidate_id: 'c2', validation: [] },
    { ...base, candidate_id: 'c9' },
  ] }, ['c1', 'c2']);
  assert.deepEqual(evaluation.items.map(item => item.candidate_id), ['c1']);
  assert.deepEqual(evaluation.items[0].dimensions, { pain: 73, demand: 100, economics: 0, feasibility: 50, advantage: 0 });
  assert.equal(evaluation.items[0].assumptions.length, 4);
  assert.ok(evaluation.items[0].rationale.length <= 2000);
  assert.doesNotThrow(() => evaluationSchema.parse(evaluation));
  const review = normalizeReview({ items: [{ candidate_id: 'c1', reject: false, critique: 'c', penalty: 44.4, falsification: 'f' }, { candidate_id: 'c3', reject: true, critique: 'c', penalty: 0, falsification: 'f' }] }, ['c1', 'c2']);
  // Methodology v2: a review deduction is clamped to 15 (it was 30), the most the review may take.
  assert.deepEqual(review.items.map(item => [item.candidate_id, item.penalty]), [['c1', 15]]);
});

test('clipping prefers sentence boundaries, keeps short text and stays within the limit', () => {
  assert.equal(clipText('  short  text ', 50), 'short text');
  const long = 'First sentence is complete. Second sentence keeps going well past the limit we set.';
  const clipped = clipText(long, 40);
  assert.ok(clipped.length <= 40 && clipped.endsWith('…'));
  assert.equal(clipText('一句话。'.repeat(100), 30).length <= 30, true);
});

test('a saved budget keeps headroom over the estimate, so a re-calibration cannot silently move runs to the fallback', async () => {
  const { recommendedBudget, BUDGET_HEADROOM } = await import('../lib/provider-settings-core.ts');
  // Production 2026-11-11: $0.55 was saved for Gemini 3.8 Flash at $0.5435; WP-07 raised the estimate to $0.5675 and
  // the next run started on Qwen. With headroom, that budget is refused and $0.63 is asked for instead.
  const live = { primary: 'gemini', autoFallback: true, qwenModel: 'qwen3.8-flash', geminiModel: 'gemini-3.8-flash', budgetUsd: 0.55 };
  // WP-16's next steps raised the estimate again, to $0.5789; the $0.63 that WP-07's headroom asked for still covers it.
  const required = estimateRunCost('gemini-3.8-flash', november).requiredUsd;
  assert.equal(required, 0.5789);
  assert.throws(() => assertBudgetFits(live, november), error => error.message === 'BUDGET_TOO_LOW' && error.requiredUsd === 0.64);
  assert.doesNotThrow(() => assertBudgetFits({ ...live, budgetUsd: 0.64 }, november));
  // A budget an older estimate accepted with headroom still fits the new one at run start, which checks without headroom.
  assert.ok(recommendedBudget(0.5435) >= 0.5675);
  assert.ok(recommendedBudget(0.5675) >= required, "the budget saved after WP-07 still starts runs on the primary model");
  for (const model of [...qwenModelIds, ...geminiModelIds]) {
    const { requiredUsd } = estimateRunCost(model, november);
    const recommended = recommendedBudget(requiredUsd);
    assert.ok(recommended >= requiredUsd * BUDGET_HEADROOM - 1e-9, model);
    assert.equal(Math.round(recommended * 100) / 100, recommended, `${model} is asked for whole cents`);
  }
  assert.equal(recommendedBudget(0.5), 0.55, 'exact products are not rounded up a cent by floating point');
});

test('each retrieval step fits in the platform function duration, however long its searches run', async () => {
  const { searchTimeout, SEARCH_TIMEOUT_MS, RETRIEVAL_STEP_BUDGET_MS, PAGE_READ_RESERVE_MS, MIN_SEARCH_MS } = await import('../lib/research-models.ts');
  const start = 1_000_000;
  assert.equal(searchTimeout('qwen', start, start), 150_000);
  assert.equal(searchTimeout('gemini', start, start), 90_000);
  // After a full-length Qwen search, its fallback gets only what is left before the page-read reserve.
  assert.equal(searchTimeout('gemini', start, start + SEARCH_TIMEOUT_MS.qwen), RETRIEVAL_STEP_BUDGET_MS - PAGE_READ_RESERVE_MS - SEARCH_TIMEOUT_MS.qwen);
  assert.ok(searchTimeout('qwen', start, start + 165_000) < MIN_SEARCH_MS, 'too little time left: not sent');
  // Searches end by budget − reserve; page reads stop starting at the budget and each read times out after 15 s.
  assert.ok(RETRIEVAL_STEP_BUDGET_MS + 15_000 < 300_000, 'stays inside the 300 s default function duration');
  assert.ok(SEARCH_TIMEOUT_MS.qwen > 90_000, 'Qwen gets more than the 90 s that cut off run 0373ec17');
});

test('a transiently failed search is skipped only while the provider looks slow rather than down', async () => {
  const { transientSkipAllowed } = await import('../lib/research-core.ts');
  const T = 'TRANSIENT_PROVIDER', E = 'evidence', U = 'RETRIEVAL_UNAVAILABLE';
  assert.equal(transientSkipAllowed([E, E, E, E, E, E, E], 0), true, 'run 0373ec17: the 8th of 8, after 7 with evidence');
  assert.equal(transientSkipAllowed([], 7), true, 'the first candidate, with others still to search');
  assert.equal(transientSkipAllowed([], 0), false, 'a single candidate (verify mode)');
  assert.equal(transientSkipAllowed([E, T], 5), false, 'two in a row');
  assert.equal(transientSkipAllowed([T, E], 5), true, 'separated by a success');
  assert.equal(transientSkipAllowed([T, E, T, E], 3), false, 'a quarter of 8 already skipped');
  assert.equal(transientSkipAllowed([T, E], 1), false, 'a quarter of 4 already skipped');
  assert.equal(transientSkipAllowed([U, U], 0), false, 'last candidate and nothing found before it');
  assert.equal(transientSkipAllowed([U, E], 0), true);
});
