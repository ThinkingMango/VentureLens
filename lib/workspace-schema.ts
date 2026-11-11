import { z } from "zod";
import {
  anySector,
  businessModelLead,
  businessModels,
  maxBusinessModels,
  maxResearchSectors,
  researchSectors,
  targetMarkets,
  angleOptions,
  maxAngles,
} from "./research-options.ts";

export const revenueTargetOptions = ["Side income (<$1k/mo)", "$1–5k/mo", "$5–20k/mo", "$20k+/mo"] as const;
export const strengthOptions = ["Technical", "Sales & marketing", "Operations", "Balanced"] as const;
export const riskOptions = ["Low", "Medium", "High"] as const;
// Languages a founder can work in, offered as a multi-select (up to 5). Stored as these canonical English names.
export const profileLanguages = [
  "English", "Mandarin Chinese", "Cantonese", "Spanish", "French", "German", "Portuguese", "Japanese", "Korean",
  "Hindi", "Arabic", "Indonesian", "Vietnamese", "Thai", "Italian", "Dutch",
] as const;
// An optional single choice: one of the options, or "" for "not answered" (the database default).
const choiceOrEmpty = <T extends readonly [string, ...string[]]>(options: T) => z.union([z.literal(""), z.enum(options)]).optional();

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  role: z.string().trim().min(1).max(100),
  industry: z.string().trim().min(1).max(100),
  skills: z.string().trim().min(1, "Add your skills or experience.").max(500),
  hours: z.enum([
    "Under 5 hours",
    "5–10 hours",
    "10–20 hours",
    "20–40 hours",
    "Full time",
  ]),
  budget: z.enum(["Under $1,000", "$1,000–5,000", "$5,000–15,000", "$15,000+"]),
  goal: z.string().trim().min(1).max(150),
  // Profile v2 (WP-02). Every field is optional and has no default here: a client that sends a profile without them
  // (an older tab, say) leaves the stored values alone instead of blanking them. The database defaults them to ''.
  interests: z.string().trim().max(500).optional(),
  pain_points: z.string().trim().max(500).optional(),
  revenue_target: choiceOrEmpty(revenueTargetOptions),
  strength: choiceOrEmpty(strengthOptions),
  distribution: z.string().trim().max(500).optional(),
  languages: z
    .array(z.enum(profileLanguages))
    .max(5, "Choose up to 5 languages.")
    .refine((values) => new Set(values).size === values.length, "Choose each language once.")
    .optional(),
  exclusions: z.string().trim().max(300).optional(),
  risk_tolerance: choiceOrEmpty(riskOptions),
});
export type Profile = z.infer<typeof profileSchema>;
// The fixed answers for available hours and starting budget, read by the onboarding form so it cannot drift from
// what the API accepts.
export const hoursOptions = profileSchema.shape.hours.options;
export const budgetOptions = profileSchema.shape.budget.options;
/** The profile v2 fields, in the order the form and the research context use them. */
export const profileV2Fields = ["interests", "pain_points", "distribution", "strength", "revenue_target", "risk_tolerance", "exclusions", "languages"] as const;
/** The founder_profiles columns the app reads, for both the workspace and a research run's profile snapshot. */
// A literal string, so the Supabase client can type the row it returns.
export const profileColumns = "name,role,industry,skills,hours,budget,goal,interests,pain_points,distribution,strength,revenue_target,risk_tolerance,exclusions,languages,onboarding_completed" as const;
/**
 * The profile v2 answers from a stored row. A value the current options no longer accept (or a column a database
 * without the WP-02 migration does not return) reads as "not answered", so one stale answer never blocks the profile.
 */
