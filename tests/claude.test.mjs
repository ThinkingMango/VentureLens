import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as claudeCore from "../lib/claude-core.ts";
import * as models from "../lib/research-models.ts";
import { errorCode } from "../lib/research-core.ts";
import { requestWasRejected } from "../lib/research-fallback-core.ts";
import { estimateRunCost, reservationFor } from "../lib/research-budget.ts";
import { recommendedBudget, MAX_RESEARCH_BUDGET_USD } from "../lib/provider-settings-core.ts";
import { discoveryDraftSchema, verifyDiscoveryDraftSchema, classificationDraftSchema, evaluationDraftSchema, reviewDraftSchema } from "../lib/research-core.ts";

const require = createRequire(import.meta.url);
const { parseClaudeSearch, parseClaudeObject, claudeError, CLAUDE_PROVIDER } = claudeCore;
const usage = (input = 1_200, output = 300, searches = 2) => ({ input_tokens: input, output_tokens: output, cache_creation_input_tokens: 0, cache_read_input_tokens: 50, server_tool_use: { web_search_requests: searches, web_fetch_requests: 0 } });
const result = (url, title) => ({ type: "web_search_result", url, title, encrypted_content: "x", page_age: null });

test("Claude search sources come from web_search_tool_result blocks, with the billed usage and query count", () => {
  const parsed = parseClaudeSearch({
    stop_reason: "end_turn",
    content: [
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "clinic intake pain" } },
      { type: "web_search_tool_result", tool_use_id: "s1", content: [result("https://a.example/1", "One"), result("https://b.example/2", "Two")] },
      { type: "server_tool_use", id: "s2", name: "web_search", input: { query: "clinic intake cost" } },
      // A failed search is an error object, not a list: billed, but it adds no sources.
      { type: "web_search_tool_result", tool_use_id: "s2", content: { type: "web_search_tool_result_error", error_code: "unavailable" } },
      { type: "text", text: "Found two sources." },
    ],
    usage: usage(),
  });
  assert.deepEqual(parsed.sources, [{ url: "https://a.example/1", title: "One" }, { url: "https://b.example/2", title: "Two" }]);
  assert.equal(parsed.searchRequests, 2);
  assert.deepEqual(parsed.tokens, { inputTokens: 1_250, outputTokens: 300 }, "cache reads are input the ledger prices");
});

test("a Claude search with no sources, or a refusal, is RETRIEVAL_UNAVAILABLE and still reports what it cost", () => {
  for (const response of [
    { stop_reason: "end_turn", content: [{ type: "text", text: "I could not search." }], usage: usage(400, 80, 0) },
    { stop_reason: "end_turn", content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: {} }, { type: "web_search_tool_result", tool_use_id: "s1", content: [] }], usage: usage(400, 80, 1) },
    { stop_reason: "refusal", content: [{ type: "web_search_tool_result", tool_use_id: "s1", content: [result("https://a.example", "A")] }], usage: usage(400, 80, 1) },
  ]) {
    assert.throws(() => parseClaudeSearch(response), error => {
      assert.equal(error.message, "RETRIEVAL_UNAVAILABLE");
      assert.deepEqual(error.usage, { inputTokens: 450, outputTokens: 80 });
      assert.equal(errorCode(error), "RETRIEVAL_UNAVAILABLE");
      return true;
    });
  }
});

test("Claude structured answers are checked against the draft schema; unusable answers are marked for one retry with their usage", () => {
  const schema = z.object({ ok: z.boolean() });
  const ok = parseClaudeObject({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text: "{\"ok\": true}" }], usage: usage(900, 120, 0) }, schema);
  assert.deepEqual(ok, { value: { ok: true }, tokens: { inputTokens: 950, outputTokens: 120 } });
  for (const [response, reason] of [
    [{ stop_reason: "max_tokens", content: [{ type: "text", text: "{\"ok\": tr" }], usage: usage(900, 8_000, 0) }, /cut off/],
    [{ stop_reason: "refusal", content: [], usage: usage(900, 10, 0) }, /declined/],
    [{ stop_reason: "end_turn", content: [{ type: "text", text: "not json" }], usage: usage(900, 10, 0) }, /not JSON/],
    [{ stop_reason: "end_turn", content: [{ type: "text", text: "{\"ok\": \"yes\"}" }], usage: usage(900, 10, 0) }, /did not match/],
  ]) {
    assert.throws(() => parseClaudeObject(response, schema), error => {
      assert.match(error.message, reason);
      assert.equal(error.unparsedOutput, true);
      assert.equal(error.usage.inputTokens, 950);
      assert.equal(errorCode(error), "INVALID_OUTPUT");
      return true;
    });
  }
});

