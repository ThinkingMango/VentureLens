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
