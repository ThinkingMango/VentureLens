import { z } from "zod";
import { DEFAULT_QWEN_MODEL, DEFAULT_GEMINI_MODEL, qwenModelSchema, geminiModelSchema, selectedModel } from "./research-models.ts";
import { estimateRunCost } from "./research-budget.ts";

// Row key in public.app_settings that holds the research policy below.
export const RESEARCH_SETTINGS_KEY = "research";
export const DEFAULT_RESEARCH_BUDGET_USD = 0.25;
export const MIN_RESEARCH_BUDGET_USD = 0.05;
export const MAX_RESEARCH_BUDGET_USD = 5;
export const providerSettingsSchema = z.strictObject({
  primary: z.enum(["qwen", "gemini"]),
  autoFallback: z.boolean(),
  qwenModel: qwenModelSchema.default(DEFAULT_QWEN_MODEL),
  geminiModel: geminiModelSchema.default(DEFAULT_GEMINI_MODEL),
  // Hard per-run spend cap applied by enqueue_research to new runs.
  budgetUsd: z.number().min(MIN_RESEARCH_BUDGET_USD).max(MAX_RESEARCH_BUDGET_USD).default(DEFAULT_RESEARCH_BUDGET_USD),
});
export type ProviderSettings = z.infer<typeof providerSettingsSchema>;
export type ResearchProvider = ProviderSettings["primary"];
export const storedProviderSettingsSchema = providerSettingsSchema.extend({
  updatedAt: z.iso.datetime(),
});
export type StoredProviderSettings = z.infer<typeof storedProviderSettingsSchema>;
export const defaultProviderSettings: ProviderSettings = providerSettingsSchema.parse({ primary: "qwen", autoFallback: true });
export type ProviderAvailability = Record<ResearchProvider, { configured: boolean; model: string }>;
export type ProviderSettingsResponse = {
  settings: ProviderSettings & { updatedAt: string | null };
  providers: ProviderAvailability;
};

export function readStoredProviderSettings(value: unknown): ProviderSettingsResponse["settings"] {
  if (value === undefined || value === null) return { ...defaultProviderSettings, updatedAt: null };
  const parsed = storedProviderSettingsSchema.safeParse(value);
  if (!parsed.success) throw new Error("PROVIDER_CONFIGURATION");
  return parsed.data;
}

export function providerPlan(settings: ProviderSettings, active: ResearchProvider = settings.primary) {
  return {
    primary: active,
    fallback: settings.autoFallback && active === settings.primary
      ? (active === "qwen" ? "gemini" : "qwen") as ResearchProvider
      : undefined,
  };
}

export function assertProvidersConfigured(settings: ProviderSettings, providers: ProviderAvailability) {
  const plan = providerPlan(settings);
  if (!providers[plan.primary].configured || (plan.fallback && !providers[plan.fallback].configured)) {
    throw new Error("PROVIDER_NOT_CONFIGURED");
  }
}

// What a complete run is expected to cost on the planned primary and fallback models, and the budget each needs.
export function runCostEstimates(settings: ProviderSettings, at = new Date()) {
  const plan = providerPlan(settings);
  return {
    primary: estimateRunCost(selectedModel(plan.primary, settings), at),
    fallback: plan.fallback ? estimateRunCost(selectedModel(plan.fallback, settings), at) : undefined,
  };
}

// A primary model that cannot finish a run within the per-run budget makes every run fail after spending money.
// A fallback that cannot finish is allowed; the engine simply does not use it.
export function assertBudgetFits(settings: ProviderSettings, at = new Date()) {
  const { primary } = runCostEstimates(settings, at);
  if (primary.requiredUsd > settings.budgetUsd) throw Object.assign(new Error("BUDGET_TOO_LOW"), { requiredUsd: primary.requiredUsd, model: primary.model });
}
