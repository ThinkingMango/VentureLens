import { researchModels, researchModelPricing, searchQueryAllowance, type ResearchModelId } from "./research-models.ts";

export type UnitPricing = { input: number; output: number; search: number };

// Fixed context headroom added to every reservation for provider-side wrapping and tool instructions.
export const RESERVATION_CONTEXT_HEADROOM = 12_000;

export function providerOf(model: ResearchModelId): "qwen" | "gemini" {
  return model.startsWith("qwen") ? "qwen" : "gemini";
}

/**
 * The amount reserved before one provider call. Prompt sizes are counted in bytes and charged as if each byte were a
 * token, which over-reserves (a token is ~4 bytes of English), so a call never spends more than it reserved for input.
 * Shared by the engine and the cost estimate so the two cannot drift.
 */
export function reservationFor(model: ResearchModelId, pricing: UnitPricing, call: { promptBytes: number; systemBytes?: number; schemaBytes?: number; search: boolean }) {
  const config = researchModels[model];
  const textBound = call.promptBytes + (call.systemBytes ?? 0) + RESERVATION_CONTEXT_HEADROOM;
  const inputBound = call.search ? Math.max(config.searchInputAllowance, textBound) : textBound + (call.schemaBytes ?? 0);
  const outputBound = call.search ? config.searchOutputTokens : config.outputTokens;
  const searchAllowance = call.search ? searchQueryAllowance[providerOf(model)] : 0;
  return { inputBound, outputBound, searchAllowance, usd: inputBound * pricing.input + outputBound * pricing.output + searchAllowance * pricing.search };
}

/**
 * Typical shape of one research run, calibrated against the production usage ledger (2026-11-05): Gemini Flash-Lite
 * discovery used ~260 input / ~1,300 output tokens; each Gemini retrieval used ~120 input tokens, filled its 512-token
 * output cap and issued 1–2 paid queries; Gemini 4 Argon discovery used ~4,300–5,000 output tokens with high thinking.
 * Stage counts follow the engine: 8 candidates, up to 4 sources each, classification in batches of 8 sources,
 * evaluation and review in batches of 2 candidates.
 */
export const typicalRun = {
  candidates: 8,
  discovery: { inputTokens: 1_500, outputTokens: 2_000, promptBytes: 3_000 },
  retrieval: { inputTokens: { gemini: 400, qwen: 8_000 }, queries: 2, promptBytes: 700 },
  classification: { calls: 4, inputTokens: 7_000, outputTokens: 2_500, promptBytes: 28_000 },
  // Methodology v3 (WP-07): 3–12 claims per candidate add about 1,500 output tokens per batch of two. Re-calibrate
  // against the usage ledger after real v3 runs.
  evaluation: { calls: 4, inputTokens: 6_500, outputTokens: 4_500, promptBytes: 26_000 },
  review: { calls: 4, inputTokens: 5_000, outputTokens: 1_500, promptBytes: 20_000 },
  systemBytes: 800,
  schemaBytes: 2_000,
} as const;

/**
 * Typical shape of a "Verify my idea" run (WP-05): one small structured call that only writes two search queries, two
 * searches for the single candidate, and one batch each of classification (up to 8 sources), evaluation and review for
 * one candidate. Estimated from the combined-run calibration; re-calibrate after real verify runs.
 */
export const typicalVerifyRun = {
  discovery: { inputTokens: 900, outputTokens: 250, promptBytes: 2_200 },
  searches: 2,
  classification: { calls: 1, inputTokens: 7_000, outputTokens: 2_500, promptBytes: 28_000 },
  evaluation: { calls: 1, inputTokens: 3_800, outputTokens: 2_400, promptBytes: 14_000 },
  review: { calls: 1, inputTokens: 2_800, outputTokens: 800, promptBytes: 10_000 },
} as const;

const thinkingOverhead = { minimal: 0, low: 1_000, medium: 2_500, high: 4_000 } as const;
function structuredOutputTokens(model: ResearchModelId, visible: number) {
  const thinking = researchModels[model].thinking;
  const extra = typeof thinking === "string" ? thinkingOverhead[thinking] : 0;
  return Math.min(researchModels[model].outputTokens, visible + extra);
}

export type RunCostEstimate = {
  model: ResearchModelId;
  /** Expected total provider cost of a complete run. */
  expectedUsd: number;
  /** Smallest per-run budget that lets every reservation in a typical run succeed. */
  requiredUsd: number;
  /** The stage whose reservation sets `requiredUsd`. */
  peakStage: string;
};

/**
 * Estimates what a complete run on one model costs and the budget it needs to finish. Estimates, not quotes.
 * `mode` "verify" estimates a single-idea run; every other mode runs the eight-candidate pipeline.
 */
export function estimateRunCost(model: ResearchModelId, at = new Date(), mode = "combined"): RunCostEstimate {
  const verify = mode === "verify";
  const shape = verify ? typicalVerifyRun : typicalRun;
  const pricing = researchModelPricing(model, at);
  const provider = providerOf(model);
  const calls: { stage: string; reservation: number; actual: number }[] = [];
  const structured = (stage: string, shape: { inputTokens: number; outputTokens: number; promptBytes: number }) => {
    const reservation = reservationFor(model, pricing, { promptBytes: shape.promptBytes, systemBytes: typicalRun.systemBytes, schemaBytes: typicalRun.schemaBytes, search: false }).usd;
    calls.push({ stage, reservation, actual: shape.inputTokens * pricing.input + structuredOutputTokens(model, shape.outputTokens) * pricing.output });
  };
  structured("discovery", shape.discovery);
  const searches = verify ? typicalVerifyRun.searches : typicalRun.candidates;
  for (let i = 1; i <= searches; i++) {
    const reservation = reservationFor(model, pricing, { promptBytes: typicalRun.retrieval.promptBytes, search: true }).usd;
    calls.push({ stage: verify ? (i === 1 ? "retrieval:c1" : "retrieval:c1:alt") : `retrieval:c${i}`, reservation, actual: typicalRun.retrieval.inputTokens[provider] * pricing.input + researchModels[model].searchOutputTokens * pricing.output + typicalRun.retrieval.queries * pricing.search });
  }
  for (const stage of ["classification", "evaluation", "review"] as const) {
    for (let i = 0; i < shape[stage].calls; i++) structured(`${stage}:batch:${i}`, shape[stage]);
  }
  let spent = 0;
  let requiredUsd = 0;
  let peakStage = "discovery";
  for (const call of calls) {
    if (spent + call.reservation > requiredUsd) { requiredUsd = spent + call.reservation; peakStage = call.stage; }
    spent += call.actual;
  }
  const round = (value: number) => Math.ceil(value * 10_000) / 10_000;
  return { model, expectedUsd: round(spent), requiredUsd: round(requiredUsd), peakStage };
}

export function fitsBudget(model: ResearchModelId, budgetUsd: number, at = new Date(), mode = "combined") {
  return estimateRunCost(model, at, mode).requiredUsd <= budgetUsd;
}
