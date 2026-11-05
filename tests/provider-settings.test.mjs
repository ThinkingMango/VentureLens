import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { ADMIN_EMAIL, isAdministrator } from "../lib/admin-access.ts";
import { providerSettingsSchema, readStoredProviderSettings, providerPlan, assertProvidersConfigured } from "../lib/provider-settings-core.ts";
import * as settingsCore from "../lib/provider-settings-core.ts";
import { withResearchFallback } from "../lib/research-fallback-core.ts";
import { errorCode } from "../lib/research-core.ts";

const verified = { id: "admin-test-id", email: ADMIN_EMAIL, email_confirmed_at: "2026-11-05T00:00:00.000Z", app_metadata: {} };
const require = createRequire(import.meta.url);
function loadModule(file, dependencies, env = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const module = { exports: {} };
  const dependency = name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
  new Function("require", "exports", "module", "process", outputText)(dependency, module.exports, module, { env });
  return module.exports;
}
function storage(admin) {
  return loadModule("../lib/provider-settings.ts", {
    "server-only": {},
    "@/lib/supabase/admin": { createAdminClient: () => ({ auth: { admin } }) },
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

test("only the exact verified administrator email is authorized", () => {
  assert.equal(isAdministrator(verified), true);
  assert.equal(isAdministrator({ ...verified, email: ADMIN_EMAIL.toUpperCase() }), true);
  for (const user of [null, undefined, {}, { email: ADMIN_EMAIL }, { ...verified, email_confirmed_at: null }, { ...verified, email: "smart@smartmango.ai" }, { ...verified, email: "ventures+admin@smartmango.ai" }, { ...verified, email: "ventures@smartmango.ai.example.org" }, { ...verified, email: " ventures@smartmango.ai" }, { email: "other@example.org", email_confirmed_at: verified.email_confirmed_at, user_metadata: { is_admin: true, email: ADMIN_EMAIL }, app_metadata: { is_admin: true } }]) assert.equal(isAdministrator(user), false);
});

test("provider updates reject arbitrary models, coercion, and privilege injection", () => {
  for (const primary of ["qwen", "gemini"]) for (const autoFallback of [false, true]) assert.deepEqual(providerSettingsSchema.parse({ primary, autoFallback }), { primary, autoFallback });
  for (const input of [{ primary: "other", autoFallback: true }, { primary: "qwen", autoFallback: "false" }, { primary: "qwen" }, { primary: "qwen", autoFallback: true, email: "other@example.org" }, { primary: "gemini", autoFallback: false, apiKey: "must-not-be-accepted" }]) assert.equal(providerSettingsSchema.safeParse(input).success, false);
});

test("missing preferences preserve the existing Qwen-to-Gemini default", () => {
  assert.deepEqual(readStoredProviderSettings(undefined), { primary: "qwen", autoFallback: true, updatedAt: null });
  assert.deepEqual(readStoredProviderSettings(null), readStoredProviderSettings(undefined));
  const settings = { primary: "gemini", autoFallback: false, updatedAt: verified.email_confirmed_at };
  assert.deepEqual(readStoredProviderSettings(settings), settings);
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
  assert.deepEqual(calls, [{ id: verified.id, settings: { primary: "gemini", autoFallback: false } }]);
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

test("new runs read paginated admin settings, ignore spoofed metadata, and preserve safe defaults", async () => {
  const saved = { primary: "gemini", autoFallback: false, updatedAt: verified.email_confirmed_at };
  const pages = [];
  const service = storage({ listUsers: async ({ page }) => {
    pages.push(page);
    return { data: { users: page === 1 ? [{ ...verified, email: "other@example.org", app_metadata: { research_provider_settings: saved } }] : [{ ...verified, app_metadata: { research_provider_settings: saved } }], nextPage: page === 1 ? 2 : null }, error: null };
  } });
  assert.deepEqual(await service.researchProviderSettings(), saved);
  assert.deepEqual(pages, [1, 2]);
  assert.deepEqual(await storage({ listUsers: async () => ({ data: { users: [], nextPage: null }, error: null }) }).researchProviderSettings(), readStoredProviderSettings(undefined));
  await assert.rejects(storage({ listUsers: async () => ({ data: null, error: new Error("database offline") }) }).researchProviderSettings(), /WORKFLOW_INTERRUPTED/);
});

test("the protected page and browser bundle never trust client roles or expose provider credentials", () => {
  const page = readFileSync(new URL("../app/(workspace)/admin/page.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(!isAdministrator\(user\)\) notFound\(\)/);
  const client = readFileSync(new URL("../components/admin-providers.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(client, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|DASHSCOPE_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|localStorage/);
});

test("research checkpoints retain the saved policy, legacy compatibility, and both pricing schedules", () => {
  const source = readFileSync(new URL("../lib/research-engine.ts", import.meta.url), "utf8");
  assert.match(source, /provider_settings: providerSettings/);
  assert.match(source, /setup\.provider_settings \?\? defaultProviderSettings/);
  assert.match(source, /\[QWEN_PROVIDER, GEMINI_PROVIDER\]\.includes/);
  assert.match(source, /\{ \.\.\.setup, active_provider: provider \}/);
  assert.doesNotMatch(source, /active_provider: provider, fallback_pricing: pricing/);
});