export function profileV2FromRow(row: Record<string, unknown>): Required<Pick<Profile, (typeof profileV2Fields)[number]>> {
  const value = <K extends (typeof profileV2Fields)[number]>(key: K, empty: NonNullable<Profile[K]>) => {
    const parsed = profileSchema.shape[key].safeParse(row[key]);
    return (parsed.success && parsed.data !== undefined ? parsed.data : empty) as NonNullable<Profile[K]>;
  };
  return {
    interests: value("interests", ""), pain_points: value("pain_points", ""), distribution: value("distribution", ""),
    strength: value("strength", ""), revenue_target: value("revenue_target", ""), risk_tolerance: value("risk_tolerance", ""),
    exclusions: value("exclusions", ""), languages: value("languages", []),
  };
}
// A multi-choice field: distinct canonical values, and the "no preference" option only on its own.
function choices<T extends string>(values: z.ZodEnum<{ [K in T]: K }>, open: T, max: number) {
  return z
    .array(values)
    .min(1)
    .max(max)
    .refine((list) => new Set(list).size === list.length, "Each option can be chosen once.")
    .refine((list) => !list.includes(open) || list.length === 1, `${open} cannot be combined with other options.`);
}
/**
 * The founder's own idea, for "Verify my idea" runs (discovery_mode "verify"). Title, buyer and pain are copied into
 * the run's single candidate exactly as written; the model never rewrites them.
 */
