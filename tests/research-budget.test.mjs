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
  assert.deepEqual(review.items.map(item => [item.candidate_id, item.penalty]), [['c1', 30]]);
});

test('clipping prefers sentence boundaries, keeps short text and stays within the limit', () => {
  assert.equal(clipText('  short  text ', 50), 'short text');
  const long = 'First sentence is complete. Second sentence keeps going well past the limit we set.';
  const clipped = clipText(long, 40);
  assert.ok(clipped.length <= 40 && clipped.endsWith('…'));
  assert.equal(clipText('一句话。'.repeat(100), 30).length <= 30, true);
});
