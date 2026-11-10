import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import * as options from "../lib/research-options.ts";
import * as workspaceSchema from "../lib/workspace-schema.ts";
import { founderIndustries } from "../lib/profile-options.ts";
import { messageKey, locales } from "../i18n/config.ts";
import { decodeHtml } from "../lib/research-source.ts";
import * as researchCore from "../lib/research-core.ts";

const { projectSchema, emptyBrief, emptyProfile } = workspaceSchema;
const require = createRequire(import.meta.url);
const catalogs = Object.fromEntries(locales.map(l => [l, JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url), "utf8"))]));
const brief = { ...emptyBrief, name: "Research" };

// A brief as it was stored, and sent, before industries and business models became multi-choice.
const legacyBrief = { name: "Research", sector: "Professional services", model: "B2B subscription", geography: "United States", context: "" };

test("every value accepted before the lists grew is still accepted, so saved briefs and runs stay valid", () => {
  const before = {
    sector: ["Professional services", "B2B SaaS", "Finance & operations", "Education", "Healthcare"],
    model: ["B2B subscription", "Productized service", "Usage-based software", "Open to possibilities"],
    geography: ["United States", "United Kingdom", "European Union", "Global / English-speaking"],
  };
  for (const [field, values] of Object.entries(before))
    for (const value of values) assert.equal(projectSchema.safeParse({ ...legacyBrief, [field]: value }).success, true, `${field}: ${value}`);
});

test("a single-choice brief from before multi-choice is read as one-item selections", () => {
  // Stored run configurations are re-parsed on retry (lib/research-engine.ts), so this shape must keep parsing.
  const parsed = projectSchema.parse(legacyBrief);
  assert.deepEqual(parsed.sectors, ["Professional services"]);
  assert.deepEqual(parsed.models, ["B2B subscription"]);
  assert.equal("sector" in parsed || "model" in parsed, false, "the legacy keys are not carried forward");
  const request = workspaceSchema.researchRequestSchema.parse({ ...legacyBrief, language: "zh-Hant" });
  assert.deepEqual([request.sectors, request.models, request.language], [["Professional services"], ["B2B subscription"], "zh-Hant"]);
  for (const [field, value] of [["sector", "invalid"], ["model", "专业服务"]])
    assert.equal(projectSchema.safeParse({ ...legacyBrief, [field]: value }).success, false, `${field}: ${value}`);
});

test("the new options are accepted, and anything off the lists is still rejected", () => {
  for (const [field, list, wrap] of [["sectors", options.researchSectors, v => [v]], ["models", options.businessModels, v => [v]], ["geography", options.targetMarkets, v => v]]) {
    for (const value of list) assert.deepEqual(projectSchema.parse({ ...brief, [field]: wrap(value) })[field], wrap(value));
    // A translated label is never a stored value: the form always submits the canonical English option value.
    for (const rejected of ["invalid", "", "专业服务", "香港", list[0].toLowerCase()])
      assert.equal(projectSchema.safeParse({ ...brief, [field]: wrap(rejected) }).success, false, `${field}: ${rejected}`);
  }
  assert.ok(options.researchSectors.length >= 18 && options.businessModels.length >= 11 && options.targetMarkets.length >= 20);
});

test("industries take up to three, models any number, and the open option only on its own", () => {
  const ok = (patch) => projectSchema.safeParse({ ...brief, ...patch }).success;
  assert.equal(ok({ sectors: ["Healthcare", "Legal & compliance", "Education"] }), true);
  assert.equal(ok({ sectors: ["Healthcare", "Legal & compliance", "Education", "B2B SaaS"] }), false, "more than three industries");
  assert.equal(ok({ sectors: [] }), false, "an empty selection");
  assert.equal(ok({ sectors: ["Healthcare", "Healthcare"] }), false, "a repeated industry");
  assert.equal(ok({ sectors: ["Open to any industry", "Healthcare"] }), false, "open with a named industry");
  assert.equal(ok({ sectors: "Healthcare" }), false, "a bare string next to the new key shape");
  const named = options.businessModels.filter(v => v !== options.businessModelLead);
  assert.equal(ok({ models: named }), true, "every named model at once");
  assert.equal(ok({ models: [] }), false);
  assert.equal(ok({ models: ["Open to possibilities", "B2B subscription"] }), false);
  assert.equal(ok({ models: ["Open to possibilities"] }), true);
});

