import { z } from "zod";
import { DEFAULT_QWEN_MODEL, DEFAULT_GEMINI_MODEL, DEFAULT_CLAUDE_MODEL, qwenModelSchema, geminiModelSchema, claudeModelSchema, researchProviders, selectedModel } from "./research-models.ts";
import { estimateRunCost } from "./research-budget.ts";
import { sourcePolicySchema, resolveSourcePolicy, runShape } from "./source-policy.ts";

// The source policy (breadth and depth of evidence collection) is stored with the provider policy; the engine and the
// admin page read it from here so the research engine's test harnesses need no extra module.
export {
  sourceKinds, recencyOptions, sourcePolicySchema, defaultSourcePolicy, legacySourcePolicy, resolveSourcePolicy, sameSourcePolicy, retrievalLimits,
  runShape, searchGuidance, queryEvidence, queryGuidance, communityHint, sectorCommunityHints,
  MIN_CANDIDATES, MAX_CANDIDATES, MIN_PAGES_PER_IDEA, MAX_PAGES_PER_IDEA,
  type SourcePolicy, type SourceKind, type Recency,
} from "./source-policy.ts";

// Row key in public.app_settings that holds the research policy below.
export const RESEARCH_SETTINGS_KEY = "research";
export const DEFAULT_RESEARCH_BUDGET_USD = 0.25;
export const MIN_RESEARCH_BUDGET_USD = 0.05;
export const MAX_RESEARCH_BUDGET_USD = 5;
export const providerSettingsSchema = z.strictObject({
  primary: z.enum(researchProviders),
  autoFallback: z.boolean(),
  // Which provider takes over when the primary fails. Absent on rows saved before Claude was added: those keep the
  // fallback they always had (defaultFallback).
  fallbackProvider: z.enum(researchProviders).optional(),
  qwenModel: qwenModelSchema.default(DEFAULT_QWEN_MODEL),
  geminiModel: geminiModelSchema.default(DEFAULT_GEMINI_MODEL),
  claudeModel: claudeModelSchema.default(DEFAULT_CLAUDE_MODEL),
  // Hard per-run spend cap applied by enqueue_research to new runs.
  budgetUsd: z.number().min(MIN_RESEARCH_BUDGET_USD).max(MAX_RESEARCH_BUDGET_USD).default(DEFAULT_RESEARCH_BUDGET_USD),
});
export type ProviderSettings = z.infer<typeof providerSettingsSchema>;
export type ResearchProvider = ProviderSettings["primary"];
/**
 * What the admin API accepts and stores: the provider policy plus the optional source policy. A row saved before the
 * source policy existed has no `sources` and researches on the defaults (resolveSourcePolicy).
 */
export const researchSettingsSchema = providerSettingsSchema.extend({
  sources: sourcePolicySchema.optional(),
});
export type ResearchSettings = z.infer<typeof researchSettingsSchema>;
export const storedProviderSettingsSchema = researchSettingsSchema.extend({
  updatedAt: z.iso.datetime(),
});
export type StoredProviderSettings = z.infer<typeof storedProviderSettingsSchema>;
export const defaultProviderSettings: ProviderSettings = providerSettingsSchema.parse({ primary: "qwen", autoFallback: true });
export type ProviderAvailability = Record<ResearchProvider, { configured: boolean; model: string }>;
export type ProviderSettingsResponse = {
  settings: ResearchSettings & { updatedAt: string | null };
  providers: ProviderAvailability;
};

export function readStoredProviderSettings(value: unknown): ProviderSettingsResponse["settings"] {
  if (value === undefined || value === null) return { ...defaultProviderSettings, updatedAt: null };
  const parsed = storedProviderSettingsSchema.safeParse(value);
  if (!parsed.success) throw new Error("PROVIDER_CONFIGURATION");
  return parsed.data;
}

/** The fallback for each primary when none is chosen: Qwen and Gemini back each other up, as before Claude existed. */
export const defaultFallback: Record<ResearchProvider, ResearchProvider> = { qwen: "gemini", gemini: "qwen", claude: "gemini" };

