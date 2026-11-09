import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement, cloneElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isAdministrator } from "../lib/admin-access.ts";
import { providerSettingsSchema, readStoredProviderSettings, providerPlan, assertProvidersConfigured } from "../lib/provider-settings-core.ts";
import * as settingsCore from "../lib/provider-settings-core.ts";
import { withResearchFallback } from "../lib/research-fallback-core.ts";
import { z } from "zod";
import * as models from "../lib/research-models.ts";
const modelDefaults = { qwenModel: models.DEFAULT_QWEN_MODEL, geminiModel: models.DEFAULT_GEMINI_MODEL, budgetUsd: 0.25 };
import { errorCode } from "../lib/research-core.ts";
import * as researchCore from "../lib/research-core.ts";
import * as workspaceSchema from "../lib/workspace-schema.ts";
import * as fallbackCore from "../lib/research-fallback-core.ts";
import * as budget from "../lib/research-budget.ts";
import * as apiClient from "../lib/api-client.ts";

const verified = { id: "admin-test-id", email: "owner@example.org", email_confirmed_at: "2026-11-05T00:00:00.000Z", app_metadata: { role: "admin" } };
const require = createRequire(import.meta.url);
// Stand-in for the AI SDK error raised when a response does not parse into the requested object.
const noObject = { isInstance: error => error?.name === "AI_NoObjectGeneratedError" };
const unparsable = usage => Object.assign(new Error("No object generated: could not parse the response."), { name: "AI_NoObjectGeneratedError", usage });
function loadModule(file, dependencies, env = {}, suffix = "") {
  const source = readFileSync(new URL(file, import.meta.url), "utf8") + suffix;
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  const dependency = name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
  new Function("require", "exports", "module", "process", outputText)(dependency, module.exports, module, { env });
  return module.exports;
}
// Fake app_settings table: `rows` is keyed by setting key; `writes` collects upserts.
function settingsTable(rows = {}, writes = [], fail = false) {
  return () => {
    const filters = {};
    const query = {
      select: () => query,
      eq: (key, value) => { filters[key] = value; return query; },
      maybeSingle: async () => fail ? { data: null, error: new Error("database offline") } : { data: filters.key in rows ? { value: rows[filters.key] } : null, error: null },
      upsert: async (row, options) => { writes.push({ row, options }); rows[row.key] = row.value; return { error: null }; },
    };
    return query;
  };
}
function storage({ admin = {}, rows = {}, writes = [], fail = false } = {}) {
  return loadModule("../lib/provider-settings.ts", {
    "server-only": {},
    "@/lib/supabase/admin": { createAdminClient: () => ({ auth: { admin }, from: settingsTable(rows, writes, fail) }) },
    "@/lib/admin-access": { isAdministrator },
    "@/lib/qwen-core": { QWEN_MODEL: "qwen-test" },
    "@/lib/research-fallback-core": { GEMINI_MODEL: "gemini-test" },
    "@/lib/provider-settings-core": settingsCore,
  }, { DASHSCOPE_API_KEY: "test-only", DASHSCOPE_WORKSPACE_ID: "test-only", GOOGLE_GENERATIVE_AI_API_KEY: "test-only" });
}
function route(user, save = () => { throw new Error("must not save"); }) {
  return loadModule("../app/api/admin/providers/route.ts", {
    "next/server": { NextResponse: { json: (value, init) => new Response(JSON.stringify(value), init) } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) },
    "@/lib/admin-access": { isAdministrator },
    "@/lib/provider-settings": { administratorSettings: () => ({ settings: readStoredProviderSettings(undefined), providers: {} }), saveProviderSettings: save },
    "@/lib/provider-settings-core": settingsCore,
  });
}
function patch(body, origin = "https://venturelens.test") {
  return new Request("https://venturelens.test/api/admin/providers", { method: "PATCH", headers: { Origin: origin, Host: "venturelens.test", "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
}

test("only server-managed administrator roles are authorized; email addresses never are", () => {
  for (const app_metadata of [{ role: "admin" }, { is_admin: true }]) {
    for (const email of ["owner@example.org", "ventures@smartmango.ai", "VENTURES@SMARTMANGO.AI"]) {
      const admin = { ...verified, email, app_metadata };
      assert.equal(isAdministrator(admin), true);
      assert.equal(isAdministrator({ ...admin, email_confirmed_at: null }), false);
    }
  }
  for (const user of [null, undefined, {}, { email: "ventures@smartmango.ai" }, { ...verified, app_metadata: {} }, { ...verified, email: "ventures@smartmango.ai", app_metadata: {} }, { email: "other@example.org", email_confirmed_at: verified.email_confirmed_at, user_metadata: { is_admin: true, role: "admin" }, app_metadata: {} }]) assert.equal(isAdministrator(user), false);
  for (const app_metadata of [{ role: "user" }, { role: "ADMIN" }, { is_admin: "true" }, { is_admin: 1 }]) {
    assert.equal(isAdministrator({ ...verified, app_metadata }), false);
  }
  const source = readFileSync(new URL("../lib/admin-access.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /@/, "no email address may be hard-coded into administrator access");
});
test("server-managed administrators can access the protected provider API", async () => {
  for (const app_metadata of [{ role: "admin" }, { is_admin: true }]) {
    const user = { ...verified, email: "administrator@example.org", app_metadata };
    const api = route(user, async () => ({ settings: readStoredProviderSettings(undefined) }));
    assert.equal((await api.GET()).status, 200);
    assert.equal((await api.PATCH(patch({ primary: "qwen", autoFallback: true }))).status, 200);
  }
});

test("provider updates reject arbitrary models, coercion, and privilege injection", () => {
  for (const primary of ["qwen", "gemini"]) for (const autoFallback of [false, true]) assert.deepEqual(providerSettingsSchema.parse({ primary, autoFallback }), { primary, autoFallback, ...modelDefaults });
  for (const input of [{ primary: "other", autoFallback: true }, { primary: "qwen", autoFallback: "false" }, { primary: "qwen" }, { primary: "qwen", autoFallback: true, email: "other@example.org" }, { primary: "gemini", autoFallback: false, apiKey: "must-not-be-accepted" }]) assert.equal(providerSettingsSchema.safeParse(input).success, false);
});

test("missing preferences preserve the existing Qwen-to-Gemini default", () => {
  assert.deepEqual(readStoredProviderSettings(undefined), { primary: "qwen", autoFallback: true, ...modelDefaults, updatedAt: null });
  assert.deepEqual(readStoredProviderSettings(null), readStoredProviderSettings(undefined));
  const settings = { primary: "gemini", autoFallback: false, updatedAt: verified.email_confirmed_at };
  assert.deepEqual(readStoredProviderSettings(settings), { ...settings, ...modelDefaults });
  assert.throws(() => readStoredProviderSettings({ primary: "other" }), /PROVIDER_CONFIGURATION/);
});

test("fallback works in either direction but never switches back or overrides a disabled policy", () => {
  assert.deepEqual(providerPlan({ primary: "qwen", autoFallback: true }), { primary: "qwen", fallback: "gemini" });
  assert.deepEqual(providerPlan({ primary: "gemini", autoFallback: true }), { primary: "gemini", fallback: "qwen" });
  assert.deepEqual(providerPlan({ primary: "qwen", autoFallback: true }, "gemini"), { primary: "gemini", fallback: undefined });
  assert.deepEqual(providerPlan({ primary: "gemini", autoFallback: true }, "qwen"), { primary: "qwen", fallback: undefined });
  for (const primary of ["qwen", "gemini"]) assert.deepEqual(providerPlan({ primary, autoFallback: false }), { primary, fallback: undefined });
});

test("provider readiness requires all selected credentials but not a disabled fallback", () => {
  const providers = { qwen: { configured: true, model: "qwen" }, gemini: { configured: false, model: "gemini" } };
  assert.doesNotThrow(() => assertProvidersConfigured({ primary: "qwen", autoFallback: false }, providers));
  assert.throws(() => assertProvidersConfigured({ primary: "qwen", autoFallback: true }, providers), /PROVIDER_NOT_CONFIGURED/);
  assert.throws(() => assertProvidersConfigured({ primary: "gemini", autoFallback: false }, providers), /PROVIDER_NOT_CONFIGURED/);
});

test("manual Gemini choice and fallback-off policy control actual provider attempts", async () => {
  for (const primary of ["qwen", "gemini"]) {
    for (const autoFallback of [false, true]) {
      const plan = providerPlan({ primary, autoFallback });
      const attempts = [];
      const execute = async provider => { attempts.push(provider); if (provider === primary) throw new Error("PROVIDER_CREDITS_REQUIRED"); return provider; };
      const result = withResearchFallback(() => execute(plan.primary), plan.fallback ? () => execute(plan.fallback) : undefined, errorCode);
      if (autoFallback) assert.equal(await result, primary === "qwen" ? "gemini" : "qwen");
      else await assert.rejects(result, /PROVIDER_CREDITS_REQUIRED/);
      assert.deepEqual(attempts, autoFallback ? [primary, plan.fallback] : [primary]);
    }
  }
});

test("unauthenticated, unverified, and non-admin sessions cannot read or modify settings", async () => {
  for (const user of [null, { ...verified, email_confirmed_at: null }, { ...verified, app_metadata: {}, user_metadata: { is_admin: true, role: "admin" } }]) {
    const api = route(user);
    for (const response of [await api.GET(), await api.PATCH(patch({ primary: "gemini", autoFallback: false }))]) {
      assert.equal(response.status, user ? 403 : 401);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
  }
});
test("admin updates enforce origin, JSON validation, request limits, and the session actor", async () => {
  const calls = [];
  const api = route(verified, async (id, settings) => { calls.push({ id, settings }); return { settings }; });
  assert.equal((await api.GET()).status, 200);
  assert.equal((await api.PATCH(patch({ primary: "gemini", autoFallback: false }, "https://attacker.test"))).status, 403);
  assert.equal((await api.PATCH(patch("{"))).status, 400);
  assert.equal((await api.PATCH(patch({ primary: "gemini", autoFallback: false, id: "victim" }))).status, 400);
  assert.equal((await api.PATCH(patch("x".repeat(1025)))).status, 413);
  assert.equal((await api.PATCH(patch({ primary: "gemini", autoFallback: false }))).status, 200);
  assert.deepEqual(calls, [{ id: verified.id, settings: { primary: "gemini", autoFallback: false, ...modelDefaults } }]);
});

test("server persistence revalidates identity and writes only the app_settings row", async () => {
  const writes = [];
  const service = storage({ writes, admin: { getUserById: async id => { assert.equal(id, verified.id); return { data: { user: verified }, error: null }; } } });
  // Gemini Flash-Lite cannot finish a run on the $0.25 default (production run 11436d76 stopped at the 8th search).
  await assert.rejects(service.saveProviderSettings(verified.id, { primary: "gemini", autoFallback: false }), /BUDGET_TOO_LOW/);
  assert.equal(writes.length, 0, "an unfinishable policy is never written");
  const saved = await service.saveProviderSettings(verified.id, { primary: "gemini", autoFallback: false, budgetUsd: 0.5 });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].row.key, "research");
  assert.equal(writes[0].row.updated_by, verified.id);
  assert.deepEqual(writes[0].options, { onConflict: "key" });
  assert.deepEqual(readStoredProviderSettings(writes[0].row.value), saved.settings);
  assert.equal(saved.settings.primary, "gemini");
  assert.equal(saved.settings.budgetUsd, 0.5);
  const denied = storage({ admin: { getUserById: async () => ({ data: { user: { ...verified, app_metadata: {} } }, error: null }) } });
  await assert.rejects(denied.saveProviderSettings(verified.id, { primary: "qwen", autoFallback: true }), /ADMIN_REQUIRED/);
  const offline = storage({ admin: { getUserById: async () => ({ data: null, error: new Error("offline") }) } });
  await assert.rejects(offline.saveProviderSettings(verified.id, { primary: "qwen", autoFallback: true }), /SETTINGS_UNAVAILABLE/);
});
test("role administrators read and update the single app_settings policy", async () => {
  const admin = { ...verified, id: "role-admin", email: "administrator@example.org", app_metadata: { role: "admin" } };
  const stored = { primary: "gemini", autoFallback: false, budgetUsd: 0.5, updatedAt: verified.email_confirmed_at };
  const rows = { research: stored };
  const writes = [];
  const service = storage({ rows, writes, admin: { getUserById: async () => ({ data: { user: admin }, error: null }) } });
  assert.deepEqual((await service.administratorSettings(admin)).settings, { ...stored, qwenModel: models.DEFAULT_QWEN_MODEL, geminiModel: models.DEFAULT_GEMINI_MODEL });
  assert.deepEqual(await service.researchProviderSettings(), { ...stored, qwenModel: models.DEFAULT_QWEN_MODEL, geminiModel: models.DEFAULT_GEMINI_MODEL });
  await service.saveProviderSettings(admin.id, { primary: "qwen", autoFallback: true, budgetUsd: 1 });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].row.key, "research");
  assert.equal(rows.research.primary, "qwen");
  assert.equal(rows.research.budgetUsd, 1);
  await assert.rejects(service.administratorSettings({ ...admin, email_confirmed_at: null }), /ADMIN_REQUIRED/);
  await assert.rejects(service.administratorSettings({ ...admin, app_metadata: {} }), /ADMIN_REQUIRED/);
});
test("new runs read the app_settings policy, fall back to defaults, and surface storage failures", async () => {
  const saved = { primary: "gemini", autoFallback: false, updatedAt: verified.email_confirmed_at };
  assert.deepEqual(await storage({ rows: { research: saved } }).researchProviderSettings(), { ...saved, ...modelDefaults });
  assert.deepEqual(await storage().researchProviderSettings(), readStoredProviderSettings(undefined));
  await assert.rejects(storage({ fail: true }).researchProviderSettings(), /WORKFLOW_INTERRUPTED/);
  await assert.rejects(storage({ rows: { research: { primary: "other" } } }).researchProviderSettings(), /PROVIDER_CONFIGURATION/);
});
test("verified model choices persist and unknown or cross-provider IDs are rejected", async () => {
  for (const qwenModel of models.qwenModelIds) for (const geminiModel of models.geminiModelIds) {
    const input = { primary: "gemini", autoFallback: true, qwenModel, geminiModel, budgetUsd: 5 };
    assert.deepEqual(providerSettingsSchema.parse(input), input);
    const stored = { ...input, updatedAt: verified.email_confirmed_at };
    assert.deepEqual(readStoredProviderSettings(stored), stored);
    const writes = [];
    const service = storage({ writes, admin: { getUserById: async () => ({ data: { user: verified }, error: null }) } });
    const result = await service.saveProviderSettings(verified.id, input);
    assert.deepEqual(result.settings, writes[0].row.value);
    assert.equal(result.settings.qwenModel, qwenModel);
    assert.equal(result.settings.geminiModel, geminiModel);
  }
  for (const invalidChoice of [{ qwenModel: "qwen3.8-unverified" }, { qwenModel: "gemini-4-argon" }, { geminiModel: "qwen3.8-max" }, { geminiModel: "gemini-latest" }, { geminiModel: "https://attacker.test" }, { qwenModel: null }, { budgetUsd: 0 }, { budgetUsd: 50 }, { budgetUsd: "0.25" }]) {
    const input = { primary: "qwen", autoFallback: true, ...invalidChoice };
    assert.equal(providerSettingsSchema.safeParse(input).success, false);
    assert.equal((await route(verified).PATCH(patch(input))).status, 400);
  }
});
test("selected models use compatible reasoning levels and preserve legacy defaults", () => {
  assert.equal(models.selectedModel("qwen", {}), "qwen3.8-flash");
  assert.equal(models.selectedModel("gemini", {}), "gemini-3.5-flash-lite");
  for (const geminiModel of models.geminiModelIds) {
    const expected = geminiModel === "gemini-4-argon" ? "high" : geminiModel === "gemini-3.8-flash" ? "low" : "minimal";
    assert.equal(models.geminiThinkingOptions(geminiModel).google.thinkingConfig.thinkingLevel, expected);
    // Thinking shares maxOutputTokens with the answer, so search never uses a heavy level that could crowd out the query.
    assert.notEqual(models.geminiThinkingOptions(geminiModel, "search").google.thinkingConfig.thinkingLevel, "high");
    assert.equal(models.selectedModel("gemini", { geminiModel }), geminiModel);
  }
  assert.equal(models.geminiThinkingOptions("gemini-4-argon", "search").google.thinkingConfig.thinkingLevel, "low");
  // DashScope supports json_schema output only in non-thinking mode.
  for (const qwenModel of models.qwenModelIds) assert.deepEqual(models.qwenThinkingFields(qwenModel, "structured"), { enable_thinking: false });
  assert.deepEqual(models.qwenThinkingFields("qwen3.8-max", "search"), { enable_thinking: true, thinking_budget: 1024 });
  assert.deepEqual(models.qwenThinkingFields("qwen3.8-flash", "search"), { enable_thinking: false });
});

test("model pricing applies published future price changes rather than an expired promotion", () => {
  const argon = at => models.researchModelPricing("gemini-4-argon", new Date(at));
  assert.equal(argon("2026-11-30T23:59:59Z").input, 2 / 1e6);
  assert.equal(argon("2026-12-01T00:00:00Z").input, 4 / 1e6);
  assert.equal(argon("2026-12-01T00:00:00Z").output, 20 / 1e6);
  const flash = at => models.researchModelPricing("gemini-3.8-flash", new Date(at));
  assert.equal(flash("2026-12-31T23:59:59Z").output, 3.75 / 1e6);
  assert.equal(flash("2027-01-01T00:00:00Z").output, 7.50 / 1e6);
  assert.equal(models.researchModelPricing("qwen3.8-max").input, 1.65 / 1e6);
  assert.equal(argon("2026-11-05").search, 0.014);
  assert.equal(models.researchModelPricing("qwen3.8-max").search, 0.573411 / 1000);
});

test("the protected page and browser bundle never trust client roles or expose provider credentials", () => {
  const page = readFileSync(new URL("../app/(admin)/admin/page.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(!isAdministrator\(user\)\) notFound\(\)/);
  const client = readFileSync(new URL("../components/admin-providers.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|DASHSCOPE_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|localStorage/);
});

test("research dispatches saved models, reasoning controls, usage IDs, and fallback choices", async () => {
  const context = { runId: "run", userId: "user", workflowId: "workflow" };
  for (const primary of ["qwen", "gemini"]) for (const failPrimary of [false, true]) {
    const setup = {
      provider_settings: { primary, autoFallback: true, qwenModel: "qwen3.8-max", geminiModel: "gemini-4-argon" },
      active_provider: primary === "qwen" ? "dashscope-beijing" : "google-gemini",
      fallback_pricing: models.researchModelPricing("gemini-4-argon"),
    };
    const calls = [], reservations = [], checkpoints = [];
    const builder = table => {
      const query = {
        select: () => query, eq: () => query,
        single: async () => ({ data: { output: setup }, error: null }),
        update: () => query,
        upsert: async value => { checkpoints.push(value); return { error: null }; },
        then: resolve => resolve({ data: null, error: null }),
      };
      return query;
    };
    const engine = loadModule("../lib/research-engine.ts", {
      "server-only": {},
      "ai": { NoObjectGeneratedError: noObject, Output: { object: ({ schema }) => schema }, generateText: async options => {
        calls.push(options);
        if (failPrimary && calls.length === 1) throw Object.assign(new Error("TRANSIENT_PROVIDER"), { statusCode: 429 });
        return { output: { ok: true }, totalUsage: { inputTokens: 100, outputTokens: 25 } };
      } },
      "@/lib/qwen-provider": { qwenModel: model => ({ modelId: model }) },
      "@/lib/gemini-provider": { geminiModel: model => ({ modelId: model }) },
      "@/lib/qwen-core": { QWEN_PROVIDER: "dashscope-beijing" },
      "@/lib/research-fallback-core": { GEMINI_PROVIDER: "google-gemini", GEMINI_SEARCH_QUERY_ALLOWANCE: 4, geminiPricing: models.researchModelPricing("gemini-3.5-flash-lite"), withResearchFallback, requestWasRejected: () => true },
      "@/lib/research-source": {},
      "@/lib/supabase/admin": { createAdminClient: () => ({ from: builder, rpc: async (_name, input) => { reservations.push(input); return { data: `usage-${reservations.length}`, error: null }; } }) },
      "@/lib/provider-settings": {},
      "@/lib/provider-settings-core": settingsCore,
      "@/lib/research-models": models,
      "@/lib/research-budget": budget,
      "@/lib/workspace-schema": {},
      "@/lib/research-core": { errorCode, researchErrors: {}, researchPolicy: researchCore.researchPolicy, reportLanguage: researchCore.reportLanguage },
    }, {}, "\nexport { structured };\n");
    assert.deepEqual(await engine.structured(context, "discovery", z.object({ ok: z.boolean() }), value => value, "Research prompt", models.researchModelPricing("qwen3.8-max")), { ok: true });
    const expected = primary === "qwen" ? ["qwen3.8-max", "gemini-4-argon"] : ["gemini-4-argon", "qwen3.8-max"];
    assert.deepEqual(calls.map(call => call.model.modelId), expected.slice(0, failPrimary ? 2 : 1));
    assert.deepEqual(reservations.map(item => item.p_model), calls.map(call => call.model.modelId));
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      if (call.model.modelId === "gemini-4-argon") assert.equal(call.providerOptions.google.thinkingConfig.thinkingLevel, "high");
      assert.equal(call.maxOutputTokens, models.researchModels[call.model.modelId].outputTokens);
      assert.equal(reservations[i].p_pricing.output, models.researchModelPricing(call.model.modelId).output);
    }
    assert.equal(checkpoints.length, failPrimary ? 1 : 0);
    if (failPrimary) assert.deepEqual(checkpoints[0].output.provider_settings, setup.provider_settings);
  }
});

test("research checkpoints retain the saved policy, legacy compatibility, and both pricing schedules", () => {
  const source = readFileSync(new URL("../lib/research-engine.ts", import.meta.url), "utf8");
  assert.match(source, /provider_settings: providerSettings/);
  assert.match(source, /setup\.provider_settings \?\? defaultProviderSettings/);
  assert.match(source, /\[QWEN_PROVIDER, GEMINI_PROVIDER\]\.includes/);
  assert.match(source, /checkpoint\(ctx, "setup", \{ \.\.\.setup, \.\.\.next \}\)/);
  assert.doesNotMatch(source, /active_provider: provider, fallback_pricing: pricing/);
});

function researchFixture({ settings = { primary: "gemini", autoFallback: true, qwenModel: "qwen3.8-max", geminiModel: "gemini-4-argon" }, spent = 0.051042, generate = async () => ({ output: { ok: true }, totalUsage: { inputTokens: 100, outputTokens: 25 } }), evidence = [], checkpoints = new Map(), search = {}, fetchSource, verify = {}, providerSettings, budgetUsd = 0.25 } = {}) {
  const context = { runId: "run", userId: "user", workflowId: "workflow" };
  const setup = { provider_settings: settings, active_provider: settings.primary === "gemini" ? "google-gemini" : "dashscope-beijing", pricing: models.researchModelPricing(settings.qwenModel), fallback_pricing: models.researchModelPricing(settings.geminiModel), brief: { ...workspaceSchema.emptyBrief, name: "Regression research" }, profile: workspaceSchema.emptyProfile };
  checkpoints.set("setup", setup);
  const reservations = [], calls = [], records = [];
  function from(table) {
    const filters = {};
    let patch;
    const query = {
      select: () => query, eq: (key, value) => { filters[key] = value; return query; },
      single: async () => ({ data: table === "research_runs" ? { status: "running", workflow_id: "workflow", configuration: { brief: setup.brief, profile: setup.profile }, budget_usd: budgetUsd } : { output: checkpoints.get(filters.stage_key) }, error: null }),
      maybeSingle: async () => ({ data: checkpoints.has(filters.stage_key) ? { output: checkpoints.get(filters.stage_key) } : null, error: null }),
      upsert: async value => { checkpoints.set(value.stage_key, value.output); return { error: null }; },
      update: value => { patch = value; return query; },
      then: resolve => {
        if (table === "research_usage" && patch) for (const record of records) if (record.id === filters.id && (!filters.status || filters.status === record.status)) Object.assign(record, patch);
        return resolve({ data: table === "research_evidence" && !patch ? evidence : null, error: null });
      },
    };
    return query;
  }
  const engine = loadModule("../lib/research-engine.ts", {
    "server-only": {}, "ai": { NoObjectGeneratedError: noObject, Output: { object: ({ schema }) => schema }, generateText: async options => { calls.push(options); return generate(options); } },
    "@/lib/qwen-provider": { qwenModel: model => ({ modelId: model }), searchQwen: search.qwen, verifyQwenModel: verify.qwen },
    "@/lib/gemini-provider": { geminiModel: model => ({ modelId: model }), searchGemini: search.gemini, verifyGeminiModel: verify.gemini },
    "@/lib/qwen-core": { QWEN_PROVIDER: "dashscope-beijing" }, "@/lib/research-fallback-core": fallbackCore,
    "@/lib/research-source": { fetchResearchSource: fetchSource }, "@/lib/provider-settings": { researchProviderSettings: async () => providerSettings }, "@/lib/provider-settings-core": settingsCore,
    "@/lib/research-models": models, "@/lib/research-budget": budget, "@/lib/workspace-schema": workspaceSchema, "@/lib/research-core": researchCore,
    "@/lib/supabase/admin": { createAdminClient: () => ({ from, rpc: async (_name, input) => {
      reservations.push(input);
      const committed = spent + records.reduce((sum, record) => sum + (record.status === "completed" ? record.estimated_usd : record.reserved_usd), 0);
      if (committed + input.p_reserved > 0.25) return { data: null, error: { message: "BUDGET_EXCEEDED" } };
      const id = `usage-${records.length}`;
      records.push({ id, status: "reserved", reserved_usd: input.p_reserved });
      return { data: id, error: null };
    } }) },
  }, {}, "\nexport { structured, providerCall };\n");
  return { engine, context, setup, reservations, records, calls, checkpoints };
}

test("an unaffordable Argon reservation falls back without sending the unaffordable request", async () => {
  // Once most of the budget is spent, Argon's search reservation no longer fits but Qwen Flash's does.
  const fixture = researchFixture({ spent: 0.2, settings: { primary: "gemini", autoFallback: true, qwenModel: "qwen3.8-flash", geminiModel: "gemini-4-argon" } });
  const executed = [];
  const result = await fixture.engine.providerCall(fixture.context, "retrieval:c1", "Find external sources", fixture.setup.pricing, true, 0, async (provider, model) => {
    executed.push({ provider, model });
    return { value: "evidence", tokens: { inputTokens: 100, outputTokens: 25 }, searchRequests: 1 };
  });
  assert.equal(result, "evidence");
  assert.deepEqual(executed, [{ provider: "dashscope-beijing", model: "qwen3.8-flash" }]);
  const argon = budget.reservationFor("gemini-4-argon", models.researchModelPricing("gemini-4-argon"), { promptBytes: Buffer.byteLength("Find external sources"), search: true });
  assert.ok(Math.abs(fixture.reservations[0].p_reserved - argon.usd) < 1e-9);
  assert.equal(fixture.records.length, 1);
  assert.equal(fixture.checkpoints.get("budget_block").model, "gemini-4-argon");
  // An unaffordable search moves later searches only; structured stages stay on the primary.
  assert.equal(fixture.checkpoints.get("setup").search_provider, "dashscope-beijing");
  assert.equal(fixture.checkpoints.get("setup").active_provider, "google-gemini");
  assert.equal(fixture.checkpoints.get("setup").provider_settings.primary, "gemini");
});

test("disabled fallback and two unaffordable providers never send a paid request", async () => {
  for (const fixture of [researchFixture({ spent: 0.2, settings: { primary: "gemini", autoFallback: false, qwenModel: "qwen3.8-max", geminiModel: "gemini-4-argon" } }), researchFixture({ spent: 0.24 })]) {
    let calls = 0;
    await assert.rejects(fixture.engine.providerCall(fixture.context, "retrieval:c1", "Find sources", fixture.setup.pricing, true, 0, async () => { calls++; }), /BUDGET_EXCEEDED/);
    assert.equal(calls, 0);
    assert.equal(fixture.records.length, 0);
  }
});

test("billed invalid structured output settles known usage without charging its whole reservation", async () => {
  const fixture = researchFixture({ spent: 0, generate: async () => { throw Object.assign(new Error("INVALID_OUTPUT"), { usage: { inputTokens: 100, outputTokens: 50 } }); } });
  await assert.rejects(fixture.engine.structured(fixture.context, "discovery", z.object({ ok: z.boolean() }), value => value, "Prompt", fixture.setup.pricing), /INVALID_OUTPUT/);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.records[0].status, "completed");
  assert.equal(fixture.records[0].estimated_usd, 100 * 0.000002 + 50 * 0.00001);
});

test("prompt-size protection is not misreported as a budget failure or sent to fallback", async () => {
  const fixture = researchFixture({ spent: 0 });
  await assert.rejects(fixture.engine.structured(fixture.context, "evaluation", z.object({ ok: z.boolean() }), value => value, "研".repeat(26000), fixture.setup.pricing), /RESEARCH_INPUT_TOO_LARGE/);
  assert.equal(fixture.reservations.length, 0);
  assert.equal(fixture.calls.length, 0);
});

test("full CJK evidence is classified, evaluated, and reviewed in resumable bounded batches", async () => {
  const checkpoints = new Map();
  const candidates = Array.from({ length: 8 }, (_, i) => ({ key: `c${i + 1}`, title: "候选机会", buyer: "买方", pain: "需求", solution: "方案", advantage: "资源", query: "independent buyer research" }));
  checkpoints.set("discovery", { candidates });
  const evidence = candidates.flatMap(candidate => Array.from({ length: 4 }, (_, i) => ({ source_key: `${candidate.key}-s${i + 1}`, candidate_id: candidate.key, url: `https://publisher${i}.org/${candidate.key}`, title: "独立研究", excerpt: "研究需求".repeat(450), retrieved_at: new Date().toISOString(), published_at: null })));
  const fixture = researchFixture({ spent: 0, settings: { primary: "qwen", autoFallback: false, qwenModel: "qwen3.8-flash", geminiModel: "gemini-3.5-flash-lite" }, evidence, checkpoints, generate: async ({ prompt }) => {
    assert.ok(Buffer.byteLength(prompt) < 75000);
    let items;
    if (prompt.includes("Classify each piece of external evidence")) {
      const sources = JSON.parse(prompt.split("; sources=")[1]);
      assert.equal(sources.length, 8);
      items = sources.map(source => ({ source_key: source.source_key, relevant: true, kind: "pain", reliability: "primary", stance: "supports", quote: source.excerpt.slice(0, 100), claim: "真实需求" }));
    } else if (prompt.includes("Evaluate only these")) {
      const batch = JSON.parse(prompt.split("; candidates=")[1].split("; evidence with classifications=")[0]);
      assert.equal(batch.length, 2);
      items = batch.map(candidate => ({ candidate_id: candidate.key, description: "业务描述", category: "专业服务", revenue: "假设，未验证", cost: "假设，未验证", risk: "需求尚未验证", assumptions: ["尚未验证"], validation: ["访谈买方", "付费试点"], dimensions: { pain: 50, demand: 50, economics: 50, feasibility: 50, advantage: 50 }, rationale: "基于独立来源" }));
    } else {
      assert.ok(prompt.includes("Independent adversarial review"));
      const batch = JSON.parse(prompt.split("Evaluations=")[1].split("; evidence classifications=")[0]).items;
      assert.equal(batch.length, 2);
      items = batch.map(item => ({ candidate_id: item.candidate_id, reject: false, critique: "需更多买方证据", penalty: 10, falsification: "付费试点验证" }));
    }
    return { output: { items }, totalUsage: { inputTokens: 100, outputTokens: 50 } };
  } });
  for (const stage of ["classification", "evaluation", "review"]) {
    await fixture.engine.executeResearchStage(fixture.context, stage);
    const expected = stage === "classification" ? 32 : 8;
    assert.equal(checkpoints.get(stage).items.length, expected);
  }
  assert.equal(fixture.calls.length, 12);
  for (const stage of ["classification", "evaluation", "review"]) {
    checkpoints.delete(stage);
    await fixture.engine.executeResearchStage(fixture.context, stage);
  }
  assert.equal(fixture.calls.length, 12, "Recovery reuses billed batch checkpoints");
});

test("finalizing counts only supporting evidence and saves counter-evidence with its stance", async () => {
  const checkpoints = new Map();
  const candidates = Array.from({ length: 5 }, (_, i) => ({ key: `c${i + 1}`, title: `Candidate ${i + 1}`, buyer: "Agencies", pain: "Slow proposals", solution: "Drafting assistant", advantage: "Domain network", query: "agency proposal preparation time survey" }));
  checkpoints.set("discovery", { candidates });
  const page = (key, candidate, url, text) => ({ source_key: key, candidate_id: candidate, url, title: "Source", excerpt: text, retrieved_at: "2026-11-09T00:00:00.000Z", published_at: null });
  const evidence = [
    page("c1-s1", "c1", "https://buyers.org/pain", "Agencies report spending ten hours every week preparing proposals."),
    page("c1-s2", "c1", "https://survey.org/analysis", "An independent survey confirms proposal preparation delays agency sales."),
    page("c1-s3", "c1", "https://critics.net/review", "Critics argue that proposal software rarely changes agency win rates."),
    page("c2-s1", "c2", "https://buyers.org/other", "Agencies report spending ten hours every week on client reporting."),
    page("c2-s2", "c2", "https://critics.net/other", "Critics argue that reporting tools rarely change client retention."),
    page("c2-s3", "c2", "https://skeptics.io/note", "Skeptics note that most agencies already automate client reporting."),
  ];
  const stance = { "c1-s3": "contradicts", "c2-s2": "contradicts", "c2-s3": "contradicts" };
  checkpoints.set("classification", { items: evidence.map(e => ({ source_key: e.source_key, relevant: true, kind: "pain", reliability: "secondary", stance: stance[e.source_key] ?? "supports", quote: e.excerpt, claim: "Buyer pain" })) });
  const dimensions = { pain: 100, demand: 100, economics: 100, feasibility: 100, advantage: 100 };
  checkpoints.set("evaluation", { items: ["c1", "c2"].map(id => ({ candidate_id: id, description: "Drafting assistant", category: "Services", revenue: "Assumed, unverified", cost: "Assumed, unverified", risk: "Unverified demand", assumptions: ["Unverified"], validation: ["Interview buyers"], dimensions, rationale: "Cites c1-s1" })) });
  checkpoints.set("review", { items: ["c1", "c2"].map(id => ({ candidate_id: id, reject: false, critique: "Needs interviews", penalty: 0, falsification: "Run a paid pilot" })) });
  const fixture = researchFixture({ spent: 0, evidence, checkpoints });
  await fixture.engine.executeResearchStage(fixture.context, "finalizing");
  const report = fixture.reservations.find(call => call.p_report)?.p_report;
  assert.ok(report, "finish_research received the report");
  // c2 had one supporting domain and two contradicting ones: it is no longer reported at all.
  assert.deepEqual(report.opportunities.map(o => o.candidate_id), ["c1"]);
  const [c1] = report.opportunities;
  assert.equal(c1.confidence, "limited", "Two supporting domains are limited confidence, whatever else is attached");
  assert.equal(c1.score, 70, "The 85 cap needs three independent supporting domains");
  assert.deepEqual(c1.evidence.map(e => [e.source_key, e.stance]), [["c1-s1", "supports"], ["c1-s2", "supports"], ["c1-s3", "contradicts"]]);
  // The stance survives the workspace read path, so the report can label counter-evidence.
  assert.deepEqual(workspaceSchema.opportunitySchema.parse(c1).evidence.map(e => e.stance), ["supports", "supports", "contradicts"]);
});

test("concurrent dispatches share a durable hook and manual retries get a new identity", async () => {
  const row = { status: "pending", workflow_id: null, retry_count: 0 };
  const hooks = new Map(), requests = [], updates = [];
  const service = loadModule("../lib/research-service.ts", {
    "server-only": {},
    "@/lib/provider-settings": { researchProviderSettings: async () => ({ primary: "qwen", autoFallback: true }) }, "@/lib/provider-settings-core": settingsCore, "@/lib/research-models": models, "@/lib/qwen-core": { QWEN_PROVIDER: "dashscope-beijing" }, "@/lib/research-fallback-core": fallbackCore,
    "workflow/api": { start: async (_workflow, args, options) => {
      assert.deepEqual(args, ["run", "owner"]);
      requests.push(options.hook.token);
      if (hooks.has(options.hook.token)) throw { conflict: true, conflictingRunId: hooks.get(options.hook.token) };
      const runId = `workflow-${hooks.size}`;
      hooks.set(options.hook.token, runId);
      return { runId };
    } },
    "workflow/errors": { HookConflictError: { is: error => error?.conflict === true }, WorkflowWorldError: { is: error => error?.world === true } },
    "@/workflows/research": { researchWorkflow: () => undefined },
    "@/lib/supabase/admin": { createAdminClient: () => ({ from: () => {
      const filters = {}; let patch;
      const query = {
        select: () => query, eq: (key, value) => { filters[key] = value; return query; }, is: (key, value) => { filters[key] = value; return query; },
        single: async () => ({ data: { ...row }, error: null }),
        update: value => { patch = value; updates.push(value); return query; },
        then: resolve => {
          assert.equal(filters.user_id, "owner");
          if (patch && Object.entries(filters).every(([key, value]) => ["id", "user_id"].includes(key) || row[key] === value)) Object.assign(row, patch);
          resolve({ error: null });
        },
      };
      return query;
    } }) },
  });
  await Promise.all([service.dispatchResearch("run", "owner"), service.dispatchResearch("run", "owner")]);
  assert.equal(hooks.size, 1);
  assert.deepEqual(requests, ["research:run:0", "research:run:0"]);
  assert.equal(row.workflow_id, "workflow-0");
  assert.equal(row.status, "pending", "A duplicate start must never mark the admitted run failed");
  row.retry_count = 1; row.workflow_id = null;
  await service.dispatchResearch("run", "owner");
  assert.equal(hooks.size, 2);
  assert.equal(row.workflow_id, "workflow-1");
  assert.ok(updates.every(update => !update.error_code));
});

test("research detail explains blocked reservations without adding them to spent totals", async () => {
  const run = { id: "run", status: "failed", stage: "retrieval", error_code: "BUDGET_EXCEEDED", retry_count: 0, budget_usd: 0.25, configuration: { brief: {} }, report: null };
  const scopes = [];
  function from(table) {
    const filters = {};
    const query = {
      select: () => query, eq: (key, value) => { filters[key] = value; return query; },
      maybeSingle: async () => {
        scopes.push(filters);
        return { data: table === "research_runs" ? run : { output: { model: "gemini-4-argon", required_usd: 0.20448 } }, error: null };
      },
      order: () => query,
      then: resolve => {
        scopes.push(filters);
        resolve({ data: table === "research_usage" ? [{ status: "completed", input_tokens: 756, output_tokens: 4953, search_requests: 0, estimated_usd: 0.051042, reserved_usd: 0.127646 }] : [{ stage_key: "discovery", created_at: "2026-11-05" }], error: null });
      },
    };
    return query;
  }
  const service = loadModule("../lib/research-service.ts", { "server-only": {}, "workflow/api": {}, "workflow/errors": {}, "@/workflows/research": {}, "@/lib/provider-settings": { researchProviderSettings: async () => ({ primary: "qwen", autoFallback: true }) }, "@/lib/provider-settings-core": settingsCore, "@/lib/research-models": models, "@/lib/qwen-core": { QWEN_PROVIDER: "dashscope-beijing" }, "@/lib/research-fallback-core": fallbackCore, "@/lib/supabase/admin": {} });
  const detail = await service.researchDetail({ from }, "owner", "run");
  assert.equal(detail.usage.committed_usd, 0.051042);
  assert.equal(detail.usage.search_requests, 0);
  assert.equal(detail.budget_block.required_usd, 0.20448);
  assert.ok(Math.abs(detail.budget_block.remaining_usd - 0.198958) < 1e-9);
  assert.ok(scopes.every(filters => filters.user_id === "owner"));
});

test("the actual progress view renders blocked-request costs and a usable recovery link", () => {
  const data = { id: "run", status: "failed", stage: "retrieval", error_code: "BUDGET_EXCEEDED", retry_count: 0, model: { provider: "google-gemini", model: "gemini-4-argon", planned: false, used: ["gemini-4-argon"] }, configuration: { brief: { name: "Test 1" } }, report: null, steps: [{ stage_key: "discovery" }, { stage_key: "retrieval:c1" }], usage: { estimated_usd: 0.051042, committed_usd: 0.051042, budget_usd: 0.25, uncertain_calls: 0, input_tokens: 756, output_tokens: 4953, search_requests: 0 }, budget_block: { model: "gemini-4-argon", required_usd: 0.20448, remaining_usd: 0.198958 } };
  const { ResearchRunView } = loadModule("../components/research-run.tsx", {
    "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
    "swr": { default: () => ({ data, mutate: async () => undefined }) },
    "@/components/ui/button": { Button: ({ asChild, children, ...props }) => asChild ? cloneElement(children, props) : createElement("button", props, children) },
    "@/components/shared": { PageHeader: ({ title, description }) => createElement("header", null, createElement("h1", null, title), createElement("p", null, description)) },
    "@/components/demo-provider": { useDemo: () => ({ refresh: async () => undefined }) },
    "@/components/research-report": { ResearchReportView: () => null },
    // The real model badge, so the rendered model and provider names are checked.
    "@/components/model-tag": loadModule("../components/model-tag.tsx", { "@/components/ui/badge": { Badge: ({ children, ...props }) => createElement("span", props, children) }, "@/lib/research-models": models, "@/i18n/use-copy": { useCopy: () => (text, values = {}) => text.replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? key) } }),
    "@/lib/research-core": researchCore,
    "@/lib/research-models": models,
    "@/components/ui/badge": { Badge: ({ children, ...props }) => createElement("span", props, children) },
    "@/i18n/use-copy": { useCopy: () => (text, values = {}) => text.replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? key), useFormats: () => ({ usd: (value, digits = 2) => `$${value.toFixed(digits)}`, number: value => String(value) }) },
    "@/i18n/errors": { feedbackSource: (_code, fallback) => fallback },
    "@/lib/api-client": apiClient,
  });
  const html = renderToStaticMarkup(createElement(ResearchRunView, { initialData: data }));
  assert.match(html, /gemini-4-argon/);
  assert.match(html, /\$0\.2045/);
  assert.match(html, /\$0\.1990/);
  assert.match(html, /This request was not sent or charged/);
  assert.match(html, /href="\/research\/new"/);
  assert.doesNotMatch(html, /Retry once from saved progress/);
  assert.match(html, /Existing progress and costs remain saved/);
  assert.match(html, /Model: Gemini 4 Argon/);
  assert.match(html, /Gemini via Google/);
});

test("a failed run says whether its slot was returned, from the server's refund decision", () => {
  const render = quota_released => {
    const data = { id: "run", status: "failed", stage: "classification", error_code: "INVALID_OUTPUT", retry_count: 0, quota_released, model: { provider: "dashscope-beijing", model: "qwen3.8-flash", planned: false, used: ["qwen3.8-flash"] }, configuration: { brief: { name: "Test" } }, report: null, steps: [{ stage_key: "discovery" }], usage: { estimated_usd: 0.04, committed_usd: 0.04, budget_usd: 0.25, uncertain_calls: 0, input_tokens: 1, output_tokens: 1, search_requests: 1 } };
    const { ResearchRunView } = loadModule("../components/research-run.tsx", {
      "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
      "swr": { default: () => ({ data, mutate: async () => undefined }) },
      "@/components/ui/button": { Button: ({ asChild, children, ...props }) => asChild ? cloneElement(children, props) : createElement("button", props, children) },
      "@/components/shared": { PageHeader: ({ title }) => createElement("h1", null, title) },
      "@/components/demo-provider": { useDemo: () => ({ refresh: async () => undefined }) },
      "@/components/research-report": { ResearchReportView: () => null },
      // The real model badge, so the rendered model and provider names are checked.
      "@/components/model-tag": loadModule("../components/model-tag.tsx", { "@/components/ui/badge": { Badge: ({ children, ...props }) => createElement("span", props, children) }, "@/lib/research-models": models, "@/i18n/use-copy": { useCopy: () => (text, values = {}) => text.replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? key) } }),
      "@/lib/research-core": researchCore, "@/lib/research-models": models,
      "@/components/ui/badge": { Badge: ({ children }) => createElement("span", null, children) },
      "@/i18n/use-copy": { useCopy: () => (text, values = {}) => text.replace(/\{(\w+)\}/g, (_m, key) => values[key] ?? key), useFormats: () => ({ usd: value => `$${value}`, number: String, date: String }) },
      "@/i18n/errors": { feedbackSource: (_code, fallback) => fallback }, "@/lib/api-client": apiClient,
    });
    return renderToStaticMarkup(createElement(ResearchRunView, { initialData: data }));
  };
  assert.match(render(true), /your allowance was restored/);
  assert.match(render(undefined), /your allowance was restored/, "runs saved before the field existed keep the old message");
  const kept = render(false);
  assert.match(kept, /reached its limit of returned failed runs/);
  assert.doesNotMatch(kept, /your allowance was restored/, "a run that kept its slot never claims it was returned");
});

test("structured output that does not parse is retried once, and each attempt is metered separately", async () => {
  let attempt = 0;
  const fixture = researchFixture({ spent: 0, settings: { primary: "qwen", autoFallback: false, qwenModel: "qwen3.8-flash", geminiModel: "gemini-3.5-flash-lite" }, generate: async () => {
    attempt++;
    if (attempt === 1) throw unparsable({ inputTokens: 1_000, outputTokens: 7_000 });
    return { output: { ok: true }, totalUsage: { inputTokens: 1_000, outputTokens: 300 } };
  } });
  assert.deepEqual(await fixture.engine.structured(fixture.context, "discovery", z.object({ ok: z.boolean() }), value => value, "Prompt", fixture.setup.pricing), { ok: true });
  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.reservations.length, 2);
  assert.deepEqual(fixture.records.map(record => record.status), ["completed", "completed"], "the truncated attempt is settled at its real usage, not left reserved");
  const twice = researchFixture({ spent: 0, settings: { primary: "qwen", autoFallback: false, qwenModel: "qwen3.8-flash", geminiModel: "gemini-3.5-flash-lite" }, generate: async () => { throw unparsable({ inputTokens: 10, outputTokens: 10 }); } });
  await assert.rejects(twice.engine.structured(twice.context, "discovery", z.object({ ok: z.boolean() }), value => value, "Prompt", twice.setup.pricing), /No object generated/);
  assert.equal(twice.calls.length, 2, "never more than one retry");
});

