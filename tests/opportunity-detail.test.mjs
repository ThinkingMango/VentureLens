import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import * as presentation from "../lib/report-presentation.ts";
import * as view from "../lib/opportunity-view.ts";
import { opportunities, researchReports } from "../lib/demo-data.ts";
import { messageKey, locales } from "../i18n/config.ts";
import * as feedbackCore from "../lib/feedback-core.ts";
import * as sprintCore from "../lib/sprint-core.ts";
import * as libraryCore from "../lib/library-core.ts";
import * as outcomeLabels from "../lib/outcome-labels.ts";

const require = createRequire(import.meta.url);
const catalogs = Object.fromEntries(locales.map(l => [l, JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url), "utf8"))]));
const text = html => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
const pass = tag => ({ children, asChild, ...props }) => asChild ? children : createElement(tag, props, children);

function copyFor(locale) {
  const t = createTranslator({ locale, messages: catalogs[locale], namespace: "ui" });
  const missing = [];
  const copy = (source, values) => { const key = messageKey(source); if (catalogs[locale].ui[key]) return t(key, values); missing.push(source); return source; };
  return { copy, missing };
}
// Modules added by the library (WP-12), for components loaded without them in their dependency list.
const libraryMocks = {
  "@/components/library": { ArchiveButton: () => null, CancelRunButton: () => null, DeleteRunButton: () => null, LibraryFilterBar: () => null },
  "@/lib/library-core": libraryCore,
};
// Modules added by report export (WP-11), for components loaded without them in their dependency list.
const exportMocks = {
  "@/components/report-export": { ExportButton: () => null, PrintButton: () => null },
  // Report links (WP-26).
  "@/components/share-report": { ShareButton: () => null },
  "@/lib/report-export": { buildOpportunityExport() {}, opportunityMarkdown() {}, exportFileName() {}, reportToMarkdown() {} },
  "@/lib/outcome-labels": outcomeLabels,
  // The real next-intl (notify.ts translates with it), with a locale for components rendered outside a provider.
  get "next-intl"() { return { ...require("next-intl"), useLocale: () => "en" }; },
};
function load(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  new Function("require", "exports", "module", outputText)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : Object.hasOwn(exportMocks, name) ? exportMocks[name] : Object.hasOwn(libraryMocks, name) ? libraryMocks[name] : require(name), module.exports, module);
  return module.exports;
}
const dialog = (open = false) => ({
  Dialog: ({ open: shown, children }) => (shown || open ? createElement("div", { "data-guide": "" }, children) : null),
  DialogContent: pass("div"), DialogHeader: pass("div"), DialogTitle: pass("h2"), DialogDescription: pass("p"), DialogFooter: pass("div"),
});
/** The flag and rating controls (WP-13), with their network and toast dependencies replaced. */
function feedbackModule(copy, posted = []) {
  return load("../components/report-feedback.tsx", {
    "@/i18n/use-copy": { useCopy: () => copy }, "@/i18n/errors": { feedbackSource: code => String(code) },
    "@/lib/api-client": { postJson: async (url, body) => { posted.push(body); return { ok: true, status: 200, body: {} }; } },
    "@/lib/feedback-core": feedbackCore, "sonner": { toast: { success() {}, info() {}, error() {} } },
    "@/components/ui/button": { Button: pass("button") }, "@/components/ui/dialog": dialog(), "@/lib/utils": { cn: (...c) => c.filter(Boolean).join(" "), progressFill: (p) => ({ transform: `translateX(${p - 100}%)` }) },
  });
}
/** The validation sprint controls (WP-10), with network and toast dependencies replaced; `sent` collects requests. */
function sprintModule(copy, sent = []) {
  return load("../components/validation-sprint.tsx", {
    "@/i18n/use-copy": { useCopy: () => copy, useFormats: () => ({ date: value => `date(${value})` }) }, "@/i18n/errors": { feedbackSource: code => String(code) },
    "@/lib/api-client": { postJson: async (url, body) => { sent.push(body); return { ok: true, status: 200, body: {} }; } },
    "@/lib/sprint-core": sprintCore, "sonner": { toast: { success() {}, info() {}, error() {} } },
    "@/components/ui/button": { Button: pass("button") }, "@/lib/utils": { cn: (...c) => c.filter(Boolean).join(" "), progressFill: (p) => ({ transform: `translateX(${p - 100}%)` }) },
    "@/components/demo-provider": { useOptionalWorkspace: () => null },
  });
}
/** The opportunity page with its UI dependencies replaced; `guide` renders the reading guide as if it were open. */
function detailModule(copy, { guide = false } = {}) {
  const dependencies = {
    "@/i18n/use-copy": { useCopy: () => copy, useFormats: () => ({ date: value => `date(${value})` }) },
    "@/components/workspace-link": { default: ({ href, children, ...props }) => createElement("a", { href, ...props }, children) },
    "@/components/demo-provider": { useDemo: () => ({ saved: [], toggleSave: () => {}, completed: ["o1-1"], toggleTask: () => {}, busy: false }) },
    "@/components/shared": { DemoNote: () => createElement("p", null, "DEMO-BANNER"), Confidence: ({ level }) => createElement("span", null, `confidence:${level}`) },
    "@/components/ui/button": { Button: pass("button") },
    "@/components/ui/badge": { Badge: pass("span") },
    "@/components/ui/dialog": dialog(guide),
    "@/components/report-feedback": feedbackModule(copy),
    "@/components/validation-sprint": sprintModule(copy),
    "@/lib/sprint-core": sprintCore,
    "@/lib/utils": { cn: (...c) => c.filter(Boolean).join(" "), progressFill: (p) => ({ transform: `translateX(${p - 100}%)` }) },
    "@/i18n/demo": { useDemoContent: () => ({ opportunity: o => o, report: id => researchReports[id] }) },
    "@/lib/report-presentation": presentation,
    "@/lib/opportunity-view": view,
  };
  return load("../components/opportunity-detail.tsx", dependencies);
}

