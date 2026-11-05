import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement, cloneElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ADMIN_EMAIL, isAdministrator } from "../lib/admin-access.ts";
import { providerSettingsSchema, readStoredProviderSettings, providerPlan, assertProvidersConfigured } from "../lib/provider-settings-core.ts";
import * as settingsCore from "../lib/provider-settings-core.ts";
import { withResearchFallback } from "../lib/research-fallback-core.ts";
import { z } from "zod";
import * as models from "../lib/research-models.ts";
const modelDefaults = { qwenModel: models.DEFAULT_QWEN_MODEL, geminiModel: models.DEFAULT_GEMINI_MODEL };
import { errorCode } from "../lib/research-core.ts";
import * as researchCore from "../lib/research-core.ts";
import * as workspaceSchema from "../lib/workspace-schema.ts";
import * as fallbackCore from "../lib/research-fallback-core.ts";

const verified = { id: "admin-test-id", email: ADMIN_EMAIL, email_confirmed_at: "2026-11-05T00:00:00.000Z", app_metadata: {} };
const require = createRequire(import.meta.url);
function loadModule(file, dependencies, env = {}, suffix = "") {
  const source = readFileSync(new URL(file, import.meta.url), "utf8") + suffix;
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  const dependency = name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
  new Function("require", "exports", "module", "process", outputText)(dependency, module.exports, module, { env });
  return module.exports;
}
function storage(admin) {
  return loadModule("../lib/provider-settings.ts", {
    "server-only": {},
    "@/lib/supabase/admin": { createAdminClient: () => ({ auth: { admin } }) },
    "@/lib/admin-access": { ADMIN_EMAIL, isAdministrator },
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

test("verified administrator email and server-managed administrator roles are authorized", () => {
  assert.equal(isAdministrator(verified), true);
  assert.equal(isAdministrator({ ...verified, email: ADMIN_EMAIL.toUpperCase() }), true);
  for (const app_metadata of [{ role: "admin" }, { is_admin: true }]) {
    const admin = { ...verified, email: "administrator@example.org", app_metadata };
    assert.equal(isAdministrator(admin), true);
    assert.equal(isAdministrator({ ...admin, email_confirmed_at: null }), false);
  }
  for (const user of [null, undefined, {}, { email: ADMIN_EMAIL }, { ...verified, email_confirmed_at: null }, { ...verified, email: "smart@smartmango.ai" }, { ...verified, email: "ventures+admin@smartmango.ai" }, { ...verified, email: "ventures@smartmango.ai.example.org" }, { ...verified, email: " ventures@smartmango.ai" }, { email: "other@example.org", email_confirmed_at: verified.email_confirmed_at, user_metadata: { is_admin: true, role: "admin", email: ADMIN_EMAIL }, app_metadata: {} }]) assert.equal(isAdministrator(user), false);
  for (const app_metadata of [{ role: "user" }, { role: "ADMIN" }, { is_admin: "true" }, { is_admin: 1 }]) {
    assert.equal(isAdministrator({ ...verified, email: "other@example.org", app_metadata }), false);
  }
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
  for (const user of [null, { ...verified, email_confirmed_at: null }, { ...verified, email: "other@example.org", user_metadata: { is_admin: true } }]) {
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

test("server persistence revalidates identity and writes only server-owned settings metadata", async () => {
  const writes = [];
  const service = storage({
    getUserById: async id => { assert.equal(id, verified.id); return { data: { user: verified }, error: null }; },
    updateUserById: async (id, attributes) => { writes.push({ id, attributes }); return { error: null }; },
  });
  const saved = await service.saveProviderSettings(verified.id, { primary: "gemini", autoFallback: false });
  assert.equal(writes.length, 1);
  assert.deepEqual(Object.keys(writes[0].attributes), ["app_metadata"]);
  assert.deepEqual(readStoredProviderSettings(writes[0].attributes.app_metadata.research_provider_settings), saved.settings);
  assert.equal(saved.settings.primary, "gemini");
  const denied = storage({ getUserById: async () => ({ data: { user: { ...verified, email: "other@example.org" } }, error: null }) });
  await assert.rejects(denied.saveProviderSettings(verified.id, { primary: "qwen", autoFallback: true }), /ADMIN_REQUIRED/);
});

test("role administrators read and update the canonical global policy rather than creating competing policies", async () => {
  const admin = { ...verified, id: "role-admin", email: "administrator@example.org", app_metadata: { role: "admin" } };
  const ownerSettings = { primary: "gemini", autoFallback: false, updatedAt: verified.email_confirmed_at };
  const owner = { ...verified, app_metadata: { research_provider_settings: ownerSettings } };
  const writes = [];
  const service = storage({
    getUserById: async () => ({ data: { user: admin }, error: null }),
    listUsers: async () => ({ data: { users: [admin, owner], nextPage: null }, error: null }),
    updateUserById: async (id, attributes) => { writes.push({ id, attributes }); return { error: null }; },
  });
  assert.deepEqual((await service.administratorSettings(admin)).settings, { ...ownerSettings, ...modelDefaults });
  assert.deepEqual(await service.researchProviderSettings(), { ...ownerSettings, ...modelDefaults });
  await service.saveProviderSettings(admin.id, { primary: "qwen", autoFallback: true });
  assert.equal(writes[0].id, owner.id);
  assert.deepEqual(Object.keys(writes[0].attributes), ["app_metadata"]);
  assert.equal(writes[0].attributes.app_metadata.research_provider_settings.primary, "qwen");
  await assert.rejects(service.administratorSettings({ ...admin, email_confirmed_at: null }), /ADMIN_REQUIRED/);
});

test("new runs read paginated admin settings, ignore spoofed metadata, and preserve safe defaults", async () => {
  const saved = { primary: "gemini", autoFallback: false, updatedAt: verified.email_confirmed_at };
  const pages = [];
  const service = storage({ listUsers: async ({ page }) => {
    pages.push(page);
    return { data: { users: page === 1 ? [{ ...verified, email: "other@example.org", app_metadata: { research_provider_settings: saved } }] : [{ ...verified, app_metadata: { research_provider_settings: saved } }], nextPage: page === 1 ? 2 : null }, error: null };
  } });
  assert.deepEqual(await service.researchProviderSettings(), { ...saved, ...modelDefaults });
  assert.deepEqual(pages, [1, 2]);
  assert.deepEqual(await storage({ listUsers: async () => ({ data: { users: [], nextPage: null }, error: null }) }).researchProviderSettings(), readStoredProviderSettings(undefined));
  await assert.rejects(storage({ listUsers: async () => ({ data: null, error: new Error("database offline") }) }).researchProviderSettings(), /WORKFLOW_INTERRUPTED/);
});

test("verified model choices persist and unknown or cross-provider IDs are rejected", async () => {
  for (const qwenModel of models.qwenModelIds) for (const geminiModel of models.geminiModelIds) {
    const input = { primary: "gemini", autoFallback: true, qwenModel, geminiModel };
    assert.deepEqual(providerSettingsSchema.parse(input), input);
    const stored = { ...input, updatedAt: verified.email_confirmed_at };
    assert.deepEqual(readStoredProviderSettings(stored), stored);
    let written;
    const service = storage({
      getUserById: async () => ({ data: { user: verified }, error: null }),
      updateUserById: async (_id, value) => { written = value.app_metadata.research_provider_settings; return { error: null }; },
    });
    const result = await service.saveProviderSettings(verified.id, input);
    assert.deepEqual(result.settings, written);
    assert.equal(result.settings.qwenModel, qwenModel);
    assert.equal(result.settings.geminiModel, geminiModel);
  }
  for (const invalidChoice of [{ qwenModel: "qwen3.8-unverified" }, { qwenModel: "gemini-4-argon" }, { geminiModel: "qwen3.8-max" }, { geminiModel: "gemini-latest" }, { geminiModel: "https://attacker.test" }, { qwenModel: null }]) {
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
    assert.equal(models.selectedModel("gemini", { geminiModel }), geminiModel);
  }
  assert.equal(models.researchModels["qwen3.8-max"].thinking, true);
  assert.equal(models.researchModels["qwen3.8-flash"].thinking, false);
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
  const page = readFileSync(new URL("../app/(workspace)/admin/page.tsx", import.meta.url), "utf8");
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
      "ai": { Output: { object: ({ schema }) => schema }, generateText: async options => {
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
      "@/lib/workspace-schema": {},
      "@/lib/research-core": { errorCode, researchErrors: {} },
    }, {}, "\nexport { structured };\n");
    assert.deepEqual(await engine.structured(context, "discovery", z.object({ ok: z.boolean() }), "Research prompt", models.researchModelPricing("qwen3.8-max")), { ok: true });
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
  assert.match(source, /\{ \.\.\.setup, active_provider: provider \}/);
  assert.doesNotMatch(source, /active_provider: provider, fallback_pricing: pricing/);
});

function researchFixture({ settings = { primary: "gemini", autoFallback: true, qwenModel: "qwen3.8-max", geminiModel: "gemini-4-argon" }, spent = 0.051042, generate = async () => ({ output: { ok: true }, totalUsage: { inputTokens: 100, outputTokens: 25 } }), evidence = [], checkpoints = new Map() } = {}) {
  const context = { runId: "run", userId: "user", workflowId: "workflow" };
  const setup = { provider_settings: settings, active_provider: settings.primary === "gemini" ? "google-gemini" : "dashscope-beijing", pricing: models.researchModelPricing(settings.qwenModel), fallback_pricing: models.researchModelPricing(settings.geminiModel), brief: { ...workspaceSchema.emptyBrief, name: "Regression research" }, profile: workspaceSchema.emptyProfile };
  checkpoints.set("setup", setup);
  const reservations = [], calls = [], records = [];
  function from(table) {
    const filters = {};
    let patch;
    const query = {
      select: () => query, eq: (key, value) => { filters[key] = value; return query; },
      single: async () => ({ data: table === "research_runs" ? { status: "running", workflow_id: "workflow" } : { output: checkpoints.get(filters.stage_key) }, error: null }),
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
    "server-only": {}, "ai": { Output: { object: ({ schema }) => schema }, generateText: async options => { calls.push(options); return generate(options); } },
    "@/lib/qwen-provider": { qwenModel: model => ({ modelId: model }) },
    "@/lib/gemini-provider": { geminiModel: model => ({ modelId: model }) },
    "@/lib/qwen-core": { QWEN_PROVIDER: "dashscope-beijing" }, "@/lib/research-fallback-core": fallbackCore,
    "@/lib/research-source": {}, "@/lib/provider-settings": {}, "@/lib/provider-settings-core": settingsCore,
    "@/lib/research-models": models, "@/lib/workspace-schema": workspaceSchema, "@/lib/research-core": researchCore,
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

test("the screenshot's Argon reservation falls back without sending the unaffordable request", async () => {
  const fixture = researchFixture();
  const executed = [];
  const result = await fixture.engine.providerCall(fixture.context, "retrieval:c1", "Find external sources", fixture.setup.pricing, true, 0, async (provider, model) => {
    executed.push({ provider, model });
    return { value: "evidence", tokens: { inputTokens: 100, outputTokens: 25 }, searchRequests: 1 };
  });
  assert.equal(result, "evidence");
  assert.deepEqual(executed, [{ provider: "dashscope-beijing", model: "qwen3.8-max" }]);
  assert.ok(Math.abs(fixture.reservations[0].p_reserved - 0.20448) < 1e-9);
  assert.equal(fixture.records.length, 1);
  assert.equal(fixture.checkpoints.get("budget_block").model, "gemini-4-argon");
  assert.equal(fixture.checkpoints.get("setup").active_provider, "dashscope-beijing");
  assert.equal(fixture.checkpoints.get("setup").provider_settings.primary, "gemini");
});

test("disabled fallback and two unaffordable providers never send a paid request", async () => {
  for (const fixture of [researchFixture({ settings: { primary: "gemini", autoFallback: false, qwenModel: "qwen3.8-max", geminiModel: "gemini-4-argon" } }), researchFixture({ spent: 0.24 })]) {
    let calls = 0;
    await assert.rejects(fixture.engine.providerCall(fixture.context, "retrieval:c1", "Find sources", fixture.setup.pricing, true, 0, async () => { calls++; }), /BUDGET_EXCEEDED/);
    assert.equal(calls, 0);
    assert.equal(fixture.records.length, 0);
  }
});

test("billed invalid structured output settles known usage without charging its whole reservation", async () => {
  const fixture = researchFixture({ spent: 0, generate: async () => { throw Object.assign(new Error("INVALID_OUTPUT"), { usage: { inputTokens: 100, outputTokens: 50 } }); } });
  await assert.rejects(fixture.engine.structured(fixture.context, "discovery", z.object({ ok: z.boolean() }), "Prompt", fixture.setup.pricing), /INVALID_OUTPUT/);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.records[0].status, "completed");
  assert.equal(fixture.records[0].estimated_usd, 100 * 0.000002 + 50 * 0.00001);
});

test("prompt-size protection is not misreported as a budget failure or sent to fallback", async () => {
  const fixture = researchFixture({ spent: 0 });
  await assert.rejects(fixture.engine.structured(fixture.context, "evaluation", z.object({ ok: z.boolean() }), "研".repeat(26000), fixture.setup.pricing), /RESEARCH_INPUT_TOO_LARGE/);
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
    if (prompt.includes("逐条分类")) {
      const sources = JSON.parse(prompt.split("；来源=")[1]);
      assert.equal(sources.length, 8);
      items = sources.map(source => ({ source_key: source.source_key, relevant: true, kind: "pain", reliability: "primary", stance: "supports", quote: source.excerpt.slice(0, 100), claim: "真实需求" }));
    } else if (prompt.includes("只评估")) {
      const batch = JSON.parse(prompt.split("；候选=")[1].split("；带分类证据=")[0]);
      assert.equal(batch.length, 2);
      items = batch.map(candidate => ({ candidate_id: candidate.key, description: "业务描述", category: "专业服务", revenue: "假设，未验证", cost: "假设，未验证", risk: "需求尚未验证", assumptions: ["尚未验证"], validation: ["访谈买方", "付费试点"], dimensions: { pain: 50, demand: 50, economics: 50, feasibility: 50, advantage: 50 }, rationale: "基于独立来源" }));
    } else {
      const batch = JSON.parse(prompt.split("评估=")[1].split("；证据分类=")[0]).items;
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

test("concurrent dispatches share a durable hook and manual retries get a new identity", async () => {
  const row = { status: "pending", workflow_id: null, retry_count: 0 };
  const hooks = new Map(), requests = [], updates = [];
  const service = loadModule("../lib/research-service.ts", {
    "server-only": {},
    "workflow/api": { start: async (_workflow, args, options) => {
      assert.deepEqual(args, ["run", "owner"]);
      requests.push(options.hook.token);
      if (hooks.has(options.hook.token)) throw { conflict: true, conflictingRunId: hooks.get(options.hook.token) };
      const runId = `workflow-${hooks.size}`;
      hooks.set(options.hook.token, runId);
      return { runId };
    } },
    "workflow/errors": { HookConflictError: { is: error => error?.conflict === true } },
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
  const service = loadModule("../lib/research-service.ts", { "server-only": {}, "workflow/api": {}, "workflow/errors": {}, "@/workflows/research": {}, "@/lib/supabase/admin": {} });
  const detail = await service.researchDetail({ from }, "owner", "run");
  assert.equal(detail.usage.committed_usd, 0.051042);
  assert.equal(detail.usage.search_requests, 0);
  assert.equal(detail.budget_block.required_usd, 0.20448);
  assert.ok(Math.abs(detail.budget_block.remaining_usd - 0.198958) < 1e-9);
  assert.ok(scopes.every(filters => filters.user_id === "owner"));
});

test("the actual progress view renders blocked-request costs and a usable recovery link", () => {
  const data = { id: "run", status: "failed", stage: "retrieval", error_code: "BUDGET_EXCEEDED", retry_count: 0, configuration: { brief: { name: "Test 1" } }, report: null, steps: [{ stage_key: "discovery" }, { stage_key: "retrieval:c1" }], usage: { estimated_usd: 0.051042, committed_usd: 0.051042, budget_usd: 0.25, uncertain_calls: 0, input_tokens: 756, output_tokens: 4953, search_requests: 0 }, budget_block: { model: "gemini-4-argon", required_usd: 0.20448, remaining_usd: 0.198958 } };
  const { ResearchRunView } = loadModule("../components/research-run.tsx", {
    "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
    "swr": { default: () => ({ data, mutate: async () => undefined }) },
    "@/components/ui/button": { Button: ({ asChild, children, ...props }) => asChild ? cloneElement(children, props) : createElement("button", props, children) },
    "@/components/shared": { PageHeader: ({ title, description }) => createElement("header", null, createElement("h1", null, title), createElement("p", null, description)) },
    "@/components/demo-provider": { useDemo: () => ({ refresh: async () => undefined }) },
    "@/components/research-report": { ResearchReportView: () => null },
    "@/lib/research-core": researchCore,
    "@/i18n/use-copy": { useCopy: () => (text, values = {}) => text.replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? key), useFormats: () => ({ usd: (value, digits = 2) => `$${value.toFixed(digits)}`, number: value => String(value) }) },
    "@/i18n/errors": { feedbackSource: (_code, fallback) => fallback },
  });
  const html = renderToStaticMarkup(createElement(ResearchRunView, { initialData: data }));
  assert.match(html, /gemini-4-argon/);
  assert.match(html, /\$0\.2045/);
  assert.match(html, /\$0\.1990/);
  assert.match(html, /This request was not sent or charged/);
  assert.match(html, /href="\/research\/new"/);
  assert.doesNotMatch(html, /Retry once from saved progress/);
  assert.match(html, /Existing progress and costs remain saved/);
});
