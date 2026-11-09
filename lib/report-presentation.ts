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

/** Points the top opportunity must lead the runner-up by to be recommended on its own. */
export const CLEAR_LEAD_POINTS = 5;

/**
 * Which opportunity to validate first, and how sure the ranking is.
 * - `single`: one opportunity survived the evidence gate and review.
 * - `leader`: the top score leads the runner-up by at least CLEAR_LEAD_POINTS.
 * - `close`: the top two are within CLEAR_LEAD_POINTS. Scores are model judgements with evidence caps at 70 and 85,
 *   so a gap that small (often a tie at a cap) does not separate them; both are worth a first test.
 */
export type Recommendation =
  | { kind: "none" }
  | { kind: "single"; lead: WorkspaceOpportunity }
  | { kind: "leader"; lead: WorkspaceOpportunity; runnerUp: WorkspaceOpportunity; gap: number }
  | { kind: "close"; lead: WorkspaceOpportunity; runnerUp: WorkspaceOpportunity; gap: number };

export function recommendation(opportunities: WorkspaceOpportunity[]): Recommendation {
  // Highest score first; on a tie the better-supported opportunity (more linked pages) leads.
  const ranked = [...opportunities].sort(
    (a, b) => b.score - a.score || reportEvidenceCount([b]) - reportEvidenceCount([a]),
  );
  const [lead, runnerUp] = ranked;
  if (!lead) return { kind: "none" };
  if (!runnerUp) return { kind: "single", lead };
  const gap = lead.score - runnerUp.score;
  return { kind: gap >= CLEAR_LEAD_POINTS ? "leader" : "close", lead, runnerUp, gap };
}