test("Claude API errors map to the engine's codes, and only refused requests release their reservation", () => {
  const api = (status, message) => Object.assign(new Error(message), { status, name: "APIError" });
  const cases = [
    [api(401, "invalid x-api-key"), "PROVIDER_CONFIGURATION", true],
    [api(403, "permission_error"), "PROVIDER_CONFIGURATION", true],
    [api(404, "model: claude-opus-5-5 not found"), "PROVIDER_CONFIGURATION", true],
    [api(400, "Your credit balance is too low to access the Anthropic API."), "PROVIDER_CREDITS_REQUIRED", true],
    [api(400, "output_config.format: schema is too complex"), "PROVIDER_CONFIGURATION", true],
    [api(429, "rate_limit_error"), "TRANSIENT_PROVIDER", true],
    [api(529, "overloaded_error"), "TRANSIENT_PROVIDER", false],
    [api(500, "api_error"), "TRANSIENT_PROVIDER", false],
    [Object.assign(new Error("Request timed out."), { name: "APIConnectionTimeoutError" }), "TRANSIENT_PROVIDER", false],
    [Object.assign(new Error("Connection error."), { name: "APIConnectionError" }), "TRANSIENT_PROVIDER", false],
  ];
  for (const [error, code, rejected] of cases) {
    const mapped = claudeError(error);
    assert.equal(errorCode(mapped), code, error.message);
    assert.equal(requestWasRejected(mapped), rejected, `${error.message}: reservation ${rejected ? "released" : "kept as possibly billed"}`);
    assert.equal(mapped.cause, error, "the original error is kept for logs");
  }
});

test("the Claude catalogue covers the current Haiku, Sonnet and Opus with their published prices", () => {
  assert.deepEqual([...models.claudeModelIds], ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]);
  const expected = { "claude-haiku-5-5": [0.10, 0.50], "claude-sonnet-5-5": [2, 10], "claude-opus-5-5": [4, 20] };
  for (const [model, [input, output]] of Object.entries(expected)) {
    const pricing = models.researchModelPricing(model);
    assert.ok(Math.abs(pricing.input * 1e6 - input) < 1e-9, model);
    assert.ok(Math.abs(pricing.output * 1e6 - output) < 1e-9, model);
    assert.equal(pricing.search, 0.01, "web search is $10 per 1,000 searches");
    assert.match(pricing.source, /^https:\/\/platform\.claude\.com\//);
    // The usage ledger's pricing schema accepts at most $10 input and $30 output per million tokens.
    assert.ok(pricing.input <= 0.00001 && pricing.output <= 0.00003, model);
    assert.equal(models.providerOfModel(model), "claude");
    assert.equal(models.selectedModel("claude", { claudeModel: model }), model);
  }
  assert.equal(models.selectedModel("claude", {}), models.DEFAULT_CLAUDE_MODEL);
  assert.equal(CLAUDE_PROVIDER, "anthropic-claude");
});

test("every Claude model can finish a run within the largest budget an administrator can set", () => {
  const november = new Date("2026-11-11T00:00:00Z");
  for (const model of models.claudeModelIds) for (const mode of ["combined", "verify"]) {
    const estimate = estimateRunCost(model, november, mode);
    assert.ok(estimate.requiredUsd >= estimate.expectedUsd, `${model} ${mode}`);
    assert.ok(recommendedBudget(estimate.requiredUsd) <= MAX_RESEARCH_BUDGET_USD, `${model} ${mode} needs ${estimate.requiredUsd}`);
  }
  // Ordered by price: Haiku is the cheapest Claude run and Opus the most expensive.
  const [haiku, sonnet, opus] = models.claudeModelIds.map(model => estimateRunCost(model, november).requiredUsd);
  assert.ok(haiku < sonnet && sonnet < opus);
  // A search reserves exactly the searches `max_uses` allows.
  const search = reservationFor("claude-sonnet-5-5", models.researchModelPricing("claude-sonnet-5-5"), { promptBytes: 700, search: true });
  assert.equal(search.searchAllowance, models.CLAUDE_SEARCH_MAX_USES);
  assert.equal(search.inputBound, models.researchModels["claude-sonnet-5-5"].searchInputAllowance);
});

test("every research draft schema converts to a Claude structured-output format", () => {
  for (const [name, schema] of Object.entries({ discoveryDraftSchema, verifyDiscoveryDraftSchema, classificationDraftSchema, evaluationDraftSchema, reviewDraftSchema })) {
    const format = zodOutputFormat(schema);
    assert.equal(format.type, "json_schema", name);
    assert.equal(format.schema.type, "object", name);
  }
});

