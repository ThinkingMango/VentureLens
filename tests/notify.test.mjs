import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement, cloneElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as core from "../lib/notify-core.ts";
import * as progress from "../lib/research-progress.ts";
import * as i18nConfig from "../i18n/config.ts";

const require = createRequire(import.meta.url);
const { notificationMode, siteOrigin, notificationOutcome, buildRunEmail, runLabel } = core;
const catalog = locale => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
function load(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  new Function("require", "exports", "module", "process", outputText)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module.exports, module, { env: {} });
  return module.exports;
}

test("email is sent only in production with a key; dry-run and other environments only log", () => {
  assert.deepEqual(notificationMode({}).mode, "off", "no key, nothing at all");
  const smtp = { SMTP_HOST: "smtp.hostinger.com", SMTP_USER: "notifications@smartmango.ai", SMTP_PASSWORD: "test-only" };
  assert.equal(notificationMode(smtp).mode, "dry-run", "development: logged, not sent");
  assert.equal(notificationMode({ ...smtp, VERCEL_ENV: "preview" }).mode, "dry-run", "previews never email real users by accident");
  assert.equal(notificationMode({ ...smtp, VERCEL_ENV: "preview", NOTIFY_SEND: "1" }).mode, "send", "unless explicitly configured");
  assert.equal(notificationMode({ ...smtp, VERCEL_ENV: "production" }).mode, "send");
  assert.equal(notificationMode({ ...smtp, VERCEL_ENV: "production", NOTIFY_DRY_RUN: "1" }).mode, "dry-run", "dry run wins");
  assert.equal(notificationMode({ ...smtp, SMTP_PASSWORD: "", VERCEL_ENV: "production" }).mode, "off", "every SMTP setting is required");
  assert.equal(notificationMode({ NOTIFY_DRY_RUN: "1" }).mode, "dry-run", "dry run works without a key");
  // Decision D1: the Hostinger mailbox, which only sends as itself; port 465 is TLS from the start.
  assert.deepEqual(core.smtpConfig(smtp), { host: "smtp.hostinger.com", port: 465, secure: true, user: "notifications@smartmango.ai", password: "test-only", from: "VentureLens <notifications@smartmango.ai>", replyTo: "support@smartmango.ai" });
  assert.deepEqual([core.smtpConfig({ ...smtp, SMTP_PORT: "587" }).secure, core.smtpConfig({ ...smtp, SMTP_PORT: "nope" })], [false, null], "587 uses STARTTLS; a bad port is no config");
  assert.equal(siteOrigin({ SITE_URL: "https://venturelens.example/app/" }), "https://venturelens.example");
  assert.equal(siteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "venturelens.example" }), "https://venturelens.example");
  assert.equal(siteOrigin({ SITE_URL: "http://evil.example" }), null, "plain http only for localhost");
  assert.equal(siteOrigin({}), null);
});

test("finished runs map to the outcomes the email reports; interrupted and unfinished runs send none", () => {
  const run = (overrides) => ({ status: "completed", error_code: null, quota_released: null, mode: "combined", opportunities: 3, ...overrides });
  assert.deepEqual(notificationOutcome(run()), { kind: "ready", count: 3 });
  assert.deepEqual(notificationOutcome(run({ mode: "verify", opportunities: 1 })), { kind: "verified" });
  assert.deepEqual(notificationOutcome(run({ status: "failed", error_code: "INSUFFICIENT_EVIDENCE" })), { kind: "nothing_passed" });
  assert.deepEqual(notificationOutcome(run({ status: "failed", error_code: "BUDGET_EXCEEDED", quota_released: true })), { kind: "failed", returned: true });
  assert.deepEqual(notificationOutcome(run({ status: "failed", error_code: "INVALID_OUTPUT", quota_released: false })), { kind: "failed", returned: false });
  assert.equal(notificationOutcome(run({ status: "failed", error_code: "WORKFLOW_INTERRUPTED" })), null);
  assert.equal(notificationOutcome(run({ status: "running" })), null);
});

