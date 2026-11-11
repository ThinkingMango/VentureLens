import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import * as presentation from "../lib/report-presentation.ts";
import * as researchCore from "../lib/research-core.ts";
import * as researchOptions from "../lib/research-options.ts";
import { messageKey, locales } from "../i18n/config.ts";
import * as libraryCore from "../lib/library-core.ts";
import * as outcomeLabels from "../lib/outcome-labels.ts";

const { scoreBreakdown, scoreBand, scoreBands } = presentation;
const { scoreParts, weightedScore, normalizeReview, REVIEW_MAX_PENALTY } = researchCore;
const require = createRequire(import.meta.url);
const catalogs = Object.fromEntries(locales.map(l => [l, JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url), "utf8"))]));

test("the review deducts at most 15 points, and the score parts add up to the score", () => {
  assert.equal(REVIEW_MAX_PENALTY, 15);
  const review = normalizeReview({ items: [{ candidate_id: "c1", reject: false, critique: "x", penalty: 28, falsification: "y" }] }, ["c1"]);
  assert.equal(review.items[0].penalty, 15);
  const dims = { pain: 80, demand: 68, economics: 78, feasibility: 72, advantage: 58 };
  // One of the real opportunities from the live project: 72.1 before review.
  assert.deepEqual(scoreParts(dims, "combined", 3, 15), { beforeReview: 72, cap: 85, score: 57 });
  assert.equal(weightedScore(dims, "combined", 3, 15), 57, "weightedScore is unchanged for the same inputs");
  assert.deepEqual(scoreParts({ pain: 100, demand: 100, economics: 100, feasibility: 100, advantage: 100 }, "combined", 2, 0), { beforeReview: 100, cap: 70, score: 70 });
  // v3 (WP-07) adds claims; the scoring rules above are unchanged from v2.
  assert.equal(researchCore.methodology, "evidence-driven-v3");
});

test("the breakdown reads stored parts, and derives them exactly for earlier reports", () => {
  assert.deepEqual(scoreBreakdown({ score: 70, penalty: 0, confidence: "limited", score_before_review: 100, score_cap: 70 }), { beforeReview: 100, deduction: 0, cap: 70, score: 70, capped: true });
  // Earlier reports have no stored parts: the cap follows confidence, and the score plus the deduction is the rating.
  assert.deepEqual(scoreBreakdown({ score: 57, penalty: 15, confidence: "moderate" }), { beforeReview: 72, deduction: 15, cap: 85, score: 57, capped: false });
  assert.deepEqual(scoreBreakdown({ score: 34, penalty: 20, confidence: "limited" }), { beforeReview: 54, deduction: 20, cap: 70, score: 34, capped: false });
  assert.equal(scoreBreakdown({ score: 60, confidence: "moderate" }).deduction, 0, "a missing penalty is no deduction");
});

test("rating bands cover every score once and describe the real results sensibly", () => {
  const cases = [[85, "strong"], [65, "strong"], [64, "promising"], [57, "promising"], [50, "promising"], [49, "mixed"], [35, "mixed"], [34, "weak"], [0, "weak"]];
  for (const [score, key] of cases) assert.equal(scoreBand(score).key, key, String(score));
  assert.deepEqual(scoreBands.map(b => b.min), [65, 50, 35, 0], "bands are ordered from highest to lowest");
  // The live project's best opportunities (55-57) now read as promising rather than as a failing grade.
  assert.equal(scoreBand(57).label, "Promising");
});

test("band labels and meanings are translated in all three languages", () => {
  for (const band of scoreBands)
    for (const text of [band.label, band.meaning])
      for (const locale of locales) assert.ok(catalogs[locale].ui[messageKey(text)], `${locale}: ${text}`);
});

// Modules added by the library (WP-12), for components loaded without them in their dependency list.
const libraryMocks = {
  "@/components/library": { ArchiveButton: () => null, DeleteRunButton: () => null, LibraryFilterBar: () => null },
  "@/lib/library-core": libraryCore,
};
// Modules added by report export (WP-11), for components loaded without them in their dependency list.
const exportMocks = {
  "@/components/report-export": { ExportButton: () => null, PrintButton: () => null },
  "@/lib/report-export": { buildOpportunityExport() {}, opportunityMarkdown() {}, exportFileName() {}, reportToMarkdown() {} },
  "@/lib/outcome-labels": outcomeLabels,
  // The real next-intl (notify.ts translates with it), with a locale for components rendered outside a provider.
  get "next-intl"() { return { ...require("next-intl"), useLocale: () => "en" }; },
};
function loadModule(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  const dependency = name => Object.hasOwn(dependencies, name) ? dependencies[name] : Object.hasOwn(exportMocks, name) ? exportMocks[name] : Object.hasOwn(libraryMocks, name) ? libraryMocks[name] : require(name);
  new Function("require", "exports", "module", "process", outputText)(dependency, module.exports, module, { env: {} });
  return module.exports;
}
function copyFor(locale) {
  const t = createTranslator({ locale, messages: catalogs[locale], namespace: "ui" });
  const missing = [];
  const copy = (source, values) => { const key = messageKey(source); if (catalogs[locale].ui[key]) return t(key, values); missing.push(source); return source; };
  return { copy, missing };
}
const text = html => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const pass = tag => ({ children, asChild, ...props }) => asChild ? children : createElement(tag, props, children);