test("a hypothesis whose search finds nothing is skipped without ending the run or moving it to the fallback", async () => {
  const checkpoints = new Map();
  checkpoints.set("discovery", { candidates: Array.from({ length: 5 }, (_, i) => ({ key: `c${i + 1}`, title: "Candidate", buyer: "Clinic managers", pain: "Intake", solution: "Automation", advantage: "Network", query: "clinic intake automation buyers" })) });
  const searched = [];
  const nothing = () => Object.assign(new Error("RETRIEVAL_UNAVAILABLE"), { usage: { inputTokens: 90, outputTokens: 512 }, searchRequests: 1 });
  const fixture = researchFixture({ spent: 0, checkpoints, settings: { primary: "qwen", autoFallback: true, qwenModel: "qwen3.8-flash", geminiModel: "gemini-3.5-flash-lite" }, search: {
    qwen: async () => { searched.push("qwen"); throw nothing(); },
    gemini: async () => { searched.push("gemini"); throw nothing(); },
  } });
  await fixture.engine.executeResearchStage(fixture.context, "retrieval:c1");
  assert.deepEqual(searched, ["qwen", "gemini"], "the fallback engine gets one chance to find sources");
  assert.deepEqual(checkpoints.get("retrieval:c1"), { evidence: [], skipped: "RETRIEVAL_UNAVAILABLE" });
  assert.equal(checkpoints.get("setup").active_provider, "dashscope-beijing", "an empty search is not a provider outage");
  assert.deepEqual(fixture.records.map(record => record.status), ["completed", "completed"], "both billed searches are settled at real usage");
  // Unreadable pages are treated the same way, while budget and configuration errors still stop the run.
  const unreadable = researchFixture({ spent: 0, checkpoints: new Map([["discovery", checkpoints.get("discovery")]]), settings: { primary: "qwen", autoFallback: false, qwenModel: "qwen3.8-flash", geminiModel: "gemini-3.5-flash-lite" },
    search: { qwen: async () => ({ sources: [{ url: "https://blocked.example.org/a" }], tokens: { inputTokens: 10, outputTokens: 10 }, searchRequests: 1 }) },
    fetchSource: async () => { throw new Error("UNREADABLE_SOURCE"); } });
  await unreadable.engine.executeResearchStage(unreadable.context, "retrieval:c2");
  assert.equal(unreadable.checkpoints.get("retrieval:c2").skipped, "RETRIEVAL_UNAVAILABLE");
  const broken = researchFixture({ spent: 0, checkpoints: new Map([["discovery", checkpoints.get("discovery")]]), settings: { primary: "qwen", autoFallback: false, qwenModel: "qwen3.8-flash", geminiModel: "gemini-3.5-flash-lite" },
    search: { qwen: async () => { throw Object.assign(new Error("PROVIDER_CONFIGURATION"), { statusCode: 401 }); } } });
  await assert.rejects(broken.engine.executeResearchStage(broken.context, "retrieval:c3"), /PROVIDER_CONFIGURATION/);
});