const v1 = { id: "o1", title: "Clinic billing", category: "Healthcare", description: "d", buyer: "Clinics", pain: "Billing pain", score: 57, confidence: "moderate", revenue: "$49/month", cost: "$5/month", risk: "Key risk", scores: [80, 68, 78, 72, 58], icon: "workflow" };
const source = (key, extra = {}) => ({ source_key: key, url: `https://www.example.org/${key}`, title: `Title ${key}`, excerpt: `Quote ${key}`, retrieved_at: "2026-11-10", published_at: null, ...extra });
const v2 = { ...v1, evidence: [source("c1-s1", { stance: "supports" }), source("c1-s2", { stance: "contradicts" })], score_before_review: 72, score_cap: 85, penalty: 15, rationale: "Why it scored", critique: "Review doubt", falsification: "Pilot fails", assumptions: ["Clinics renew"], validation: ["Interview ten clinics", "Run a paid pilot"] };
const claim = (kind, section, claimText, extra = {}) => ({ kind, section, text: claimText, source_keys: [], ...extra });
const v3 = { ...v2, methodology_version: 3, evidence: [source("c1-s1", { stance: "supports", reliability: "primary" }), source("c1-s2", { stance: "contradicts", reliability: "vendor" }), source("c1-s3", { stance: "neutral", reliability: "secondary" })], claims: [
  claim("assumption", "economics", "Clinics would pay $49.", { confirm: "Ask five owners." }),
  claim("inference", "risk", "Vendors overstate the problem.", { source_keys: ["c1-s2"] }),
  claim("observed", "pain", "Clinics lose slots weekly.", { source_keys: ["c1-s1", "c1-s3"] }),
  claim("observed", "buyer", "Owners run the front desk.", { source_keys: ["c1-s1"] }),
] };
const render = (component, props, { locale = "en", guide = false } = {}) => {
  const { copy, missing } = copyFor(locale);
  const module = detailModule(copy, { guide });
  return { html: renderToStaticMarkup(createElement(module[component], props)), missing };
};
const tabsOf = html => [...html.matchAll(/role="tab"[^>]*>([^<]+)</g)].map(([, label]) => label);
const selected = html => /aria-selected="true"[^>]*>([^<]+)</.exec(html)[1];

test("live and demo pages render the same component with the same tabs and one reading-guide entry point", () => {
  const live = render("LiveOpportunityDetail", { opportunity: v3 });
  const demo = render("DemoOpportunityDetail", { opportunity: opportunities[0] });
  for (const { html } of [live, demo]) {
    assert.deepEqual(tabsOf(html), ["Overview", "Evidence", "Economics", "Validation"]);
    assert.equal(selected(html), "Overview");
    assert.equal(html.match(/<button[^>]*>(?:(?!<\/button>).)*How to read this report/g)?.length, 1, "exactly one guide button");
    assert.match(html, /role="tabpanel"[^>]*tabindex="0"|tabindex="0"[^>]*role="tabpanel"/);
  }
  assert.doesNotMatch(live.html, /DEMO-BANNER/, "no demo banner on a real report");
  assert.equal(demo.html.match(/DEMO-BANNER/g).length, 1, "the demo keeps one persistent banner");
  assert.deepEqual([...live.missing, ...demo.missing], []);
});

