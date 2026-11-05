import { z } from "zod";
import { DEFAULT_QWEN_MODEL, DEFAULT_GEMINI_MODEL, qwenModelSchema, geminiModelSchema } from "./research-models.ts";

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
