import type { WorkspaceOpportunity } from "./workspace-schema.ts";
import type { DemoReport, Opportunity } from "./demo-data.ts";
import { citationNumbers, scoreBreakdown, type ScoreBreakdown } from "./report-presentation.ts";
import { claimKey } from "./feedback-core.ts";

/**
 * One opportunity, ready to display (WP-09). The live and demo opportunity pages render the same component from this,
 * so the demo can never show more than a real user gets. Live text is the run's own (in the report language); demo
 * text arrives already translated.
 */
export const opportunityTabIds = ["overview", "evidence", "economics", "validation"] as const;
export type OpportunityTabId = (typeof opportunityTabIds)[number];
export type Claim = NonNullable<WorkspaceOpportunity["claims"]>[number];
/** A claim with its feedback key (WP-13), which stays its position in the stored claims whatever order it is shown in. */
export type ViewClaim = Claim & { key: string };
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
/**
 * A next step (WP-16), ready to display. `source` is the card the step points to, when it cites one of the listed
 * sources; otherwise `hint` says where to look and is shown as a suggestion. `assumption` is the text of the
 * assumption the step tests, when it names one.
 */
export type ViewStep = {
  action: string;
  source: Pick<ViewSource, "key" | "number" | "title" | "url" | "domain"> | null;
  hint: string | null;
  doneWhen: string;
  stopIf: string;
  assumption: string | null;
  day: number;
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
  claims: ViewClaim[];
  sources: ViewSource[];
  revenue: string;
  cost: string;
  assumptions: string[];
  /** Assumption claims and what would confirm them. */
  confirmations: { claim: string; confirm: string | null }[];
  validation: string[];
  /** Next steps (WP-16); empty for reports made before them, which keep the fixed first steps. */
  steps: ViewStep[];
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
/** A stored opportunity's next steps, each pointing at its listed source card when it cites one. */
export function liveSteps(item: Pick<WorkspaceOpportunity, "steps" | "assumptions">, sources: ViewSource[]): ViewStep[] {
  return (item.steps ?? []).map((step) => {
    const card = step.where ? sources.find((source) => source.key === step.where) : undefined;
    return {
      action: step.action,
      source: card ? { key: card.key, number: card.number, title: card.title, url: card.url, domain: card.domain } : null,
      // A cited source that is no longer listed falls back to the hint, which is empty when a source was cited.
      hint: card ? null : step.where_hint || null,
      doneWhen: step.done_when,
      stopIf: step.stop_if,
      assumption: step.tests_assumption === null ? null : item.assumptions?.[step.tests_assumption] ?? null,
      day: step.day,
    };
  });
}
export function liveOpportunityView(item: WorkspaceOpportunity): OpportunityView {
  const numbers = citationNumbers(item.evidence);
  const claims = (item.claims ?? []).map((claim, index) => ({ ...claim, key: claimKey(index) }));
  const sources = liveSources(item.evidence, numbers);
  const steps = liveSteps(item, sources);
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
    sources,
    revenue: item.revenue,
    cost: item.cost,
    assumptions: item.assumptions ?? [],
    confirmations: claims.filter((claim) => claim.kind === "assumption").map((claim) => ({ claim: claim.text, confirm: claim.confirm ?? null })),
    validation: item.validation ?? [],
    steps,
    // With next steps (WP-16), the first one is what to test first.
    firstTest: steps[0]?.action ?? item.validation?.[0] ?? null,
    rationale: item.rationale ?? null,
    critique: item.critique ?? null,
    falsification: item.falsification ?? null,
    penalty: item.penalty ?? null,
    buyerContext: null,
  };
}

/**
 * The demo's next steps (WP-16): fixed, illustrative text citing its synthetic sources. The opportunity page, its
 * example sprint and the demo dashboard all use these, so the demo matches what a real report now shows.
 */
export function demoSteps(copy: (text: string, values?: Record<string, string | number>) => string, sources: ViewSource[]): ViewStep[] {
  const cite = (index: number) => {
    const card = sources[index];
    return card ? { key: card.key, number: card.number, title: card.title, url: null, domain: null } : null;
  };
  const pays = copy("The outcome is valuable enough to support a subscription.");
  return [
    {
      action: copy("Ask five likely buyers how they handled this problem the last time it came up."),
      source: cite(0), hint: null,
      doneWhen: copy("Five conversations held"),
      stopIf: copy("Fewer than two describe the problem without prompting"),
      assumption: copy("Buyers encounter the problem repeatedly, not just once."), day: 5,
    },
    {
      action: copy("Ask the same buyers what they spend on their current workaround, in time or money."),
      source: null, hint: copy("The same conversations: no new outreach needed"),
      doneWhen: copy("A spend figure from at least three buyers"),
      stopIf: copy("Nobody can name a cost"),
      assumption: pays, day: 9,
    },
    {
      action: copy("Offer a small paid pilot of the manual version to the buyers with the clearest pain."),
      source: cite(1), hint: null,
      doneWhen: copy("One buyer agrees to pay"),
      stopIf: copy("No buyer agrees at any price you can sustain"),
      assumption: pays, day: 14,
    },
  ];
}

/**
 * The demo's fixed sample, as a view. `o` and `report` arrive translated (useDemoContent); `copy` translates the few
 * fixed demo lines kept here so the component holds no demo-only text.
 */
export function demoOpportunityView(o: Opportunity, report: DemoReport, copy: (text: string, values?: Record<string, string | number>) => string): OpportunityView {
  const sources: ViewSource[] = report.sources.map((source, index) => ({
    key: `demo-${index + 1}`, number: index + 1, title: source.title, url: null, domain: null,
    quote: source.observation, reliability: null, stance: null, retrievedAt: null, publishedAt: null,
    synthetic: { type: source.type, detail: source.detail, interpretation: source.implication, limitation: source.limitation },
  }));
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
    sources,
    revenue: o.revenue,
    cost: o.cost,
    assumptions: [
      copy("Buyers encounter the problem repeatedly, not just once."),
      copy("AI inference, hosting, and human review fit within the delivery budget."),
      copy("The outcome is valuable enough to support a subscription."),
      copy("Acquisition cost, churn, taxes, and support still need to be modeled."),
    ],
    confirmations: [],
    // The demo shows next steps (WP-16) with fixed, illustrative text, citing its synthetic sources.
    validation: [],
    steps: demoSteps(copy, sources),
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
export function topClaims<C extends Claim>(claims: C[], count = 3): C[] {
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

/** A next step's task detail, as the database writes it when a sprint starts (WP-16): where, done when, stop if. */
export function stepTaskDetail(step: ViewStep, labels: { where: string; hint: string; done: string; stop: string }): string {
  return [
    step.source ? `${labels.where}: ${step.source.title}` : step.hint ? `${labels.hint}: ${step.hint}` : null,
    `${labels.done}: ${step.doneWhen}`,
    `${labels.stop}: ${step.stopIf}`,
  ].filter(Boolean).join("\n");
}