test("the email names the run, states the outcome, links back, and is written in the report language", () => {
  const { translatorFor } = loadNotify();
  const url = "https://venturelens.example/research/r1";
  const en = buildRunEmail({ outcome: { kind: "ready", count: 3 }, name: "Clinic <research>", runUrl: url, profileUrl: "https://venturelens.example/profile", lang: "en" }, translatorFor("en"));
  assert.equal(en.subject, "Your VentureLens report is ready: Clinic <research>");
  assert.match(en.html, /Clinic &lt;research&gt;/, "the name is escaped in HTML");
  assert.match(en.html, /3 opportunities passed/);
  assert.match(en.html, /href="https:\/\/venturelens\.example\/research\/r1"/);
  assert.match(en.text, /Open your report: https:\/\/venturelens\.example\/research\/r1/);
  assert.match(en.text, /turn them off on your profile page\. https:\/\/venturelens\.example\/profile/);
  const one = buildRunEmail({ outcome: { kind: "ready", count: 1 }, name: "", runUrl: url, profileUrl: url, lang: "en" }, translatorFor("en"));
  assert.match(one.text, /^1 opportunity passed/, "no name line when the run has none");
  assert.equal(one.subject, "Your VentureLens report is ready");
  const hans = buildRunEmail({ outcome: { kind: "failed", returned: true }, name: "诊所", runUrl: url, profileUrl: url, lang: "zh-Hans" }, translatorFor("zh-Hans"));
  assert.match(hans.subject, /^你的 VentureLens 研究已中止：|^你的 VentureLens 研究已中止: /);
  assert.match(hans.text, /研究失败，本次研究次数已退回/);
  assert.match(hans.html, /<html lang="zh-Hans">/);
  const hant = buildRunEmail({ outcome: { kind: "nothing_passed" }, name: "x", runUrl: url, profileUrl: url, lang: "zh-Hant" }, translatorFor("zh-Hant"));
  assert.match(hant.text, /這次沒有想法通過/);
  assert.equal(runLabel(` ${"a".repeat(100)} `).length, 80);
  // Every fixed line of every outcome is translated in both Chinese catalogues.
  const source = readFileSync(new URL("../lib/notify-core.ts", import.meta.url), "utf8");
  const lines = [...source.matchAll(/\bt\("((?:[^"\\]|\\.)+)"/g)].map(([, text]) => text);
  assert.ok(lines.length >= 15);
  for (const locale of ["zh-Hans", "zh-Hant"]) {
    const ui = catalog(locale).ui;
    assert.deepEqual(lines.filter(text => !ui[i18nConfig.messageKey(text)]), [], locale);
  }
});

