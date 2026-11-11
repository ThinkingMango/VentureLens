import { registrableDomain, safeSourceUrl } from "./research-core.ts";

// Research quality metrics for /admin/quality (spec WP-01 §2) and the evaluation script (scripts/research-eval.mjs).
// Pure functions over rows the caller has already read, so every definition is unit-tested on fixed samples.

export const metricWindows = [7, 30, 90] as const;
export type MetricWindow = (typeof metricWindows)[number];
export function parseMetricWindow(value: unknown): MetricWindow {
  const days = Number(Array.isArray(value) ? value[0] : value);
  return (metricWindows as readonly number[]).includes(days) ? (days as MetricWindow) : 30;
}

export type MetricRun = {
  id: string;
  status: string;
  error_code: string | null;
  started_at: string | null;
  completed_at: string | null;
  /** Stopped before its first request because no configured model could finish within the budget (budget_block "estimate"). */
  preflight_blocked?: boolean;
};
export type MetricUsage = { run_id: string | null; status: string; estimated_usd: number | string | null; reserved_usd: number | string };
/** One classified source: its classification's reliability. */
export type MetricSource = { reliability: string | null | undefined };
/** One saved opportunity: its run and the evidence list stored on its payload. */
export type MetricOpportunity = { run_id: string; evidence: unknown };

/** Committed cost of usage rows: the settled estimate when known, otherwise the full reservation (as researchDetail and the refund trigger count it). */
export function committedUsd(rows: MetricUsage[]): number {
  return rows.reduce((sum, row) => sum + Number(row.status === "completed" ? row.estimated_usd ?? 0 : row.reserved_usd), 0);
}

/** Median: the middle value, or the mean of the two middle values. Null for an empty list. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Nearest-rank percentile (p in 0–100): the smallest value with at least p% of values at or below it. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

/** Run duration from start to completion in milliseconds, or null when either time is missing or out of order. */
export function durationMs(run: Pick<MetricRun, "started_at" | "completed_at">): number | null {
  if (!run.started_at || !run.completed_at) return null;
  const ms = Date.parse(run.completed_at) - Date.parse(run.started_at);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/**
 * Independent supporting domains of a saved opportunity, counted the way the evidence gate counts them: distinct
 * registrable domains of sources marked "supports". Reports from before stance was recorded (methodology v1) kept
 * only sources the gate accepted, so every source on them counts.
 */
export function opportunitySupportingDomains(evidence: unknown): number {
  if (!Array.isArray(evidence)) return 0;
  const domains = new Set<string>();
  for (const source of evidence) {
    if (!source || typeof source !== "object") continue;
    const { url, stance } = source as { url?: unknown; stance?: unknown };
    if (stance !== undefined && stance !== "supports") continue;
    const safe = typeof url === "string" ? safeSourceUrl(url) : null;
    const domain = safe ? registrableDomain(safe) : null;
    if (domain) domains.add(domain);
  }
  return domains.size;
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

export type QualityMetrics = ReturnType<typeof qualityMetrics>;

/**
 * `detachedUsage`: usage rows of runs the founder deleted (WP-12, decision D6), kept for cost accounting with no run or
 * founder. They count towards spend in the window; they cannot count towards any run's own figures.
 */
export function qualityMetrics(input: { runs: MetricRun[]; usage: MetricUsage[]; sources: MetricSource[]; opportunities: MetricOpportunity[]; detachedUsage?: MetricUsage[] }) {
  const completed = input.runs.filter(run => run.status === "completed");
  const failed = input.runs.filter(run => run.status === "failed");
  const preflight = failed.filter(run => run.preflight_blocked);
  const finished = completed.length + failed.length;
  const errorCodes: Record<string, number> = {};
  for (const run of failed) errorCodes[run.error_code ?? "UNKNOWN"] = (errorCodes[run.error_code ?? "UNKNOWN"] ?? 0) + 1;

  const completedIds = new Set(completed.map(run => run.id));
  const perRun = new Map<string, number>([...completedIds].map(id => [id, 0]));
  for (const opportunity of input.opportunities) if (perRun.has(opportunity.run_id)) perRun.set(opportunity.run_id, perRun.get(opportunity.run_id)! + 1);
  const counts = [...perRun.values()];
  const distribution: Record<string, number> = {};
  for (const n of counts) distribution[n] = (distribution[n] ?? 0) + 1;
  const opportunities = counts.reduce((sum, n) => sum + n, 0);

  const classified = input.sources.filter(source => typeof source.reliability === "string");
  const durations = [...completed, ...failed].map(durationMs).filter((ms): ms is number => ms !== null);
  const runIds = new Set(input.runs.map(run => run.id));
  const usage = input.usage.filter(row => row.run_id !== null && runIds.has(row.run_id));
  const detached = input.detachedUsage ?? [];
  const deletedRunsUsd = committedUsd(detached);
  const total = committedUsd(usage) + deletedRunsUsd;
  const completedSpend = committedUsd(usage.filter(row => row.run_id !== null && completedIds.has(row.run_id)));

  return {
    runs: { total: input.runs.length, completed: completed.length, failed: failed.length, active: input.runs.length - finished, preflightBlocked: preflight.length },
    /** completed ÷ (completed + failed), leaving out runs the pre-flight budget check stopped before any request. */
    completionRate: ratio(completed.length, finished - preflight.length),
    /** failed with INSUFFICIENT_EVIDENCE ÷ all finished runs. */
    insufficientEvidenceRate: ratio(errorCodes.INSUFFICIENT_EVIDENCE ?? 0, finished),
    errorCodes,
    opportunitiesPerCompletedRun: { mean: ratio(opportunities, completed.length), distribution },
    /** Median independent supporting domains per saved opportunity of a completed run. */
    supportingDomainsMedian: median(input.opportunities.filter(o => completedIds.has(o.run_id)).map(o => opportunitySupportingDomains(o.evidence))),
    /** Sources classified "vendor" ÷ all classified sources. */
    vendorShare: ratio(classified.filter(source => source.reliability === "vendor").length, classified.length),
    duration: { medianMs: median(durations), p95Ms: percentile(durations, 95), runs: durations.length },
    cost: {
      totalUsd: total,
      /** Mean committed cost of one completed run. */
      meanCompletedRunUsd: ratio(completedSpend, completed.length),
      /** All spend in the window, failed runs included, per completed run: what one usable report really costs. */
      spendPerCompletedRunUsd: ratio(total, completed.length),
      /** All spend in the window per opportunity that survived the gate and the review. */
      spendPerOpportunityUsd: ratio(total, opportunities),
      uncertainCalls: [...usage, ...detached].filter(row => row.status !== "completed").length,
      /** Spend of runs deleted since (included in totalUsd). */
      deletedRunsUsd,
    },
  };
}
