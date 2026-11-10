import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { messageKey, formatDate } from "../i18n/config.ts";
import { parseBudgetInput, settleBudgetInput, MIN_RESEARCH_BUDGET_USD, MAX_RESEARCH_BUDGET_USD } from "../lib/provider-settings-core.ts";
import * as researchCore from "../lib/research-core.ts";
import * as researchOptions from "../lib/research-options.ts";
import * as workspaceSchema from "../lib/workspace-schema.ts";
import * as profileOptions from "../lib/profile-options.ts";
import * as starterProfilesModule from "../lib/starter-profiles.ts";

const require = createRequire(import.meta.url);
function loadModule(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  const dependency = name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
  new Function("require", "exports", "module", "process", outputText)(dependency, module.exports, module, { env: { NODE_ENV: "test" } });
  return module.exports;
}

// copy() backed by the real English catalogue. Every lookup without an entry is recorded, because in the app it
// would silently show the raw source text.
function realCopy() {
  const messages = JSON.parse(readFileSync(new URL("../messages/en.json", import.meta.url), "utf8"));
  const t = createTranslator({ locale: "en", messages, namespace: "ui" });
  const missing = [];
  const copy = (source, values) => {
    const key = messageKey(source);
    if (Object.hasOwn(messages.ui, key)) return t(key, values);
    missing.push(source);
    return source;
  };
  return { copy, missing };
}
const passthrough = tag => ({ children, asChild, ...props }) => createElement(tag, props, children);
const text = html => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

test("the admin budget field keeps partial input and clamps only when the field is left", () => {
  // While typing, incomplete or out-of-range text is not applied (and never rewritten).
  for (const partial of ["", "0", "0.", "0.0", ".", "abc", "-1", "9"]) assert.equal(parseBudgetInput(partial), null, partial);
  assert.equal(parseBudgetInput("0.25"), 0.25);
  assert.equal(parseBudgetInput("1.234"), 1.23, "rounded to cents, matching step=0.01");
  assert.equal(parseBudgetInput(String(MIN_RESEARCH_BUDGET_USD)), MIN_RESEARCH_BUDGET_USD);
  // On blur the text settles to a valid budget; empty or invalid text keeps the previous value.
  assert.equal(settleBudgetInput("0.01", 0.25), MIN_RESEARCH_BUDGET_USD);
  assert.equal(settleBudgetInput("50", 0.25), MAX_RESEARCH_BUDGET_USD);
  assert.equal(settleBudgetInput("", 0.4), 0.4);
  assert.equal(settleBudgetInput("abc", 0.4), 0.4);
  const admin = readFileSync(new URL("../components/admin-providers.tsx", import.meta.url), "utf8");
  assert.match(admin, /step="0\.01"/);
});

test("research history shows whole translated sentences for counts and dates, and never re-translates them", () => {
  const { copy, missing } = realCopy();
  const created = "2026-11-05T09:00:00Z";
  const runs = (id, completed) => Array.from({ length: completed }, (_, i) => ({ id: `${id}-${i}`, project_id: id, status: "completed", stage: "completed", created_at: created }));
  const data = {
    projects: [{ id: "p1", name: "Agency research", sectors: ["B2B SaaS"], created_at: created }, { id: "p2", name: "Clinic research", sectors: ["Healthcare", "Legal & compliance"], created_at: created }],
    runs: [...runs("p1", 1), ...runs("p2", 2)],
  };
  const { ResearchLibrary } = loadModule("../components/research-library.tsx", {
    "@/i18n/use-copy": { useCopy: () => copy, useFormats: () => ({ date: value => formatDate("en", value) }) },
    "@/components/workspace-link": { default: ({ href, children }) => createElement("a", { href }, children) },
    "@/components/shared": { PageHeader: ({ title, children }) => createElement("header", null, title, children), DemoNote: () => null },
    "@/components/ui/button": { Button: passthrough("button") }, "@/components/ui/input": { Input: props => createElement("input", props) },
    "@/components/ui/badge": { Badge: passthrough("span") },
    "@/components/demo-provider": { useDemo: () => ({ isDemo: false, data, run: { name: "" } }) },
    "@/lib/research-core": researchCore,
    "@/lib/research-options": researchOptions,
  });
  const html = text(renderToStaticMarkup(createElement(ResearchLibrary)));
  // A brief with several industries lists them all, each translated on its own.
  assert.match(html, /Healthcare \+ Legal &amp; compliance/);
  assert.match(html, /1 completed run\b/);
  assert.match(html, /2 completed runs\b/);
  assert.match(html, new RegExp(`${formatDate("en", created).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} UTC`));
  // The date label used to be built in code and then passed through copy() again, a lookup with no entry.
  assert.deepEqual(missing.filter(source => /\d{4}/.test(source)), []);
});