test("the overview shows the verdict with its score steps, buyer, pain and the top three claims", () => {
  const { html } = render("LiveOpportunityDetail", { opportunity: v3 });
  const page = text(html);
  assert.match(page, /Verdict Promising · 57\/100/);
  assert.match(page, /Rated 72 before review, 15 points deducted by the adversarial review, under an evidence cap of 85\./);
  assert.match(page, /Why it scored/);
  assert.match(page, /Weighted rating before review 72 Adversarial review deduction −15 Evidence cap \(3\+ independent supporting sources\) 85 Score 57/);
  // Observed first, then inferences; the assumption is the fourth claim and is left for the Evidence tab.
  const keyClaims = page.slice(page.indexOf("Key claims"), page.indexOf("See every claim"));
  assert.match(keyClaims, /Clinics lose slots weekly\. \[1\] \[3\] Owners run the front desk\. \[1\] Inference Vendors overstate the problem\. \[2\]/);
  assert.doesNotMatch(keyClaims, /Clinics would pay/);
  assert.match(html, /<a href="#source-c1-s1"[^>]*aria-label="Source 1: Title c1-s1"/);
  assert.match(page, /What the adversarial review found Review doubt/);
});

test("the evidence tab lists claims by section and source cards with domain, reliability and stance, counter-evidence apart", () => {
  const { html, missing } = render("LiveOpportunityDetail", { opportunity: v3, initialTab: "EVIDENCE" });
  assert.equal(selected(html), "Evidence");
  const page = text(html);
  assert.ok(page.indexOf(" Buyer ") < page.indexOf(" Pain ") && page.indexOf(" Pain ") < page.indexOf(" Economics Assumption") && page.indexOf("Economics Assumption") < page.indexOf(" Risk "), "sections in reading order");
  assert.match(page, /Assumption Clinics would pay \$49\. To confirm: Ask five owners\./);
  const sources = page.slice(page.indexOf(" Sources "), page.indexOf("Counter-evidence "));
  assert.match(sources, /Source excerpts are kept in their original language/, "the one note kept from the old disclaimers");
  assert.match(sources, /\[1\] Title c1-s1 example\.org Primary source Supports Quote c1-s1 Retrieved: date\(2026-11-10\) UTC · Published: Unknown/);
  assert.match(sources, /\[3\] Title c1-s3 example\.org Secondary source Neutral Quote c1-s3/);
  assert.doesNotMatch(sources, /c1-s2/, "counter-evidence is not listed among the sources");
  assert.match(page.slice(page.indexOf("Counter-evidence ")), /Counter-evidence: this source contradicts the opportunity \[2\] Title c1-s2 example\.org Vendor source Quote c1-s2/);
  assert.match(html, /<article id="source-c1-s1" tabindex="-1"/);
  assert.match(html, /href="https:\/\/www\.example\.org\/c1-s1" target="_blank" rel="noopener noreferrer"/);
  assert.deepEqual(missing, []);
});

test("economics labels price and cost as assumptions with what would confirm them; validation keeps the checklist", () => {
  const economics = text(render("LiveOpportunityDetail", { opportunity: v3, initialTab: "economics" }).html);
  assert.match(economics, /Price hypothesis Assumption \$49\/month Delivery cost hypothesis Assumption \$5\/month/);
  assert.match(economics, /The assumptions that matter Clinics renew/);
  assert.match(economics, /What would confirm this Clinics would pay \$49\. To confirm: Ask five owners\./);
  const validation = text(render("LiveOpportunityDetail", { opportunity: v3, initialTab: "validation" }).html);
  assert.match(validation, /What to test first Interview ten clinics/);
  assert.match(validation, /Next validation steps Interview ten clinics Run a paid pilot/);
  assert.match(validation, /How to falsify this opportunity Pilot fails/);
  assert.match(validation, /1 of 4 steps complete/, "progress is still read by index, so saved checklists keep their ticks");
  assert.match(validation, /Checklist progress is saved with this opportunity/);
});

