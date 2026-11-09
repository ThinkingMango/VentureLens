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

const { sectors: _sectors, models: _models, ...legacyBrief } = brief;

test("every value accepted before the lists grew is still accepted, so saved briefs and runs stay valid", () => {
  const before = {
    sector: ["Professional services", "B2B SaaS", "Finance & operations", "Education", "Healthcare"],
    model: ["B2B subscription", "Productized service", "Usage-based software", "Open to possibilities"],
  };
  // Briefs saved before multi-select carry one sector and one model; they are read as lists of one.
  for (const sector of before.sector)
    for (const model of before.model)
      assert.deepEqual(projectSchema.parse({ ...legacyBrief, sector, model }), { ...brief, sectors: [sector], models: [model] }, `${sector} / ${model}`);
  for (const geography of ["United States", "United Kingdom", "European Union", "Global / English-speaking"])
    assert.equal(projectSchema.safeParse({ ...brief, geography }).success, true, geography);
});

test("the new options are accepted, and anything off the lists is still rejected", () => {
  for (const [field, list, wrap] of [["sectors", options.researchSectors, true], ["models", options.businessModels, true], ["geography", options.targetMarkets, false]]) {
    const value = v => (wrap ? [v] : v);
    for (const option of list) assert.deepEqual(projectSchema.parse({ ...brief, [field]: value(option) })[field], value(option));
    // A translated label is never a stored value: the form always submits the canonical English option value.
    for (const rejected of ["invalid", "", "专业服务", "香港", list[0].toLowerCase()])
      assert.equal(projectSchema.safeParse({ ...brief, [field]: value(rejected) }).success, false, `${field}: ${rejected}`);
  }
  assert.ok(options.researchSectors.length >= 18 && options.businessModels.length >= 11 && options.targetMarkets.length >= 20);
});

test("a brief takes up to two industries and three business models, and an open choice only on its own", () => {
  const ok = (patch) => projectSchema.safeParse({ ...brief, ...patch }).success;
  assert.equal(ok({ sectors: ["Healthcare", "Legal & compliance"] }), true);
  assert.equal(ok({ sectors: ["Healthcare", "Legal & compliance", "Education"] }), false, "three industries");
  assert.equal(ok({ sectors: ["Healthcare", "Healthcare"] }), false, "a repeated industry");
  assert.equal(ok({ sectors: [] }), false, "no industry");
  assert.equal(ok({ sectors: ["Open to any industry"] }), true);
  assert.equal(ok({ sectors: ["Open to any industry", "Healthcare"] }), false, "open with a specific industry");
  assert.equal(ok({ models: ["B2B subscription", "Productized service", "API or data product"] }), true);
  assert.equal(ok({ models: ["B2B subscription", "Productized service", "API or data product", "Licensing or white-label"] }), false, "four models");
  assert.equal(ok({ models: ["Open to possibilities", "B2B subscription"] }), false, "open with a specific model");
  assert.equal(ok({ models: [] }), false, "no model");
  assert.equal(options.MAX_RESEARCH_SECTORS, 2);
  assert.equal(options.MAX_BUSINESS_MODELS, 3);
});

test("choosing toggles within the limit, an open choice replaces the rest, and one choice always remains", () => {
  const { toggleChoice } = options;
  const open = "Open to possibilities";
  assert.deepEqual(toggleChoice(["B2B subscription"], "Productized service", open, 3), ["B2B subscription", "Productized service"]);
  assert.deepEqual(toggleChoice(["B2B subscription", "Productized service"], "B2B subscription", open, 3), ["Productized service"]);
  assert.deepEqual(toggleChoice(["B2B subscription"], "B2B subscription", open, 3), ["B2B subscription"], "the last choice stays");
  assert.deepEqual(toggleChoice(["a", "b", "c"], "d", open, 3), ["a", "b", "c"], "nothing is added beyond the limit");
  assert.deepEqual(toggleChoice(["a", "b"], open, open, 3), [open], "open replaces the others");
  assert.deepEqual(toggleChoice([open], "a", open, 3), ["a"], "a specific choice replaces open");
});

