import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { providerDisclosure } from "../lib/provider-disclosure.ts";
import { providerSettingsSchema } from "../lib/provider-settings-core.ts";
import { messageKey } from "../i18n/config.ts";
import * as contact from "../lib/contact.ts";

const require = createRequire(import.meta.url);
const catalogs = ["en", "zh-Hans", "zh-Hant"].map(lang => [lang, JSON.parse(readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), "utf8")).ui]);

// Transpiles a TS/TSX module and evaluates it with the given stand-ins for app-internal imports.
function loadModule(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  const dependency = name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
  new Function("require", "exports", "module", outputText)(dependency, module.exports, module);
  return module.exports;
}

// Records every catalogue source the page asks for, and renders the English source with its values.
function pageDependencies(requested) {
  const copy = (source, values = {}) => {
    requested.push(source);
    return source.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
  };
  const passthrough = ({ children }) => createElement("div", null, children);
  return {
    "@/i18n/use-copy": { useCopy: () => copy, useFormats: () => ({ date: value => `date(${value})` }) },
    "@/components/public-shell": { PublicShell: passthrough },
    "@/components/ui/badge": { Badge: passthrough },
    "@/components/ui/button": { Button: passthrough },
    "@/lib/contact": contact,
    "next/link": { default: ({ href, children }) => createElement("a", { href }, children) },
  };
}
function render(file, exportName, disclosure) {
  const requested = [];
  const component = loadModule(file, pageDependencies(requested))[exportName];
  const html = renderToStaticMarkup(createElement(component, { disclosure }));
  // Collapse markup so assertions read like the visible text.
  return { text: html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " "), requested };
}

const policy = (input, updatedAt = "2026-11-08T10:00:00.000Z") => ({ ...providerSettingsSchema.parse(input), updatedAt });
const policies = {
  qwenWithFallback: policy({ primary: "qwen", autoFallback: true, qwenModel: "qwen3.8-max", geminiModel: "gemini-3.8-flash" }),
  qwenOnly: policy({ primary: "qwen", autoFallback: false }),
  geminiWithFallback: policy({ primary: "gemini", autoFallback: true, geminiModel: "gemini-4-argon" }),
  geminiOnly: policy({ primary: "gemini", autoFallback: false, geminiModel: "gemini-3.8-flash" }),
  claudeWithFallback: policy({ primary: "claude", autoFallback: true, claudeModel: "claude-sonnet-5-5" }),
  claudeToQwen: policy({ primary: "claude", autoFallback: true, fallbackProvider: "qwen", claudeModel: "claude-haiku-5-5" }),
  geminiToClaude: policy({ primary: "gemini", autoFallback: true, fallbackProvider: "claude" }),
};
const CHINA = "mainland China";

test("the disclosure mirrors the saved routing policy exactly", () => {
  const both = providerDisclosure(policies.qwenWithFallback);
  assert.equal(both.known, true);
  assert.deepEqual([both.primary.provider, both.primary.modelName, both.fallback?.provider, both.fallback?.modelName], ["qwen", "Qwen 3.8 Max", "gemini", "Gemini 3.8 Flash"]);
  assert.equal(both.processesInChina, true);
  assert.equal(both.settingsUpdatedAt, "2026-11-08T10:00:00.000Z");

  const geminiOnly = providerDisclosure(policies.geminiOnly);
  assert.equal(geminiOnly.fallback, null);
  assert.equal(geminiOnly.processesInChina, false, "A Gemini-only policy sends nothing to mainland China");

  const geminiFirst = providerDisclosure(policies.geminiWithFallback);
  assert.deepEqual([geminiFirst.primary.provider, geminiFirst.fallback?.provider], ["gemini", "qwen"]);
  assert.equal(geminiFirst.processesInChina, true, "A Qwen fallback still means data may reach mainland China");

  const defaults = providerDisclosure({ ...providerSettingsSchema.parse({ primary: "qwen", autoFallback: true }), updatedAt: null });
  assert.equal(defaults.settingsUpdatedAt, null);

  const claude = providerDisclosure(policies.claudeWithFallback);
  assert.deepEqual([claude.primary.provider, claude.primary.processor, claude.primary.modelName, claude.fallback?.provider], ["claude", "Anthropic", "Claude Sonnet 5.5", "gemini"]);
  assert.equal(claude.processesInChina, false, "Claude with its default Gemini fallback sends nothing to mainland China");

  const claudeToQwen = providerDisclosure(policies.claudeToQwen);
  assert.deepEqual([claudeToQwen.primary.modelName, claudeToQwen.fallback?.provider], ["Claude Haiku 5.5", "qwen"]);
  assert.equal(claudeToQwen.processesInChina, true, "A chosen Qwen fallback means data may reach mainland China");

  const geminiToClaude = providerDisclosure(policies.geminiToClaude);
  assert.deepEqual([geminiToClaude.fallback?.provider, geminiToClaude.fallback?.modelName], ["claude", "Claude Opus 5.5"]);
  assert.equal(geminiToClaude.processesInChina, false);
});

