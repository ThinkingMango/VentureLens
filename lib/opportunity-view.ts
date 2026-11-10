import type { WorkspaceOpportunity } from "./workspace-schema.ts";
import type { DemoReport, Opportunity } from "./demo-data.ts";
import { citationNumbers, scoreBreakdown, type ScoreBreakdown } from "./report-presentation.ts";

/**
 * One opportunity, ready to display (WP-09). The live and demo opportunity pages render the same component from this,
 * so the demo can never show more than a real user gets. Live text is the run's own (in the report language); demo
 * text arrives already translated.
 */
export const opportunityTabIds = ["overview", "evidence", "economics", "validation"] as const;
export type OpportunityTabId = (typeof opportunityTabIds)[number];
export type Claim = NonNullable<WorkspaceOpportunity["claims"]>[number];
export type ViewSource = {
  key: string;
  /** Citation number: the order sources are listed, starting at 1. */
  number: number;
  title: string;
  url: string | null;
  domain: string | null;
  /** The page excerpt, verbatim in its original language. */
  quote: string | null;
  reliability: "primary" | "secondary" | "vendor" | "unknown" | null;
  stance: "supports" | "contradicts" | "neutral" | null;
  retrievedAt: string | null;
  publishedAt: string | null;
  /** Demo only: a synthetic record, with how it would be interpreted and its limits. */
  synthetic: { type: string; detail: string; interpretation: string; limitation: string } | null;
};
export type OpportunityView = {
  kind: "live" | "demo";
  id: string;
  title: string;
  description: string;
  category: string;
  buyer: string;
  pain: string;
  /** How the idea would be delivered; live reports keep it in the description. */
  approach: string | null;
  risk: string;
  score: number;
  confidence: string;
  scores: number[];
  /** How the score was reached (rating, review deduction, evidence cap). Demo scores are illustrative and have none. */
  breakdown: ScoreBreakdown | null;
  /** 1: original; 2: review cap and stance; 3: claims (WP-07). The demo is not a methodology version. */
  methodologyVersion: 1 | 2 | 3 | null;
  claims: Claim[];
  sources: ViewSource[];
  revenue: string;
  cost: string;
  assumptions: string[];
  /** Assumption claims and what would confirm them. */
  confirmations: { claim: string; confirm: string | null }[];
  validation: string[];
  firstTest: string | null;
  rationale: string | null;
  critique: string | null;
  falsification: string | null;
  penalty: number | null;
  /** Demo only: the illustrative buying context. */
  buyerContext: { job: string; alternative: string; trigger: string } | null;
};

/** The methodology an opportunity was made under, from what its payload records. */
export function methodologyVersion(item: Pick<WorkspaceOpportunity, "methodology_version" | "score_before_review" | "evidence">): 1 | 2 | 3 {
  if (item.methodology_version === 3) return 3;
  if (item.methodology_version === 2 || item.score_before_review !== undefined || item.evidence?.some((source) => source.stance)) return 2;
  return 1;
}

function domainOf(url: string) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/** Source cards in listed order; a repeated key keeps its first card, so each citation number points at one card. */
function liveSources(evidence: WorkspaceOpportunity["evidence"], numbers: Map<string, number>): ViewSource[] {
  const seen = new Set<string>();
  const cards: ViewSource[] = [];
  for (const source of evidence ?? []) {
    if (seen.has(source.source_key)) continue;
    seen.add(source.source_key);
    const domain = domainOf(source.url);
    cards.push({
      key: source.source_key, number: numbers.get(source.source_key) ?? cards.length + 1, title: source.title,
      url: domain ? source.url : null, domain, quote: source.excerpt ?? null, reliability: source.reliability ?? null,
      stance: source.stance ?? null, retrievedAt: source.retrieved_at, publishedAt: source.published_at, synthetic: null,
    });
  }
  return cards;
}
export function liveOpportunityView(item: WorkspaceOpportunity): OpportunityView {
  const numbers = citationNumbers(item.evidence);
  const claims = item.claims ?? [];
  return {
    kind: "live",
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.category,
    buyer: item.buyer,
    pain: item.pain,
    approach: null,
    risk: item.risk,
    score: item.score,
    confidence: item.confidence,
    scores: item.scores,
    breakdown: scoreBreakdown(item),
    methodologyVersion: methodologyVersion(item),
    claims,
    sources: liveSources(item.evidence, numbers),
    revenue: item.revenue,
    cost: item.cost,
    assumptions: item.assumptions ?? [],
    confirmations: claims.filter((claim) => claim.kind === "assumption").map((claim) => ({ claim: claim.text, confirm: claim.confirm ?? null })),
    validation: item.validation ?? [],
    firstTest: item.validation?.[0] ?? null,
    rationale: item.rationale ?? null,
    critique: item.critique ?? null,
    falsification: item.falsification ?? null,
    penalty: item.penalty ?? null,
    buyerContext: null,
  };
}