test("ticking options keeps the selection valid, in list order, and never empty", () => {
  const { researchSectors: list, anySector: open, maxResearchSectors: max, toggleChoice } = options;
  let picked = [open];
  picked = toggleChoice(list, picked, "Healthcare", open, max);
  assert.deepEqual(picked, ["Healthcare"], "a named industry replaces the open option");
  picked = toggleChoice(list, picked, "B2B SaaS", open, max);
  assert.deepEqual(picked, ["B2B SaaS", "Healthcare"], "kept in list order, not click order");
  picked = toggleChoice(list, picked, "Legal & compliance", open, max);
  assert.deepEqual(toggleChoice(list, picked, "Education", open, max), picked, "at the cap, another tick changes nothing");
  assert.deepEqual(toggleChoice(list, picked, open, open, max), [open], "the open option clears the named ones");
  assert.deepEqual(toggleChoice(list, ["Healthcare"], "Healthcare", open, max), [open], "unticking the last falls back to open");
  for (const selection of [picked, [open], ["Healthcare"]])
    assert.equal(projectSchema.safeParse({ ...brief, sectors: selection }).success, true);
  assert.equal(options.choiceLabel(["Healthcare", "Legal & compliance"], v => v.toUpperCase()), "HEALTHCARE + LEGAL & COMPLIANCE");
});

test("the discovery prompt spells out how several industries and models are to be used", () => {
  const focus = (sectors, models) => options.briefFocus({ sectors, models });
  assert.match(focus(["Open to any industry"], ["Open to possibilities"]), /open to any industry.*Business model: open/s);
  assert.match(focus(["Healthcare"], ["B2B subscription"]), /every hypothesis must sit in Healthcare\..*every hypothesis must use B2B subscription/s);
  const several = focus(["Healthcare", "Legal & compliance"], ["B2B subscription", "Productized service"]);
  assert.match(several, /at least one of Healthcare; Legal & compliance\. Cover each of these industries with at least one hypothesis; hypotheses that combine them are welcome\./);
  assert.match(several, /exactly one of B2B subscription; Productized service, named in its description/);
  const engine = readFileSync(new URL("../lib/research-engine.ts", import.meta.url), "utf8");
  assert.match(engine, /combined considers both\. \$\{briefFocus\(brief\)\} Brief=/);
});

test("grouped lists show every option exactly once, and every profile industry can be researched", () => {
  for (const [lead, groups, list] of [[options.businessModelLead, options.businessModelGroups, options.businessModels], [options.targetMarketLead, options.targetMarketGroups, options.targetMarkets]]) {
    const shown = [lead, ...groups.flatMap(group => group.options)];
    assert.equal(new Set(shown).size, shown.length, "no option is listed twice");
    assert.deepEqual([...shown].sort(), [...list].sort(), "groups cover the whole list");
  }
  for (const industry of founderIndustries.filter(value => value !== "No specific industry yet"))
    assert.ok(options.researchSectors.includes(industry), industry);
});

test("every option and group label is translated in all three languages", () => {
  // These reach copy() through variables, which the literal-call i18n test cannot see.
  const labels = [...options.researchSectors, ...options.businessModels, ...options.targetMarkets, ...options.businessModelGroups.map(g => g.label), ...options.targetMarketGroups.map(g => g.label)];
  for (const label of labels)
    for (const locale of locales) assert.ok(catalogs[locale].ui[messageKey(label)], `${locale}: ${label}`);
});

