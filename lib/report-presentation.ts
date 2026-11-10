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

/** How an opportunity's score was reached, for the score breakdown. */
export type ScoreBreakdown = {
  /** The weighted rating of the five dimensions, before the adversarial review. */
  beforeReview: number;
  /** Points the adversarial review deducted. */
  deduction: number;
  /** 85 with three or more independent supporting sources, otherwise 70. */
  cap: 70 | 85;
  score: number;
  /** True when the evidence cap, not the rating, set the final score. */
  capped: boolean;
};

/**
 * Reports from methodology v2 store the rating before review and the cap. For earlier reports both are derived: the
 * cap follows the confidence level (both came from the same source count), and the rating before review is the score
 * plus the deduction, which is exact unless the cap set the score.
 */
export function scoreBreakdown(o: Pick<WorkspaceOpportunity, "score" | "penalty" | "confidence" | "score_before_review" | "score_cap">): ScoreBreakdown {
  const deduction = Math.max(0, o.penalty ?? 0);
  const cap = o.score_cap ?? (o.confidence === "moderate" ? 85 : 70);
  const beforeReview = o.score_before_review ?? o.score + deduction;
  return { beforeReview, deduction, cap, score: o.score, capped: beforeReview - deduction > cap };
}

export type ScoreBand = { key: "strong" | "promising" | "mixed" | "weak"; min: number; label: string; meaning: string };

/**
 * What a score means. Scores are strict by design: five ratings that are lowered where evidence is missing, a review
 * that can only deduct, and a cap of 70 (85 with three independent supporting sources). A well-supported but still
 * unvalidated opportunity therefore lands in the 50s and 60s, and the bands are set for that scale.
 */
export const scoreBands: ScoreBand[] = [
  { key: "strong", min: 65, label: "Strong candidate", meaning: "Well-supported pain and demand, with few unresolved risks." },
  { key: "promising", min: 50, label: "Promising", meaning: "Worth validating with buyers; the review found real but manageable risks." },
  { key: "mixed", min: 35, label: "Mixed evidence", meaning: "Some support, but serious gaps or risks to resolve first." },
  { key: "weak", min: 0, label: "Weak case", meaning: "Little support, or risks that outweigh it." },
];
export function scoreBand(score: number): ScoreBand {
  return scoreBands.find((band) => score >= band.min) ?? scoreBands[scoreBands.length - 1];
}

// Claim-level citations (WP-07).
type Claims = NonNullable<WorkspaceOpportunity["claims"]>;
export const claimSectionOrder = ["buyer", "pain", "demand", "competition", "economics", "risk"] as const;
/**
 * Citation numbers for an opportunity's sources: [1] is the first source card, [2] the second, and so on. Numbers follow
 * the order the sources are listed, so a chip and the card it points to always agree, whatever order claims cite them.
 */
export function citationNumbers(evidence: WorkspaceOpportunity["evidence"]): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const source of evidence ?? []) if (!numbers.has(source.source_key)) numbers.set(source.source_key, numbers.size + 1);
  return numbers;
}
/** The page anchor of a source card, safe to use as an element id whatever characters the source key holds. */
export function sourceAnchor(sourceKey: string) {
  return `source-${sourceKey.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}
/** Claims grouped by section in a fixed reading order (buyer to risk), keeping each section's own order; empty sections are left out. */
export function claimsBySection(claims: Claims | undefined) {
  return claimSectionOrder
    .map((section) => ({ section, claims: (claims ?? []).filter((claim) => claim.section === section) }))
    .filter((group) => group.claims.length > 0);
}
