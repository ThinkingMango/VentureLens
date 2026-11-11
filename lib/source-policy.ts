import { z } from "zod";

/**
 * The source policy: how widely research looks for evidence (breadth) and how much it reads (depth). Administrators set
 * it at /admin beside the provider policy; it is stored in the same app_settings row under `sources`, frozen into each
 * run's setup checkpoint, and read by discovery and retrieval.
 *
 * The policy only steers what is searched and how much is read. It never changes the evidence gate (`evidenceGate` in
 * research-core): every source still has to be classified, quoted verbatim and counted by registrable domain. The vendor
 * option can only tighten the search ("at most one" or "none"); there is no setting that admits more vendor pages.
 *
 * Defaults reproduce the engine's behaviour before this policy existed, prompt text included, so runs set up without a
 * policy and runs on the default policy research exactly as before.
 */

/** Independent source types a search is told to prefer, in the order the search prompt lists them. */
export const sourceKinds = ["communities", "associations", "research", "news", "government", "jobs"] as const;
export type SourceKind = (typeof sourceKinds)[number];

/** How each source type is named in the search prompt. */
const kindPhrases: Record<SourceKind, string> = {
  communities: "buyer forums and communities",
  associations: "industry associations",
  research: "surveys and research",
  news: "news and analyst coverage",
  government: "government or regulatory pages",
  jobs: "job postings",
};
/** How each source type is named when discovery writes its search queries. */
const queryPhrases: Record<SourceKind, string> = {
  research: "surveys, industry reports",
  communities: "forum discussions",
  news: "news",
  associations: "industry association material",
  government: "government or regulator data",
  jobs: "job postings",
};
/** The query-writing order; the first three reproduce the original wording. */
const queryOrder: readonly SourceKind[] = ["research", "communities", "news", "associations", "government", "jobs"];

export const recencyOptions = ["any", "3y", "1y"] as const;
export type Recency = (typeof recencyOptions)[number];

export const MIN_CANDIDATES = 5;
export const MAX_CANDIDATES = 8;
export const MIN_PAGES_PER_IDEA = 2;
export const MAX_PAGES_PER_IDEA = 6;

export const sourcePolicySchema = z.strictObject({
  /** Breadth: independent source types the search prefers. At least one; duplicates are dropped, order is canonical. */
  kinds: z.array(z.enum(sourceKinds)).min(1).max(sourceKinds.length)
    .transform(kinds => sourceKinds.filter(kind => kinds.includes(kind))),
  /** Breadth: steer queries and searches toward the communities where the brief's buyers discuss their own work. */
  sectorCommunities: z.boolean(),
  /** Breadth: a second search per idea for the alternatives buyers already use or pay for (verify runs always do this). */
  alternativesSearch: z.boolean(),
  /** Breadth: vendor product pages a search may include. Only 1 (the original rule) or 0; never more. */
  vendorPages: z.union([z.literal(0), z.literal(1)]),
  /** Breadth: prefer recent sources. "any" adds no instruction. */
  recency: z.enum(recencyOptions),
  /** Depth: ideas discovery proposes (discovery's schema accepts 5–8). */
  candidates: z.number().int().min(MIN_CANDIDATES).max(MAX_CANDIDATES),
  /** Depth: pages read per idea. A verify run, which researches one idea, reads twice as many. */
  pagesPerIdea: z.number().int().min(MIN_PAGES_PER_IDEA).max(MAX_PAGES_PER_IDEA),
});
export type SourcePolicy = z.infer<typeof sourcePolicySchema>;

export const defaultSourcePolicy: SourcePolicy = Object.freeze({
  kinds: [...sourceKinds],
  sectorCommunities: false,
  alternativesSearch: false,
  vendorPages: 1,
  recency: "any",
  candidates: MAX_CANDIDATES,
  pagesPerIdea: 4,
}) as SourcePolicy;

/** The policy in force: a stored or checkpointed value when it is valid, otherwise the defaults. Never throws. */
export function resolveSourcePolicy(value: unknown): SourcePolicy {
  const parsed = sourcePolicySchema.safeParse(value);
  return parsed.success ? parsed.data : { ...defaultSourcePolicy, kinds: [...defaultSourcePolicy.kinds] };
}

export function sameSourcePolicy(a: unknown, b: unknown) {
  return JSON.stringify(resolveSourcePolicy(a)) === JSON.stringify(resolveSourcePolicy(b));
}

