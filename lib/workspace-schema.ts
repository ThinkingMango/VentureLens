import { z } from "zod";
import {
  anySector,
  businessModelLead,
  businessModels,
  maxBusinessModels,
  maxResearchSectors,
  researchSectors,
  targetMarkets,
} from "./research-options.ts";

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
});
export type Profile = z.infer<typeof profileSchema>;
// The fixed answers for available hours and starting budget, read by the onboarding form so it cannot drift from
// what the API accepts.
export const hoursOptions = profileSchema.shape.hours.options;
export const budgetOptions = profileSchema.shape.budget.options;
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
  evidence: z.array(z.object({ source_key: z.string(), url: z.string().url(), title: z.string(), excerpt: z.string().optional(), retrieved_at: z.string(), published_at: z.string().nullable(), stance: z.enum(["supports", "contradicts", "neutral"]).optional() })).optional(),
  assumptions: z.array(z.string()).optional(),
  validation: z.array(z.string()).optional(),
  rationale: z.string().optional(),
  critique: z.string().optional(),
  falsification: z.string().optional(),
  penalty: z.number().optional(),
  // From methodology v2: the weighted rating before the review deduction, and the evidence cap that applied.
  score_before_review: z.number().min(0).max(100).optional(),
  score_cap: z.union([z.literal(70), z.literal(85)]).optional(),
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
};
export const emptyBrief: ResearchBrief = {
  name: "",
  sectors: ["Professional services"],
  models: ["B2B subscription"],
  geography: "United States",
  context: "",
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
