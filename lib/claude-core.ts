import { z } from "zod";
import { DEFAULT_CLAUDE_MODEL, researchModelPricing } from "./research-models.ts";

export const CLAUDE_MODEL = DEFAULT_CLAUDE_MODEL;
/** Provider id recorded on runs and in the usage ledger for calls served by the Claude API. */
export const CLAUDE_PROVIDER = "anthropic-claude";
export const claudePricing = researchModelPricing(CLAUDE_MODEL);

const usageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cache_creation_input_tokens: z.number().int().nonnegative().nullish(),
  cache_read_input_tokens: z.number().int().nonnegative().nullish(),
  server_tool_use: z.object({ web_search_requests: z.number().int().nonnegative().nullish() }).nullish(),
});
const messageSchema = z.object({
  stop_reason: z.string().nullish(),
  content: z.array(z.looseObject({ type: z.string() })),
  usage: usageSchema.nullish(),
});
const searchResultsSchema = z.array(z.object({ type: z.literal("web_search_result"), url: z.string(), title: z.string().nullish() }));

/** Billed tokens of one Claude response; cache writes and reads are input the ledger prices as input. */
export function claudeTokens(usage: z.infer<typeof usageSchema> | null | undefined) {
  if (!usage) return undefined;
  return {
    inputTokens: usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
  };
}

// A response that was generated (and billed) but carries no usable sources still reports its usage, so the ledger can
// record the real cost instead of holding the whole reservation as "unknown".
function noSources(usage: ReturnType<typeof claudeTokens>, searchRequests: number) {
  const error = new Error("RETRIEVAL_UNAVAILABLE");
  return usage ? Object.assign(error, { usage, searchRequests }) : error;
}

/**
 * Sources from a Claude response that used the web search server tool. Results arrive as `web_search_tool_result`
 * blocks; a block whose content is an error object (not a list) is a failed search, which is billed but has no sources.
 */
export function parseClaudeSearch(value: unknown) {
  const message = messageSchema.parse(value);
  const tokens = claudeTokens(message.usage);
  const searchCalls = message.content.filter(block => block.type === "server_tool_use" && block.name === "web_search").length;
  const searchRequests = Math.max(message.usage?.server_tool_use?.web_search_requests ?? 0, searchCalls);
  if (message.stop_reason === "refusal") throw noSources(tokens, searchRequests);
  const sources = message.content.flatMap(block => {
    if (block.type !== "web_search_tool_result") return [];
    const results = searchResultsSchema.safeParse(block.content);
    return results.success ? results.data.map(result => ({ url: result.url, ...(result.title ? { title: result.title } : {}) })) : [];
  });
  if (!searchRequests || !sources.length) throw noSources(tokens, searchRequests);
  return { sources, searchRequests, tokens };
}

/**
 * The JSON answer of a structured-output response, checked against the draft schema. An answer that is missing, cut
 * off or does not match throws an error marked `unparsedOutput` (retried once, like the other providers' unparsed
 * output) that carries the billed usage.
 */
export function parseClaudeObject<T>(value: unknown, schema: z.ZodType<T>): { value: T; tokens: ReturnType<typeof claudeTokens> } {
  const message = messageSchema.parse(value);
  const tokens = claudeTokens(message.usage);
  const unparsed = (reason: string) => Object.assign(new Error(`INVALID_OUTPUT: ${reason}`), { unparsedOutput: true, finishReason: message.stop_reason ?? undefined, ...(tokens ? { usage: tokens } : {}) });
  if (message.stop_reason === "refusal") throw unparsed("the model declined the request");
  if (message.stop_reason === "max_tokens") throw unparsed("the answer was cut off at the output limit");
  const text = message.content.flatMap(block => block.type === "text" && typeof block.text === "string" ? [block.text] : []).join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw unparsed("the answer was not JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw unparsed("the answer did not match the schema");
  return { value: parsed.data, tokens };
}

/**
 * Turns a Claude API or transport error into the codes the engine classifies (errorCode in research-core.ts), keeping
 * the HTTP status so a request the API refused before generating anything releases its reservation.
 */
export function claudeError(error: unknown): Error {
  const failure = (error ?? {}) as { status?: unknown; name?: unknown; message?: unknown };
  const status = typeof failure.status === "number" ? failure.status : undefined;
  const message = typeof failure.message === "string" ? failure.message : String(error);
  const name = typeof failure.name === "string" ? failure.name : "";
  const coded = (code: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(`${code}: ${message.slice(0, 300)}`), { cause: error, ...extra });
  if (status === undefined) {
    // No response: a timeout, an abort or a dropped connection. The request may have been billed.
    return /timeout|abort|connection|fetch failed|network/i.test(`${name} ${message}`) ? coded("TRANSIENT_PROVIDER") : (error instanceof Error ? error : new Error(message));
  }
  // A billing failure is reported as a 400 before any generation, so it is never billed.
  if (/credit balance|billing|insufficient/i.test(message)) return coded("PROVIDER_CREDITS_REQUIRED", { statusCode: 402 });
  if (status === 429 || status === 408 || status === 529 || status >= 500) return coded("TRANSIENT_PROVIDER", { statusCode: status });
  // 401/403 (key), 404 (model unavailable to this key) and other 4xx (request the API refused): never billed.
  return coded("PROVIDER_CONFIGURATION", { statusCode: status, ...(status === 400 || status === 413 || status === 422 ? { requestNotSent: true } : {}) });
}
