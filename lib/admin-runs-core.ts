import { evidenceGate, groundedClassifications, registrableDomain, safeSourceUrl, type Classification, type Evidence } from "./research-core.ts";
import { committedUsd, durationMs, type MetricUsage } from "./quality-metrics.ts";

// Pure helpers for the operator run inspector (/admin/runs, spec WP-01 §1).
//
// Privacy (owner decision D5): the inspector shows structural data only. Codes, counts, timings, costs, models and the
// registrable domains of web sources are structural. Brief and profile text, candidate titles, buyers, pains and search
// queries (which the model writes from the brief), source titles, URLs beyond their domain, excerpts and quotes are
// not: the helpers below read them on the server where the gate needs them, and never return them.

export const runStatuses = ["pending", "running", "completed", "failed"] as const;
export type RunStatus = (typeof runStatuses)[number];
export const RUNS_PAGE_SIZE = 50;

export type RunFilters = { status: RunStatus | null; errorCode: string | null; from: string | null; to: string | null; page: number };
type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || null;
const isDay = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Filters from the list page's query string. Anything malformed is ignored rather than rejected. */
export function parseRunFilters(params: SearchParams): RunFilters {
  const status = first(params.status);
  const errorCode = first(params.error)?.toUpperCase() ?? null;
  const from = first(params.from);
  const to = first(params.to);
  const page = Number(first(params.page));
  return {
    status: (runStatuses as readonly string[]).includes(status ?? "") ? (status as RunStatus) : null,
    errorCode: errorCode && /^[A-Z][A-Z0-9_]{0,39}$/.test(errorCode) ? errorCode : null,
    from: isDay(from) ? from : null,
    to: isDay(to) ? to : null,
    page: Number.isSafeInteger(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

/** The created_at range a filter selects: from the start of `from` to the end of `to`, both in UTC. */
export function filterRange(filters: Pick<RunFilters, "from" | "to">): { fromIso: string | null; beforeIso: string | null } {
  const next = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString();
  return { fromIso: filters.from ? `${filters.from}T00:00:00.000Z` : null, beforeIso: filters.to ? next(filters.to) : null };
}

export type RunListRow = {
  id: string; status: string; stage: string; error_code: string | null; mode: string | null; language: string | null;
  created_at: string; durationMs: number | null; committedUsd: number; opportunities: number; retry_count: number;
};
export function runListRow(
  run: { id: string; status: string; stage: string; error_code: string | null; mode?: string | null; language?: string | null; created_at: string; started_at: string | null; completed_at: string | null; retry_count: number },
  usage: MetricUsage[],
  opportunities: number,
): RunListRow {
  return {
    id: run.id, status: run.status, stage: run.stage, error_code: run.error_code, mode: run.mode ?? null, language: run.language ?? null,
    created_at: run.created_at, durationMs: durationMs(run), committedUsd: committedUsd(usage.filter(row => row.run_id === run.id)), opportunities, retry_count: run.retry_count,
  };
}

/** The pipeline stage of a usage row; the engine stores `<stage>:<provider>:<workflow id>`. */
export function usageStage(stageKey: string): string {
  const parts = stageKey.split(":");
  return parts.length > 2 ? parts.slice(0, -2).join(":") : stageKey;
}

/** Each point where a run's calls moved from one provider to another, in call order. */
export function providerSwitches(rows: { stage_key: string; provider: string; created_at: string }[]) {
  const ordered = [...rows].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const switches: { stage: string; from: string; to: string; at: string }[] = [];
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].provider !== ordered[i - 1].provider) switches.push({ stage: usageStage(ordered[i].stage_key), from: ordered[i - 1].provider, to: ordered[i].provider, at: ordered[i].created_at });
  }
  return switches;
}

/** Stage checkpoints in order, with the size of each saved output in bytes. Outputs themselves are not returned. */
export function stageTimeline(rows: { stage_key: string; created_at: string; output: unknown }[]) {
  const encoder = new TextEncoder();
  return [...rows]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map(row => ({ key: row.stage_key, created_at: row.created_at, bytes: encoder.encode(JSON.stringify(row.output ?? null)).length }));
}