test("an unreadable policy discloses every provider rather than understating processing", () => {
  const unknown = providerDisclosure(null);
  assert.equal(unknown.known, false);
  assert.deepEqual(unknown.providers.map(p => p.processor), ["Alibaba Cloud Model Studio", "Google", "Anthropic"]);
  assert.equal(unknown.processesInChina, true);
  // The browser receives derived facts only: never the budget or anything about credentials.
  assert.ok(!("budgetUsd" in providerDisclosure(policies.qwenOnly)));
});

test("the Privacy Policy names only the providers and regions the current policy uses", () => {
  const qwen = render("../components/privacy.tsx", "Privacy", providerDisclosure(policies.qwenWithFallback)).text;
  assert.match(qwen, /Research runs currently use Qwen 3\.8 Max through Alibaba Cloud Model Studio, which processes requests in mainland China/);
  assert.match(qwen, /fall back to Gemini 3\.8 Flash through the Google Gemini API/);
  assert.match(qwen, /Alibaba Cloud Model Studio Primary AI model \(Qwen\)/);
  assert.match(qwen, /Google Fallback AI model \(Gemini\)/);
  assert.match(qwen, /for Qwen research runs, mainland China/);
  assert.match(qwen, /AI provider settings last changed date\(2026-11-08T10:00:00\.000Z\)/);

  const gemini = render("../components/privacy.tsx", "Privacy", providerDisclosure(policies.geminiOnly)).text;
  assert.match(gemini, /Research runs currently use Gemini 3\.8 Flash through the Google Gemini API\./);
  assert.match(gemini, /Automatic fallback to another provider is turned off, so no other AI provider receives your data\./);
  assert.match(gemini, /Google Primary AI model \(Gemini\)/);
  assert.ok(!gemini.includes("Alibaba"), "An unused processor is not listed");
  assert.ok(!gemini.includes(CHINA), "No mainland China processing is claimed when none can happen");
  assert.match(gemini, /including the United States\. Where the law requires it/);

  const reversed = render("../components/privacy.tsx", "Privacy", providerDisclosure(policies.geminiWithFallback)).text;
  assert.match(reversed, /Google Primary AI model \(Gemini\).*Alibaba Cloud Model Studio Fallback AI model \(Qwen\)/);
  assert.match(reversed, /fall back to Qwen 3\.8 Flash through Alibaba Cloud Model Studio, which processes requests in mainland China/);

  const unknown = render("../components/privacy.tsx", "Privacy", providerDisclosure(null)).text;
  assert.match(unknown, /Qwen through Alibaba Cloud Model Studio, which processes requests in mainland China \(Beijing region\), the Google Gemini API, or the Anthropic Claude API/);
  assert.match(unknown, /Anthropic AI model \(Claude\)/);

  const claude = render("../components/privacy.tsx", "Privacy", providerDisclosure(policies.claudeWithFallback)).text;
  assert.match(claude, /Research runs currently use Claude Sonnet 5\.5 through the Anthropic Claude API\./);
  assert.match(claude, /Anthropic Primary AI model \(Claude\).*Google Fallback AI model \(Gemini\)/);
  assert.ok(!claude.includes(CHINA), "No mainland China processing is claimed for Claude with a Gemini fallback");

  const claudeFallback = render("../components/privacy.tsx", "Privacy", providerDisclosure(policies.geminiToClaude)).text;
  assert.match(claudeFallback, /fall back to Claude Opus 5\.5 through the Anthropic Claude API/);
  assert.match(claudeFallback, /Anthropic Fallback AI model \(Claude\)/);
  assert.ok(!claudeFallback.includes("Alibaba"), "Qwen is not listed when neither primary nor fallback uses it");
  assert.match(unknown, /for Qwen research runs, mainland China/);
  assert.ok(!unknown.includes("last changed"), "No change date is shown when the policy could not be read");
});

