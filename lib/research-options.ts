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

/** Shown first and outside any group; the rest are grouped so a long list stays scannable. */
export const businessModelLead: BusinessModel = "Open to possibilities";
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