test("a model that skips a candidate or returns fractional scores no longer fails evaluation", async () => {
  const checkpoints = new Map();
  const candidates = Array.from({ length: 5 }, (_, i) => ({ key: `c${i + 1}`, title: "Candidate", buyer: "Clinic managers", pain: "Intake", solution: "Automation", advantage: "Network", query: "clinic intake automation buyers" }));
  checkpoints.set("discovery", { candidates });
  const evidence = candidates.slice(0, 2).flatMap(candidate => [0, 1].map(i => ({ source_key: `${candidate.key}-s${i + 1}`, candidate_id: candidate.key, url: `https://publisher${i}.org/${candidate.key}`, title: "Survey", excerpt: "Practice managers report intake paperwork takes nine hours every week.", retrieved_at: "", published_at: null })));
  checkpoints.set("classification", { items: evidence.map(source => ({ source_key: source.source_key, relevant: true, kind: "pain", reliability: "primary", stance: "supports", quote: "intake paperwork takes nine hours", claim: "Real pain" })) });
  const fixture = researchFixture({ spent: 0, checkpoints, evidence, settings: { primary: "qwen", autoFallback: false, qwenModel: "qwen3.8-flash", geminiModel: "gemini-3.5-flash-lite" }, generate: async () => ({
    output: { items: [{ candidate_id: "c2", description: "d", category: "Services", revenue: "Unverified", cost: "Unverified", risk: "r", assumptions: ["a"], validation: ["v1", "v2"], dimensions: { pain: 61.5, demand: 55, economics: 40, feasibility: 70, advantage: 20 }, rationale: "r ".repeat(1200) }] },
    totalUsage: { inputTokens: 100, outputTokens: 50 },
  }) });
  await fixture.engine.executeResearchStage(fixture.context, "evaluation");
  const items = checkpoints.get("evaluation").items;
  assert.deepEqual(items.map(item => item.candidate_id), ["c2"]);
  assert.equal(items[0].dimensions.pain, 62);
  assert.ok(items[0].rationale.length <= 2000);
});

