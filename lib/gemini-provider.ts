import "server-only";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { GEMINI_MODEL, parseGeminiSearch } from "@/lib/research-fallback-core";

export function geminiModel() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) throw Object.assign(new Error("PROVIDER_CONFIGURATION"), { requestNotSent: true });
  return google(GEMINI_MODEL);
}

export async function verifyGeminiModel() {
  geminiModel();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`, {
    headers: { "x-goog-api-key": process.env.GOOGLE_GENERATIVE_AI_API_KEY! },
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Object.assign(new Error(response.status === 429 || response.status >= 500 ? "TRANSIENT_PROVIDER" : "PROVIDER_CONFIGURATION"), { statusCode: response.status });
  const model = await response.json();
  if (!model.supportedGenerationMethods?.includes("generateContent")) throw new Error("PROVIDER_CONFIGURATION");
}

export async function searchGemini(prompt: string) {
  const result = await generateText({
    model: geminiModel(), prompt,
    tools: { google_search: google.tools.googleSearch({}) },
    providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
    maxOutputTokens: 512, maxRetries: 0, abortSignal: AbortSignal.timeout(90000),
  });
  return parseGeminiSearch(result);
}