test("the Support page answers which model runs research from the current policy", () => {
  const qwenOnly = render("../components/support.tsx", "Support", providerDisclosure(policies.qwenOnly)).text;
  assert.match(qwenOnly, /Which AI model runs my research\?/);
  assert.match(qwenOnly, /New research runs use Qwen 3\.8 Flash through Alibaba Cloud Model Studio, which processes requests in mainland China/);
  assert.match(qwenOnly, /Automatic fallback to another provider is turned off\./);

  const argon = render("../components/support.tsx", "Support", providerDisclosure(policies.geminiWithFallback)).text;
  assert.match(argon, /New research runs use Gemini 4 Argon through the Google Gemini API\./);
  assert.match(argon, /fall back to Qwen 3\.8 Flash through Alibaba Cloud Model Studio/);

  const unknown = render("../components/support.tsx", "Support", providerDisclosure(null)).text;
  assert.match(unknown, /Research runs use Qwen through Alibaba Cloud Model Studio.*the Google Gemini API, or the Anthropic Claude API/);

  const claude = render("../components/support.tsx", "Support", providerDisclosure(policies.claudeToQwen)).text;
  assert.match(claude, /New research runs use Claude Haiku 5\.5 through the Anthropic Claude API\./);
  assert.match(claude, /fall back to Qwen 3\.8 Flash through Alibaba Cloud Model Studio, which processes requests in mainland China/);
});

test("every policy variant renders only text that is translated in all three languages", () => {
  // useCopy silently falls back to English for a missing key, so check every source each variant can produce.
  for (const disclosure of [...Object.values(policies).map(providerDisclosure), providerDisclosure(null)]) {
    for (const [file, name] of [["../components/privacy.tsx", "Privacy"], ["../components/support.tsx", "Support"]]) {
      for (const source of render(file, name, disclosure).requested) {
        for (const [lang, ui] of catalogs) assert.ok(Object.hasOwn(ui, messageKey(source)), `${lang} is missing: ${source}`);
      }
    }
  }
});

test("a failed policy read falls back to the full disclosure instead of breaking the page", async () => {
  const load = settings => loadModule("../lib/provider-disclosure-server.ts", {
    "server-only": {},
    "@/lib/provider-settings": { researchProviderSettings: settings },
    "@/lib/provider-disclosure": { providerDisclosure },
  }).loadProviderDisclosure;
  const warn = console.warn;
  console.warn = () => {};
  try {
    const failed = await load(async () => { throw new Error("PROVIDER_CONFIGURATION"); })();
    assert.equal(failed.known, false);
    assert.equal(failed.processesInChina, true);
  } finally {
    console.warn = warn;
  }
  const saved = await load(async () => policies.geminiOnly)();
  assert.equal(saved.known, true);
  assert.equal(saved.processesInChina, false);
});

test("both pages are rendered per request from the saved policy, so a change shows immediately", () => {
  for (const path of ["../app/privacy/page.tsx", "../app/support/page.tsx"]) {
    const page = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(page, /export const dynamic = "force-dynamic"/);
    assert.match(page, /disclosure=\{await loadProviderDisclosure\(\)\}/);
  }
  // The admin screen warns that saving changes the public notices.
  assert.match(readFileSync(new URL("../components/admin-providers.tsx", import.meta.url), "utf8"), /t\("disclosure"\)/);
  for (const [lang] of catalogs) {
    const admin = JSON.parse(readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), "utf8")).admin;
    assert.ok(admin.disclosure, `${lang} admin.disclosure`);
  }
});