test("the report's score key explains the scale, and describes earlier reports by their own rules", () => {
  for (const locale of ["en", "zh-Hans"]) {
    const { copy, missing } = copyFor(locale);
    const { ScoreScale } = loadModule("../components/score-scale.tsx", { "@/i18n/use-copy": { useCopy: () => copy }, "@/lib/report-presentation": presentation, "@/lib/research-core": researchCore });
    const html = text(renderToStaticMarkup(createElement(ScoreScale, { methodology: "evidence-driven-v2" })));
    if (locale === "en") {
      for (const line of ["65+ · Strong candidate", "50–64 · Promising", "35–49 · Mixed evidence", "Below 35 · Weak case"]) assert.ok(html.includes(line), line);
      assert.match(html, /deducts up to 15 points for risks the ratings missed/);
      const legacy = text(renderToStaticMarkup(createElement(ScoreScale, { methodology: "evidence-driven-v1" })));
      assert.match(legacy, /earlier, stricter rules: the adversarial review could deduct up to 30 points/);
    } else {
      assert.ok(html.includes("50–64 分 · 有潜力"));
    }
    assert.deepEqual(missing, [], locale);
  }
});

test("cards and the opportunity page show the rating and every step of the score", () => {
  const { copy, missing } = copyFor("en");
  const card = loadModule("../components/opportunity-card.tsx", {
    "@/components/workspace-link": { default: ({ href, children }) => createElement("a", { href }, children) },
    "@/components/ui/card": new Proxy({}, { get: (_, name) => name === "__esModule" ? false : pass("div") }),
    "@/components/ui/button": { Button: pass("button") }, "@/components/shared": { Confidence: ({ level }) => createElement("span", null, level) },
    "@/lib/report-presentation": presentation, "@/components/demo-provider": { useDemo: () => ({ saved: [], toggleSave: () => {}, isDemo: false, busy: false }) },
    "@/lib/utils": { cn: (...c) => c.filter(Boolean).join(" ") }, "@/i18n/use-copy": { useCopy: () => copy },
  });
  const opportunity = { id: "o1", title: "Clinic billing assistant", category: "Healthcare", description: "d", buyer: "Clinics", pain: "Billing", score: 57, confidence: "moderate", revenue: "r", cost: "c", risk: "k", scores: [80, 68, 78, 72, 58], icon: "workflow", penalty: 15, evidence: [], validation: ["Interview ten clinics"] };
  assert.match(text(renderToStaticMarkup(createElement(card.OpportunityCard, { opportunity }))), /57 \/100 moderate Promising/);

  const live = loadModule("../components/opportunity-detail.tsx", {
    "@/i18n/use-copy": { useCopy: () => copy, useFormats: () => ({ date: String, number: String }) },
    "@/components/workspace-link": { default: ({ href, children }) => createElement("a", { href }, children) },
    "@/components/demo-provider": { useDemo: () => ({ saved: [], toggleSave: () => {}, completed: [], toggleTask: () => {}, busy: false }) },
    "@/components/shared": { DemoNote: () => null, Confidence: ({ level }) => createElement("span", null, level) },
    "@/components/ui/button": { Button: pass("button") }, "@/components/ui/badge": { Badge: pass("span") },
    "@/components/ui/dialog": { Dialog: () => null, DialogContent: pass("div"), DialogHeader: pass("div"), DialogTitle: pass("h2"), DialogDescription: pass("p") },
    "@/i18n/demo": { useDemoContent: () => ({}) }, "@/lib/report-presentation": presentation,
    "@/components/report-feedback": { FlagProvider: ({ children }) => children, FlagButton: () => null },
    "@/components/validation-sprint": { SprintPanel: () => null, SprintStarter: () => null, useSprintActions: () => ({ send: async () => false, busy: false }) },
    "@/lib/sprint-core": require("../lib/sprint-core.ts"),
    "@/lib/opportunity-view": require("../lib/opportunity-view.ts"), "@/lib/utils": { cn: (...c) => c.filter(Boolean).join(" ") },
  });
  const detail = text(renderToStaticMarkup(createElement(live.LiveOpportunityDetail, { opportunity })));
  assert.match(detail, /Promising/);
  assert.match(detail, /Weighted rating before review 72 Adversarial review deduction −15 Evidence cap \(3\+ independent supporting sources\) 85 Score 57/);
  assert.doesNotMatch(detail, /The evidence cap set this score/);
  const capped = text(renderToStaticMarkup(createElement(live.LiveOpportunityDetail, { opportunity: { ...opportunity, score: 70, penalty: 0, confidence: "limited", score_before_review: 88, score_cap: 70 } })));
  assert.match(capped, /Weighted rating before review 88 Adversarial review deduction 0 Evidence cap \(fewer than 3 independent supporting sources\) 70 Score 70/);
  assert.match(capped, /The evidence cap set this score\./);
  assert.deepEqual(missing.filter(s => !/^Clinic|^Healthcare$/.test(s)), []);
});