/** The provider that takes over from `primary`: the chosen one, or the default when none is chosen or it is the primary itself. */
export function fallbackFor(settings: Pick<ProviderSettings, "primary"> & { fallbackProvider?: ResearchProvider }): ResearchProvider {
  const chosen = settings.fallbackProvider;
  return chosen && chosen !== settings.primary ? chosen : defaultFallback[settings.primary];
}

export function providerPlan(settings: Pick<ProviderSettings, "primary" | "autoFallback"> & { fallbackProvider?: ResearchProvider }, active: ResearchProvider = settings.primary) {
  return {
    primary: active,
    fallback: settings.autoFallback && active === settings.primary ? fallbackFor(settings) : undefined,
  };
}

export function assertProvidersConfigured(settings: ProviderSettings, providers: ProviderAvailability) {
  const plan = providerPlan(settings);
  if (!providers[plan.primary].configured || (plan.fallback && !providers[plan.fallback].configured)) {
    throw new Error("PROVIDER_NOT_CONFIGURED");
  }
}

// What a complete run is expected to cost on the planned primary and fallback models, and the budget each needs, at
// the breadth and depth the source policy sets.
export function runCostEstimates(settings: ProviderSettings & { sources?: unknown }, at = new Date()) {
  const plan = providerPlan(settings);
  const run = runShape(resolveSourcePolicy(settings.sources));
  return {
    primary: estimateRunCost(selectedModel(plan.primary, settings), at, "combined", run),
    fallback: plan.fallback ? estimateRunCost(selectedModel(plan.fallback, settings), at, "combined", run) : undefined,
    // "Verify my idea" runs are smaller; shown beside the discovery estimate on the admin page.
    verify: {
      primary: estimateRunCost(selectedModel(plan.primary, settings), at, "verify", run),
      fallback: plan.fallback ? estimateRunCost(selectedModel(plan.fallback, settings), at, "verify", run) : undefined,
    },
  };
}

/**
 * Margin a saved budget must keep above a model's estimated requirement. The estimate is re-calibrated as the pipeline
 * changes (WP-07 raised Gemini 3.8 Flash from $0.5435 to $0.5675), and a run whose configured primary no longer fits
 * is started on the fallback instead. Without this margin, a budget saved just above the estimate silently moves every
 * later run to another model after a deploy.
 */
export const BUDGET_HEADROOM = 1.1;
/** The smallest budget the admin page accepts for a model that needs `requiredUsd`: the estimate plus headroom, in cents. */
export function recommendedBudget(requiredUsd: number) {
  return Math.ceil(Math.round(requiredUsd * BUDGET_HEADROOM * 10_000) / 100) / 100;
}

// A primary model that cannot finish a run within the per-run budget makes every run fail after spending money, or
// moves it to the fallback. A fallback that cannot finish is allowed; the engine simply does not use it.
export function assertBudgetFits(settings: ProviderSettings & { sources?: unknown }, at = new Date()) {
  const { primary } = runCostEstimates(settings, at);
  const recommended = recommendedBudget(primary.requiredUsd);
  if (recommended > settings.budgetUsd) throw Object.assign(new Error("BUDGET_TOO_LOW"), { requiredUsd: recommended, model: primary.model });
}

/**
 * The per-run budget as typed into the admin form. Returns the value rounded to cents when it is a usable budget,
 * or null while the text is incomplete or out of range ("", "0.", "0.0"), so typing is never overwritten mid-entry.
 */
export function parseBudgetInput(text: string): number | null {
  if (!/^\d*\.?\d*$/.test(text.trim()) || !/\d/.test(text)) return null;
  const value = Math.round(Number(text) * 100) / 100;
  return Number.isFinite(value) && value >= MIN_RESEARCH_BUDGET_USD && value <= MAX_RESEARCH_BUDGET_USD ? value : null;
}

/** The budget to keep when the field loses focus: the typed value clamped into range, or the previous value. */
export function settleBudgetInput(text: string, previous: number): number {
  const value = Number(text);
  if (!text.trim() || !Number.isFinite(value)) return previous;
  return Math.min(MAX_RESEARCH_BUDGET_USD, Math.max(MIN_RESEARCH_BUDGET_USD, Math.round(value * 100) / 100));
}