test("a run whose models cannot finish within its budget stops before any provider request", async () => {
  const verified = [];
  const fixture = researchFixture({ spent: 0, providerSettings: { primary: "gemini", autoFallback: true, qwenModel: "qwen3.8-max", geminiModel: "gemini-4-argon", budgetUsd: 0.25, updatedAt: null },
    verify: { qwen: async () => { verified.push("qwen"); }, gemini: async () => { verified.push("gemini"); } } });
  fixture.setup.profile = { ...workspaceSchema.emptyProfile, name: "Founder", skills: "Operations" };
  fixture.checkpoints.delete("setup");
  await assert.rejects(fixture.engine.initializeResearch(fixture.context), /BUDGET_EXCEEDED/);
  assert.deepEqual(verified, []);
  assert.equal(fixture.reservations.length, 0);
  assert.equal(fixture.checkpoints.get("budget_block").kind, "estimate");
  assert.equal(fixture.checkpoints.get("budget_block").model, "gemini-4-argon");
  // When only the fallback can finish, the run starts on the fallback and keeps no mid-run fallback.
  const viaFallback = researchFixture({ spent: 0, providerSettings: { primary: "gemini", autoFallback: true, qwenModel: "qwen3.8-flash", geminiModel: "gemini-4-argon", budgetUsd: 0.25, updatedAt: null },
    verify: { qwen: async () => { verified.push("qwen"); }, gemini: async () => { verified.push("gemini"); } } });
  viaFallback.setup.profile = fixture.setup.profile;
  viaFallback.checkpoints.delete("setup");
  assert.equal(await viaFallback.engine.initializeResearch(viaFallback.context), true);
  assert.deepEqual(verified, ["qwen"]);
  assert.equal(viaFallback.checkpoints.get("setup").active_provider, "dashscope-beijing");
  assert.equal(viaFallback.checkpoints.get("setup").fallback_allowed, false);
});