/**
 * Pages read per idea. Discovery reads `pagesPerIdea` of up to `2 × pages + 2` search results (4 of 10 by default); a
 * verify run reads twice as many of up to four times as many results (8 of 16 by default).
 */
export function retrievalLimits(policy: SourcePolicy, mode: string) {
  return mode === "verify"
    ? { evidence: policy.pagesPerIdea * 2, sources: policy.pagesPerIdea * 4 }
    : { evidence: policy.pagesPerIdea, sources: policy.pagesPerIdea * 2 + 2 };
}

/** The run shape the cost estimate uses for a policy (lib/research-budget.ts). */
export function runShape(policy: SourcePolicy) {
  return { candidates: policy.candidates, pagesPerIdea: policy.pagesPerIdea, alternativesSearch: policy.alternativesSearch };
}

/** Where each industry's buyers discuss their own work. Types of place, never named sites, so no geography is assumed. */
export const sectorCommunityHints: Record<string, string> = {
  "Professional services": "practitioner forums and professional-body communities for accountants, lawyers and consultants",
  "B2B SaaS": "practitioner communities where the buyer's own role discusses its tools and workflows",
  "Finance & operations": "finance and operations practitioner forums and professional-body communities",
  "Healthcare": "clinician and practice-manager forums, professional associations and health trade press",
  "Education": "teacher, tutor and school-administrator communities and education trade press",
  "Retail & e-commerce": "independent seller and shop-owner forums and marketplace seller communities",
  "Marketing & media": "marketer, creator and agency practitioner communities",
  "Real estate & property": "landlord, property-manager and agent forums and property trade press",
  "Travel & hospitality": "hotelier, host and hospitality-operator forums and hospitality trade press",
  "Manufacturing & engineering": "plant, quality and operations engineer forums and manufacturing trade press",
  "Logistics & transportation": "dispatcher, fleet-operator and freight forums and logistics trade press",
  "Food & agriculture": "farmer, grower and food-business forums and agricultural extension material",
  "Energy & sustainability": "installer, energy-manager and sustainability practitioner communities",
  "Legal & compliance": "lawyer, paralegal and compliance-officer forums and legal trade press",
  "HR & recruitment": "HR practitioner and recruiter communities and HR trade press",
  "Nonprofits & social impact": "nonprofit staff and fundraiser communities and sector bodies",
  "Consumer products & services": "consumer forums and reviews where buyers describe the problem in their own words",
};
const genericCommunityHint = "practitioner forums, professional communities and trade press for the buyer's own profession";

/** The community hint for a brief's industries; the generic hint when none is named or none is known. */
export function communityHint(sectors: readonly string[] = []) {
  const hints = [...new Set(sectors.map(sector => sectorCommunityHints[sector]).filter((hint): hint is string => !!hint))];
  return hints.length ? hints.join("; ") : genericCommunityHint;
}

function list(items: string[]) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * The source guidance in each search prompt. On the default policy this is exactly the sentence the engine used before
 * the policy existed.
 */
export function searchGuidance(policy: SourcePolicy, sectors: readonly string[] = []) {
  const parts = [
    `Prefer sources that are not selling a product in this space: ${list(policy.kinds.map(kind => kindPhrases[kind]))}.`,
    policy.vendorPages === 0 ? "Do not include vendor product pages." : "Include at most one vendor product page.",
  ];
  if (policy.sectorCommunities) parts.push(`Look first where these buyers discuss their own work: ${communityHint(sectors)}.`);
  if (policy.recency !== "any") parts.push(`Prefer sources published in the last ${policy.recency === "1y" ? "12 months" : "three years"}; use older sources only when nothing recent exists, and say how old they are.`);
  return parts.join(" ");
}

/**
 * The evidence named when discovery writes a search query. On the default policy this is exactly the original list,
 * "surveys, industry reports, forum discussions, news".
 */
export function queryEvidence(policy: SourcePolicy) {
  // All types selected is the default policy: keep the original wording, which names only the first three.
  const kinds = policy.kinds.length === sourceKinds.length ? queryOrder.slice(0, 3) : queryOrder.filter(kind => policy.kinds.includes(kind));
  return kinds.map(kind => queryPhrases[kind]).join(", ");
}

/** Extra query-writing guidance for discovery; empty on the default policy. */
export function queryGuidance(policy: SourcePolicy, sectors: readonly string[] = []) {
  return policy.sectorCommunities
    ? ` Phrase each query the way these buyers describe the problem in their own communities (${communityHint(sectors)}).`
    : "";
}
