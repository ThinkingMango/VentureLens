import { z } from "zod";
import { registrableDomain, safeSourceUrl } from "./research-core.ts";

// Report feedback (spec WP-13): founders flag a claim or a source and rate each report 1–5. Pure helpers shared by the
// API route, the opportunity page and the operator quality page, so every rule is unit-tested.

export const flagReasons = ["wrong", "outdated", "irrelevant", "broken_link", "other"] as const;
export type FlagReason = (typeof flagReasons)[number];
export type FlagTarget = "claim" | "source";
export const FEEDBACK_COMMENT_MAX = 1000;

/** A claim's feedback key: its position in the opportunity's stored claims, which never change after a run. */
export const claimKey = (index: number) => `claim-${index}`;

const comment = z.string().trim().max(FEEDBACK_COMMENT_MAX).default("");
export const feedbackRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("flag"),
    opportunity_id: z.uuid(),
    target: z.enum(["claim", "source"]),
    target_key: z.string().regex(/^[A-Za-z0-9_.:-]{1,100}$/),
    reason: z.enum(flagReasons),
    comment,
  }),
  z.strictObject({ action: z.literal("rate"), run_id: z.uuid(), rating: z.number().int().min(1).max(5), comment }),
]);
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

/** The reasons offered for a target: a broken link only makes sense for a source. */
export function reasonsFor(target: FlagTarget): FlagReason[] {
  return flagReasons.filter((reason) => target === "source" || reason !== "broken_link");
}

/**
 * Whether a flag names a claim or source the opportunity really has (and a reason that fits it), so stored flags
 * always point at something the founder saw.
 */
export function flagTargetExists(payload: unknown, target: FlagTarget, key: string, reason: FlagReason): boolean {
  if (!reasonsFor(target).includes(reason) || !payload || typeof payload !== "object") return false;
  if (target === "claim") {
    const claims = (payload as { claims?: unknown }).claims;
    const match = /^claim-(\d{1,2})$/.exec(key);
    return Array.isArray(claims) && !!match && Number(match[1]) < claims.length;
  }
  const evidence = (payload as { evidence?: unknown }).evidence;
  return Array.isArray(evidence) && evidence.some((source) => (source as { source_key?: unknown } | null)?.source_key === key);
}

// Operator aggregates for /admin/quality.
export type FeedbackFlagRow = { target: string; target_key: string; reason: string | null; evidence: unknown };
export type FeedbackRatingRow = { rating: number; mode: string | null; model: string | null };
export type RatingGroup = { key: string; ratings: number; mean: number };

/**
 * The model that wrote most of a run: the one with the most output tokens over its settled calls. A run that fell back
 * to another provider part-way is counted under whichever model did most of the work.
 */
export function runModel(usage: { provider: string; model: string; status: string; output_tokens: number }[]): string | null {
  const tokens = new Map<string, number>();
  for (const row of usage) {
    if (row.status !== "completed") continue;
    const key = `${row.provider}/${row.model}`;
    tokens.set(key, (tokens.get(key) ?? 0) + Math.max(0, row.output_tokens));
  }
  let best: string | null = null;
  for (const [key, n] of [...tokens].sort(([a], [b]) => a.localeCompare(b))) if (best === null || n > tokens.get(best)!) best = key;
  return best;
}

function groups(rows: FeedbackRatingRow[], key: (row: FeedbackRatingRow) => string | null): RatingGroup[] {
  const totals = new Map<string, { sum: number; n: number }>();
  for (const row of rows) {
    const name = key(row) ?? "unknown";
    const total = totals.get(name) ?? { sum: 0, n: 0 };
    totals.set(name, { sum: total.sum + row.rating, n: total.n + 1 });
  }
  return [...totals]
    .map(([name, { sum, n }]) => ({ key: name, ratings: n, mean: sum / n }))
    .sort((a, b) => b.ratings - a.ratings || a.key.localeCompare(b.key));
}

export function feedbackMetrics(input: { flags: FeedbackFlagRow[]; ratings: FeedbackRatingRow[] }, topDomains = 10) {
  const byReason = Object.fromEntries(flagReasons.map((reason) => [reason, 0])) as Record<FlagReason, number>;
  for (const flag of input.flags) if (flag.reason && Object.hasOwn(byReason, flag.reason)) byReason[flag.reason as FlagReason]++;
  // Flagged sources, counted by the registrable domain of the source the founder flagged.
  const domains = new Map<string, number>();
  for (const flag of input.flags) {
    if (flag.target !== "source" || !Array.isArray(flag.evidence)) continue;
    const source = flag.evidence.find((item) => (item as { source_key?: unknown } | null)?.source_key === flag.target_key) as { url?: unknown } | undefined;
    const safe = typeof source?.url === "string" ? safeSourceUrl(source.url) : null;
    const domain = safe ? registrableDomain(safe) : null;
    if (domain) domains.set(domain, (domains.get(domain) ?? 0) + 1);
  }
  const ratings = input.ratings.filter((row) => Number.isInteger(row.rating) && row.rating >= 1 && row.rating <= 5);
  return {
    flags: {
      total: input.flags.length,
      claims: input.flags.filter((flag) => flag.target === "claim").length,
      sources: input.flags.filter((flag) => flag.target === "source").length,
      byReason,
      topDomains: [...domains].map(([domain, flags]) => ({ domain, flags })).sort((a, b) => b.flags - a.flags || a.domain.localeCompare(b.domain)).slice(0, topDomains),
    },
    ratings: {
      total: ratings.length,
      mean: ratings.length ? ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length : null,
      byMode: groups(ratings, (row) => row.mode),
      byModel: groups(ratings, (row) => row.model),
    },
  };
}
export type FeedbackMetrics = ReturnType<typeof feedbackMetrics>;
