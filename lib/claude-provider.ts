import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { CLAUDE_MODEL, claudeError, parseClaudeObject, parseClaudeSearch } from "@/lib/claude-core";
import { CLAUDE_SEARCH_MAX_USES, claudeModelSchema, claudeThinkingOptions, researchModels, SEARCH_TIMEOUT_MS, type ClaudeModelId } from "@/lib/research-models";

// The engine retries and falls back itself, and every request is reserved against the run budget first, so the SDK
// must not retry on its own: a silent retry would spend money the ledger never reserved.
function client() {
  if (!process.env.ANTHROPIC_API_KEY) throw Object.assign(new Error("PROVIDER_CONFIGURATION"), { requestNotSent: true });
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
}

/** Checks that the key can use the model before a run spends anything. */
export async function verifyClaudeModel(model: ClaudeModelId = CLAUDE_MODEL) {
  claudeModelSchema.parse(model);
  const anthropic = client();
  try {
    await anthropic.models.retrieve(model, {}, { timeout: 15_000 });
  } catch (error) {
    throw claudeError(error);
  }
}

/**
 * One structured call: the answer is constrained to the draft schema with structured outputs, then checked against
 * it. Thinking is adaptive (always on for current Claude models) at the effort the model's settings give.
 */
export async function generateClaudeObject<T>({ model, system, prompt, schema, maxOutputTokens, timeoutMs }: {
  model: ClaudeModelId; system: string; prompt: string; schema: z.ZodType<T>; maxOutputTokens: number; timeoutMs: number;
}) {
  claudeModelSchema.parse(model);
  const anthropic = client();
  const { thinking, effort } = claudeThinkingOptions(model, "structured");
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model, max_tokens: maxOutputTokens, thinking,
      ...(system ? { system } : {}),
      output_config: { effort, format: zodOutputFormat(schema) },
      messages: [{ role: "user", content: prompt }],
    }, { timeout: timeoutMs });
  } catch (error) {
    throw claudeError(error);
  }
  return parseClaudeObject(response, schema);
}

/**
 * One native web search. Claude only needs to issue queries here: the engine reads the pages itself. Results are
 * requested as direct tool results (not through code execution), so their URLs arrive in `web_search_tool_result`
 * blocks, and `max_uses` caps the paid searches at the allowance the reservation counted.
 * `timeoutMs` is set by the retrieval step's time budget (searchTimeout in research-models.ts).
 */
export async function searchClaude(prompt: string, model: ClaudeModelId = CLAUDE_MODEL, timeoutMs: number = SEARCH_TIMEOUT_MS.claude) {
  claudeModelSchema.parse(model);
  const anthropic = client();
  const { thinking, effort } = claudeThinkingOptions(model, "search");
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model, max_tokens: researchModels[model].searchOutputTokens, thinking,
      output_config: { effort },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: CLAUDE_SEARCH_MAX_USES, allowed_callers: ["direct"] }],
      messages: [{ role: "user", content: prompt }],
    }, { timeout: timeoutMs });
  } catch (error) {
    throw claudeError(error);
  }
  return parseClaudeSearch(response);
}
