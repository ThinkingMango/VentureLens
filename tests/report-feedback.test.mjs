import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as core from "../lib/feedback-core.ts";
import { eventProps } from "../lib/events-core.ts";

const require = createRequire(import.meta.url);
const { feedbackRequestSchema, flagTargetExists, reasonsFor, runModel, feedbackMetrics, claimKey } = core;
const OPPORTUNITY = "11111111-1111-4111-8111-111111111111";
const RUN = "22222222-2222-4222-8222-222222222222";
const payload = {
  claims: [{ text: "a", kind: "observed", section: "pain", source_keys: ["c1-s1"] }, { text: "b", kind: "assumption", section: "buyer", source_keys: [] }],
  evidence: [{ source_key: "c1-s1", url: "https://www.forum.example.org/t/1" }, { source_key: "c1-s2", url: "https://blog.vendor.io/a" }],
};

test("feedback requests are strict: fixed reasons and ratings, bounded comments, no extra fields", () => {
  const flag = { action: "flag", opportunity_id: OPPORTUNITY, target: "claim", target_key: "claim-1", reason: "wrong", comment: "  Not what it says  " };
  assert.equal(feedbackRequestSchema.parse(flag).comment, "Not what it says", "comments are trimmed");
  assert.equal(feedbackRequestSchema.parse({ ...flag, comment: undefined }).comment, "", "a comment is optional");
  for (const bad of [{ reason: "boring" }, { target: "report" }, { target_key: "" }, { target_key: "x".repeat(101) }, { target_key: "a b" }, { comment: "x".repeat(1001) }, { opportunity_id: "o1" }, { user_id: RUN }])
    assert.equal(feedbackRequestSchema.safeParse({ ...flag, ...bad }).success, false, JSON.stringify(bad).slice(0, 60));
  const rate = { action: "rate", run_id: RUN, rating: 4 };
  assert.equal(feedbackRequestSchema.parse(rate).comment, "");
  for (const rating of [0, 6, 3.5, "4"]) assert.equal(feedbackRequestSchema.safeParse({ ...rate, rating }).success, false, String(rating));
});

test("a flag must name a claim or source the opportunity has, with a reason that fits it", () => {
  assert.equal(claimKey(3), "claim-3");
  assert.deepEqual(reasonsFor("claim"), ["wrong", "outdated", "irrelevant", "other"], "a claim has no link to break");
  assert.deepEqual(reasonsFor("source"), ["wrong", "outdated", "irrelevant", "broken_link", "other"]);
  assert.equal(flagTargetExists(payload, "claim", "claim-1", "wrong"), true);
  assert.equal(flagTargetExists(payload, "claim", "claim-2", "wrong"), false, "past the last claim");
  assert.equal(flagTargetExists(payload, "claim", "c1-s1", "wrong"), false);
  assert.equal(flagTargetExists(payload, "claim", "claim-0", "broken_link"), false);
  assert.equal(flagTargetExists(payload, "source", "c1-s2", "broken_link"), true);
  assert.equal(flagTargetExists(payload, "source", "c9-s9", "outdated"), false);
  assert.equal(flagTargetExists({}, "claim", "claim-0", "wrong"), false, "older reports have no claims to flag");
  assert.equal(flagTargetExists(null, "source", "c1-s1", "wrong"), false);
});

test("events carry the reason, the target and the rating, never the comment", () => {
  assert.deepEqual(eventProps("claim_flagged", { reason: "outdated", target: "source" }), { reason: "outdated", target: "source" });
  assert.deepEqual(eventProps("claim_flagged", { reason: "outdated" }), { reason: "outdated" }, "events recorded before WP-13 stay valid");
  assert.equal(eventProps("claim_flagged", { reason: "outdated", comment: "x" }), null);
  assert.equal(eventProps("claim_flagged", { reason: "outdated", target: "report" }), null);
});