// The notifier with its database, auth and provider replaced.
function loadNotify() {
  return load("../lib/notify.ts", {
    "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => { throw new Error("use deps.client"); } },
    "@/i18n/config": i18nConfig, "@/lib/notify-core": core,
    "nodemailer": { default: { createTransport: () => { throw new Error("tests pass their own transport"); } } },
    "@/messages/en.json": { default: catalog("en") }, "@/messages/zh-Hans.json": { default: catalog("zh-Hans") }, "@/messages/zh-Hant.json": { default: catalog("zh-Hant") },
  });
}
function fakeDb({ run = {}, profile = { notify_on_complete: true }, user = { email: "founder@example.com", email_confirmed_at: "2026-11-01" }, opportunities = 2 } = {}) {
  const state = { notified_at: null, selects: [], claims: 0, releases: 0 };
  const row = { status: "completed", error_code: null, quota_released: null, name: "Clinic research", mode: "combined", language: "en", ...run };
  const client = {
    from: table => {
      const filters = {};
      let update = null, select = "";
      const query = {
        select: (columns) => { select = columns; state.selects.push({ table, columns }); return query; },
        eq: (key, value) => { filters[key] = value; return query; },
        is: (key, value) => { filters[`is:${key}`] = value; return query; },
        update: values => { update = values; return query; },
        maybeSingle: async () => {
          if (table === "research_runs") return { data: { ...row, notified_at: state.notified_at }, error: null };
          if (table === "founder_profiles") return { data: profile, error: null };
          return { data: null, error: null };
        },
        then: (resolve) => {
          if (table === "opportunities") return resolve({ count: opportunities, error: null });
          if (table === "research_runs" && update) {
            if (update.notified_at === null) { state.notified_at = null; state.releases++; return resolve({ data: null, error: null }); }
            if (filters["is:notified_at"] === null && state.notified_at === null) { state.notified_at = update.notified_at; state.claims++; return resolve({ data: [{ id: "r1" }], error: null }); }
            return resolve({ data: [], error: null });
          }
          return resolve({ data: null, error: null });
        },
      };
      void select;
      return query;
    },
    auth: { admin: { getUserById: async () => ({ data: { user } }) } },
  };
  return { client, state };
}
const production = { SMTP_HOST: "smtp.hostinger.com", SMTP_USER: "notifications@smartmango.ai", SMTP_PASSWORD: "test-only", VERCEL_ENV: "production", SITE_URL: "https://venturelens.example" };
const ctx = { runId: "r1", userId: "u1" };
function recorder(fail = 0) {
  const sent = [];
  return { sent, provider: { send: async message => { if (fail-- > 0) throw new Error("EMAIL_PROVIDER_503"); sent.push(message); } } };
}

test("exactly one email per finished run, however often the step runs", async () => {
  const { notifyRunFinished } = loadNotify();
  const { client, state } = fakeDb();
  const { sent, provider } = recorder();
  assert.equal(await notifyRunFinished(ctx, { env: production, client, provider }), "sent");
  assert.equal(await notifyRunFinished(ctx, { env: production, client, provider }), "already-notified");
  assert.equal(sent.length, 1);
  assert.equal(state.claims, 1);
  assert.deepEqual([sent[0].to, sent[0].idempotencyKey], ["founder@example.com", "run-finished-r1"]);
  assert.match(sent[0].subject, /Your VentureLens report is ready: Clinic research/);
  assert.match(sent[0].text, /2 opportunities passed/);
});

test("the email carries no profile, brief or report text: only the run's name is read from the brief", async () => {
  const { notifyRunFinished } = loadNotify();
  const { client, state } = fakeDb({ run: { context: "SECRET-CONTEXT", report: { summary: "SECRET-REPORT" } } });
  const { sent, provider } = recorder();
  await notifyRunFinished(ctx, { env: production, client, provider });
  const runRead = state.selects.find(s => s.table === "research_runs").columns;
  assert.doesNotMatch(runRead, /report|context|profile|configuration(?!->brief->>(name|discovery_mode|language))/, "only the name, mode and language are read from the brief");
  assert.deepEqual(state.selects.filter(s => s.table === "founder_profiles").map(s => s.columns), ["notify_on_complete"], "only the preference is read from the profile");
  assert.doesNotMatch(JSON.stringify(sent), /SECRET/);
});

test("no email when the founder turned it off, the run was interrupted, or the address is unconfirmed", async () => {
  const { notifyRunFinished } = loadNotify();
  for (const [setup, expected] of [
    [{ profile: { notify_on_complete: false } }, "opted-out"],
    [{ run: { status: "failed", error_code: "WORKFLOW_INTERRUPTED" } }, "not-final"],
    [{ run: { status: "running" } }, "not-final"],
    [{ user: { email: "x@example.com", email_confirmed_at: null } }, "no-recipient"],
  ]) {
    const { client, state } = fakeDb(setup);
    const { sent, provider } = recorder();
    assert.equal(await notifyRunFinished(ctx, { env: production, client, provider }), expected);
    assert.deepEqual([sent.length, state.claims], [0, 0], expected);
  }
  const { client, state } = fakeDb();
  assert.equal(await notifyRunFinished(ctx, { env: {}, client }), "off", "no key: nothing is read or claimed");
  assert.equal(state.selects.length, 0);
  assert.equal(await notifyRunFinished(ctx, { env: { SMTP_HOST: "smtp.hostinger.com", SMTP_USER: "notifications@smartmango.ai", SMTP_PASSWORD: "test-only", VERCEL_ENV: "production" }, client }), "no-site-url");
});

