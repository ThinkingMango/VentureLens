// The fixed choices of a research brief. The form, the API schema (lib/workspace-schema.ts) and the research engine
// all read them from here. Values are canonical English: they are stored as written and translated only for display,
// so every stored brief reads correctly in all three interface languages. Specifics outside these lists (a city, a
// particular buyer group) belong in the brief's free-text context, which the research prompts also receive.
//
// Every value accepted before these lists grew is still here, so saved briefs and earlier runs stay valid.

type Group<T extends string> = { label: string; options: readonly T[] };

/** Industries mirror the founder-profile list (lib/profile-options.ts), so a founder can research their own industry. */
export const researchSectors = [
  "Professional services",
  "B2B SaaS",
  "Finance & operations",
  "Healthcare",
  "Education",
  "Retail & e-commerce",
  "Marketing & media",
  "Real estate & property",
  "Travel & hospitality",
  "Manufacturing & engineering",
  "Logistics & transportation",
  "Food & agriculture",
  "Energy & sustainability",
  "Legal & compliance",
  "HR & recruitment",
  "Nonprofits & social impact",
  "Consumer products & services",
  "Open to any industry",
] as const;
export type ResearchSector = (typeof researchSectors)[number];

/** The "no preference" industry. It stands alone: it cannot be combined with a named industry. */
export const anySector: ResearchSector = "Open to any industry";
/**
 * A brief may name up to three industries. Every run produces eight hypotheses, so each extra industry gets fewer of
 * them; past three, a run is effectively "Open to any industry" with extra rules.
 */
export const maxResearchSectors = 3;

export const businessModels = [
  "Open to possibilities",
  "B2B subscription",
  "B2C subscription",
  "Usage-based software",
  "Freemium with paid upgrades",
  "API or data product",
  "Productized service",
  "Managed service or retainer",
  "Marketplace or platform fees",
  "Licensing or white-label",
  "Paid community or membership",
] as const;
export type BusinessModel = (typeof businessModels)[number];

/** Shown first and outside any group; the rest are grouped so a long list stays scannable. It stands alone, like
 * anySector: it cannot be combined with a named model. */
export const businessModelLead: BusinessModel = "Open to possibilities";
/** Any number of named models may be accepted at once: a model filters hypotheses, it does not split the search. */
export const maxBusinessModels = businessModels.length - 1;
export const businessModelGroups: Group<BusinessModel>[] = [
  { label: "Recurring software", options: ["B2B subscription", "B2C subscription", "Usage-based software", "Freemium with paid upgrades", "API or data product"] },
  { label: "Services", options: ["Productized service", "Managed service or retainer"] },
  { label: "Platforms and access", options: ["Marketplace or platform fees", "Licensing or white-label", "Paid community or membership"] },
];

export const targetMarkets = [
  "Global / English-speaking",
  "United States",
  "Canada",
  "United Kingdom",
  "European Union",
  "Germany",
  "France",
  "Nordics",
  "Australia & New Zealand",
  "Singapore",
  "Hong Kong",
  "Taiwan",
  "Mainland China",
  "Japan",
  "South Korea",
  "India",
  "Southeast Asia",
  "Middle East (GCC)",
  "Latin America",
  "Africa",
] as const;
export type TargetMarket = (typeof targetMarkets)[number];

export const targetMarketLead: TargetMarket = "Global / English-speaking";
export const targetMarketGroups: Group<TargetMarket>[] = [
  { label: "North America", options: ["United States", "Canada"] },
  { label: "Europe", options: ["United Kingdom", "European Union", "Germany", "France", "Nordics"] },
  { label: "Asia-Pacific", options: ["Australia & New Zealand", "Singapore", "Hong Kong", "Taiwan", "Mainland China", "Japan", "South Korea", "India", "Southeast Asia"] },
  { label: "Middle East, Latin America and Africa", options: ["Middle East (GCC)", "Latin America", "Africa"] },
];