test("dispatch falls back to a plain start when the deployment does not support start hooks", async () => {
  const row = { status: "pending", workflow_id: null, retry_count: 0 };
  const starts = [];
  const service = loadModule("../lib/research-service.ts", {
    "server-only": {},
    "@/lib/provider-settings": {}, "@/lib/provider-settings-core": settingsCore, "@/lib/research-models": models, "@/lib/qwen-core": { QWEN_PROVIDER: "dashscope-beijing" }, "@/lib/research-fallback-core": fallbackCore,
    "workflow/api": { start: async (_workflow, _args, options) => {
      starts.push(options?.hook ? "hook" : "plain");
      // Mirrors @workflow/core: without WORKFLOW_VERCEL_EXPERIMENTAL_START_HOOK the World refuses and creates no run.
      if (options?.hook) throw { world: true, code: "WORLD_CONTRACT_ERROR", message: "start({ hook }) requires a World that supports atomic start Hooks" };
      return { runId: "workflow-plain" };
    } },
    "workflow/errors": { HookConflictError: { is: () => false }, WorkflowWorldError: { is: error => error?.world === true } },
    "@/workflows/research": { researchWorkflow: () => undefined },
    "@/lib/supabase/admin": { createAdminClient: () => ({ from: () => {
      const filters = {}; let patch;
      const query = {
        select: () => query, eq: (key, value) => { filters[key] = value; return query; }, is: (key, value) => { filters[key] = value; return query; },
        single: async () => ({ data: { ...row }, error: null }),
        update: value => { patch = value; return query; },
        then: resolve => { if (patch && Object.entries(filters).every(([key, value]) => ["id", "user_id"].includes(key) || row[key] === value)) Object.assign(row, patch); resolve({ error: null }); },
      };
      return query;
    } }) },
  });
  const warn = console.warn; console.warn = () => {};
  try { await service.dispatchResearch("run", "owner"); } finally { console.warn = warn; }
  assert.deepEqual(starts, ["hook", "plain"]);
  assert.equal(row.workflow_id, "workflow-plain");
  assert.equal(row.status, "pending", "an unsupported start hook must not mark the run DISPATCH_FAILED");
  assert.equal(service.startHookUnsupported({ world: true, code: "START_HOOK_ADMISSION_DISABLED" }), true);
  assert.equal(service.startHookUnsupported({ world: true, code: "TIMEOUT" }), false);
});