test("dry run logs the subject but never the address or body; a failed send is released for the step's retry", async () => {
  const { notifyRunFinished, dryRunProvider, smtpProvider } = loadNotify();
  const logged = [];
  const { client } = fakeDb();
  assert.equal(await notifyRunFinished(ctx, { env: { NOTIFY_DRY_RUN: "1", SITE_URL: "http://localhost:3000" }, client, provider: dryRunProvider((line, details) => logged.push({ line, details })) }), "dry-run");
  assert.equal(logged.length, 1);
  assert.doesNotMatch(JSON.stringify(logged), /founder@|opportunities passed/);
  assert.equal(logged[0].details.recipientDomain, "example.com");

  const failing = fakeDb();
  const once = recorder(1);
  await assert.rejects(notifyRunFinished(ctx, { env: production, client: failing.client, provider: once.provider }), /EMAIL_PROVIDER_503/);
  assert.deepEqual([failing.state.claims, failing.state.releases, failing.state.notified_at], [1, 1, null], "the claim is released");
  assert.equal(await notifyRunFinished(ctx, { env: production, client: failing.client, provider: once.provider }), "sent", "the retry sends");
  assert.equal(once.sent.length, 1);

  // SMTP: TLS on 465 with the mailbox login, sent as the mailbox, replies to support, and one fixed Message-ID per run.
  const transports = [], mails = [];
  const config = core.smtpConfig({ SMTP_HOST: "smtp.hostinger.com", SMTP_USER: "notifications@smartmango.ai", SMTP_PASSWORD: "test-only" });
  await smtpProvider(config, options => { transports.push(options); return { sendMail: async mail => { mails.push(mail); } }; })
    .send({ to: "a@example.com", subject: "s", html: "<p>h</p>", text: "t", idempotencyKey: "run-finished-r1" });
  assert.deepEqual([transports[0].host, transports[0].port, transports[0].secure, transports[0].auth], ["smtp.hostinger.com", 465, true, { user: "notifications@smartmango.ai", pass: "test-only" }]);
  assert.ok(transports[0].connectionTimeout && transports[0].socketTimeout, "a stuck server cannot hold the step");
  assert.deepEqual(mails[0], { from: "VentureLens <notifications@smartmango.ai>", to: "a@example.com", replyTo: "support@smartmango.ai", subject: "s", html: "<p>h</p>", text: "t", messageId: "<run-finished-r1@smartmango.ai>" });
  // A refusal becomes a short code: the server's reply, which can echo the address, is never passed on.
  const refusal = Object.assign(new Error("550 a@example.com: mailbox unavailable"), { responseCode: 550 });
  await assert.rejects(smtpProvider(config, () => ({ sendMail: async () => { throw refusal; } })).send({ to: "a@example.com", subject: "", html: "", text: "", idempotencyKey: "x" }),
    error => error.message === "EMAIL_PROVIDER_550");
});

