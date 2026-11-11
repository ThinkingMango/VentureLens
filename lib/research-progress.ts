import { registrableDomain, safeSourceUrl } from "./research-core.ts";

// Live progress on the run page (spec WP-08). Pure helpers, shared by the server read and the page.

export type ProgressSource = { title: string; domain: string | null };
export type RunProgress = {
  /** Candidates discovery chose to research; null until discovery has finished. */
  candidates: number | null;
  /** Sources saved so far, newest first, at most PROGRESS_SOURCES of them. */
  sources: ProgressSource[];
  /** How many sources have been saved in total. */
  sourceCount: number;
  /** Median minutes a finished run of this mode took recently; null when there are too few runs to say. */
  estimateMinutes: number | null;
};
export const PROGRESS_SOURCES = 12;
/** Fewer finished runs than this and the page falls back to its fixed wording. */
export const ESTIMATE_MIN_RUNS = 5;

/** How far retrieval has got: candidates with a saved retrieval checkpoint, out of those discovery chose. */
export function retrievalProgress(steps: { stage_key: string }[], candidates: number | null) {
  const done = new Set(steps.filter((step) => step.stage_key.startsWith("retrieval:")).map((step) => step.stage_key)).size;
  return { done, total: candidates !== null && candidates >= done ? candidates : null };
}

/** A source as shown while the run is still working: its title and the publisher's domain only. */
export function progressSource(row: { title: unknown; url: unknown }): ProgressSource {
  const title = typeof row.title === "string" ? row.title.replace(/\s+/g, " ").trim().slice(0, 160) : "";
  const safe = typeof row.url === "string" ? safeSourceUrl(row.url) : null;
  return { title, domain: safe ? registrableDomain(safe) : null };
}

/** Median duration in whole minutes (at least 1) of recent finished runs, or null with fewer than ESTIMATE_MIN_RUNS. */
export function estimateMinutes(runs: { started_at: string | null; completed_at: string | null }[]): number | null {
  const durations = runs
    .map((run) => (run.started_at && run.completed_at ? Date.parse(run.completed_at) - Date.parse(run.started_at) : NaN))
    .filter((ms) => Number.isFinite(ms) && ms > 0)
    .sort((a, b) => a - b);
  if (durations.length < ESTIMATE_MIN_RUNS) return null;
  const middle = durations.length / 2;
  const median = durations.length % 2 ? durations[Math.floor(middle)] : (durations[middle - 1] + durations[middle]) / 2;
  return Math.max(1, Math.round(median / 60_000));
}

/**
 * How often the page asks for fresh progress: every 3 seconds for the first two minutes, every 5 until ten minutes,
 * then every 10. SWR stops polling while the tab is hidden and backs off on errors by itself.
 */
export function pollInterval(createdAt: string, now = Date.now()): number {
  const elapsed = now - Date.parse(createdAt);
  if (!Number.isFinite(elapsed) || elapsed < 120_000) return 3000;
  return elapsed < 600_000 ? 5000 : 10_000;
}