test("operator aggregates: flags by reason, flagged source domains, and ratings by mode and model", () => {
  assert.equal(runModel([
    { provider: "qwen", model: "qwen-plus", status: "completed", output_tokens: 900 },
    { provider: "gemini", model: "gemini-2.5-flash", status: "completed", output_tokens: 400 },
    { provider: "gemini", model: "gemini-2.5-flash", status: "completed", output_tokens: 600 },
    { provider: "qwen", model: "qwen-max", status: "reserved", output_tokens: 5000 },
  ]), "gemini/gemini-2.5-flash", "the model with the most settled output tokens");
  assert.equal(runModel([]), null);
  const metrics = feedbackMetrics({
    flags: [
      { target: "source", target_key: "c1-s1", reason: "outdated", evidence: payload.evidence },
      { target: "source", target_key: "c1-s2", reason: "broken_link", evidence: payload.evidence },
      { target: "source", target_key: "c1-s1", reason: "wrong", evidence: payload.evidence },
      { target: "source", target_key: "c9-s9", reason: "wrong", evidence: payload.evidence },
      { target: "claim", target_key: "claim-0", reason: "wrong", evidence: undefined },
    ],
    ratings: [
      { rating: 5, mode: "market", model: "qwen/qwen-plus" }, { rating: 3, mode: "market", model: "qwen/qwen-plus" },
      { rating: 2, mode: "verify", model: null }, { rating: 9, mode: "market", model: "qwen/qwen-plus" },
    ],
  });
  assert.deepEqual(metrics.flags.byReason, { wrong: 3, outdated: 1, irrelevant: 0, broken_link: 1, other: 0 });
  assert.deepEqual([metrics.flags.total, metrics.flags.claims, metrics.flags.sources], [5, 1, 4]);
  assert.deepEqual(metrics.flags.topDomains, [{ domain: "example.org", flags: 2 }, { domain: "vendor.io", flags: 1 }], "registrable domains; a missing source is skipped");
  assert.equal(metrics.ratings.total, 3, "an out-of-range rating is ignored");
  assert.ok(Math.abs(metrics.ratings.mean - 10 / 3) < 1e-9);
  assert.deepEqual(metrics.ratings.byMode, [{ key: "market", ratings: 2, mean: 4 }, { key: "verify", ratings: 1, mean: 2 }]);
  assert.deepEqual(metrics.ratings.byModel, [{ key: "qwen/qwen-plus", ratings: 2, mean: 4 }, { key: "unknown", ratings: 1, mean: 2 }]);
  assert.equal(feedbackMetrics({ flags: [], ratings: [] }).ratings.mean, null);
});

// The API route, with the session client and the event recorder replaced.
function route({ user = { id: "u1" }, opportunity = { run_id: RUN, payload }, insertError = null, rpcError = null } = {}) {
  const source = readFileSync(new URL("../app/api/feedback/route.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const calls = { inserts: [], rpc: [], events: [], reads: [] };
  const supabase = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: table => {
      const filters = {};
      const query = {
        select: () => query,
        eq: (key, value) => { filters[key] = value; return query; },
        maybeSingle: async () => { calls.reads.push({ table, ...filters }); return { data: opportunity, error: null }; },
        insert: async row => { calls.inserts.push(row); return { error: insertError }; },
      };
      return query;
    },
    rpc: async (name, args) => { calls.rpc.push({ name, args }); return { error: rpcError }; },
  };
  const dependencies = {
    "next/server": { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) }, after: fn => fn() },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/feedback-core": core,
    "@/lib/events": { track: async (event, options) => { calls.events.push({ event, ...options }); } },
  };
  const module = { exports: {} };
  new Function("require", "exports", "module", outputText)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module.exports, module);
  const post = (body, headers = {}) => {
    const raw = typeof body === "string" ? body : JSON.stringify(body);
    const all = { origin: "https://app.example.com", host: "app.example.com", "content-type": "application/json", ...headers };
    return module.exports.POST({ headers: { get: name => all[name] ?? null }, text: async () => raw });
  };
  return { post, calls };
}
const flag = { action: "flag", opportunity_id: OPPORTUNITY, target: "source", target_key: "c1-s2", reason: "broken_link", comment: "404" };

test("the feedback API stores a flag under the opportunity's own run, and records only the reason", async () => {
  const { post, calls } = route();
  const response = await post(flag);
  assert.equal(response.status, 200);
  assert.deepEqual(calls.reads, [{ table: "opportunities", id: OPPORTUNITY, user_id: "u1" }], "read through the founder's own session");
  assert.deepEqual(calls.inserts, [{ user_id: "u1", run_id: RUN, opportunity_id: OPPORTUNITY, target: "source", target_key: "c1-s2", reason: "broken_link", comment: "404" }]);
  assert.deepEqual(calls.events, [{ event: "claim_flagged", userId: "u1", props: { reason: "broken_link", target: "source" } }]);
});

test("the feedback API refuses what it should, and says when something was already flagged", async () => {
  assert.equal((await route().post(flag, { origin: "https://evil.example" })).status, 403);
  assert.equal((await route().post(flag, { "content-type": "text/plain" })).status, 415);
  assert.equal((await route().post("{not json")).status, 400);
  assert.equal((await route().post({ ...flag, reason: "boring" })).status, 400);
  assert.equal((await route({ user: null }).post(flag)).status, 401);
  assert.equal((await route({ opportunity: null }).post(flag)).status, 404, "not the founder's opportunity");
  const missing = route();
  assert.equal((await missing.post({ ...flag, target_key: "c9-s9" })).status, 404, "a source the opportunity does not have");
  assert.equal(missing.calls.inserts.length, 0);
  const again = route({ insertError: { code: "23505" } });
  const duplicate = await again.post(flag);
  assert.deepEqual([duplicate.status, duplicate.body.code], [409, "ALREADY_FLAGGED"]);
  assert.equal(again.calls.events.length, 0, "a repeated flag is not counted twice");
  assert.equal((await route({ insertError: { code: "42501" } }).post(flag)).status, 503);
});