/**
 * The demo's fixed sample, as a view. `o` and `report` arrive translated (useDemoContent); `copy` translates the few
 * fixed demo lines kept here so the component holds no demo-only text.
 */
export function demoOpportunityView(o: Opportunity, report: DemoReport, copy: (text: string, values?: Record<string, string | number>) => string): OpportunityView {
  return {
    kind: "demo",
    id: o.id,
    title: o.title,
    description: o.description,
    category: o.category,
    buyer: o.buyer,
    pain: o.pain,
    approach: report.approach,
    risk: o.risk,
    score: o.score,
    confidence: o.confidence,
    scores: o.scores,
    breakdown: null,
    methodologyVersion: null,
    claims: [],
    sources: report.sources.map((source, index) => ({
      key: `demo-${index + 1}`, number: index + 1, title: source.title, url: null, domain: null,
      quote: source.observation, reliability: null, stance: null, retrievedAt: null, publishedAt: null,
      synthetic: { type: source.type, detail: source.detail, interpretation: source.implication, limitation: source.limitation },
    })),
    revenue: o.revenue,
    cost: o.cost,
    assumptions: [
      copy("Buyers encounter the problem repeatedly, not just once."),
      copy("AI inference, hosting, and human review fit within the delivery budget."),
      copy("The outcome is valuable enough to support a subscription."),
      copy("Acquisition cost, churn, taxes, and support still need to be modeled."),
    ],
    confirmations: [],
    // The demo's validation plan is the shared checklist plus its first test; it has no research-generated steps.
    validation: [],
    firstTest: report.firstTest,
    rationale: null,
    critique: null,
    falsification: null,
    penalty: null,
    buyerContext: { job: report.buyerJob, alternative: report.alternative, trigger: report.trigger },
  };
}

/**
 * The tabs an opportunity has. Overview, Economics and Validation always; Evidence only when there are sources or
 * claims to show, so an early (v1) opportunity without evidence never opens on an empty tab.
 */
export function opportunityTabs(view: Pick<OpportunityView, "sources" | "claims">): OpportunityTabId[] {
  return opportunityTabIds.filter((tab) => tab !== "evidence" || view.sources.length > 0 || view.claims.length > 0);
}

/** The claims shown on the Overview: observed first, then inferences, then assumptions, each kind in its own order. */
export function topClaims(claims: Claim[], count = 3): Claim[] {
  const rank = { observed: 0, inference: 1, assumption: 2 } as const;
  return claims
    .map((claim, index) => ({ claim, index }))
    .sort((a, b) => rank[a.claim.kind] - rank[b.claim.kind] || a.index - b.index)
    .slice(0, count)
    .map(({ claim }) => claim);
}

/** A tab requested by URL (`?tab=evidence`), if the opportunity has it; otherwise the Overview. */
export function initialTab(requested: string | undefined, available: OpportunityTabId[]): OpportunityTabId {
  const tab = opportunityTabIds.find((id) => id === requested?.toLowerCase());
  return tab && available.includes(tab) ? tab : "overview";
}
