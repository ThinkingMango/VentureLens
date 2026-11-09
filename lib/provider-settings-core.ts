import { z } from "zod";
import { DEFAULT_QWEN_MODEL, DEFAULT_GEMINI_MODEL, qwenModelSchema, geminiModelSchema, selectedModel } from "./research-models.ts";
import { estimateRunCost, candidatesForBudget, MIN_CANDIDATES } from "./research-budget.ts";

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

export type RunPlan = {
  /** Providers the run may use, in order. One entry means the run has no fallback. */
  providers: ResearchProvider[];
  /** Hypotheses discovery generates. Every provider in `providers` can finish this many within the budget. */
  candidates: number;
};

/**
 * Which providers a run uses and how many hypotheses it generates, for one per-run budget. Shared by the engine (at
 * run start) and the admin form (as a preview) so the two cannot drift.
 * 1. Keep the fallback when both providers can finish at least MIN_CANDIDATES. The count is then sized for the more
 *    expensive of the two, trading a few hypotheses for a run that survives a provider failure.
 * 2. Otherwise run alone on the first provider, primary before fallback, that can finish MIN_CANDIDATES.
 * 3. Otherwise null: no run can finish, and it should stop before spending anything.
 */
export function runPlan(settings: ProviderSettings, budgetUsd: number, at = new Date()): RunPlan | null {
  const plan = providerPlan(settings);
  const model = (provider: ResearchProvider) => selectedModel(provider, settings);
  if (plan.fallback) {
    const both = candidatesForBudget([model(plan.primary), model(plan.fallback)], budgetUsd, at);
    if (both !== null) return { providers: [plan.primary, plan.fallback], candidates: both };
  }
  for (const provider of [plan.primary, ...(plan.fallback ? [plan.fallback] : [])]) {
    const alone = candidatesForBudget([model(provider)], budgetUsd, at);
    if (alone !== null) return { providers: [provider], candidates: alone };
  }
  return null;
}

/**
 * What a complete run is expected to cost on the planned primary and fallback models at the hypothesis count the
 * budget allows, and the budget each needs. A provider that cannot take part is estimated at MIN_CANDIDATES, the least
 * any run needs, so the shortfall shown is the smallest one.
 */
export function runCostEstimates(settings: ProviderSettings, at = new Date()) {
  const plan = providerPlan(settings);
  const run = runPlan(settings, settings.budgetUsd, at);
  const candidates = run?.candidates ?? MIN_CANDIDATES;
  // A provider the plan leaves out is shown at the smallest run, so its shortfall reads as the least it would need.
  const estimate = (provider: ResearchProvider) => estimateRunCost(selectedModel(provider, settings), at, run?.providers.includes(provider) ? candidates : MIN_CANDIDATES);
  return {
    plan: run,
    candidates,
    primary: estimate(plan.primary),
    fallback: plan.fallback ? estimate(plan.fallback) : undefined,
  };
}

// A primary model that cannot finish even the smallest run within the per-run budget makes every run fail after
// spending money. A fallback that cannot finish is allowed; the engine simply does not use it.
export function assertBudgetFits(settings: ProviderSettings, at = new Date()) {
  const plan = providerPlan(settings);
  const run = runPlan(settings, settings.budgetUsd, at);
  if (!run || run.providers[0] !== plan.primary) {
    const primary = estimateRunCost(selectedModel(plan.primary, settings), at, MIN_CANDIDATES);
    throw Object.assign(new Error("BUDGET_TOO_LOW"), { requiredUsd: primary.requiredUsd, model: primary.model });
  }
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