/**
 * Ticks or unticks one option of a multi-choice field and returns the new selection in list order.
 * `open` is the field's "no preference" option: choosing it clears the named options, choosing a named option clears
 * it, and unticking the last named option falls back to it, so a selection is never empty. At `max` named options,
 * ticking another changes nothing.
 */
export function toggleChoice<T extends string>(list: readonly T[], current: readonly T[], value: T, open: T, max: number): T[] {
  if (value === open) return [open];
  const named = current.filter((item) => item !== open);
  const next = named.includes(value)
    ? named.filter((item) => item !== value)
    : named.length >= max
      ? named
      : [...named, value];
  return next.length ? list.filter((item) => next.includes(item)) : [open];
}

/** A selection shown as one line, each value translated by `translate`: "Healthcare + Legal & compliance". */
export function choiceLabel(values: readonly string[], translate: (value: string) => string): string {
  return values.map(translate).join(" + ");
}

/**
 * The discovery prompt's instructions for a brief's industries and business models. The selections are spelled out
 * as rules rather than left to the brief JSON, because "several industries" can mean either "each of these" or
 * "only where they meet", and the engine must read it one way.
 */
/**
 * Run focus (WP-03): quick constraints for one run, without editing the profile. They deliberately do not overlap the
 * industries and business models above. Canonical English values; translated only for display.
 */
export const angleOptions = [
  "Bootstrapped (no funding needed)",
  "Runs async / low-touch",
  "No paid ads to start",
  "Sells to small businesses",
  "Sells to professionals",
  "Sells to consumers",
  "Local / in-person",
  "Remote-only",
  "Privacy-first",
  "Mobile-first",
  "Regulated market is OK",
  "Uses my existing audience",
  "Recurring revenue from day one",
  "Can launch in 30 days",
] as const;
export type Angle = (typeof angleOptions)[number];
export const maxAngles = 6;
/** How many angles the form shows before "Show all". */
export const visibleAngles = 8;

export function briefFocus(brief: { sectors: readonly string[]; models: readonly string[]; angles?: readonly string[] }): string {
  const sectors = brief.sectors.filter((value) => value !== anySector);
  const models = brief.models.filter((value) => value !== businessModelLead);
  const industry = !sectors.length
    ? "Industry: open to any industry; choose the industries where the evidence of buyer pain is strongest."
    : sectors.length === 1
      ? `Industry: every hypothesis must sit in ${sectors[0]}.`
      : `Industries: every hypothesis must sit in at least one of ${sectors.join("; ")}. Cover each of these industries with at least one hypothesis; hypotheses that combine them are welcome.`;
  const model = !models.length
    ? "Business model: open; choose the model that best fits each hypothesis."
    : models.length === 1
      ? `Business model: every hypothesis must use ${models[0]}, named in its description.`
      : `Business models: every hypothesis must use exactly one of ${models.join("; ")}, named in its description. These are the founder's acceptable models; do not spread hypotheses across them for the sake of variety.`;
  const angles = brief.angles?.length
    ? ` Constraints for this run: ${brief.angles.join("; ")}. Every hypothesis must satisfy all of them.`
    : "";
  return `${industry} ${model}${angles}`;
}

// Buyers discuss their problems in their own language, so evidence for a local market is mostly found by searching
// in it. Markets not listed here are searched in English, the common business language there.
const marketSearchLanguages: Partial<Record<TargetMarket, string>> = {
  "Mainland China": "Simplified Chinese",
  Taiwan: "Traditional Chinese",
  "Hong Kong": "Traditional Chinese or English, whichever local buyers use to discuss this problem",
  Japan: "Japanese",
  "South Korea": "Korean",
  Germany: "German",
  France: "French",
  "Latin America": "Spanish, or Portuguese for Brazil",
};

/** The language discovery should write each candidate's evidence search query in, for a brief's target market. */
export function searchLanguage(market: string): string {
  return marketSearchLanguages[market as TargetMarket] ?? "English";
}