// Loads lib/claude-provider.ts with a stand-in Anthropic client that records each request.
function provider(env = { ANTHROPIC_API_KEY: "test-key" }, respond = {}) {
  const requests = [], clients = [];
  class Anthropic {
    constructor(options) {
      clients.push(options);
      this.messages = { create: async (body, options) => { requests.push({ body, options }); if (respond.error) throw respond.error; return respond.message; } };
      this.models = { retrieve: async (model, params, options) => { requests.push({ model, params, options }); if (respond.error) throw respond.error; return { id: model }; } };
    }
  }
  const source = readFileSync(new URL("../lib/claude-provider.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const module = { exports: {} };
  const dependencies = {
    "server-only": {}, "@anthropic-ai/sdk": { default: Anthropic, __esModule: true }, "@anthropic-ai/sdk/helpers/zod": { zodOutputFormat },
    "@/lib/claude-core": claudeCore, "@/lib/research-models": models,
  };
  new Function("require", "exports", "module", "process", outputText)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module.exports, module, { env });
  return { ...module.exports, requests, clients };
}

test("structured Claude calls use adaptive thinking at the model's effort, a JSON schema format and no SDK retries", async () => {
  const claude = provider({ ANTHROPIC_API_KEY: "test-key" }, { message: { stop_reason: "end_turn", content: [{ type: "text", text: "{\"ok\":true}" }], usage: usage(100, 20, 0) } });
  const value = await claude.generateClaudeObject({ model: "claude-opus-5-5", system: "Policy", prompt: "Prompt", schema: z.object({ ok: z.boolean() }), maxOutputTokens: 12_000, timeoutMs: 120_000 });
  assert.deepEqual(value.value, { ok: true });
  assert.deepEqual(claude.clients, [{ apiKey: "test-key", maxRetries: 0 }], "the engine, not the SDK, decides retries");
  const [{ body, options }] = claude.requests;
  assert.equal(body.model, "claude-opus-5-5");
  assert.equal(body.max_tokens, 12_000);
  assert.equal(body.system, "Policy");
  assert.deepEqual(body.thinking, { type: "adaptive" });
  assert.equal(body.output_config.effort, "medium");
  assert.equal(body.output_config.format.type, "json_schema");
  assert.deepEqual(body.messages, [{ role: "user", content: "Prompt" }]);
  assert.equal(options.timeout, 120_000);
  for (const field of ["temperature", "top_p", "top_k", "tool_choice"]) assert.ok(!(field in body), `${field} is not sent`);
});

test("Claude searches cap paid searches with max_uses and ask for direct results", async () => {
  const message = { stop_reason: "end_turn", content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: {} }, { type: "web_search_tool_result", tool_use_id: "s1", content: [result("https://a.example", "A")] }], usage: usage(5_000, 400, 1) };
  const claude = provider(undefined, { message });
  const found = await claude.searchClaude("Find evidence", "claude-haiku-5-5", 45_000);
  assert.deepEqual(found.sources, [{ url: "https://a.example", title: "A" }]);
  const [{ body, options }] = claude.requests;
  assert.deepEqual(body.tools, [{ type: "web_search_20260209", name: "web_search", max_uses: models.CLAUDE_SEARCH_MAX_USES, allowed_callers: ["direct"] }]);
  assert.equal(body.max_tokens, models.researchModels["claude-haiku-5-5"].searchOutputTokens);
  assert.equal(body.output_config.effort, "low");
  assert.equal(options.timeout, 45_000);
});

test("a missing key is a configuration failure before any request, and API failures are mapped", async () => {
  const unconfigured = provider({});
  await assert.rejects(unconfigured.verifyClaudeModel("claude-sonnet-5-5"), error => error.message === "PROVIDER_CONFIGURATION" && error.requestNotSent === true);
  assert.equal(unconfigured.requests.length, 0);
  await assert.rejects(unconfigured.verifyClaudeModel("claude-fable-5-2"), /invalid|Invalid/, "models outside the catalogue are rejected");

  const missing = provider(undefined, { error: Object.assign(new Error("model not found"), { status: 404 }) });
  await assert.rejects(missing.verifyClaudeModel("claude-sonnet-5-5"), error => errorCode(error) === "PROVIDER_CONFIGURATION");
  assert.equal(missing.requests[0].options.timeout, 15_000);
  const overloaded = provider(undefined, { error: Object.assign(new Error("Overloaded"), { status: 529 }) });
  await assert.rejects(overloaded.searchClaude("Find", "claude-sonnet-5-5"), error => errorCode(error) === "TRANSIENT_PROVIDER");
});