test("the feedback API rates a report through rate_report and records the rating only", async () => {
  const { post, calls } = route();
  const response = await post({ action: "rate", run_id: RUN, rating: 5, comment: " Clear sources " });
  assert.equal(response.status, 200);
  assert.deepEqual(calls.rpc, [{ name: "rate_report", args: { p_run_id: RUN, p_rating: 5, p_comment: "Clear sources" } }]);
  assert.deepEqual(calls.events, [{ event: "report_rated", userId: "u1", props: { rating: 5 } }]);
  assert.equal((await route({ rpcError: { code: "P0002" } }).post({ action: "rate", run_id: RUN, rating: 3 })).status, 404, "not the founder's finished report");
});

test("the quality page shows flag counts by reason, flagged domains and ratings by mode and model, in every language", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createTranslator } = await import("next-intl");
  const { messageKey, locales } = await import("../i18n/config.ts");
  const quality = await import("../lib/quality-metrics.ts");
  const funnelCore = await import("../lib/validation-funnel.ts");
  const pass = tag => ({ children, ...props }) => createElement(tag, props, children);
  const feedback = feedbackMetrics({
    flags: [{ target: "source", target_key: "c1-s1", reason: "outdated", evidence: payload.evidence }],
    ratings: [{ rating: 4, mode: "verify", model: "qwen/qwen-plus" }],
  });
  const metrics = quality.qualityMetrics({ runs: [], usage: [], sources: [], opportunities: [] });
  for (const locale of locales) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    const t = createTranslator({ locale, messages, namespace: "ui" });
    const missing = [];
    const copy = (source, values) => (messages.ui[messageKey(source)] ? t(messageKey(source), values) : (missing.push(source), source));
    const labels = load("../components/admin-labels.tsx", { "@/i18n/use-copy": { useCopy: () => copy } });
    const { AdminQuality } = load("../components/admin-quality.tsx", {
      "next/link": { default: ({ href, children }) => createElement("a", { href }, children) },
      "@/i18n/use-copy": { useCopy: () => copy, useFormats: () => ({ number: (n, o) => new Intl.NumberFormat(locale, o).format(n), usd: n => `$${n}`, date: String }) },
      "@/components/shared": { PageHeader: ({ title, children }) => createElement("header", null, title, children) },
      "@/components/admin-nav": { AdminNav: () => null }, "@/components/admin-labels": labels,
      "@/components/ui/card": { Card: pass("div"), CardContent: pass("div"), CardDescription: pass("p"), CardHeader: pass("div"), CardTitle: pass("h3") },
      "@/lib/quality-metrics": quality, "@/lib/validation-funnel": funnelCore, "@/lib/feedback-core": core, "@/lib/utils": { cn: (...c) => c.filter(Boolean).join(" "), progressFill: (p) => ({ transform: `translateX(${p - 100}%)` }) },
    });
    const DAY = 86_400_000, now = new Date("2026-11-30T12:00:00Z"), ago = d => new Date(now.getTime() - d * DAY).toISOString();
    const funnel = funnelCore.validationFunnel({
      reports: [{ user_id: "a", created_at: ago(45) }, { user_id: "b", created_at: ago(40) }, { user_id: "c", created_at: ago(5) }],
      events: [{ user_id: "a", event: "opportunity_viewed", created_at: ago(44) }, { user_id: "a", event: "task_completed", created_at: ago(42) }],
      days: 30, now,
    });
    const page = (value, funnelValue = funnel) => renderToStaticMarkup(createElement(AdminQuality, { report: { days: 30, since: "2026-10-11", metrics, feedback: value, funnel: funnelValue } })).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const html = page(feedback);
    if (locale === "en") {
      assert.match(html, /1 flags \(0 claims, 1 sources\) and 1 ratings in this window\. Average rating: 4\.0\./);
      assert.match(html, /Outdated 1 Irrelevant to this opportunity 0 Broken link 0/);
      assert.match(html, /Most-flagged domains .* example\.org 1/);
      assert.match(html, /Average rating by mode .* Idea check 4\.0 from 1 ratings/);
      assert.match(html, /Average rating by model .* qwen\/qwen-plus 4\.0 from 1 ratings/);
      assert.match(page(null), /Report feedback could not be read\./, "the rest of the page still loads when feedback cannot be read");
      assert.match(html, /1 founders received their first report in the last 30 days\./);
      assert.match(html, /30-day action rate 50%/);
      assert.match(html, /\(1 of 2\)/);
      assert.match(page(feedback, null), /Product events could not be read\./, "the rest of the page still loads when events cannot be read");
    }
    assert.deepEqual(missing, [], locale);
  }
});
function load(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  new Function("require", "exports", "module", outputText)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module.exports, module);
  return module.exports;
}