const pick = <T extends string>(value: unknown, keys: readonly T[]): Partial<Record<T, string | number | boolean | null>> => {
  if (!value || typeof value !== "object") return {};
  const out: Partial<Record<T, string | number | boolean | null>> = {};
  for (const key of keys) {
    const field = (value as Record<string, unknown>)[key];
    if (field === null || ["string", "number", "boolean"].includes(typeof field)) out[key] = field as string | number | boolean | null;
  }
  return out;
};
/** Only the structural fields of the setup, failure and budget checkpoints: never the brief or profile stored in setup. */
export const structuralSetup = (output: unknown) => {
  // primary_skipped: the configured primary could not finish within the run's budget, so the run started on the fallback.
  const skipped = pick(output && typeof output === "object" ? (output as { primary_skipped?: unknown }).primary_skipped : null, ["model", "required_usd"] as const);
  return {
    ...pick(output, ["provider", "model", "active_provider", "search_provider", "fallback_allowed", "methodology"] as const),
    ...(typeof skipped.model === "string" ? { primary_skipped: skipped.model, primary_required_usd: typeof skipped.required_usd === "number" ? skipped.required_usd : null } : {}),
  };
};
export const structuralFailure = (output: unknown) => pick(output, ["stage", "code", "name", "status", "at"] as const);
export const structuralBudgetBlock = (output: unknown) => pick(output, ["stage", "kind", "provider", "model", "required_usd"] as const);

export type CandidateDiagnostic = {
  key: string;
  /**
   * searched: a retrieval checkpoint with evidence; skipped: the search found nothing readable; failed: the search failed
   * transiently (timeout, 429, 5xx) and the run went on without it; not_reached: no checkpoint yet.
   */
  retrieval: "searched" | "skipped" | "failed" | "not_reached";
  sources: number;
  /** Distinct registrable domains among this candidate's saved sources. */
  domains: number;
  /** Sources with a classification whose quote was found in the source (the only classifications the gate counts). */
  classified: number;
  vendorShare: number | null;
  /** The evidence gate's own verdict, or not_evaluated before classification has run. */
  gate: "passed" | "failed" | "not_evaluated";
  /** Independent supporting domains as the gate reports them (0 when the gate fails). */
  supportingDomains: number;
  rows: { domain: string | null; reliability: string | null; stance: string | null; kind: string | null; relevant: boolean | null }[];
};

/**
 * Structural diagnostics per candidate. The pass/fail verdict comes from evidenceGate itself, never a re-implementation.
 * WP-06 adds the reason a candidate failed (diagnoseCandidates); until then the inspector shows the gate's inputs.
 */
export function candidateDiagnostics(input: {
  keys: string[];
  retrieval: Record<string, { skipped?: unknown } | undefined>;
  evidence: Evidence[];
  classifications: Classification[] | null;
}): CandidateDiagnostic[] {
  const grounded = input.classifications ? groundedClassifications(input.evidence, input.classifications) : [];
  const byKey = new Map(grounded.map(item => [item.source_key, item]));
  return input.keys.map(key => {
    const evidence = input.evidence.filter(source => source.candidate_id === key);
    const domain = (url: string) => { const safe = safeSourceUrl(url); return safe ? registrableDomain(safe) : null; };
    const rows = evidence.map(source => {
      const item = byKey.get(source.source_key);
      return { domain: domain(source.url), reliability: item?.reliability ?? null, stance: item?.stance ?? null, kind: item?.kind ?? null, relevant: item ? item.relevant : null };
    });
    const classified = rows.filter(row => row.reliability !== null);
    const checkpoint = input.retrieval[key];
    const gate = input.classifications ? evidenceGate(key, input.evidence, input.classifications) : null;
    return {
      key,
      retrieval: !checkpoint ? "not_reached" : checkpoint.skipped === "TRANSIENT_PROVIDER" ? "failed" : checkpoint.skipped ? "skipped" : "searched",
      sources: evidence.length,
      domains: new Set(rows.map(row => row.domain).filter(Boolean)).size,
      classified: classified.length,
      vendorShare: classified.length ? classified.filter(row => row.reliability === "vendor").length / classified.length : null,
      gate: !gate ? "not_evaluated" : gate.sources.length ? "passed" : "failed",
      supportingDomains: gate?.supportingDomains ?? 0,
      rows,
    };
  });
}
