import { z } from "zod";
import { DEFAULT_GEMINI_MODEL, researchModelPricing } from "./research-models.ts";

export const GEMINI_MODEL = DEFAULT_GEMINI_MODEL;
export const GEMINI_PROVIDER = "google-gemini";
export const GEMINI_SEARCH_INPUT_ALLOWANCE = 64_000;
export const GEMINI_SEARCH_QUERY_ALLOWANCE = 4;
export const geminiPricing = researchModelPricing(GEMINI_MODEL);

export async function withResearchFallback<T>(primary: () => Promise<T>, fallback: (() => Promise<T>) | undefined, classify: (error: unknown) => string): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    const code = classify(error);
    const reservationRejected = code === "BUDGET_EXCEEDED" && typeof error === "object" && error !== null &&
      "reservationRejected" in error && error.reservationRejected === true &&
      "requestNotSent" in error && error.requestNotSent === true;
    if (!fallback || (!reservationRejected && !["PROVIDER_CONFIGURATION", "PROVIDER_CREDITS_REQUIRED", "TRANSIENT_PROVIDER", "RETRIEVAL_UNAVAILABLE"].includes(code))) throw error;
    return fallback();
  }
}

export function requestWasRejected(error: unknown): boolean {
  const seen = new Set<unknown>();
  for (let current = error; current && !seen.has(current) && seen.size < 8;) {
    seen.add(current);
    if (typeof current !== "object") return false;
    const failure = current as { statusCode?: number; requestNotSent?: boolean; cause?: unknown };
    if (failure.requestNotSent || [401, 402, 403, 404, 429].includes(failure.statusCode ?? 0)) return true;
    current = failure.cause;
  }
  return false;
}

const geminiSearchSchema = z.object({
  sources: z.array(z.object({ sourceType: z.string(), url: z.string().optional(), title: z.string().optional() })),
  providerMetadata: z.object({ google: z.object({
    groundingMetadata: z.object({ webSearchQueries: z.array(z.string()).nullish() }).nullish(),
    usageMetadata: z.object({
      promptTokenCount: z.number().int().nonnegative().optional(),
      candidatesTokenCount: z.number().int().nonnegative().optional(),
      thoughtsTokenCount: z.number().int().nonnegative().optional(),
      toolUsePromptTokenCount: z.number().int().nonnegative().optional(),
    }).nullish(),
  }) }),
});
export function parseGeminiSearch(value: unknown) {
  const result = geminiSearchSchema.safeParse(value);
  if (!result.success) throw new Error("RETRIEVAL_UNAVAILABLE");
  const { sources, providerMetadata: { google } } = result.data;
  const urls = sources.flatMap(source => source.sourceType === "url" && source.url ? [{ url: source.url, title: source.title }] : []);
  const queries = google.groundingMetadata?.webSearchQueries?.filter(query => query.trim()) ?? [];
  if (!urls.length || !queries.length) throw new Error("RETRIEVAL_UNAVAILABLE");
  const usage = google.usageMetadata;
  return {
    sources: urls,
    searchRequests: queries.length,
    tokens: usage?.promptTokenCount !== undefined && usage.candidatesTokenCount !== undefined
      ? { inputTokens: usage.promptTokenCount + (usage.toolUsePromptTokenCount ?? 0), outputTokens: usage.candidatesTokenCount + (usage.thoughtsTokenCount ?? 0) }
      : undefined,
  };
}