test("older v1 and v2 opportunities render every tab without errors, and v1 without evidence has no Evidence tab", () => {
  const old = render("LiveOpportunityDetail", { opportunity: v1, initialTab: "evidence" });
  assert.deepEqual(tabsOf(old.html), ["Overview", "Economics", "Validation"]);
  assert.equal(selected(old.html), "Overview", "a tab the opportunity lacks falls back to the overview");
  for (const opportunity of [v1, v2])
    for (const tab of view.opportunityTabs(view.liveOpportunityView(opportunity))) {
      const { html, missing } = render("LiveOpportunityDetail", { opportunity, initialTab: tab });
      assert.ok(html.includes("role=\"tabpanel\""), `${opportunity === v1 ? "v1" : "v2"} ${tab}`);
      assert.deepEqual(missing, []);
    }
  const economics = text(render("LiveOpportunityDetail", { opportunity: v1, initialTab: "economics" }).html);
  assert.match(economics, /What would confirm this Ask buyers what the problem costs them today/, "a generic confirmation when the payload has no assumption claims");
  // v2 evidence has a stance but no reliability: the card shows no reliability badge, and nothing breaks.
  const evidence = text(render("LiveOpportunityDetail", { opportunity: v2, initialTab: "evidence" }).html);
  assert.match(evidence, /\[1\] Title c1-s1 example\.org Supports Quote c1-s1/);
  assert.doesNotMatch(evidence, /What the research claims/);
});

