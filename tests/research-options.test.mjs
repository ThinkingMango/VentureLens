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

const { projectSchema, emptyBrief, emptyProfile } = workspaceSchema;
const require = createRequire(import.meta.url);
const catalogs = Object.fromEntries(locales.map(l => [l, JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url), "utf8"))]));
const brief = { ...emptyBrief, name: "Research" };

test("every value accepted before the lists grew is still accepted, so saved briefs and runs stay valid", () => {
  const before = {
    sector: ["Professional services", "B2B SaaS", "Finance & operations", "Education", "Healthcare"],
    model: ["B2B subscription", "Productized service", "Usage-based software", "Open to possibilities"],
    geography: ["United States", "United Kingdom", "European Union", "Global / English-speaking"],
  };
  for (const [field, values] of Object.entries(before))
    for (const value of values) assert.equal(projectSchema.safeParse({ ...brief, [field]: value }).success, true, `${field}: ${value}`);
});

test("the new options are accepted, and anything off the lists is still rejected", () => {
  for (const [field, list] of [["sector", options.researchSectors], ["model", options.businessModels], ["geography", options.targetMarkets]]) {
    for (const value of list) assert.equal(projectSchema.parse({ ...brief, [field]: value })[field], value);
    // A translated label is never a stored value: the form always submits the canonical English option value.
    for (const rejected of ["invalid", "", "专业服务", "香港", list[0].toLowerCase()])
      assert.equal(projectSchema.safeParse({ ...brief, [field]: rejected }).success, false, `${field}: ${rejected}`);
  }
  assert.ok(options.researchSectors.length >= 18 && options.businessModels.length >= 11 && options.targetMarkets.length >= 20);
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
function renderForm({ projects = [], industry = "Healthcare", isDemo = false } = {}) {
  const t = createTranslator({ locale: "zh-Hant", messages: catalogs["zh-Hant"], namespace: "ui" });
  const missing = [];
  const copy = (source, values) => { const key = messageKey(source); if (catalogs["zh-Hant"].ui[key]) return t(key, values); missing.push(source); return source; };
  const pass = tag => ({ children, asChild, ...props }) => asChild ? children : createElement(tag, props, children);
  const { ResearchConfig } = loadModule("../components/research-config.tsx", {
    "@/components/mobile-disclosure": { MobileDisclosure: ({ children }) => createElement("div", null, children) },
    "@/i18n/use-copy": { useCopy: () => copy },
    "@/i18n/errors": { feedbackSource: code => code },
    "@/lib/api-client": { postJson: async () => ({}), ApiNetworkError: Error },
    "next/navigation": { useRouter: () => ({ push: () => {}, refresh: () => {} }) },
    "next-intl": { useLocale: () => "zh-Hant" },
    "@/i18n/config": { localeNames: { en: "English", "zh-Hans": "简体中文", "zh-Hant": "繁體中文" } },
    "@/components/workspace-link": { default: ({ href, children }) => createElement("a", { href }, children) },
    "@/components/demo-provider": { useDemo: () => ({ run: { ...emptyBrief }, setRun: async () => {}, profile: { ...emptyProfile, industry }, isDemo, href: p => p, busy: false, refresh: async () => {}, data: isDemo ? null : { projects, access: { enabled: true, remaining: 1, maxRuns: 1, expiresAt: null } } }) },
    "@/components/shared": { PageHeader: ({ title }) => createElement("h1", null, title), DemoNote: () => null },
    "@/components/research-access-card": { ResearchAccessCard: () => null },
    "@/components/ui/button": { Button: pass("button") }, "@/components/ui/input": { Input: props => createElement("input", props) },
    "@/components/ui/field": new Proxy({}, { get: (_, name) => name === "__esModule" ? false : pass(name === "FieldLabel" ? "label" : "div") }),
    "@/lib/research-options": options,
  });
  return { html: renderToStaticMarkup(createElement(ResearchConfig)), missing };
}

test("the research form shows the grouped options in the interface language and submits canonical values", () => {
  const { html, missing } = renderForm();
  const select = id => html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>(.*?)</select>`, "s"))[1];
  // Labels are translated; option values stay canonical English.
  assert.match(select("geography"), /<optgroup label="亞太地區"><option value="Australia &amp; New Zealand">澳洲與紐西蘭<\/option>/);
  assert.match(select("geography"), /<option value="Mainland China">中國大陸<\/option>/);
  assert.match(select("model"), /<optgroup label="服務"><option value="Productized service">產品化服務<\/option>/);
  assert.equal([...select("sector").matchAll(/<option /g)].length, options.researchSectors.length);
  assert.equal([...select("model").matchAll(/<option /g)].length, options.businessModels.length);
  assert.equal([...select("geography").matchAll(/<option /g)].length, options.targetMarkets.length);
  assert.deepEqual(missing.filter(s => options.targetMarkets.includes(s) || options.businessModels.includes(s) || options.researchSectors.includes(s)), []);
  // A first brief starts from the founder's own industry when it can be researched.
  assert.match(select("sector"), /<option value="Healthcare" selected="">/);
});

test("a founder's industry pre-selects only a first brief, and only when it is a research industry", () => {
  const selected = html => /<select[^>]*id="sector"[^>]*>.*?<option value="([^"]+)" selected=""/s.exec(html)?.[1];
  assert.equal(selected(renderForm({ industry: "Marine conservation" }).html), emptyBrief.sector, "a custom profile industry leaves the default");
  assert.equal(selected(renderForm({ projects: [{ id: "p" }], industry: "Healthcare" }).html), emptyBrief.sector, "later briefs keep the last brief's choices");
  assert.equal(selected(renderForm({ isDemo: true }).html), emptyBrief.sector, "the demo never reads a real profile");
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