test("discovery is told how to spread hypotheses across several industries and models, and nothing changes for one", () => {
  const { briefFocusInstructions } = options;
  assert.equal(briefFocusInstructions({ sectors: ["Healthcare"], models: ["B2B subscription"] }), "");
  assert.equal(briefFocusInstructions({ sector: "Healthcare", model: "B2B subscription" }), "", "a brief saved before multi-select");
  const both = briefFocusInstructions({ sectors: ["Healthcare", "Legal & compliance"], models: ["B2B subscription", "Productized service"] });
  assert.match(both, /2 industries \(Healthcare; Legal & compliance\)[^.]*cover each, and make at least two hypotheses combine them/);
  assert.match(both, /2 business models \(B2B subscription; Productized service\): every hypothesis must use one of them, and use each at least once/);
  assert.equal(options.joinChoices(["Healthcare", "Legal & compliance"], v => v.toUpperCase()), "HEALTHCARE + LEGAL & COMPLIANCE");
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
function renderForm({ projects = [], industry = "Healthcare", isDemo = false, run = emptyBrief } = {}) {
  const t = createTranslator({ locale: "zh-Hant", messages: catalogs["zh-Hant"], namespace: "ui" });
  const missing = [];
  const copy = (source, values) => { const key = messageKey(source); if (catalogs["zh-Hant"].ui[key]) return t(key, values); missing.push(source); return source; };
  const pass = tag => ({ children, asChild, ...props }) => asChild ? children : createElement(tag, props, children);
  const chips = loadModule("../components/choice-chips.tsx", {
    "@/i18n/use-copy": { useCopy: () => copy }, "@/lib/utils": { cn: (...c) => c.filter(Boolean).join(" ") }, "@/lib/research-options": options,
  });
  const { ResearchConfig } = loadModule("../components/research-config.tsx", {
    "@/components/choice-chips": chips,
    "@/components/mobile-disclosure": { MobileDisclosure: ({ children }) => createElement("div", null, children) },
    "@/i18n/use-copy": { useCopy: () => copy },
    "@/i18n/errors": { feedbackSource: code => code },
    "@/lib/api-client": { postJson: async () => ({}), ApiNetworkError: Error },
    "next/navigation": { useRouter: () => ({ push: () => {}, refresh: () => {} }) },
    "next-intl": { useLocale: () => "zh-Hant" },
    "@/i18n/config": { localeNames: { en: "English", "zh-Hans": "简体中文", "zh-Hant": "繁體中文" } },
    "@/components/workspace-link": { default: ({ href, children }) => createElement("a", { href }, children) },
    "@/components/demo-provider": { useDemo: () => ({ run: { ...run }, setRun: async () => {}, profile: { ...emptyProfile, industry }, isDemo, href: p => p, busy: false, refresh: async () => {}, data: isDemo ? null : { projects, access: { enabled: true, remaining: 1, maxRuns: 1, expiresAt: null } } }) },
    "@/components/shared": { PageHeader: ({ title }) => createElement("h1", null, title), DemoNote: () => null },
    "@/components/research-access-card": { ResearchAccessCard: () => null },
    "@/components/ui/button": { Button: pass("button") }, "@/components/ui/input": { Input: props => createElement("input", props) },
    "@/components/ui/field": new Proxy({}, { get: (_, name) => name === "__esModule" ? false : pass(name === "FieldLabel" ? "label" : "div") }),
    "@/lib/research-options": options,
  });
  return { html: renderToStaticMarkup(createElement(ResearchConfig)), missing };
}

/** The chips of a multi-select: canonical value, whether it is chosen or disabled, and the visible label. */
function chips(html, id) {
  return [...html.matchAll(/<label[^>]*><input type="checkbox"([^>]*)\/>(.*?)<\/label>/g)]
    .filter(([, attrs]) => attrs.includes(` name="${id}"`))
    .map(([, attrs, label]) => ({
      value: / value="([^"]+)"/.exec(attrs)[1].replace(/&amp;/g, "&"), checked: / checked=""/.test(attrs), disabled: / disabled=""/.test(attrs),
      label: label.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&"),
    }));
}
const chosen = (html, id) => chips(html, id).filter(chip => chip.checked).map(chip => chip.value);