function renderOnboarding(props = {}) {
  const { copy, missing } = realCopy();
  const { Onboarding } = loadModule("../components/onboarding.tsx", {
    "@/components/mobile-disclosure": { MobileDisclosure: ({ children }) => createElement("div", null, children) },
    "@/i18n/use-copy": { useCopy: () => copy },
    "@/components/workspace-link": { default: ({ href, children }) => createElement("a", { href }, children) },
    "next/navigation": { useRouter: () => ({ push: () => {} }) },
    "sonner": { toast: { error: () => {}, success: () => {} } },
    "@/components/shared": { Brand: () => createElement("span", null, "VentureLens"), DemoNote: () => null, PageHeader: ({ title }) => createElement("h1", null, title) },
    "@/components/language-switcher": { LanguageSwitcher: () => null },
    "@/components/demo-provider": { useDemo: () => ({ profile: workspaceSchema.emptyProfile, setProfile: async () => {}, isDemo: false, href: path => path, busy: false }) },
    "@/components/ui/button": { Button: passthrough("button") }, "@/components/ui/input": { Input: props => createElement("input", props) },
    "@/components/ui/field": { Field: passthrough("div"), FieldLabel: passthrough("label"), FieldGroup: passthrough("div") },
    "@/components/profile-choice": { ProfileChoice: () => null },
    "@/lib/profile-options": profileOptions, "@/lib/workspace-schema": workspaceSchema, "@/lib/utils": { cn: (...c) => c.filter(Boolean).join(" ") },
    "@/lib/starter-profiles": starterProfilesModule,
  });
  return { html: renderToStaticMarkup(createElement(Onboarding, props)), missing };
}

test("first-run onboarding has one h1, the page title, above the step headings", () => {
  const { html } = renderOnboarding();
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>(.*?)<\/h\1>/g)].map(m => [Number(m[1]), text(m[2]).trim()]);
  assert.equal(headings.filter(([level]) => level === 1).length, 1, "exactly one h1");
  assert.deepEqual(headings[0], [1, "Better opportunities start with you."]);
  assert.ok(headings.slice(1).every(([level]) => level >= 2), "nothing above the page title");
});