test("evidence searches run in the language local buyers use for the chosen market", () => {
  assert.equal(options.searchLanguage("Mainland China"), "Simplified Chinese");
  assert.equal(options.searchLanguage("Taiwan"), "Traditional Chinese");
  assert.match(options.searchLanguage("Hong Kong"), /Traditional Chinese or English/);
  assert.equal(options.searchLanguage("Japan"), "Japanese");
  assert.equal(options.searchLanguage("South Korea"), "Korean");
  assert.equal(options.searchLanguage("Germany"), "German");
  for (const market of ["United States", "Global / English-speaking", "Singapore", "India", "European Union"]) assert.equal(options.searchLanguage(market), "English", market);
  assert.equal(options.searchLanguage("Somewhere unknown"), "English");
  const engine = readFileSync(new URL("../lib/research-engine.ts", import.meta.url), "utf8");
  assert.match(engine, /Write "query" as a web-search string in \$\{searchLanguage\(brief\.geography\)\}/);
  assert.doesNotMatch(engine, /as an English web-search string/);
});

test("fetched pages are decoded in their declared character set, not always as UTF-8", () => {
  const cases = [
    ["gbk", Buffer.from([0xbb, 0xe1, 0xbc, 0xc6, 0xca, 0xa6]), "会计师"],
    ["gb2312", Buffer.from([0xbb, 0xe1, 0xbc, 0xc6, 0xca, 0xa6]), "会计师"],
    ["big5", Buffer.from([0xb7, 0x7c, 0xad, 0x70, 0xae, 0x76]), "會計師"],
    ["shift_jis", Buffer.from([0x89, 0xef, 0x8c, 0x76]), "会計"],
    ["euc-kr", Buffer.from([0xc8, 0xb8, 0xb0, 0xe8]), "회계"],
  ];
  for (const [charset, bytes, text] of cases) {
    assert.equal(decodeHtml(bytes, `text/html; charset=${charset}`), text, `header ${charset}`);
    const page = Buffer.concat([Buffer.from(`<html><head><meta charset="${charset}"></head><body>`), bytes, Buffer.from("</body></html>")]);
    assert.ok(decodeHtml(page, "text/html").includes(text), `meta ${charset}`);
  }
  const httpEquiv = Buffer.concat([Buffer.from('<meta http-equiv="Content-Type" content="text/html; charset=big5">'), cases[2][1]]);
  assert.ok(decodeHtml(httpEquiv, "text/html").includes("會計師"));
  // UTF-8 remains the default, and an unknown label never throws.
  assert.equal(decodeHtml(Buffer.from("會計師 accountants"), "text/html"), "會計師 accountants");
  assert.equal(decodeHtml(Buffer.from("會計師"), "text/html; charset=not-a-charset"), "會計師");
  // Before this change GBK bytes became replacement characters, so no quote could ever match.
  assert.notEqual(cases[0][1].toString("utf8"), "会计师");
});