test("saving a primary model the budget cannot pay for is refused with the required amount", async () => {
  const api = route(verified, async () => { throw Object.assign(new Error("BUDGET_TOO_LOW"), { requiredUsd: 1.4659 }); });
  const response = await api.PATCH(patch({ primary: "gemini", autoFallback: true, geminiModel: "gemini-4-argon" }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { code: "BUDGET_TOO_LOW", requiredUsd: 1.4659 });
});

test("a slow primary search moves later searches to the fallback while structured stages stay on the primary", async () => {
  const checkpoints = new Map();
  checkpoints.set("discovery", { candidates: Array.from({ length: 5 }, (_, i) => ({ key: `c${i + 1}`, title: "Candidate", buyer: "Accounting firm partners", pain: "Compliance checklists", solution: "Automation", advantage: "Network", query: "accounting firm compliance checklist burden survey" })) });
  const searched = [];
  const timeout = () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  const page = { url: "https://association.example.org/survey", title: "Survey", excerpt: "Partners at small accounting firms report that compliance checklists take hours every week and they pay for outside help." };
  const fixture = researchFixture({ spent: 0, checkpoints, settings: { primary: "qwen", autoFallback: true, qwenModel: "qwen3.8-flash", geminiModel: "gemini-3.5-flash-lite" }, search: {
    qwen: async () => { searched.push("qwen"); throw timeout(); },
    gemini: async () => { searched.push("gemini"); return { sources: [{ url: page.url }], tokens: { inputTokens: 100, outputTokens: 500 }, searchRequests: 1 }; },
  }, fetchSource: async () => page });
  await fixture.engine.executeResearchStage(fixture.context, "retrieval:c1");
  assert.deepEqual(searched, ["qwen", "gemini"]);
  assert.equal(checkpoints.get("setup").search_provider, "google-gemini");
  assert.equal(checkpoints.get("setup").active_provider, "dashscope-beijing", "structured stages stay on the cheaper primary");
  await fixture.engine.executeResearchStage(fixture.context, "retrieval:c2");
  assert.deepEqual(searched, ["qwen", "gemini", "gemini"], "later searches skip the slow provider instead of waiting for its timeout again");
  // Structured calls still go to the primary.
  assert.deepEqual(await fixture.engine.structured(fixture.context, "evaluation", z.object({ ok: z.boolean() }), value => value, "Prompt", fixture.setup.pricing), { ok: true });
  assert.equal(fixture.calls.at(-1).model.modelId, "qwen3.8-flash");
});

test("account-level failures move the whole run, empty searches move nothing", async () => {
  const { providerSwitch } = loadModule("../lib/research-engine.ts", {
    "server-only": {}, "ai": {}, "@/lib/qwen-provider": {}, "@/lib/gemini-provider": {}, "@/lib/qwen-core": { QWEN_PROVIDER: "dashscope-beijing" },
    "@/lib/research-fallback-core": fallbackCore, "@/lib/research-source": {}, "@/lib/supabase/admin": {}, "@/lib/provider-settings": {}, "@/lib/provider-settings-core": settingsCore,
    "@/lib/research-models": models, "@/lib/research-budget": budget, "@/lib/workspace-schema": workspaceSchema, "@/lib/research-core": researchCore,
  });
  const g = "google-gemini";
  assert.equal(providerSwitch(true, "RETRIEVAL_UNAVAILABLE", g), null);
  assert.deepEqual(providerSwitch(true, "TRANSIENT_PROVIDER", g), { search_provider: g });
  assert.deepEqual(providerSwitch(true, "BUDGET_EXCEEDED", g), { search_provider: g });
  for (const code of ["PROVIDER_CONFIGURATION", "PROVIDER_CREDITS_REQUIRED"]) assert.deepEqual(providerSwitch(true, code, g), { active_provider: g, search_provider: g });
  assert.deepEqual(providerSwitch(false, "TRANSIENT_PROVIDER", g), { active_provider: g, search_provider: g });
});

test("discovery queries look for evidence of the problem, not for products", () => {
  const source = readFileSync(new URL("../lib/research-engine.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /naming the buyer, the problem, paid alternatives/, "asking for paid alternatives steered search to vendor pages");
  assert.match(source, /Do not name products or ask for tools or software\./);
  assert.match(source, /rather than for software that claims to solve it/);
});
