import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { messageKey, locales } from "../i18n/config.ts";
import { buildOpportunityExport, buildReportExport, exportFileName, mdText, mdUrl, opportunityMarkdown, opportunityToMarkdown, reportMarkdown, reportToMarkdown } from "../lib/report-export.ts";

// Report export (WP-11): the Markdown builder for v1, v2 and v3 payloads in every language, what is left out by
// default (profile and brief), and that untrusted research text cannot add Markdown or HTML to the file.

const catalogs = Object.fromEntries(locales.map((locale) => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"))]));
function copyFor(locale) {
  const messages = catalogs[locale];
  const t = createTranslator({ locale, messages, namespace: "ui" });
  const missing = [];
  const copy = (source, values) => (messages.ui[messageKey(source)] ? t(messageKey(source), values) : (missing.push(source), source));
  return { copy, missing };
}
const AT = "2026-11-11T09:30:00.000Z";
const source = (key, extra = {}) => ({ source_key: key, url: `https://${key}.example.org/report`, title: `Source ${key}`, excerpt: `Clinics say ${key} billing takes hours.`, retrieved_at: "2026-11-01T10:00:00.000Z", published_at: "2026-10-02", ...extra });
// Methodology v1: no evidence, review text or claims.
const v1 = { id: "11111111-1111-4111-8111-111111111111", title: "Clinic billing", category: "Healthcare", description: "Billing help for small clinics.", buyer: "Clinic managers", pain: "Billing takes hours", score: 57, confidence: "moderate", revenue: "$49/month", cost: "$5/month", risk: "Payers change rules", scores: [80, 68, 78, 72, 58], icon: "workflow" };
// v2: evidence with stance, the score before review and its cap, review text.
const v2 = { ...v1, evidence: [source("c1-s1", { stance: "supports" }), source("c1-s2", { stance: "contradicts" })], score_before_review: 72, score_cap: 85, penalty: 15, rationale: "Strong pain.", critique: "Free tools exist.", falsification: "Run a paid pilot.", assumptions: ["Owners will pay"], validation: ["Interview ten clinics", "Run a paid pilot"] };
// v3: claims citing the sources, reliability on each source.
const v3 = {
  ...v2, methodology_version: 3,
  evidence: [source("c1-s1", { stance: "supports", reliability: "primary" }), source("c1-s2", { stance: "contradicts", reliability: "vendor" }), source("c1-s3", { stance: "supports", reliability: "secondary", url: "https://news.example.com/a(b) c" })],
  claims: [
    { text: "Managers spend hours on billing.", kind: "observed", section: "pain", source_keys: ["c1-s3", "c1-s1"] },
    { text: "Clinics would pay $49 a month.", kind: "assumption", section: "economics", source_keys: [], confirm: "Ask five clinics to prepay." },
    { text: "Demand is growing.", kind: "inference", section: "demand", source_keys: ["c1-s1"] },
  ],
};
const brief = { name: "Dr Lee's secret clinic plan", sectors: ["Healthcare"], models: ["B2B subscription"], geography: "United States", context: "I used to run a clinic in Ohio.", angles: [], explore_new: false };
const run = (opportunities, extra = {}) => ({
  id: "22222222-2222-4222-8222-222222222222", created_at: "2026-11-10T08:00:00.000Z", completed_at: "2026-11-10T08:20:00.000Z",
  report: { methodology: "evidence-driven-v3", language: "en", model: "qwen3.8-flash", provider: "dashscope-beijing", mode: "combined", generated_at: "2026-11-10T08:20:00.000Z", summary: "Searched 4 candidates.", limitations: ["Web excerpts are not full due diligence."], weights: {}, opportunities },
  outcome: { version: 1, mode: "combined", counts: { candidates: 2, sources: 3, passed: 1 }, suggestions: [], candidates: [
    { key: "c1", title: "Clinic billing", buyer: "Clinic managers", query: "q", sources: [], supportingDomains: 2, nonVendorSupport: true, contradicting: 0, reason: "PASSED" },
    { key: "c2", title: "Dental reminders", buyer: "Dentists", query: "q", sources: [], supportingDomains: 1, nonVendorSupport: true, contradicting: 0, reason: "SINGLE_DOMAIN" },
  ] },
  ...extra,
});

test("a v3 opportunity exports as Markdown with numbered citations, sources and quotes (snapshot)", () => {
  const { copy, missing } = copyFor("en");
  const markdown = opportunityToMarkdown(v3, { copy, locale: "en", generatedAt: AT });
  assert.deepEqual(missing, []);
  assert.equal(markdown, `# Clinic billing

Billing help for small clinics.

- **Category:** Healthcare
- **Likely buyer:** Clinic managers
- **Research score:** 57/100
- **Confidence:** Moderate: primary validation still needed

**Promising · 57/100**: Worth validating with buyers; the review found real but manageable risks.

Strong pain.

## The problem worth solving

Billing takes hours

## Score breakdown

- **Buyer pain:** 80
- **Demand:** 68
- **Unit economics:** 78
- **Delivery feasibility:** 72
- **Founder advantage:** 58

### How this score was reached

- **Weighted rating before review:** 72
- **Adversarial review deduction:** −15
- **Evidence cap (3+ independent supporting sources):** 85
- **Score:** 57

## What the research claims

### Pain

- **Observed:** Managers spend hours on billing. [1][3]

### Demand

- **Inference:** Demand is growing. [1]

### Economics

- **Assumption:** Clinics would pay $49 a month.
  - Ask five clinics to prepay.

## The assumptions that matter

- Owners will pay

## Price and cost hypotheses

- **Price hypothesis:** $49/month
- **Delivery cost hypothesis:** $5/month

## Key risk to validate

Payers change rules

### What the adversarial review found

Free tools exist.

### How to falsify this opportunity

Run a paid pilot.

## Next validation steps

1. Interview ten clinics
2. Run a paid pilot

## Sources

_Source excerpts are kept in their original language so you can verify them yourself._

**[1]** [Source c1-s1](https://c1-s1.example.org/report)\\
<https://c1-s1.example.org/report>\\
c1-s1.example.org · Primary source · Supports · Retrieved: Nov 1, 2026 UTC · Published: 2026-10-02

> Clinics say c1-s1 billing takes hours.

**[2]** [Source c1-s2](https://c1-s2.example.org/report)\\
<https://c1-s2.example.org/report>\\
c1-s2.example.org · Vendor source · Contradicts · Retrieved: Nov 1, 2026 UTC · Published: 2026-10-02

> Clinics say c1-s2 billing takes hours.

**[3]** [Source c1-s3](https://news.example.com/a%28b%29%20c)\\
<https://news.example.com/a%28b%29%20c>\\
news.example.com · Secondary source · Supports · Retrieved: Nov 1, 2026 UTC · Published: 2026-10-02

> Clinics say c1-s3 billing takes hours.

_Methodology version 3 · Generated on Nov 11, 2026 by VentureLens_
`);
});

test("v1 and v2 opportunities export without the sections their payloads lack", () => {
  const { copy } = copyFor("en");
  const old = opportunityToMarkdown(v1, { copy, locale: "en", generatedAt: AT });
  for (const absent of ["What the research claims", "## Sources", "The assumptions that matter", "Next validation steps", "What the adversarial review found", "How to falsify"]) assert.ok(!old.includes(absent), `v1 has no "${absent}"`);
  for (const present of ["# Clinic billing", "## The problem worth solving", "## Score breakdown", "## Price and cost hypotheses", "## Key risk to validate", "Methodology version 1"]) assert.ok(old.includes(present), `v1 has "${present}"`);
  assert.ok(old.includes("- **Evidence cap (3+ independent supporting sources):** 85"), "v1 cap follows its confidence");

  const middle = opportunityToMarkdown(v2, { copy, locale: "en", generatedAt: AT });
  assert.ok(!middle.includes("What the research claims"), "v2 has no claims");
  assert.ok(middle.includes("**[2]** [Source c1-s2]") && middle.includes("Contradicts"), "v2 sources keep their stance");
  assert.ok(!middle.includes("Primary source"), "v2 sources have no reliability");
  assert.ok(middle.includes("Methodology version 2"));
});

test("every language exports v1, v2 and v3 reports with translated headings and no missing strings", () => {
  const headings = { en: "## Research summary", "zh-Hans": "## 研究摘要", "zh-Hant": "## 研究摘要" };
  for (const locale of locales) {
    const { copy, missing } = copyFor(locale);
    for (const op of [v1, v2, v3]) {
      const markdown = reportToMarkdown(run([op]), { copy, locale, generatedAt: AT });
      assert.ok(markdown.startsWith(`# ${copy("VentureLens research report")}\n`), `${locale}: generic title`);
      assert.ok(markdown.includes(headings[locale]), `${locale}: summary heading`);
      assert.ok(markdown.includes(`### 1\\. ${op.title}`), `${locale}: numbered opportunity`);
      assert.ok(markdown.includes("Dental reminders") && markdown.includes(copy("Support came from only one publisher. The evidence rules need at least two independent ones.")), `${locale}: ideas that did not pass, with the reason`);
      assert.ok(!markdown.includes("**Clinic billing** ("), `${locale}: a candidate that passed is not listed as failing`);
    }
    assert.deepEqual(missing, [], `${locale}: every export string is translated`);
  }
  const { copy } = copyFor("zh-Hant");
  const hant = reportToMarkdown(run([v3]), { copy, locale: "zh-Hant", generatedAt: AT });
  for (const text of ["研究報告", "已觀察", "一手來源", "支持", "方法版本 3"]) assert.ok(hant.includes(text), `zh-Hant includes ${text}`);
  assert.ok(hant.includes("> Clinics say c1-s1 billing takes hours."), "quotes stay verbatim in their own language");
});

test("the founder's brief and profile are left out by default, and the brief is added only on request", () => {
  const { copy } = copyFor("en");
  const doc = buildReportExport(run([v3]), { copy, locale: "en", generatedAt: AT, brief });
  assert.equal(doc.brief, null);
  const plain = reportMarkdown(doc);
  for (const secret of ["Dr Lee", "Ohio", "Your brief", "Brief name"]) assert.ok(!plain.includes(secret), `no "${secret}" without consent`);
  assert.equal(doc.title, "VentureLens research report");

  const withBrief = reportToMarkdown(run([v3]), { copy, locale: "en", generatedAt: AT, brief, includeBrief: true });
  assert.ok(withBrief.startsWith("# Dr Lee's secret clinic plan\n"), "the brief name titles the document when included");
  for (const text of ["## Your brief", "- **Industries:** Healthcare", "- **Target market:** United States", "- **Extra context:** I used to run a clinic in Ohio."]) assert.ok(withBrief.includes(text), text);
  // Profile fields are not an input at all: the builder has no way to reach them.
  assert.ok(!/profile/i.test(JSON.stringify(Object.keys(buildOpportunityExport(v3, { copy, locale: "en", generatedAt: AT })))));
});

test("an idea check report carries its verdict, and the run's own facts", () => {
  const { copy } = copyFor("en");
  const markdown = reportToMarkdown(run([{ ...v3, confidence: "limited" }], { report: { ...run([]).report, mode: "verify", opportunities: [{ ...v3, confidence: "limited" }] } }), { copy, locale: "en", generatedAt: AT });
  assert.ok(markdown.includes("## Supported by independent evidence (limited confidence)"));
  assert.ok(markdown.includes("- **Research mode:** Idea check"));
  assert.ok(markdown.includes("- **Model:** "), "the model is named");
  assert.ok(markdown.includes("- **Methodology:** evidence-driven-v3"));
  assert.ok(markdown.includes("- **Report completed:** Nov 10, 2026"));
});

test("old reports without limitations, outcome, language or claims still export", () => {
  const { copy } = copyFor("zh-Hans");
  const legacy = { id: "r", created_at: AT, completed_at: null, report: { methodology: "evidence-driven-v1", model: "mixed", mode: "founder", generated_at: AT, summary: "", limitations: [], weights: {}, opportunities: [v1] } };
  const markdown = reportToMarkdown(legacy, { copy, locale: "zh-Hans", generatedAt: AT });
  assert.ok(!markdown.includes(copy("Research summary")) && !markdown.includes(copy("Limitations")) && !markdown.includes(copy("Ideas that did not pass")));
  assert.ok(markdown.includes(copy("Mixed models")));
  assert.doesNotThrow(() => reportToMarkdown({ ...legacy, report: { ...legacy.report, opportunities: undefined } }, { copy, locale: "zh-Hans", generatedAt: AT }));
});

test("research text cannot add headings, links, HTML or list items to the file", () => {
  const { copy } = copyFor("en");
  const hostile = {
    ...v3, title: "# Owned <script>alert(1)</script>", description: "[click](javascript:alert(1)) **bold** | table |",
    risk: "1. not a list\n- nor this", evidence: [source("x", { title: "<img src=x onerror=alert(1)>", url: "https://x.example.org/a>b" })],
    claims: [{ text: "Text with ` backticks ` and _under_", kind: "observed", section: "pain", source_keys: ["x"] }],
  };
  const markdown = opportunityToMarkdown(hostile, { copy, locale: "en", generatedAt: AT });
  assert.ok(markdown.startsWith("# \\# Owned \\<script\\>alert(1)\\</script\\>\n"), "a title cannot add a heading or a tag");
  assert.ok(!/(^|[^\\])<(script|img)/.test(markdown), "no raw HTML: every < is escaped");
  assert.ok(markdown.includes("\\[click\\](javascript:alert(1))"), "no links from research text");
  assert.ok(markdown.includes("\\| table \\|"));
  assert.ok(markdown.includes("1\\. not a list - nor this"), "line breaks fold and list markers are escaped");
  assert.ok(markdown.includes("](https://x.example.org/a%3Eb)"), "a link target cannot be closed early");
  assert.equal(mdText("a\\b"), "a\\\\b");
  assert.equal(mdUrl("https://e.org/a (b)"), "https://e.org/a%20%28b%29");
  const unsafe = { ...v3, evidence: [source("y", { url: "ftp://y.example.org/file" })], claims: [] };
  assert.ok(!opportunityMarkdown(buildOpportunityExport(unsafe, { copy, locale: "en", generatedAt: AT })).includes("](ftp:"), "only http(s) sources become links");
});

test("export file names are readable, safe and dated, in any script", () => {
  assert.equal(exportFileName("Clinic billing: AI / RCM?", AT), "clinic-billing-ai-rcm-2026-11-11.md");
  assert.equal(exportFileName("診所帳單 自動化", AT), "診所帳單-自動化-2026-11-11.md");
  assert.equal(exportFileName("../../etc/passwd", AT), "etc-passwd-2026-11-11.md");
  assert.equal(exportFileName("***", AT), "venturelens-2026-11-11.md");
  assert.ok(exportFileName("x".repeat(200), AT).length <= 74);
});

test("the print view puts each opportunity on its own page, links sources and quotes them verbatim", () => {
  const require = createRequire(import.meta.url);
  const source = readFileSync(new URL("../components/print-document.tsx", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  const dependencies = { "@/components/report-export": { PrintButton: () => createElement("button", null, "PRINT") }, "lucide-react": { ArrowLeft: () => null } };
  new Function("require", "exports", "module", outputText)((name) => (Object.hasOwn(dependencies, name) ? dependencies[name] : require(name)), module.exports, module);
  const { ReportDocument, OpportunityDocument, PrintToolbar } = module.exports;
  const { copy } = copyFor("en");
  const doc = buildReportExport(run([v3, { ...v1, id: "33333333-3333-4333-8333-333333333333", title: "Second idea" }]), { copy, locale: "en", generatedAt: AT, brief });
  const html = renderToStaticMarkup(createElement(ReportDocument, { doc }));
  assert.equal((html.match(/class="print-break"/g) ?? []).length, 2, "one page per opportunity");
  assert.ok(html.indexOf("<h2>Opportunities</h2>") > html.indexOf('class="print-break"'), "the Opportunities heading starts the first opportunity's page");
  assert.ok(html.includes('<a href="https://c1-s1.example.org/report" rel="noopener noreferrer">Source c1-s1</a>'));
  assert.ok(html.includes("<blockquote>Clinics say c1-s1 billing takes hours.</blockquote>"));
  assert.ok(html.includes('<h3 class="print-opportunity-title">1. Clinic billing</h3>') && html.includes('<h3 class="print-opportunity-title">2. Second idea</h3>'));
  assert.ok(!html.includes("Dr Lee") && !html.includes("Ohio"), "no brief by default");
  const single = renderToStaticMarkup(createElement(OpportunityDocument, { op: buildOpportunityExport(v3, { copy, locale: "en", generatedAt: AT }) }));
  assert.ok(single.startsWith('<h1 class="print-title">Clinic billing</h1>') && single.includes("<h2>Sources</h2>"));
  const toolbar = renderToStaticMarkup(createElement(PrintToolbar, { backHref: "/research/x", backLabel: "Back", hint: "Hint" }));
  assert.ok(toolbar.includes('class="print-hide') && toolbar.includes("PRINT"), "the toolbar is hidden on paper");
});