function loadModule(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  const dependency = name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
  new Function("require", "exports", "module", "process", outputText)(dependency, module.exports, module, { env: {} });
  return module.exports;
}
function renderForm({ projects = [], industry = "Healthcare", isDemo = false, run = { ...emptyBrief }, search = "", initialBrief } = {}) {
  const t = createTranslator({ locale: "zh-Hant", messages: catalogs["zh-Hant"], namespace: "ui" });
  const missing = [];
  const copy = (source, values) => { const key = messageKey(source); if (catalogs["zh-Hant"].ui[key]) return t(key, values); missing.push(source); return source; };
  const pass = tag => ({ children, asChild, ...props }) => asChild ? children : createElement(tag, props, children);
  const { ResearchConfig } = loadModule("../components/research-config.tsx", {
    "@/components/mobile-disclosure": { MobileDisclosure: ({ children }) => createElement("div", null, children) },
    "@/i18n/use-copy": { useCopy: () => copy },
    "@/i18n/errors": { feedbackSource: code => code },
    "@/lib/api-client": { postJson: async () => ({}), ApiNetworkError: Error },
    "next/navigation": { useRouter: () => ({ push: () => {}, refresh: () => {} }), useSearchParams: () => new URLSearchParams(search) },
    "next-intl": { useLocale: () => "zh-Hant" },
    "@/i18n/config": { localeNames: { en: "English", "zh-Hans": "简体中文", "zh-Hant": "繁體中文" } },
    "@/components/workspace-link": { default: ({ href, children }) => createElement("a", { href }, children) },
    "@/components/demo-provider": { useDemo: () => ({ run, setRun: async () => {}, profile: { ...emptyProfile, industry }, isDemo, href: p => p, busy: false, refresh: async () => {}, data: isDemo ? null : { projects, access: { enabled: true, remaining: 1, maxRuns: 1, expiresAt: null } } }) },
    "@/components/shared": { PageHeader: ({ title }) => createElement("h1", null, title), DemoNote: () => null },
    "@/components/research-access-card": { ResearchAccessCard: () => null },
    "@/components/ui/button": { Button: pass("button") }, "@/components/ui/input": { Input: props => createElement("input", props) },
    "@/components/ui/field": new Proxy({}, { get: (_, name) => name === "__esModule" ? false : pass(name === "FieldLabel" ? "label" : "div") }),
    "@/lib/research-options": options,
    "@/lib/research-core": researchCore,
    "@/lib/workspace-schema": workspaceSchema,
  });
  return { html: renderToStaticMarkup(createElement(ResearchConfig, { initialBrief })), missing };
}

// The checkboxes of one multi-choice field, as [value, checked, disabled].
const checkboxes = (html, id) => {
  const group = html.match(new RegExp(`<div id="${id}"[^>]*>(.*?)<div id="${id}-help"`, "s"))[1];
  return [...group.matchAll(/<input type="checkbox"([^>]*)\/?>/g)].map(([, attrs]) => [/value="([^"]*)"/.exec(attrs)[1].replace(/&amp;/g, "&"), /checked=""/.test(attrs), /disabled=""/.test(attrs)]);
};

