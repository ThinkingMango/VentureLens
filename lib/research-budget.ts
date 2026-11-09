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
 * How many hypotheses discovery generates. The count follows the per-run budget (see `candidatesForBudget`):
 * - Fewer than 5 is never run. Production runs kept 0–5 of 8 hypotheses after the evidence gate, so a smaller start
 *   would mostly produce empty reports.
 * - More than 12 is never asked for. Past that, one discovery call tends to repeat itself, every repeat still pays for
 *   a full search, and retrieval (one hypothesis at a time) gets long.
 * - 8 was the fixed count before the budget set it. Runs started before then, and estimates that do not name a
 *   count, use it.
 */
export const MIN_CANDIDATES = 5;
export const MAX_CANDIDATES = 12;
export const DEFAULT_CANDIDATES = 8;
/** Sources kept per hypothesis after retrieval. Classification checks 8 sources per call, i.e. 2 hypotheses. */
export const SOURCES_PER_CANDIDATE = 4;

/**
 * Typical shape of one research run, calibrated against the production usage ledger (2026-11-05): Gemini Flash-Lite
 * discovery used ~260 input / ~1,300 output tokens for 8 hypotheses; each Gemini retrieval used ~120 input tokens,
 * filled its 512-token output cap and issued 1–2 paid queries; Gemini 4 Argon discovery used ~4,300–5,000 output tokens
 * with high thinking. Per-call shapes are fixed; the number of calls follows the hypothesis count (`stageCalls`).
 */
export const typicalRun = {
  discovery: { inputTokens: 1_500, outputTokensPerCandidate: 250, promptBytes: 3_000 },
  retrieval: { inputTokens: { gemini: 400, qwen: 8_000 }, queries: 2, promptBytes: 700 },
  classification: { inputTokens: 7_000, outputTokens: 2_500, promptBytes: 28_000 },
  evaluation: { inputTokens: 6_000, outputTokens: 3_000, promptBytes: 24_000 },
  review: { inputTokens: 5_000, outputTokens: 1_500, promptBytes: 20_000 },
  systemBytes: 800,
  schemaBytes: 2_000,
} as const;

/**
 * Calls a run of `candidates` hypotheses makes after discovery, following the engine: one search per hypothesis;
 * classification in batches of 8 sources (2 hypotheses at 4 sources each); evaluation and review in batches of 2.
 */
export function stageCalls(candidates: number) {
  const batches = Math.ceil(candidates / 2);
  return { retrieval: candidates, classification: batches, evaluation: batches, review: batches };
}

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
  /** How many hypotheses the estimate assumes. */
  candidates: number;
};

/**
 * Estimates what a complete run of `candidates` hypotheses on one model costs and the budget it needs to finish.
 * Estimates, not quotes.
 */
export function estimateRunCost(model: ResearchModelId, at = new Date(), candidates = DEFAULT_CANDIDATES): RunCostEstimate {
  const pricing = researchModelPricing(model, at);
  const provider = providerOf(model);
  const counts = stageCalls(candidates);
  const calls: { stage: string; reservation: number; actual: number }[] = [];
  const structured = (stage: string, shape: { inputTokens: number; outputTokens: number; promptBytes: number }) => {
    const reservation = reservationFor(model, pricing, { promptBytes: shape.promptBytes, systemBytes: typicalRun.systemBytes, schemaBytes: typicalRun.schemaBytes, search: false }).usd;
    calls.push({ stage, reservation, actual: shape.inputTokens * pricing.input + structuredOutputTokens(model, shape.outputTokens) * pricing.output });
  };
  const { outputTokensPerCandidate, ...discovery } = typicalRun.discovery;
  structured("discovery", { ...discovery, outputTokens: outputTokensPerCandidate * candidates });
  for (let i = 1; i <= counts.retrieval; i++) {
    const reservation = reservationFor(model, pricing, { promptBytes: typicalRun.retrieval.promptBytes, search: true }).usd;
    calls.push({ stage: `retrieval:c${i}`, reservation, actual: typicalRun.retrieval.inputTokens[provider] * pricing.input + researchModels[model].searchOutputTokens * pricing.output + typicalRun.retrieval.queries * pricing.search });
  }
  for (const stage of ["classification", "evaluation", "review"] as const) {
    for (let i = 0; i < counts[stage]; i++) structured(`${stage}:batch:${i}`, typicalRun[stage]);
  }
  let spent = 0;
  let requiredUsd = 0;
  let peakStage = "discovery";
  for (const call of calls) {
    if (spent + call.reservation > requiredUsd) { requiredUsd = spent + call.reservation; peakStage = call.stage; }
    spent += call.actual;
  }
  const round = (value: number) => Math.ceil(value * 10_000) / 10_000;
  return { model, expectedUsd: round(spent), requiredUsd: round(requiredUsd), peakStage, candidates };
}

export function fitsBudget(model: ResearchModelId, budgetUsd: number, at = new Date(), candidates = DEFAULT_CANDIDATES) {
  return estimateRunCost(model, at, candidates).requiredUsd <= budgetUsd;
}

/**
 * The most hypotheses, from MIN_CANDIDATES to MAX_CANDIDATES, that every listed model could finish within the budget,
 * or null when even MIN_CANDIDATES does not fit. All models must fit because a run can move to its fallback part way
 * through (Qwen's search timed out in both production runs that tried it): a count sized for the cheaper model would
 * stop the run during retrieval, after money was spent and before any report.
 *
 * No extra margin is added: `requiredUsd` is already the peak of the run's reservations, which charge every prompt
 * byte as a token and add fixed context headroom, so it sits above the expected spend.
 */
export function candidatesForBudget(models: ResearchModelId[], budgetUsd: number, at = new Date()): number | null {
  if (!models.length) return null;
  for (let candidates = MAX_CANDIDATES; candidates >= MIN_CANDIDATES; candidates--) {
    if (models.every(model => fitsBudget(model, budgetUsd, at, candidates))) return candidates;
  }
  return null;
}