export const ideaSchema = z.object({
  title: z.string().trim().min(3, "Give the idea a short name.").max(180),
  buyer: z.string().trim().min(3, "Say who would buy it.").max(300),
  pain: z.string().trim().min(10, "Describe the problem it solves in a sentence or two.").max(800),
  offer: z.string().trim().max(800).default(""),
  price_hint: z.string().trim().max(100).default(""),
});
export type ResearchIdea = z.infer<typeof ideaSchema>;
export const discoveryModes = ["founder", "market", "combined", "verify"] as const;
const briefShape = z.object({
  name: z.string().trim().min(1).max(100),
  // Canonical English values from lib/research-options.ts; translated only for display.
  sectors: choices(z.enum(researchSectors), anySector, maxResearchSectors),
  models: choices(z.enum(businessModels), businessModelLead, maxBusinessModels),
  geography: z.enum(targetMarkets),
  context: z.string().trim().max(1000).default(""),
  discovery_mode: z.enum(discoveryModes).optional(),
  idea: ideaSchema.optional(),
  // Run focus (WP-03). Briefs saved before WP-03 have neither and read as "none" and "off".
  angles: z
    .array(z.enum(angleOptions))
    .max(maxAngles, "Choose up to 6 angles.")
    .refine((values) => new Set(values).size === values.length, "Choose each angle once.")
    .default([]),
  explore_new: z.boolean().default(false),
});
// An idea is required when checking an idea, and only then: a discovery brief that carried one would send text the
// founder no longer sees to the research model.
function verifyRule(brief: { discovery_mode?: string; idea?: unknown }, ctx: z.RefinementCtx) {
  const verify = brief.discovery_mode === "verify";
  if (verify && !brief.idea) ctx.addIssue({ code: "custom", path: ["idea"], message: "Describe the idea to check." });
  if (!verify && brief.idea) ctx.addIssue({ code: "custom", path: ["idea"], message: "An idea is only used when checking an idea." });
}
// Briefs saved, and runs started, before industries and business models became multi-choice hold a single `sector`
// and `model`. They are read as one-item selections, so stored run configurations and older clients stay valid.
function singleChoiceBrief(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { sector, model, idea, ...brief } = value as Record<string, unknown>;
  return {
    ...brief,
    // Saved projects store "no idea" as a null column; the key is left out so discovery briefs parse as before.
    ...(idea == null ? {} : { idea }),
    sectors: brief.sectors ?? (sector === undefined ? undefined : [sector]),
    models: brief.models ?? (model === undefined ? undefined : [model]),
  };
}
export const projectSchema = z.preprocess(singleChoiceBrief, briefShape.superRefine(verifyRule));
export type ResearchBrief = z.infer<typeof briefShape>;
export const reportLanguageSchema = z.enum(["en", "zh-Hans", "zh-Hant"]);
export type ReportLanguage = z.infer<typeof reportLanguageSchema>;
// A research request is a brief plus the language the report should be written in.
// The language travels inside the stored run configuration; it is not a column.
export const researchRequestSchema = z.preprocess(
  singleChoiceBrief,
  briefShape.extend({ language: reportLanguageSchema.optional() }).superRefine(verifyRule),
);
export type ResearchRequest = z.infer<typeof researchRequestSchema>;
export type Project = ResearchBrief & { id: string; created_at: string };
export type ResearchRun = {
  id: string;
  project_id: string;
  status: string;
  created_at: string;
  stage: string;
  error_code: string | null;
  retry_count: number;
};
export const opportunitySchema = z.object({
  id: z.string(),
  title: z.string().max(200),
  category: z.string(),
  description: z.string(),
  buyer: z.string(),
  pain: z.string(),
  score: z.number().min(0).max(100),
  confidence: z.string(),
  revenue: z.string(),
  cost: z.string(),
  risk: z.string(),
  scores: z.array(z.number().min(0).max(100)).length(5),
  icon: z.enum(["file", "headset", "chart", "workflow"]),
  candidate_id: z.string().optional(),
  // `stance` is recorded from v2 of the evidence gate; reports saved earlier have no stance on their sources.
  // `excerpt` is present on the opportunity page and omitted from the workspace list (see workspaceOpportunity).
  // `reliability` is recorded from WP-09; older payloads have none.
  evidence: z.array(z.object({ source_key: z.string(), url: z.string().url(), title: z.string(), excerpt: z.string().optional(), retrieved_at: z.string(), published_at: z.string().nullable(), stance: z.enum(["supports", "contradicts", "neutral"]).optional(), reliability: z.enum(["primary", "secondary", "vendor", "unknown"]).optional() })).optional(),
  assumptions: z.array(z.string()).optional(),
  validation: z.array(z.string()).optional(),
  rationale: z.string().optional(),
  critique: z.string().optional(),
  falsification: z.string().optional(),
  penalty: z.number().optional(),
  // From methodology v2: the weighted rating before the review deduction, and the evidence cap that applied.
  score_before_review: z.number().min(0).max(100).optional(),
  score_cap: z.union([z.literal(70), z.literal(85)]).optional(),
  // From methodology v3 (WP-07): claims tied to the evidence above, and the version the opportunity was made under.
  claims: z.array(z.object({
    text: z.string(),
    kind: z.enum(["observed", "inference", "assumption"]),
    section: z.enum(["buyer", "pain", "demand", "competition", "economics", "risk"]),
    source_keys: z.array(z.string()),
    confirm: z.string().optional(),
  })).optional(),
  methodology_version: z.number().int().optional(),
});
export type WorkspaceOpportunity = z.infer<typeof opportunitySchema>;
export type ResearchAccess = {
  enabled: boolean;
  remaining: number;
  maxRuns: number;
  expiresAt: string | null;
};
export const noResearchAccess: ResearchAccess = {
  enabled: false,
  remaining: 0,
  maxRuns: 0,
  expiresAt: null,
};
export type WorkspaceData = {
  userId: string;
  email: string;
  profile: Profile;
  onboarded: boolean;
  /** When the founder last cleared their idea memory (WP-04); null if never. */
  memoryResetAt?: string | null;
  /** Whether a finished run sends a "report ready" email (WP-08). True when the preference cannot be read. */
  notifyOnComplete?: boolean;
  access: ResearchAccess;
  projects: Project[];
  runs: ResearchRun[];
  opportunities: WorkspaceOpportunity[];
  saved: string[];
  completed: string[];
};
export const emptyProfile: Profile = {
  name: "",
  role: "Aspiring founder",
  industry: "Professional services",
  skills: "",
  hours: "10–20 hours",
  budget: "Under $1,000",
  goal: "Build a sustainable side business",
  interests: "",
  pain_points: "",
  revenue_target: "",
  strength: "",
  distribution: "",
  languages: [],
  exclusions: "",
  risk_tolerance: "",
};
export const emptyBrief: ResearchBrief = {
  name: "",
  sectors: ["Professional services"],
  models: ["B2B subscription"],
  geography: "United States",
  context: "",
  angles: [],
  explore_new: false,
};
export function safeReturnPath(
  value: string | null | undefined,
  fallback = "/dashboard",
) {
  if (
    !value ||
    !/^\/(dashboard|research|saved|profile|billing|onboarding|opportunities|admin)(\/|\?|$)/.test(
      value,
    ) ||
    /[\\\r\n]/.test(value)
  )
    return fallback;
  return value;
}