test("the workflow emails after the run is saved, from its own step, and a failed email never fails the run", () => {
  const source = readFileSync(new URL("../workflows/research.ts", import.meta.url), "utf8");
  const workflow = source.slice(source.indexOf("export async function researchWorkflow"));
  assert.ok(workflow.indexOf("await recordFailure") < workflow.indexOf("await notify(ctx)"), "after success or failure is recorded");
  assert.match(workflow, /try \{\s*await notify\(ctx\);\s*\} catch/);
  assert.match(source, /async function notify\(ctx: Context\) \{\s*"use step";/);
  assert.match(source, /notify\.maxRetries = 1;/);
});

test("progress helpers: retrieval count, recent-run estimate and polling back-off", () => {
  const steps = [{ stage_key: "discovery" }, { stage_key: "retrieval:c1" }, { stage_key: "retrieval:c2" }, { stage_key: "retrieval:c2" }];
  assert.deepEqual(progress.retrievalProgress(steps, 8), { done: 2, total: 8 });
  assert.deepEqual(progress.retrievalProgress(steps, null), { done: 2, total: null });
  const run = minutes => ({ started_at: "2026-11-10T10:00:00Z", completed_at: new Date(Date.parse("2026-11-10T10:00:00Z") + minutes * 60_000).toISOString() });
  assert.equal(progress.estimateMinutes([run(4), run(6), run(5), run(9)]), null, "too few runs to say");
  assert.equal(progress.estimateMinutes([run(4), run(6), run(5), run(9), run(7)]), 6);
  assert.equal(progress.estimateMinutes([run(0.2), run(0.2), run(0.2), run(0.2), run(0.2)]), 1, "at least a minute");
  assert.deepEqual(progress.progressSource({ title: "  A   title ", url: "https://www.news.example.co.uk/a" }), { title: "A title", domain: "example.co.uk" });
  assert.deepEqual(progress.progressSource({ title: "x", url: "javascript:alert(1)" }), { title: "x", domain: null });
  const start = "2026-11-10T10:00:00Z", at = seconds => Date.parse(start) + seconds * 1000;
  assert.deepEqual([progress.pollInterval(start, at(30)), progress.pollInterval(start, at(300)), progress.pollInterval(start, at(900))], [3000, 5000, 10000]);
});

// The run page with its UI dependencies replaced and copy passed through untranslated.
let swrOptions = null;
function runView(data, props = {}) {
  const copy = (text, values = {}) => text.replace(/\{count, plural, one \{# ([^}]*)\} other \{# ([^}]*)\}\}/, (_m, one, other) => `${values.count} ${values.count === 1 ? one : other}`).replace(/\{(\w+)\}/g, (_m, key) => values[key] ?? key);
  const { ResearchRunView } = load("../components/research-run.tsx", {
    "@/components/report-feedback": { ReportRating: () => null }, "@/lib/research-progress": progress,
    "next/link": { default: ({ children, ...p }) => createElement("a", p, children) },
    "swr": { default: (_key, _fetcher, options) => { swrOptions = options; return { data, mutate: async () => undefined }; } },
    "@/components/ui/button": { Button: ({ asChild, children, ...p }) => asChild ? cloneElement(children, p) : createElement("button", p, children) },
    "@/components/shared": { PageHeader: ({ title }) => createElement("h1", null, title) },
    "@/components/demo-provider": { useDemo: () => ({ refresh: async () => undefined }) },
    "@/components/research-report": { ResearchReportView: () => null }, "@/components/research-outcome": { ResearchOutcomeView: () => null },
    "@/components/model-tag": { ModelTag: () => null }, "@/lib/research-core": require("../lib/research-core.ts"), "@/lib/research-models": { researchModels: {} },
    "@/i18n/use-copy": { useCopy: () => copy, useFormats: () => ({ usd: v => `$${v}`, number: String, date: String }) },
    "@/i18n/errors": { feedbackSource: (_c, f) => f }, "@/lib/api-client": {},
  });
  return renderToStaticMarkup(createElement(ResearchRunView, { initialData: data, ...props })).replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
}
const running = (overrides = {}) => ({
  id: "r1", status: "running", stage: "retrieval", error_code: null, retry_count: 0, model: { provider: null, model: null, planned: true, used: [] },
  configuration: { brief: { name: "Clinic research", discovery_mode: "combined" } }, report: null, created_at: "2026-11-10T10:00:00Z", completed_at: null,
  steps: [{ stage_key: "discovery", created_at: "x" }, { stage_key: "retrieval:c1", created_at: "x" }, { stage_key: "retrieval:c2", created_at: "x" }],
  usage: { estimated_usd: 0, committed_usd: 0, uncertain_calls: 0, input_tokens: 0, output_tokens: 0, search_requests: 0, budget_usd: 0.25 },
  progress: { candidates: 8, sources: [{ title: "Forum thread on no-shows", domain: "physio-forum.org" }, { title: "Survey", domain: null }], sourceCount: 14, estimateMinutes: 6 },
  ...overrides,
});

test("the run page shows per-candidate progress, the latest sources and an estimate, and promises email only when it will be sent", () => {
  const page = runView(running(), { emailOnFinish: true });
  assert.match(page, /Searching 3 of 8 candidates…/);
  assert.match(page, /14 sources found so far Forum thread on no-shows physio-forum\.org Survey/);
  assert.match(page, /Showing the latest 2\. Every source is listed in the report\./);
  assert.match(page, /Runs like this usually take about 6 minutes\. You can leave this page\. We'll email you when it's ready\./);
  const noEmail = runView(running({ progress: { candidates: null, sources: [], sourceCount: 0, estimateMinutes: null } }));
  assert.match(noEmail, /A full run usually takes 5–10 minutes\. You can leave this page; progress is saved on the server\./, "fallback estimate, no email promise");
  assert.doesNotMatch(noEmail, /Searching \d|found so far/, "nothing to count before discovery has finished");
  const verify = runView(running({ stage: "review", configuration: { brief: { name: "Idea", discovery_mode: "verify" } }, progress: undefined }));
  assert.match(verify, /Running an adversarial critique that can reject your idea or deduct points\. A check usually takes about 2–3 minutes/);
  const done = runView(running({ status: "completed", stage: "completed", progress: undefined }), { emailOnFinish: true });
  assert.doesNotMatch(done, /email you|found so far/);
});

test("the profile toggle shows the founder's choice and saves it; the demo has none", async () => {
  const calls = [];
  const settings = enabled => load("../components/notification-settings.tsx", {
    "@/i18n/use-copy": { useCopy: () => (text, values = {}) => text.replace(/\{(\w+)\}/g, (_m, key) => values[key] ?? key) },
    "@/components/demo-provider": { useDemo: () => ({ data: enabled === "demo" ? null : { email: "founder@example.com", notifyOnComplete: enabled }, isDemo: enabled === "demo", busy: false, setNotify: async value => calls.push(value) }) },
    "sonner": { toast: { success() {}, error() {} } },
  }).NotificationSettings;
  const on = renderToStaticMarkup(createElement(settings(true)));
  assert.match(on, /role="switch"[^>]*checked=""|checked=""[^>]*role="switch"/);
  assert.match(on, /Email me when my research is ready/);
  assert.match(on, /sent to founder@example\.com/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(settings(false))), /checked=""/);
  assert.equal(renderToStaticMarkup(createElement(settings("demo"))), "");
  assert.equal(renderToStaticMarkup(createElement(settings(undefined))).includes('checked=""'), true, "on when the preference could not be read");
});

test("the run page polls from its first render, slows down for long runs, and stops once the run has finished", () => {
  const created = new Date(Date.now() - 30_000).toISOString();
  runView(running({ created_at: created }));
  // SWR asks with an empty cache until the first fetch; the server-rendered run must start polling by itself.
  assert.equal(swrOptions.refreshInterval(undefined), 3000);
  assert.equal(swrOptions.refreshInterval(running({ created_at: new Date(Date.now() - 900_000).toISOString() })), 10000);
  assert.equal(swrOptions.refreshInterval(running({ status: "completed" })), 0);
  runView(running({ status: "failed", stage: "retrieval" }));
  assert.equal(swrOptions.refreshInterval(undefined), 0, "a finished run never polls");
});