test("onboarding has six steps, two of them optional, and offers starter profiles only to new founders", () => {
  const { html, missing } = renderOnboarding();
  assert.match(html, /Step 1 of 6/);
  assert.equal((html.match(/>Optional</g) ?? []).length, 2, "the two new steps are marked optional");
  assert.match(html, /Make it personal[\s\S]*Boundaries/);
  assert.match(html, /Start from an example/);
  for (const starter of starterProfilesModule.starterProfiles) assert.match(html, new RegExp(`aria-pressed="false"[^>]*>[\\s\\S]*?${starter.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.deepEqual(missing, [], "every onboarding string is translated");
  const { html: editing } = renderOnboarding({ editing: true });
  assert.doesNotMatch(editing, /Start from an example/, "an existing profile is never overwritten from a template");
  assert.match(editing, /Step 1 of 6/);
});

// Walks a rendered element tree (plain function components are called) and returns every element with an onClick.
function clickables(node, out = []) {
  if (Array.isArray(node)) { node.forEach(child => clickables(child, out)); return out; }
  if (!isValidElement(node)) return out;
  if (typeof node.type === "function") return clickables(node.type(node.props), out);
  if (node.props.onClick) out.push(node);
  clickables(node.props.children, out);
  return out;
}

test("error pages say what failed, show the support reference, and retry by re-fetching", () => {
  const { copy, missing } = realCopy();
  const deps = {
    "@/i18n/use-copy": { useCopy: () => copy },
    "next/link": { default: ({ href, children }) => createElement("a", { href }, children) },
    "@/components/ui/button": { Button: ({ children, asChild, ...props }) => (asChild ? children : createElement("button", props, children)) },
    "@/lib/error-digest": loadModule("../lib/error-digest.ts", {}),
  };
  const error = Object.assign(new Error("hidden"), { digest: "4217983091" });
  for (const [file, heading] of [["../app/error.tsx", "Something went wrong."], ["../app/(workspace)/error.tsx", "Your workspace could not be loaded."], ["../app/global-error.tsx", "Something went wrong."]]) {
    let retried = 0, reset = 0;
    const Page = loadModule(file, deps).default;
    const props = { error, retry: () => retried++, reset: () => reset++ };
    const html = text(renderToStaticMarkup(createElement(Page, props)));
    assert.ok(html.includes(heading), `${file}: ${heading}`);
    assert.match(html, /Reference: 4217983091/);
    assert.ok(!html.includes("hidden"), `${file} never shows the raw error message`);
    for (const button of clickables(Page(props))) button.props.onClick();
    assert.equal(retried, 1, `${file}: "Try again" re-fetches with retry()`);
    assert.equal(reset, 0, `${file}: reset() only re-renders the same failure`);
  }
  // A thrown non-Error value has no digest, and the page still renders.
  assert.doesNotMatch(renderToStaticMarkup(createElement(loadModule("../app/error.tsx", deps).default, { error: "boom", retry: () => {} })), /Reference/);
  assert.deepEqual(missing, []);
  const notFound = readFileSync(new URL("../app/not-found.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(notFound, /opportunity/i, "the site-wide 404 is not about opportunities");
});

test("onboarding is first-run only, and administrators reach /admin without a founder profile", async () => {
  const redirects = [];
  const redirect = path => { redirects.push(path); throw new Error(`REDIRECT ${path}`); };
  const onboardingPage = onboarded => loadModule("../app/onboarding/page.tsx", {
    "@/i18n/server": { getCopy: async () => s => s }, "@/components/onboarding": { Onboarding: () => null },
    "@/components/demo-provider": { WorkspaceProvider: ({ children }) => children }, "next/navigation": { redirect },
    "@/lib/workspace": { loadWorkspace: async () => ({ userId: "u", onboarded }) },
  }).default;
  await assert.rejects(onboardingPage(true)(), /REDIRECT \/dashboard/);
  assert.ok(await onboardingPage(false)(), "a new founder sees the onboarding form");

  const shell = { "@/components/app-shell": { AppShell: ({ children }) => children }, "@/components/demo-provider": { WorkspaceProvider: ({ children }) => children }, "@/lib/admin-access": { isAdministrator: () => true } };
  const workspace = { loadWorkspace: async () => ({ userId: "admin", onboarded: false }), requireUser: async () => ({ user: { id: "admin" } }) };
  const adminLayout = loadModule("../app/(admin)/layout.tsx", { ...shell, "@/lib/workspace": workspace, "next/navigation": { redirect } }).default;
  redirects.length = 0;
  assert.ok(await adminLayout({ children: "settings" }));
  assert.deepEqual(redirects, [], "an administrator without a profile is not sent to onboarding");
  const workspaceLayout = loadModule("../app/(workspace)/layout.tsx", { ...shell, "@/lib/workspace": workspace, "next/navigation": { redirect } }).default;
  await assert.rejects(workspaceLayout({ children: "dashboard" }), /REDIRECT \/onboarding/, "other workspace pages still require onboarding");
});

test("the development sign-in redirect can never apply to a production build", () => {
  const screen = readFileSync(new URL("../components/auth-screen.tsx", import.meta.url), "utf8");
  assert.match(screen, /process\.env\.NODE_ENV !== "production"\s*\?\s*process\.env\.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL\s*:\s*undefined/);
  assert.equal((screen.match(/NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL/g) ?? []).length, 1, "no unguarded use");
});

test("decorative initials are hidden from screen readers and labelled groups have a role", () => {
  const shell = readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
  for (const span of shell.matchAll(/<span([^>]*)>\s*\{profile\.name\.slice\(0, 1\)/g)) assert.match(span[1], /aria-hidden="true"/);
  for (const file of ["demo-research-results.tsx", "evidence-preview.tsx"]) {
    const source = readFileSync(new URL(`../components/${file}`, import.meta.url), "utf8");
    // A div with no role is not announced with its label; any landmark or grouping role (group, region) makes it so.
    for (const div of source.matchAll(/<div\s([^>]*aria-label=[^>]*)>/g)) assert.match(div[1], /role="(group|region)"/, file);
  }
});
