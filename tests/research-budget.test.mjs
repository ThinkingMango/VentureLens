import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { estimateRunCost, fitsBudget, reservationFor, candidatesForBudget, stageCalls, MIN_CANDIDATES, MAX_CANDIDATES, DEFAULT_CANDIDATES, SOURCES_PER_CANDIDATE } from '../lib/research-budget.ts';
import { researchModelPricing, qwenModelIds, geminiModelIds } from '../lib/research-models.ts';
import { runCostEstimates, assertBudgetFits, runPlan } from '../lib/provider-settings-core.ts';
import {
  normalizeDiscovery, normalizeClassification, normalizeEvaluation, normalizeReview, clipText,
  discoveryDraftSchema, discoverySchema, classificationSchema, evaluationSchema, reviewSchema, groundedClassifications,
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

test('at the $0.25 default only Qwen Flash can finish an 8-hypothesis run; the live production policy cannot finish at all', () => {
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

// ---------------------------------------------------------------------------------------------------------------
// The budget sets how many hypotheses a run explores.
// ---------------------------------------------------------------------------------------------------------------
const allModels = [...qwenModelIds, ...geminiModelIds];
const livePolicy = { primary: 'qwen', autoFallback: true, qwenModel: 'qwen3.8-flash', geminiModel: 'gemini-3.5-flash-lite', budgetUsd: 0.4 };
const anchor = new Date('2026-11-09T00:00:00Z');

test('an estimate that names no count is the old fixed 8-hypothesis run, to the cent', () => {
  assert.equal(DEFAULT_CANDIDATES, 8);
  // Figures from estimateRunCost before the count became a parameter.
  assert.deepEqual(estimateRunCost('gemini-3.5-flash-lite', anchor), { model: 'gemini-3.5-flash-lite', expectedUsd: 0.3323, requiredUsd: 0.355, peakStage: 'review:batch:3', candidates: 8 });
  assert.deepEqual(estimateRunCost('qwen3.8-flash', anchor), { model: 'qwen3.8-flash', expectedUsd: 0.0459, requiredUsd: 0.0529, peakStage: 'review:batch:3', candidates: 8 });
  assert.deepEqual(stageCalls(8), { retrieval: 8, classification: 4, evaluation: 4, review: 4 });
  assert.deepEqual(stageCalls(9), { retrieval: 9, classification: 5, evaluation: 5, review: 5 });
});

test('cost never falls as the hypothesis count rises, on any model', () => {
  for (const model of allModels) {
    let previous = { expectedUsd: 0, requiredUsd: 0 };
    for (let n = MIN_CANDIDATES; n <= MAX_CANDIDATES; n++) {
      const estimate = estimateRunCost(model, november, n);
      assert.equal(estimate.candidates, n);
      assert.ok(estimate.expectedUsd >= previous.expectedUsd && estimate.requiredUsd >= previous.requiredUsd, `${model} at ${n}`);
      assert.ok(estimate.requiredUsd >= estimate.expectedUsd, `${model} at ${n}`);
      previous = estimate;
    }
  }
});

test('the count is the most every listed model can finish, clamped to 5–12, and never shrinks as the budget grows', () => {
  for (const model of allModels) {
    let previous = null;
    for (let cents = 5; cents <= 500; cents += 5) {
      const budget = cents / 100;
      const count = candidatesForBudget([model], budget, november);
      if (count !== null) {
        assert.ok(count >= MIN_CANDIDATES && count <= MAX_CANDIDATES);
        assert.ok(fitsBudget(model, budget, november, count), `${model} must finish ${count} at $${budget}`);
        if (count < MAX_CANDIDATES) assert.ok(!fitsBudget(model, budget, november, count + 1), `${model} could finish ${count + 1} at $${budget}`);
      } else {
        assert.ok(!fitsBudget(model, budget, november, MIN_CANDIDATES));
      }
      assert.ok(previous === null || (count ?? 0) >= previous, `${model} shrank at $${budget}`);
      previous = count ?? 0;
    }
  }
  assert.equal(candidatesForBudget([], 5, november), null);
  // Qwen Flash is cheap enough for the maximum at the old default; Flash-Lite is not, so a pair is sized for Flash-Lite.
  assert.equal(candidatesForBudget(['qwen3.8-flash'], 0.25, november), MAX_CANDIDATES);
  assert.equal(candidatesForBudget(['qwen3.8-flash', 'gemini-3.5-flash-lite'], 0.25, november), candidatesForBudget(['gemini-3.5-flash-lite'], 0.25, november));
});

test('the live production policy keeps 8 hypotheses at $0.40 and gains or loses them with the budget', () => {
  assert.deepEqual(runPlan(livePolicy, 0.4, anchor), { providers: ['qwen', 'gemini'], candidates: 8 });
  assert.deepEqual(runPlan(livePolicy, 0.25, anchor), { providers: ['qwen', 'gemini'], candidates: 5 });
  assert.deepEqual(runPlan(livePolicy, 0.55, anchor), { providers: ['qwen', 'gemini'], candidates: MAX_CANDIDATES });
  assert.deepEqual(runPlan(livePolicy, 5, anchor), { providers: ['qwen', 'gemini'], candidates: MAX_CANDIDATES });
  const estimate = runCostEstimates({ ...livePolicy, budgetUsd: 0.25 }, anchor);
  assert.equal(estimate.candidates, 5);
  assert.equal(estimate.fallback.candidates, 5);
  assert.ok(estimate.fallback.requiredUsd <= 0.25);
});

test('a fallback that cannot finish even the smallest run is dropped instead of shrinking the run below 5', () => {
  // Flash-Lite needs ≈ $0.24 for 5 hypotheses, so at $0.20 the run is Qwen alone, sized for Qwen.
  assert.deepEqual(runPlan(livePolicy, 0.2, anchor), { providers: ['qwen'], candidates: MAX_CANDIDATES });
  const estimate = runCostEstimates({ ...livePolicy, budgetUsd: 0.2 }, anchor);
  assert.equal(estimate.fallback.candidates, MIN_CANDIDATES, 'a left-out fallback is shown at the smallest run');
  assert.ok(estimate.fallback.requiredUsd > 0.2);
  // A primary that cannot finish hands the run to the fallback alone, as before.
  assert.deepEqual(runPlan({ ...livePolicy, primary: 'gemini' }, 0.2, anchor), { providers: ['qwen'], candidates: MAX_CANDIDATES });
  // The live policy of 2026-11-05 (Argon, Qwen Max fallback) cannot finish anything at $0.25.
  assert.equal(runPlan({ primary: 'gemini', autoFallback: true, qwenModel: 'qwen3.8-max', geminiModel: 'gemini-4-argon', budgetUsd: 0.25 }, 0.25, november), null);
});

test('saving accepts any budget that runs the smallest run on the primary, and names that minimum otherwise', () => {
  assert.doesNotThrow(() => assertBudgetFits({ primary: 'gemini', autoFallback: false, qwenModel: 'qwen3.8-flash', geminiModel: 'gemini-3.5-flash-lite', budgetUsd: 0.25 }, november));
  try {
    assertBudgetFits({ primary: 'gemini', autoFallback: false, qwenModel: 'qwen3.8-flash', geminiModel: 'gemini-3.5-flash-lite', budgetUsd: 0.2 }, november);
    assert.fail('expected BUDGET_TOO_LOW');
  } catch (error) {
    assert.match(error.message, /BUDGET_TOO_LOW/);
    assert.equal(error.requiredUsd, estimateRunCost('gemini-3.5-flash-lite', november, MIN_CANDIDATES).requiredUsd);
  }
  // A primary that only the fallback could replace is still rejected: runs would never use the chosen model.
  assert.throws(() => assertBudgetFits({ ...livePolicy, primary: 'gemini', budgetUsd: 0.2 }, anchor), /BUDGET_TOO_LOW/);
});

test('every run-wide schema accepts the largest run and rejects one hypothesis more', () => {
  const draft = discoveryDraftSchema.parse({ candidates: Array.from({ length: 14 }, (_, i) => candidate(i)) });
  const twelve = normalizeDiscovery(draft, MAX_CANDIDATES);
  assert.deepEqual(twelve.candidates.map(c => c.key), Array.from({ length: 12 }, (_, i) => `c${i + 1}`));
  assert.equal(normalizeDiscovery(draft, 99).candidates.length, MAX_CANDIDATES, 'a larger limit is clamped');
  assert.equal(normalizeDiscovery(draft, 5).candidates.length, 5);
  assert.throws(() => normalizeDiscovery({ candidates: draft.candidates.slice(0, 4) }, 12), /INVALID_OUTPUT/);
  assert.equal(discoverySchema.safeParse({ candidates: [...twelve.candidates, { ...twelve.candidates[0], key: 'c13' }] }).success, false);
  assert.equal(discoverySchema.safeParse({ candidates: twelve.candidates.slice(0, 5).map((c, i) => ({ ...c, key: ['c0', 'c13', 'c01', 'C1', 'c1'][i] })) }).success, false);
  // The classification, evaluation and review checkpoints hold every source or hypothesis of the run, not one batch.
  const classified = { source_key: 's', relevant: true, kind: 'pain', reliability: 'primary', stance: 'supports', quote: 'q', claim: 'c' };
  assert.equal(SOURCES_PER_CANDIDATE, 4);
  assert.ok(classificationSchema.safeParse({ items: Array(MAX_CANDIDATES * SOURCES_PER_CANDIDATE).fill(classified) }).success, '48 sources');
  assert.equal(classificationSchema.safeParse({ items: Array(MAX_CANDIDATES * SOURCES_PER_CANDIDATE + 1).fill(classified) }).success, false);
  const evaluated = { candidate_id: 'c1', description: 'd', category: 'c', revenue: 'r', cost: 'c', risk: 'r', assumptions: ['a'], validation: ['v'], dimensions: { pain: 1, demand: 1, economics: 1, feasibility: 1, advantage: 1 }, rationale: 'r' };
  assert.ok(evaluationSchema.safeParse({ items: Array(MAX_CANDIDATES).fill(evaluated) }).success);
  assert.equal(evaluationSchema.safeParse({ items: Array(MAX_CANDIDATES + 1).fill(evaluated) }).success, false);
  const reviewed = { candidate_id: 'c1', reject: false, critique: 'c', penalty: 0, falsification: 'f' };
  assert.ok(reviewSchema.safeParse({ items: Array(MAX_CANDIDATES).fill(reviewed) }).success);
});

test('the database accepts a report as large as the largest run', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const latest = files.filter(f => readFileSync(new URL(f, dir), 'utf8').includes('function public.finish_research')).at(-1);
  const sql = readFileSync(new URL(latest, dir), 'utf8');
  const [, max] = /jsonb_array_length\(p_report->'opportunities'\)(?:, 0\))? not between 1 and (\d+)/.exec(sql) ?? [];
  assert.equal(Number(max), MAX_CANDIDATES, `${latest} must accept up to MAX_CANDIDATES opportunities`);
});
