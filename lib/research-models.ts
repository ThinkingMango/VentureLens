import { z } from "zod";

export const qwenModelIds = ["qwen3.8-flash", "qwen3.8-max"] as const;
export const geminiModelIds = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-4-argon"] as const;
// Claude Fable 5.2 is left out: its output price ($40 per million tokens) is above what the usage ledger accepts.
export const claudeModelIds = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"] as const;
export const qwenModelSchema = z.enum(qwenModelIds);
export const geminiModelSchema = z.enum(geminiModelIds);
export const claudeModelSchema = z.enum(claudeModelIds);
export type QwenModelId = typeof qwenModelIds[number];
export type GeminiModelId = typeof geminiModelIds[number];
export type ClaudeModelId = typeof claudeModelIds[number];
export type ResearchModelId = QwenModelId | GeminiModelId | ClaudeModelId;
/** The three model vendors a research run can use. */
export const researchProviders = ["qwen", "gemini", "claude"] as const;
export type ResearchProviderName = typeof researchProviders[number];
export const DEFAULT_QWEN_MODEL: QwenModelId = "qwen3.8-flash";
export const DEFAULT_GEMINI_MODEL: GeminiModelId = "gemini-3.5-flash-lite";
export const DEFAULT_CLAUDE_MODEL: ClaudeModelId = "claude-opus-5-5";
export const GOOGLE_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1";
export const QWEN_API_TEMPLATE = "https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
export const MODEL_CATALOG_CHECKED_AT = "2026-11-05";
export type ThinkingLevel = false | true | "minimal" | "low" | "medium" | "high";
/** When the Claude catalogue and prices below were last checked against Anthropic's published models and pricing. */
export const CLAUDE_CATALOG_CHECKED_AT = "2026-11-03";

// `thinking` applies to structured stages; `searchThinking` to native web search.
// Gemini counts thinking tokens against maxOutputTokens, so a search call with heavy thinking can spend its whole
// output allowance before it issues a query and return no grounding at all. Search only needs the model to issue
// queries, so it uses the lowest level each model supports.
// Qwen structured output (json_schema) is supported only in non-thinking mode, so Qwen structured calls never think;
// `thinking` for Qwen therefore applies to search only.
// `searchInputAllowance` is the reserved context for one native-search call. Observed Gemini grounding prompts are a few
// hundred tokens; DashScope injects retrieved pages into context, so Qwen gets more headroom.
// Claude thinking cannot be switched off on its current models (adaptive thinking is always on); the level is the
// `effort` sent with each request, which bounds how much the model thinks. Claude's web search adds the result pages'
// content to the input of the search call, so it reserves the most context of the three.
export const researchModels = {
  "qwen3.8-flash": { name: "Qwen 3.8 Flash", capability: "fast", thinking: false, searchThinking: false, outputTokens: 7000, searchOutputTokens: 512, searchInputAllowance: 64_000 },
  "qwen3.8-max": { name: "Qwen 3.8 Max", capability: "complex", thinking: false, searchThinking: true, outputTokens: 10000, searchOutputTokens: 2048, searchInputAllowance: 64_000 },
  "gemini-3.5-flash-lite": { name: "Gemini 3.5 Flash-Lite", capability: "economical", thinking: "minimal", searchThinking: "minimal", outputTokens: 7000, searchOutputTokens: 512, searchInputAllowance: 16_000 },
  "gemini-3.8-flash": { name: "Gemini 3.8 Flash", capability: "fastReasoning", thinking: "low", searchThinking: "low", outputTokens: 7000, searchOutputTokens: 2048, searchInputAllowance: 16_000 },
  "gemini-4-argon": { name: "Gemini 4 Argon", capability: "complex", thinking: "high", searchThinking: "low", outputTokens: 10000, searchOutputTokens: 2048, searchInputAllowance: 16_000 },
  "claude-haiku-5-5": { name: "Claude Haiku 5.5", capability: "economical", thinking: "low", searchThinking: "low", outputTokens: 8000, searchOutputTokens: 2048, searchInputAllowance: 64_000 },
  "claude-sonnet-5-5": { name: "Claude Sonnet 5.5", capability: "fastReasoning", thinking: "low", searchThinking: "low", outputTokens: 10000, searchOutputTokens: 2048, searchInputAllowance: 64_000 },
  "claude-opus-5-5": { name: "Claude Opus 5.5", capability: "complex", thinking: "medium", searchThinking: "low", outputTokens: 12000, searchOutputTokens: 2048, searchInputAllowance: 64_000 },
} as const satisfies Record<ResearchModelId, { thinking: ThinkingLevel; searchThinking: ThinkingLevel; outputTokens: number; searchOutputTokens: number; searchInputAllowance: number; name: string; capability: string }>;