test("the research form shows the grouped options in the interface language and submits canonical values", () => {
  const { html, missing } = renderForm();
  const select = id => html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>(.*?)</select>`, "s"))[1];
  // Labels are translated; option values stay canonical English.
  assert.match(select("geography"), /<optgroup label="亞太地區"><option value="Australia &amp; New Zealand">澳洲與紐西蘭<\/option>/);
  assert.match(select("geography"), /<option value="Mainland China">中國大陸<\/option>/);
  assert.equal([...select("geography").matchAll(/<option /g)].length, options.targetMarkets.length);
  // Industries and business models are checkbox groups: every option once, the open option first.
  const sectors = checkboxes(html, "sectors");
  const models = checkboxes(html, "models");
  assert.deepEqual(sectors.map(([v]) => v).sort(), [...options.researchSectors].sort());
  assert.deepEqual(models.map(([v]) => v).sort(), [...options.businessModels].sort());
  assert.equal(sectors[0][0], options.anySector);
  assert.equal(models[0][0], options.businessModelLead);
  assert.match(html, /aria-label="服務".*?value="Productized service"[^>]*\/?>產品化服務/s);
  assert.deepEqual(missing.filter(s => options.targetMarkets.includes(s) || options.businessModels.includes(s) || options.researchSectors.includes(s) || /\{count\}|Choose/.test(s)), []);
  // A first brief starts from the founder's own industry when it can be researched.
  assert.deepEqual(sectors.filter(([, checked]) => checked).map(([v]) => v), ["Healthcare"]);
  assert.deepEqual(models.filter(([, checked]) => checked).map(([v]) => v), emptyBrief.models);
});

test("discovery mode is a set of radio cards that say what each mode does to the score", () => {
  const radios = html => [...html.matchAll(/<input type="radio"([^>]*)\/?>/g)].map(([, attrs]) => attrs).filter(attrs => attrs.includes('name="discovery-mode"')).map(attrs => [/value="([^"]+)"/.exec(attrs)[1], /checked=""/.test(attrs)]);
  const { html, missing } = renderForm();
  assert.equal(/<select[^>]*id="discovery-mode"/.test(html), false, "no longer a dropdown");
  assert.deepEqual(radios(html), [["combined", true], ["founder", false], ["market", false]], "combined is the default");
  // Titles and descriptions are translated, and the advantage weight comes from the scoring weights.
  assert.match(html, /綜合探索.*?你的優勢佔評分的 15%/s);
  assert.match(html, /創業者優勢.*?你的優勢佔評分的 25%/s);
  assert.match(html, /市場優先.*?不使用你的背景，優勢也不計入評分/s);
  assert.equal(researchCore.scoringWeights.market.advantage, 0, "the market-first card says advantage does not count");
  assert.deepEqual(missing.filter(source => /score|advantage|Combined|Founder|Market-first/i.test(source)), []);
  // Each card's description is announced with its radio.
  for (const [value] of radios(html)) assert.match(html, new RegExp(`aria-describedby="discovery-mode-${value}-help"[^>]*/?>.*?id="discovery-mode-${value}-help"`, "s"));
  // A saved brief reopens with its own mode selected.
  assert.deepEqual(radios(renderForm({ projects: [{ id: "p" }], run: { ...emptyBrief, discovery_mode: "market" } }).html).filter(([, checked]) => checked), [["market", true]]);
});

test("the form starts by asking what the founder wants to do, and ?mode=verify opens the idea form", () => {
  const kinds = html => [...html.matchAll(/<input type="radio"([^>]*)\/?>/g)].map(([, attrs]) => attrs).filter(attrs => attrs.includes('name="research-kind"')).map(attrs => [/value="([^"]+)"/.exec(attrs)[1], /checked=""/.test(attrs)]);
  const discover = renderForm();
  assert.deepEqual(kinds(discover.html), [["verify", false], ["discover", true]], "discovery stays the default");
  assert.match(discover.html, /我有一個想法 — 幫我驗證/);
  assert.doesNotMatch(discover.html, /id="idea-title"/);
  const verify = renderForm({ search: "mode=verify" });
  assert.deepEqual(kinds(verify.html), [["verify", true], ["discover", false]]);
  for (const id of ["idea-title", "idea-buyer", "idea-pain", "idea-offer", "idea-price"]) assert.match(verify.html, new RegExp(`id="${id}"`), id);
  assert.match(verify.html, /id="idea-title"[^>]*maxLength="180"|maxLength="180"[^>]*id="idea-title"/);
  assert.match(verify.html, /驗證這個想法/, "the submit button says what it does");
  assert.match(verify.html, /約 2–3 分鐘/, "the time expectation (decision D8) is shown before starting");
  assert.doesNotMatch(verify.html, /name="discovery-mode"/, "discovery modes are not asked when checking an idea");
  // (Profile values in the sample are already Chinese; any English string left untranslated would show here.)
  assert.deepEqual(verify.missing.filter(source => /[A-Za-z]{3}/.test(source)), [], "every verify-form string is translated");
});

test("a verify brief prefilled from a candidate opens with the idea's own text", () => {
  const idea = { title: "Reminders for physio clinics", buyer: "Clinic owners", pain: "No-shows cost clinics revenue every week.", offer: "", price_hint: "" };
  const { html, missing } = renderForm({ initialBrief: { ...emptyBrief, name: idea.title, discovery_mode: "verify", idea } });
  assert.match(html, /id="idea-title"[^>]*value="Reminders for physio clinics"|value="Reminders for physio clinics"[^>]*id="idea-title"/);
  assert.match(html, /No-shows cost clinics revenue every week\./);
  assert.deepEqual(missing.filter(source => source !== idea.title && /[A-Za-z]{3}/.test(source)), []);
  // The page builds that brief from the outcome with the founder's own client, so row-level security applies.
  const page = readFileSync(new URL("../app/(workspace)/research/new/page.tsx", import.meta.url), "utf8");
  assert.match(page, /from\("research_stages"\)\.select\("output"\)\.eq\("run_id", id\)\.eq\("user_id", user\.id\)\.eq\("stage_key", "outcome"\)/);
  assert.match(page, /\/\^c\\d\{1,2\}\$\/\.test\(ideaKey\)/, "only candidate keys are accepted");
  assert.match(page, /discovery_mode: "verify"/);
});

test("at three industries the other named industries are disabled, with a message saying why", () => {
  const run = { ...emptyBrief, sectors: ["Healthcare", "Education", "Legal & compliance"] };
  const { html } = renderForm({ projects: [{ id: "p" }], run });
  const sectors = checkboxes(html, "sectors");
  for (const [value, checked, disabled] of sectors)
    assert.equal(disabled, !checked && value !== options.anySector, value);
  assert.match(html, /你已選擇 3 個產業/);
  const { html: below } = renderForm({ projects: [{ id: "p" }], run: { ...run, sectors: ["Healthcare"] } });
  assert.ok(checkboxes(below, "sectors").every(([, , disabled]) => !disabled));
  assert.match(below, /最多可選 3 個/);
});

test("a founder's industry pre-selects only a first brief, and only when it is a research industry", () => {
  const selected = html => checkboxes(html, "sectors").filter(([, checked]) => checked).map(([v]) => v);
  assert.deepEqual(selected(renderForm({ industry: "Marine conservation" }).html), emptyBrief.sectors, "a custom profile industry leaves the default");
  assert.deepEqual(selected(renderForm({ projects: [{ id: "p" }], industry: "Healthcare" }).html), emptyBrief.sectors, "later briefs keep the last brief's choices");
  assert.deepEqual(selected(renderForm({ isDemo: true }).html), emptyBrief.sectors, "the demo never reads a real profile");
});

test("the page fetcher itself decodes a GBK page before extracting evidence", async () => {
  // Drives the real fetchResearchSource with its network stubbed: a public address for DNS, and a server that answers
  // with GBK bytes. The unit test above covers decodeHtml; this proves the fetch path actually uses it.
  const { EventEmitter } = await import("node:events");
  const gbkPhrase = Buffer.from([0xbb, 0xe1, 0xbc, 0xc6, 0xca, 0xa6, 0xca, 0xc2, 0xce, 0xf1, 0xcb, 0xf9]); // 会计师事务所
  const body = Buffer.concat([Buffer.from("<html><head><title>t</title></head><body><main><p>"), ...Array(20).fill(gbkPhrase), Buffer.from("</p></main></body></html>")]);
  const request = (_url, _options, onResponse) => {
    const req = new EventEmitter();
    req.end = () => process.nextTick(() => {
      const response = Object.assign(new EventEmitter(), { statusCode: 200, headers: { "content-type": "text/html; charset=gbk" }, destroy: () => {} });
      onResponse(response);
      response.emit("data", body);
      response.emit("end");
    });
    return req;
  };
  const source = loadModule("../lib/research-source.ts", {
    "node:dns/promises": { lookup: async () => [{ address: "93.184.216.34", family: 4 }] },
    "node:http": { request }, "node:https": { request },
    // Default-import shape for the CommonJS package, as the bundler provides it.
    "ipaddr.js": { default: require("ipaddr.js") },
  });
  const page = await source.fetchResearchSource("https://example.org/report");
  assert.ok(page.excerpt.startsWith("会计师事务所会计师事务所"), page.excerpt.slice(0, 40));
  assert.ok(!page.excerpt.includes("�"), "no replacement characters");
});
