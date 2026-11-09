import type { WorkspaceOpportunity } from "./workspace-schema";

export function reportEvidenceCount(opportunities: WorkspaceOpportunity[]) {
  const pages = opportunities.flatMap((item) =>
    (item.evidence ?? []).flatMap((source) => {
      try {
        const url = new URL(source.url);
        if (!["https:", "http:"].includes(url.protocol)) return [];
        url.hash = "";
        return [url.href];
      } catch {
        return [];
      }
    }),
  );
  return new Set(pages).size;
}

export function reportShortlist(
  opportunities: WorkspaceOpportunity[],
  saved: string[],
  savedOnly: boolean,
  sort: string,
  locale: string,
) {
  return opportunities
    .filter((item) => !savedOnly || saved.includes(item.id))
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, locale)
        : sort === "evidence"
          ? reportEvidenceCount([b]) - reportEvidenceCount([a]) ||
            b.score - a.score
          : b.score - a.score,
    );
}

export type CandidateProgress = {
  key: string;
  title: string;
  /** "searching" until its retrieval checkpoint exists; "skipped" when retrieval found nothing usable. */
  state: "searching" | "done" | "skipped";
  sources: number;
};

/**
 * Per-hypothesis retrieval progress for a run that has not finished, built
 * from the discovery checkpoint, the stage keys written so far, and the
 * candidate_id of each saved evidence row. Malformed discovery output yields
 * no rows rather than an error, because this only decorates the progress view.
 */
export function candidateProgress(
  discovery: unknown,
  stageKeys: string[],
  evidenceCandidateIds: string[],
): CandidateProgress[] {
  const list = (discovery as { candidates?: unknown } | null)?.candidates;
  if (!Array.isArray(list)) return [];
  const done = new Set(
    stageKeys
      .filter((key) => key.startsWith("retrieval:"))
      .map((key) => key.slice("retrieval:".length)),
  );
  const counts = new Map<string, number>();
  for (const id of evidenceCandidateIds)
    counts.set(id, (counts.get(id) ?? 0) + 1);
  return list.flatMap((item) => {
    const { key, title } = (item ?? {}) as { key?: unknown; title?: unknown };
    if (typeof key !== "string" || typeof title !== "string") return [];
    const sources = counts.get(key) ?? 0;
    return [
      {
        key,
        title,
        state: !done.has(key) ? "searching" : sources ? "done" : "skipped",
        sources,
      } satisfies CandidateProgress,
    ];
  });
}
