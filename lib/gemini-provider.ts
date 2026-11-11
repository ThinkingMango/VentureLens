import "server-only";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { GEMINI_MODEL, parseGeminiSearch } from "@/lib/research-fallback-core";
import { GOOGLE_API_BASE, geminiModelSchema, geminiThinkingOptions, researchModels, SEARCH_TIMEOUT_MS, type GeminiModelId } from "@/lib/research-models";

export function geminiModel(model: GeminiModelId = GEMINI_MODEL) {
  geminiModelSchema.parse(model);
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) throw Object.assign(new Error("PROVIDER_CONFIGURATION"), { requestNotSent: true });
  return google(model);
}

export async function verifyGeminiModel(model: GeminiModelId = GEMINI_MODEL) {
  geminiModel(model);
  const response = await fetch(`${GOOGLE_API_BASE}/models/${model}`, {
    headers: { "x-goog-api-key": process.env.GOOGLE_GENERATIVE_AI_API_KEY! },
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Object.assign(new Error(response.status === 429 || response.status >= 500 ? "TRANSIENT_PROVIDER" : "PROVIDER_CONFIGURATION"), { statusCode: response.status });
  const details = await response.json();
  if (!details.supportedGenerationMethods?.includes("generateContent")) throw new Error("PROVIDER_CONFIGURATION");
}

/** `timeoutMs` is set by the retrieval step's time budget (searchTimeout in research-models.ts). */
export async function searchGemini(prompt: string, model: GeminiModelId = GEMINI_MODEL, timeoutMs: number = SEARCH_TIMEOUT_MS.gemini) {
  const result = await generateText({
    model: geminiModel(model), prompt,
    tools: { google_search: google.tools.googleSearch({}) },
    // Thinking shares maxOutputTokens with the answer; search only needs the model to issue queries.
    providerOptions: geminiThinkingOptions(model, "search"),
    maxOutputTokens: researchModels[model].searchOutputTokens, maxRetries: 0, abortSignal: AbortSignal.timeout(timeoutMs),
  });
  return parseGeminiSearch(result);
}
