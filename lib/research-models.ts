import { z } from "zod";

export const qwenModelIds = ["qwen3.8-flash", "qwen3.8-max"] as const;
export const geminiModelIds = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-4-argon"] as const;
export const qwenModelSchema = z.enum(qwenModelIds);
export const geminiModelSchema = z.enum(geminiModelIds);
export type QwenModelId = typeof qwenModelIds[number];
export type GeminiModelId = typeof geminiModelIds[number];
export type ResearchModelId = QwenModelId | GeminiModelId;
export const DEFAULT_QWEN_MODEL: QwenModelId = "qwen3.8-flash";
export const DEFAULT_GEMINI_MODEL: GeminiModelId = "gemini-3.5-flash-lite";
export const GOOGLE_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const QWEN_API_TEMPLATE = "https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
export const MODEL_CATALOG_CHECKED_AT = "2026-11-05";

export const researchModels = {
  "qwen3.8-flash": { name: "Qwen 3.8 Flash", capability: "fast", thinking: false, outputTokens: 7000, searchOutputTokens: 512, searchInputAllowance: 1_000_000 },
  "qwen3.8-max": { name: "Qwen 3.8 Max", capability: "complex", thinking: true, outputTokens: 10000, searchOutputTokens: 2048, searchInputAllowance: 64_000 },
  "gemini-3.5-flash-lite": { name: "Gemini 3.5 Flash-Lite", capability: "economical", thinking: "minimal", outputTokens: 7000, searchOutputTokens: 512, searchInputAllowance: 64_000 },
  "gemini-3.8-flash": { name: "Gemini 3.8 Flash", capability: "fastReasoning", thinking: "low", outputTokens: 7000, searchOutputTokens: 2048, searchInputAllowance: 64_000 },
  "gemini-4-argon": { name: "Gemini 4 Argon", capability: "complex", thinking: "high", outputTokens: 10000, searchOutputTokens: 2048, searchInputAllowance: 64_000 },
} as const;

export function selectedModel(provider: "qwen" | "gemini", settings: { qwenModel?: QwenModelId; geminiModel?: GeminiModelId }): ResearchModelId {
  return provider === "qwen"
    ? qwenModelSchema.parse(settings.qwenModel ?? DEFAULT_QWEN_MODEL)
    : geminiModelSchema.parse(settings.geminiModel ?? DEFAULT_GEMINI_MODEL);
}

export function geminiThinkingOptions(model: GeminiModelId) {
  return { google: { thinkingConfig: { thinkingLevel: researchModels[model].thinking } } };
}

export function researchModelPricing(model: ResearchModelId, at = new Date()) {
  let input: number;
  let output: number;
  switch (model) {
    case "qwen3.8-flash": input = 0.15; output = 0.47; break;
    case "qwen3.8-max": input = 1.65; output = 4.951; break;
    case "gemini-3.5-flash-lite": input = 0.30; output = 2.50; break;
    case "gemini-3.8-flash":
      input = at >= new Date("2027-01-01T00:00:00Z") ? 1.50 : 0.75;
      output = input * 5;
      break;
    case "gemini-4-argon":
      input = at >= new Date("2026-12-01T00:00:00Z") ? 4 : 2;
      output = input * 5;
      break;
  }
  const qwen = model.startsWith("qwen");
  return {
    input: input / 1_000_000, output: output / 1_000_000,
    search: qwen ? 0.573411 / 1000 : 14 / 1000,
    checked_at: MODEL_CATALOG_CHECKED_AT,
    source: qwen ? "https://www.alibabacloud.com/help/en/model-studio/model-pricing" : "https://ai.google.dev/gemini-api/docs/pricing",
    search_source: qwen ? "https://www.alibabacloud.com/help/en/model-studio/web-search" : "https://ai.google.dev/gemini-api/docs/google-search",
  };
}
