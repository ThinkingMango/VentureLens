import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { QWEN_MODEL, qwenOrigin, parseQwenSearch } from "@/lib/qwen-core";
import { qwenModelSchema, researchModels, type QwenModelId } from "@/lib/research-models";

function credentials() {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw Object.assign(new Error("PROVIDER_CONFIGURATION"), { requestNotSent: true });
  try {
    return { apiKey, origin: qwenOrigin(process.env.DASHSCOPE_WORKSPACE_ID) };
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error("PROVIDER_CONFIGURATION"), { requestNotSent: true });
  }
}
export function qwenModel(model: QwenModelId = QWEN_MODEL) {
  qwenModelSchema.parse(model);
  const { apiKey, origin } = credentials();
  return createOpenAICompatible({
    name: "dashscope", apiKey, baseURL: `${origin}/compatible-mode/v1`, supportsStructuredOutputs: true,
    transformRequestBody: body => ({ ...body, enable_thinking: researchModels[model].thinking, ...(researchModels[model].thinking ? { thinking_budget: 1024 } : {}) }),
  }).chatModel(model);
}
export async function verifyQwenModel(model: QwenModelId = QWEN_MODEL) {
  qwenModelSchema.parse(model);
  const { apiKey, origin } = credentials();
  const response = await fetch(`${origin}/compatible-mode/v1/models`, {
    headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw await providerError(response);
  const catalog = await response.json();
  if (!catalog.data?.some((item: { id: string }) => item.id === model)) throw new Error("PROVIDER_CONFIGURATION");
}
async function providerError(response: Response) {
  const body = await response.json().catch(() => ({}));
  const code = String(body.error?.code ?? body.code ?? "");
  const message = /arrearage|insufficient|balance|quotaexhausted/i.test(code) || response.status === 402
    ? "PROVIDER_CREDITS_REQUIRED"
    : response.status === 429 || response.status >= 500 ? "TRANSIENT_PROVIDER" : "PROVIDER_CONFIGURATION";
  return Object.assign(new Error(message), { statusCode: response.status });
}
export async function searchQwen(prompt: string, model: QwenModelId = QWEN_MODEL) {
  qwenModelSchema.parse(model);
  const { apiKey, origin } = credentials();
  const response = await fetch(`${origin}/compatible-mode/v1/responses`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(90000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: prompt,
      tools: [{ type: "web_search" }], tool_choice: "required",
      enable_thinking: researchModels[model].thinking,
      ...(researchModels[model].thinking ? { thinking_budget: 1024 } : {}),
      max_output_tokens: researchModels[model].searchOutputTokens,
    }),
  });
  if (!response.ok) throw await providerError(response);
  return parseQwenSearch(await response.json());
}