// Paid search queries reserved per native-search call. Gemini normally issues 1–2 queries per call; DashScope's agent
// strategy may search several rounds but each query costs a fraction of a cent. Claude's web search is capped per
// request (`max_uses`, CLAUDE_SEARCH_MAX_USES), so its allowance is exact.
export const CLAUDE_SEARCH_MAX_USES = 3;
export const searchQueryAllowance = { qwen: 32, gemini: 4, claude: CLAUDE_SEARCH_MAX_USES } as const;

/**
 * Wall-clock limits for one retrieval step (one candidate's searches plus reading their pages). A workflow step is
 * bounded by the platform's function duration (300 s by default on Vercel), and a step killed by the platform loses
 * the search it already paid for. So each step works to a fixed budget, and every search gets the smaller of its own
 * cap and what is left of that budget after reserving time to read pages.
 *
 * Qwen's native search is agent-style and multi-round: in production (2026-11-11) most searches finished in about
 * 30 s, but 2 of 7 ran 16–20 query rounds for about 60 s, and one passed the former 90 s cap. Gemini issues 1–2
 * queries per call and keeps the 90 s cap.
 */
export const RETRIEVAL_STEP_BUDGET_MS = 240_000;
export const PAGE_READ_RESERVE_MS = 60_000;
export const SEARCH_TIMEOUT_MS = { qwen: 150_000, gemini: 90_000, claude: 90_000 } as const;
/** A search given less time than this is not sent: it would almost certainly time out after being billed. */
export const MIN_SEARCH_MS = 20_000;

/** How long a search that starts now may run, for a retrieval step that started at `stepStart`; below MIN_SEARCH_MS, skip it. */
export function searchTimeout(provider: ResearchProviderName, stepStart: number, now = Date.now()) {
  return Math.min(SEARCH_TIMEOUT_MS[provider], stepStart + RETRIEVAL_STEP_BUDGET_MS - PAGE_READ_RESERVE_MS - now);
}

export function selectedModel(provider: ResearchProviderName, settings: { qwenModel?: QwenModelId; geminiModel?: GeminiModelId; claudeModel?: ClaudeModelId }): ResearchModelId {
  if (provider === "claude") return claudeModelSchema.parse(settings.claudeModel ?? DEFAULT_CLAUDE_MODEL);
  return provider === "qwen"
    ? qwenModelSchema.parse(settings.qwenModel ?? DEFAULT_QWEN_MODEL)
    : geminiModelSchema.parse(settings.geminiModel ?? DEFAULT_GEMINI_MODEL);
}

/** The vendor of a model id. */
export function providerOfModel(model: ResearchModelId): ResearchProviderName {
  return model.startsWith("qwen") ? "qwen" : model.startsWith("claude") ? "claude" : "gemini";
}

export function geminiThinkingOptions(model: GeminiModelId, purpose: "structured" | "search" = "structured") {
  const config = researchModels[model];
  return { google: { thinkingConfig: { thinkingLevel: purpose === "search" ? config.searchThinking : config.thinking } } };
}

// DashScope request fields for a Qwen call. Structured output requires non-thinking mode.
export function qwenThinkingFields(model: QwenModelId, purpose: "structured" | "search") {
  const thinking = purpose === "search" && researchModels[model].searchThinking === true;
  return { enable_thinking: thinking, ...(thinking ? { thinking_budget: 1024 } : {}) };
}

/**
 * Request fields that set how much a Claude call thinks. Current Claude models always think adaptively, so the control
 * is `output_config.effort`; thinking counts against `max_tokens`, which the reservation already bounds.
 */
export function claudeThinkingOptions(model: ClaudeModelId, purpose: "structured" | "search" = "structured") {
  const config = researchModels[model];
  const effort = purpose === "search" ? config.searchThinking : config.thinking;
  return { thinking: { type: "adaptive" as const }, effort };
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
    // Anthropic first-party API rates; Claude Haiku 5.5's rate is for prompts up to 100K tokens, which every call stays under.
    case "claude-haiku-5-5": input = 0.10; output = 0.50; break;
    case "claude-sonnet-5-5": input = 2; output = 10; break;
    case "claude-opus-5-5": input = 4; output = 20; break;
  }
  const provider = providerOfModel(model);
  if (provider === "claude") {
    return {
      input: input / 1_000_000, output: output / 1_000_000,
      // Web search: $10 per 1,000 searches, plus the tokens of the results it adds to the context.
      search: 10 / 1000,
      checked_at: CLAUDE_CATALOG_CHECKED_AT,
      source: "https://platform.claude.com/docs/en/about-claude/pricing",
      search_source: "https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool",
    };
  }
  const qwen = provider === "qwen";
  return {
    input: input / 1_000_000, output: output / 1_000_000,
    search: qwen ? 0.573411 / 1000 : 14 / 1000,
    checked_at: MODEL_CATALOG_CHECKED_AT,
    source: qwen ? "https://www.alibabacloud.com/help/en/model-studio/model-pricing" : "https://ai.google.dev/gemini-api/docs/pricing",
    search_source: qwen ? "https://www.alibabacloud.com/help/en/model-studio/web-search" : "https://ai.google.dev/gemini-api/docs/google-search",
  };
}
