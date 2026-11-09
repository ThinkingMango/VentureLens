import { z } from "zod";

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
export const projectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sector: z.enum([
    "Professional services",
    "B2B SaaS",
    "Finance & operations",
    "Education",
    "Healthcare",
  ]),
  model: z.enum([
    "B2B subscription",
    "Productized service",
    "Usage-based software",
    "Open to possibilities",
  ]),
  geography: z.enum([
    "United States",
    "United Kingdom",
    "European Union",
    "Global / English-speaking",
  ]),
  context: z.string().trim().max(1000).default(""),
  discovery_mode: z.enum(["founder", "market", "combined"]).optional(),
});
export type ResearchBrief = z.infer<typeof projectSchema>;
export const reportLanguageSchema = z.enum(["en", "zh-Hans", "zh-Hant"]);
export type ReportLanguage = z.infer<typeof reportLanguageSchema>;
// A research request is a brief plus the language the report should be written in.
// The language travels inside the stored run configuration; it is not a column.
export const researchRequestSchema = projectSchema.extend({
  language: reportLanguageSchema.optional(),
});
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
  evidence: z.array(z.object({ source_key: z.string(), url: z.string().url(), title: z.string(), excerpt: z.string(), retrieved_at: z.string(), published_at: z.string().nullable() })).optional(),
  assumptions: z.array(z.string()).optional(),
  validation: z.array(z.string()).optional(),
  rationale: z.string().optional(),
  critique: z.string().optional(),
  falsification: z.string().optional(),
  penalty: z.number().optional(),
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
  sector: "Professional services",
  model: "B2B subscription",
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