test("the research form shows the grouped options in the interface language and submits canonical values", () => {
  const { html, missing } = renderForm();
  const select = id => html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>(.*?)</select>`, "s"))[1];
  // Labels are translated; option values stay canonical English.
  assert.match(select("geography"), /<optgroup label="亞太地區"><option value="Australia &amp; New Zealand">澳洲與紐西蘭<\/option>/);
  assert.match(select("geography"), /<option value="Mainland China">中國大陸<\/option>/);
  assert.equal([...select("geography").matchAll(/<option /g)].length, options.targetMarkets.length);
  // Industries and business models are multi-selects: one checkbox per option, the open choice first.
  const sectors = chips(html, "sector"), models = chips(html, "model");
  assert.deepEqual(sectors.map(c => c.value).sort(), [...options.researchSectors].sort());
  assert.deepEqual(models.map(c => c.value).sort(), [...options.businessModels].sort());
  assert.equal(sectors[0].value, options.openSector);
  assert.equal(models[0].value, options.openBusinessModel);
  assert.deepEqual(models.find(c => c.value === "Productized service"), { value: "Productized service", checked: false, disabled: false, label: "產品化服務" });
  assert.match(html, /<fieldset id="model"[^>]*>.*<p[^>]*>服務<\/p>/s, "business models keep their group headings");
  assert.match(html, /最多選擇 2 項。選擇「不限產業」會清除其他選項。/);
  assert.match(html, /最多選擇 3 項。選擇「不限商業模式」會清除其他選項。/);
  assert.deepEqual(missing.filter(s => options.targetMarkets.includes(s) || options.businessModels.includes(s) || options.researchSectors.includes(s) || /selected|Choose up to/.test(s)), []);
  // A first brief starts from the founder's own industry when it can be researched.
  assert.deepEqual(chosen(html, "sector"), ["Healthcare"]);
  assert.deepEqual(chosen(html, "model"), emptyBrief.models);
});

test("at the limit the other choices are disabled, but the open choice stays available", () => {
  const { html } = renderForm({ projects: [{ id: "p" }], run: { ...emptyBrief, sectors: ["Healthcare", "Education"], models: ["B2B subscription", "Productized service", "API or data product"] } });
  for (const [id, open] of [["sector", options.openSector], ["model", options.openBusinessModel]]) {
    const all = chips(html, id);
    assert.ok(all.filter(c => !c.checked && c.value !== open).every(c => c.disabled), `${id}: unchosen options are disabled`);
    assert.equal(all.find(c => c.value === open).disabled, false, `${id}: open stays available`);
    assert.ok(all.filter(c => c.checked).every(c => !c.disabled), `${id}: chosen options can be removed`);
  }
  assert.match(html, /已選 2\/2 項/);
  assert.match(html, /已選 3\/3 項/);
});

test("a founder's industry pre-selects only a first brief, and only when it is a research industry", () => {
  assert.deepEqual(chosen(renderForm({ industry: "Marine conservation" }).html, "sector"), emptyBrief.sectors, "a custom profile industry leaves the default");
  assert.deepEqual(chosen(renderForm({ projects: [{ id: "p" }], industry: "Healthcare" }).html, "sector"), emptyBrief.sectors, "later briefs keep the last brief's choices");
  assert.deepEqual(chosen(renderForm({ isDemo: true }).html, "sector"), emptyBrief.sectors, "the demo never reads a real profile");
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
