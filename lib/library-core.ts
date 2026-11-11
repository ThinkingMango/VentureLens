import { scoreBands } from "./report-presentation.ts";
import type { Project, ResearchRun, WorkspaceOpportunity } from "./workspace-schema";

/**
 * Library filters (spec WP-12): archived (hidden unless "Show archived"), confidence, score range, research mode and
 * run, on top of the existing search. Pure, so the results and saved pages and the tests share one definition.
 */

export const discoveryModeOptions = ["founder", "market", "combined", "verify"] as const;
export type DiscoveryModeOption = (typeof discoveryModeOptions)[number];
/** Score ranges follow the score bands, so a filter and the label on a card always agree. */
export const scoreRangeKeys = ["strong", "promising", "mixed", "weak"] as const;
export type ScoreRangeKey = (typeof scoreRangeKeys)[number];

export type LibraryFilters = {
  query: string;
  showArchived: boolean;
  confidence: "any" | "moderate" | "limited";
  score: "any" | ScoreRangeKey;
  mode: "any" | DiscoveryModeOption;
  /** A run id, or "any". */
  run: string;
};
export const defaultFilters: LibraryFilters = { query: "", showArchived: false, confidence: "any", score: "any", mode: "any", run: "any" };

/** The score range a band covers: from its minimum up to the next band's minimum, exclusive. */
export function scoreRange(key: ScoreRangeKey): { min: number; max: number } {
  const index = scoreBands.findIndex((band) => band.key === key);
  return { min: scoreBands[index].min, max: index === 0 ? 100 : scoreBands[index - 1].min - 1 };
}

export type RunInfo = { id: string; mode: DiscoveryModeOption; name: string; created_at: string };
/** Each run's mode and brief name, from the workspace's runs and their briefs (projects). */
export function runInfo(runs: Pick<ResearchRun, "id" | "project_id" | "created_at">[], projects: Pick<Project, "id" | "name" | "discovery_mode">[]): Map<string, RunInfo> {
  const byProject = new Map(projects.map((project) => [project.id, project]));
  return new Map(runs.map((run) => {
    const project = byProject.get(run.project_id);
    const mode = discoveryModeOptions.find((value) => value === project?.discovery_mode) ?? "combined";
    return [run.id, { id: run.id, mode, name: project?.name ?? "", created_at: run.created_at }];
  }));
}

/** Runs that produced at least one of the listed opportunities, newest first: the options of the "Run" filter. */
export function runOptions(items: Pick<WorkspaceOpportunity, "run_id">[], runs: Map<string, RunInfo>): RunInfo[] {
  const ids = new Set(items.map((item) => item.run_id).filter((id): id is string => !!id));
  return [...ids].flatMap((id) => (runs.has(id) ? [runs.get(id)!] : [])).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export const isArchived = (item: Pick<WorkspaceOpportunity, "archived_at">) => !!item.archived_at;

/** The opportunities a list shows: saved-only when asked, archived only with "Show archived", then every filter. */
export function filterOpportunities<T extends WorkspaceOpportunity>(items: T[], filters: LibraryFilters, context: { saved: string[]; savedOnly: boolean; runs: Map<string, RunInfo> }): T[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const range = filters.score === "any" ? null : scoreRange(filters.score);
  return items.filter((item) => {
    if (context.savedOnly && !context.saved.includes(item.id)) return false;
    if (!filters.showArchived && isArchived(item)) return false;
    if (query && !`${item.title} ${item.category} ${item.buyer}`.toLocaleLowerCase().includes(query)) return false;
    if (filters.confidence !== "any" && item.confidence !== filters.confidence) return false;
    if (range && (item.score < range.min || item.score > range.max)) return false;
    if (filters.mode !== "any" && (!item.run_id || context.runs.get(item.run_id)?.mode !== filters.mode)) return false;
    if (filters.run !== "any" && item.run_id !== filters.run) return false;
    return true;
  });
}

/** How many filters other than search differ from the defaults ("Show archived" counts as one). */
export function activeFilterCount(filters: LibraryFilters) {
  return (["showArchived", "confidence", "score", "mode", "run"] as const).filter((key) => filters[key] !== defaultFilters[key]).length;
}

/** The workspace list without archived opportunities, for the dashboard and anything else that is not the library. */
export function unarchived<T extends Pick<WorkspaceOpportunity, "archived_at">>(items: T[]): T[] {
  return items.filter((item) => !isArchived(item));
}

/** Delete-run confirmation: the founder types this word, whatever the interface language. */
export const DELETE_CONFIRMATION = "DELETE";
export function deleteConfirmed(value: string) {
  return value.trim().toUpperCase() === DELETE_CONFIRMATION;
}
/** Runs that may be deleted: anything that is not still pending or running. */
export function canDeleteRun(status: string) {
  return !["pending", "running"].includes(status);
}