test("the demo shows its synthetic sources and illustrative score without a score breakdown", () => {
  const o = opportunities[0];
  const { html, missing } = render("DemoOpportunityDetail", { opportunity: o, initialTab: "evidence" });
  const page = text(html);
  assert.equal(page.match(/Synthetic · Not verified/g).length, researchReports[o.id].sources.length);
  assert.match(page, /Working interpretation .* Limitations /);
  assert.doesNotMatch(html, /href="http/, "synthetic sources are never linked");
  assert.doesNotMatch(page, /How this score was reached/);
  const validation = text(render("DemoOpportunityDetail", { opportunity: o, initialTab: "validation" }).html);
  // The demo shows one fixed example sprint (WP-10) in place of the checklist, made from its next steps (WP-16).
  assert.match(validation, /14-day validation sprint Day 4 of 14 · started .* 2 of 3 tasks done Example sprint · Ticks reset on refresh/);
  assert.doesNotMatch(validation, /Demo checklist|Write down the riskiest assumption/);
  assert.match(validation, /Ask five likely buyers how they handled this problem the last time it came up\./);
  assert.match(validation, /Where: .+ Done when: Five conversations held Stop if: Fewer than two describe the problem without prompting/);
  // The report's own first test still leads the page header.
  assert.ok(text(render("DemoOpportunityDetail", { opportunity: o }).html).includes(researchReports[o.id].firstTest));
  assert.deepEqual(missing, []);
});

test("the reading guide covers the score, caps, review, source types, stance, claim kinds and language; old disclaimers are gone", () => {
  const { html, missing } = render("LiveOpportunityDetail", { opportunity: v3 }, { guide: true });
  const guide = text(html.slice(html.indexOf("data-guide")));
  for (const topic of ["Score", "Evidence cap", "Adversarial review deduction", "Source types", "Stance", "Claim kinds", "Report language and quotes"])
    assert.match(guide, new RegExp(` ${topic.replace(/[()]/g, "\\$&")} `), topic);
  assert.match(guide, /Sources are webpage excerpts returned by retrieval services/);
  assert.deepEqual(missing, []);
  // Without the guide open, no page carries the repeated per-section disclaimers any more.
  for (const [component, opportunity] of [["LiveOpportunityDetail", v3], ["DemoOpportunityDetail", opportunities[0]]])
    for (const tab of view.opportunityTabIds) {
      const page = text(render(component, { opportunity, initialTab: tab }).html);
      assert.doesNotMatch(page, /webpage excerpts returned by retrieval|Scores compare hypotheses|Illustrative composite assessment|These invented records|Illustrative buyer hypotheses/, `${component} ${tab}`);
    }
});

test("every tab of the live and demo pages is translated in both Chinese catalogues", () => {
  for (const locale of ["zh-Hans", "zh-Hant"])
    for (const [component, opportunity] of [["LiveOpportunityDetail", v3], ["LiveOpportunityDetail", v1], ["DemoOpportunityDetail", opportunities[1]]])
      for (const tab of view.opportunityTabIds) {
        const { missing } = render(component, { opportunity, initialTab: tab }, { locale, guide: true });
        assert.deepEqual(missing, [], `${locale} ${component} ${tab}`);
      }
});

test("every claim and source card on the Evidence tab has a Flag control keyed to what it flags", () => {
  const { html, missing } = render("LiveOpportunityDetail", { opportunity: v3, initialTab: "evidence" });
  const labels = [...html.matchAll(/aria-label="(Flag (?:claim|source): [^"]+)"/g)].map(([, label]) => label);
  assert.deepEqual(labels.filter(label => label.startsWith("Flag claim")).length, v3.claims.length, "one per claim");
  assert.deepEqual(labels.filter(label => label.startsWith("Flag source")), ["Flag source: Title c1-s1", "Flag source: Title c1-s3", "Flag source: Title c1-s2"], "one per source card, counter-evidence included");
  assert.ok(labels.includes("Flag claim: Clinics would pay $49."));
  assert.deepEqual(missing, []);
  // The overview's key claims stay uncluttered; flags live where the full evidence is.
  assert.doesNotMatch(render("LiveOpportunityDetail", { opportunity: v3 }).html, /Flag claim/);
  // Claims keep their stored position as their key, whatever order they are shown in.
  assert.deepEqual(view.liveOpportunityView(v3).claims.map(c => c.key), ["claim-0", "claim-1", "claim-2", "claim-3"]);
  // The demo's synthetic sources can be flagged too; nothing is sent (see the component test).
  assert.match(render("DemoOpportunityDetail", { opportunity: opportunities[0], initialTab: "evidence" }).html, /aria-label="Flag source: /);
});

test("the rating form offers five labelled stars and shows a saved rating", () => {
  for (const locale of ["en", "zh-Hans", "zh-Hant"]) {
    const { copy, missing } = copyFor(locale);
    const { ReportRating } = feedbackModule(copy);
    const fresh = renderToStaticMarkup(createElement(ReportRating, { runId: "r1", initial: null }));
    const saved = renderToStaticMarkup(createElement(ReportRating, { runId: "r1", initial: { rating: 4, comment: "Useful sources" } }));
    if (locale === "en") {
      assert.equal(fresh.match(/type="radio"/g).length, 5);
      assert.match(text(fresh), /1 of 5: Not useful .* 5 of 5: Very useful/);
      assert.match(text(fresh), /Choose 1 to 5 stars\. Comment \(optional\) Save rating/);
      assert.match(fresh, /<button[^>]*type="submit"[^>]*disabled=""/, "nothing to save before a star is chosen");
      assert.match(saved, /<input[^>]*checked=""[^>]*value="4"/);
      assert.match(text(saved), /Useful Comment \(optional\) Useful sources Update rating Your rating: 4 of 5/);
    }
    assert.deepEqual(missing, [], locale);
  }
});

test("next steps (WP-16) replace the fixed first steps, with where, done-when, stop-if and the assumption tested", () => {
  const v4 = { ...v3, steps_version: 1, steps: [
    { action: "Ask five owners how they book", where: "c1-s1", where_hint: "", done_when: "Five conversations held", stop_if: "Fewer than two confirm", tests_assumption: 0, day: 5 },
    { action: "Offer a paid pilot", where: null, where_hint: "Local practice managers' group", done_when: "One clinic pays", stop_if: "None pay", tests_assumption: null, day: 14 },
  ] };
  for (const locale of locales) {
    const { html, missing } = render("LiveOpportunityDetail", { opportunity: v4, initialTab: "validation" }, { locale });
    assert.deepEqual(missing, [], locale);
    if (locale !== "en") continue;
    const page = text(html);
    assert.match(page, /Next steps 1 of 2 steps complete/, "ticks are still read by position");
    assert.match(page, /Ask five owners how they book Where \[1\] Title c1-s1 · example\.org Done when Five conversations held Stop if Fewer than two confirm Tests Clinics renew Aim for Day 5 of 14/);
    assert.match(page, /Offer a paid pilot Where Local practice managers' group Suggestion Done when One clinic pays/);
    assert.match(html, /href="https:\/\/www\.example\.org\/c1-s1"[^>]*rel="noopener noreferrer"/);
    assert.doesNotMatch(page, /Write down the riskiest assumption|Next validation steps|Interview ten clinics/, "no fixed first steps or plain validation steps");
    assert.equal(page.match(/What to test first/g)?.length, 1, "the header names the first step; the tab does not repeat it");
    assert.match(page, /What to test first Ask five owners how they book/);
    assert.match(page, /How to falsify this opportunity Pilot fails/);
  }
  // A report made before next steps keeps its fixed first steps (checked in the economics/validation test above).
  assert.match(text(render("LiveOpportunityDetail", { opportunity: v3, initialTab: "validation" }).html), /Checklist 1 of 4 steps complete Write down|Write down the riskiest assumption/);
});
