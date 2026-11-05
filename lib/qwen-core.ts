import { z } from "zod";
import { DEFAULT_QWEN_MODEL, researchModelPricing } from "./research-models.ts";

export const QWEN_MODEL = DEFAULT_QWEN_MODEL;
export const QWEN_PROVIDER = "dashscope-beijing";
export const qwenPricing = researchModelPricing(QWEN_MODEL);
export function qwenOrigin(workspace: string | undefined): string {
  if (!workspace || !/^[a-zA-Z0-9-]{1,100}$/.test(workspace)) throw new Error("PROVIDER_CONFIGURATION");
  return `https://${workspace}.cn-beijing.maas.aliyuncs.com`;
}
const responseSchema = z.object({
  error: z.unknown().nullish(),
  status: z.string().optional(),
  output: z.array(z.object({
    type: z.string(), status: z.string().nullish(),
    action: z.object({
      sources: z.array(z.object({ url: z.string(), title: z.string().optional() })).optional(),
      queries: z.array(z.string()).optional(),
    }).optional(),
  })),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    x_tools: z.record(z.string(), z.object({ count: z.number().int().nonnegative().optional() })).optional(),
  }).optional(),
});
export function parseQwenSearch(value: unknown) {
  const response = responseSchema.parse(value);
  if (response.error || response.status === "failed") throw new Error("RETRIEVAL_UNAVAILABLE");
  const calls = response.output.filter(item => item.type === "web_search_call" && item.status === "completed");
  const sources = calls.flatMap(item => item.action?.sources ?? []);
  if (!calls.length || !sources.length) throw new Error("RETRIEVAL_UNAVAILABLE");
  return {
    sources,
    searchRequests: Math.max(calls.reduce((sum, call) => sum + Math.max(call.action?.queries?.length ?? 0, 1), 0), response.usage?.x_tools?.web_search?.count ?? 0),
    tokens: response.usage ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } : undefined,
  };
}
