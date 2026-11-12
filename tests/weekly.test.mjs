import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as core from "../lib/weekly-core.ts";
import * as notifyCore from "../lib/notify-core.ts";
import * as i18nConfig from "../i18n/config.ts";
import { messageKey } from "../i18n/config.ts";

const require = createRequire(import.meta.url);
const { weekKey, linkSecret, unsubscribeToken, verifyUnsubscribeToken, pickWeeklyTask, buildWeeklyEmail, weeklyMax, MIN_SPRINT_AGE_DAYS } = core;
const catalog = locale => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
const USER = "5f0c8a9e-1f6b-4f8e-9a77-1f2d3c4b5a69";
const SECRET = "a-test-secret-of-enough-length";

test("each week is keyed by its Monday in UTC", () => {
  assert.equal(weekKey(new Date("2026-11-16T00:00:00Z")), "2026-11-16");
  assert.equal(weekKey(new Date("2026-11-22T23:59:59Z")), "2026-11-16");
  assert.equal(weekKey(new Date("2026-11-23T00:00:00Z")), "2026-11-23");
});

test("opt-out links are signed per founder, and a wrong, altered or unsigned link does nothing", () => {
  assert.equal(linkSecret({}), null);
  assert.equal(linkSecret({ CRON_SECRET: "short" }), null, "a short secret is not used");
  assert.equal(linkSecret({ CRON_SECRET: SECRET }), SECRET);
  assert.equal(linkSecret({ NOTIFY_LINK_SECRET: "another-secret-long-enough", CRON_SECRET: SECRET }), "another-secret-long-enough");
  const token = unsubscribeToken(SECRET, USER);
  assert.ok(verifyUnsubscribeToken(SECRET, USER, token));
  assert.equal(verifyUnsubscribeToken(SECRET, "6f0c8a9e-1f6b-4f8e-9a77-1f2d3c4b5a69", token), false, "another founder");
  assert.equal(verifyUnsubscribeToken(SECRET, USER, `${token.slice(0, -1)}x`), false, "altered");
  assert.equal(verifyUnsubscribeToken("a-different-secret-entirely", USER, token), false, "another deployment's secret");
  assert.equal(verifyUnsubscribeToken(null, USER, token), false, "no secret configured");
  assert.equal(verifyUnsubscribeToken(SECRET, "not-a-uuid", token), false);
  assert.equal(verifyUnsubscribeToken(SECRET, USER, undefined), false);
});

const sprint = (id, started_on, tasks, length_days = 14) => ({ id, opportunity_id: `o-${id}`, length_days, started_on, tasks });
const task = (title, due_on, done = false, position = 0) => ({ title, detail: "", due_on, done_at: done ? "2026-11-10T00:00:00Z" : null, position });

test("the email names the next open task of the sprint whose next task is due soonest", () => {
  const today = "2026-11-16";
  const pick = pickWeeklyTask([
    sprint("a", "2026-11-05", [task("Done already", "2026-11-08", true), task("A next", "2026-11-20", false, 1)]),
    sprint("b", "2026-11-10", [task("B next", "2026-11-18")]),
  ], today);
  assert.equal(pick.task.title, "B next");
  assert.deepEqual([pick.sprint.id, pick.day, pick.done, pick.total], ["b", 7, 0, 1]);
  assert.equal("tasks" in pick.sprint, false);
});

test("no email for a sprint started in the last few days, or one with every task done", () => {
  const today = "2026-11-16";
  assert.equal(pickWeeklyTask([sprint("new", "2026-11-14", [task("Fresh", "2026-11-20")])], today), null, `day ${MIN_SPRINT_AGE_DAYS} or less`);
  assert.equal(pickWeeklyTask([sprint("done", "2026-11-01", [task("All done", "2026-11-05", true)])], today), null);
  assert.ok(pickWeeklyTask([sprint("old", "2026-11-12", [task("Undated", null)])], today), "day 5 qualifies; an undated task still counts");
});

test("the email names one task, its details and due date, asks for a time, and links to stop", () => {
  const t = (text, values = {}) => text.replace(/\{(\w+)\}/g, (_m, key) => values[key] ?? key);
  const email = buildWeeklyEmail({
    opportunity: "Clinic <b>scheduling</b>", task: { title: "Ask five owners", detail: "Where: Clinic forum\nDone when: 5 held\n\nStop if: none", due_on: "2026-11-20" },
    day: 5, length: 14, done: 1, total: 3, sprintUrl: "https://venturelens.example/opportunities/o1?tab=validation",
    unsubscribeUrl: "https://venturelens.example/unsubscribe?u=u1&t=abc", lang: "en", formatDate: day => `[${day}]`,
  }, t);
  assert.equal(email.subject, "Your one step this week: Clinic <b>scheduling</b>");
  assert.match(email.html, /Clinic &lt;b&gt;scheduling&lt;\/b&gt;/, "text is escaped in HTML");
  assert.doesNotMatch(email.html, /<b>scheduling/);
  assert.match(email.text, /Day 5 of 14 · 1 of 3 tasks done\n\nAsk five owners\nWhere: Clinic forum\nDone when: 5 held\nStop if: none\nDue \[2026-11-20\]\n\nPick a day and time for it now\./);
  assert.match(email.text, /Open your sprint: https:\/\/venturelens\.example\/opportunities\/o1\?tab=validation/);
  assert.match(email.text, /Stop weekly emails: https:\/\/venturelens\.example\/unsubscribe\?u=u1&t=abc$/);
  assert.match(email.html, /href="https:\/\/venturelens\.example\/unsubscribe\?u=u1&amp;t=abc"/);
  assert.doesNotMatch(email.text, /streak|badge|you missed/i, "no streaks or guilt");
});

test("every fixed line of the email is translated in both Chinese catalogues", () => {
  const source = readFileSync(new URL("../lib/weekly-core.ts", import.meta.url), "utf8");
  const lines = [...source.matchAll(/\bt\("([^"]+)"/g)].map(([, text]) => text);
  assert.ok(lines.length >= 8);
  for (const locale of ["en", "zh-Hans", "zh-Hant"]) {
    const ui = catalog(locale).ui;
    for (const line of lines) assert.ok(ui[messageKey(line)], `${locale}: ${line}`);
  }
});

test("the per-run cap defaults to 100 and accepts only sensible values", () => {
  assert.equal(weeklyMax({}), 100);
  assert.equal(weeklyMax({ NOTIFY_WEEKLY_MAX: "25" }), 25);
  assert.equal(weeklyMax({ NOTIFY_WEEKLY_MAX: "0" }), 100);
  assert.equal(weeklyMax({ NOTIFY_WEEKLY_MAX: "abc" }), 100);
});

// --- The job itself, against an in-memory database -----------------------------------------------------------------
function load(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
  const module = { exports: {} };
  new Function("require", "exports", "module", outputText)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module.exports, module);
  return module.exports;
}
const tracked = [];
function loadWeekly() {
  const notify = load("../lib/notify.ts", {
    "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => { throw new Error("use deps.client"); } },
    "@/i18n/config": i18nConfig, "@/lib/notify-core": notifyCore,
    "nodemailer": { default: { createTransport: () => { throw new Error("tests pass their own provider"); } } },
    "@/messages/en.json": { default: catalog("en") }, "@/messages/zh-Hans.json": { default: catalog("zh-Hans") }, "@/messages/zh-Hant.json": { default: catalog("zh-Hant") },
  });
  return load("../lib/weekly.ts", {
    "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => { throw new Error("use deps.client"); } },
    "@/i18n/config": i18nConfig, "@/lib/notify-core": notifyCore, "@/lib/notify": notify, "@/lib/weekly-core": core,
    "@/lib/events": { track: async (event, options) => { tracked.push({ event, ...options }); } },
  });
}
/** A tiny stand-in for the Supabase client: filters (eq, in, gte), range, upsert with ignoreDuplicates, delete, update. */
function memoryDb(tables, users) {
  const client = {
    from(name) {
      const rows = tables[name] ??= [];
      const filters = [];
      let action = "select", payload = null, options = {};
      const matches = row => filters.every(f => f(row));
      const query = {
        select: () => query, order: () => query,
        eq: (key, value) => { filters.push(row => row[key] === value); return query; },
        in: (key, values) => { filters.push(row => values.includes(row[key])); return query; },
        range: (from, to) => { query.page = [from, to]; return query; },
        upsert: (value, opts) => { action = "upsert"; payload = value; options = opts; return query; },
        update: value => { action = "update"; payload = value; return query; },
        delete: () => { action = "delete"; return query; },
        then(resolve) {
          if (action === "upsert") {
            const exists = rows.some(row => row.user_id === payload.user_id && row.week === payload.week);
            if (exists && options.ignoreDuplicates) return resolve({ data: [], error: null });
            rows.push({ ...payload });
            return resolve({ data: [{ user_id: payload.user_id }], error: null });
          }
          if (action === "delete") { tables[name] = rows.filter(row => !matches(row)); return resolve({ data: null, error: null }); }
          if (action === "update") { rows.filter(matches).forEach(row => Object.assign(row, payload)); return resolve({ data: null, error: null }); }
          const found = rows.filter(matches).map(row => (name === "research_runs" ? { id: row.id, language: row.configuration?.brief?.language ?? null } : row));
          return resolve({ data: query.page ? found.slice(query.page[0], query.page[1] + 1) : found, error: null });
        },
      };
      return query;
    },
    auth: { admin: { getUserById: async id => ({ data: { user: users[id] ?? null } }) } },
  };
  return client;
}
const production = { SMTP_HOST: "smtp.example", SMTP_USER: "notifications@venturelens.example", SMTP_PASSWORD: "x", VERCEL_ENV: "production", SITE_URL: "https://venturelens.example", CRON_SECRET: SECRET };
const now = new Date("2026-11-16T01:23:00Z"); // a Monday
function world() {
  const founder = (id, extra = {}) => ({ id, email: `${id}@example.com`, email_confirmed_at: "2026-11-01", ...extra });
  const users = { [USER]: founder(USER), off: founder("off"), young: founder("young"), unconfirmed: founder("unconfirmed", { email_confirmed_at: null }) };
  const tables = {
    validation_sprints: [
      { id: "s1", user_id: USER, opportunity_id: "o1", length_days: 14, started_on: "2026-11-10", status: "active" },
      { id: "s2", user_id: "off", opportunity_id: "o2", length_days: 14, started_on: "2026-11-01", status: "active" },
      { id: "s3", user_id: "young", opportunity_id: "o3", length_days: 7, started_on: "2026-11-15", status: "active" },
      { id: "s4", user_id: "unconfirmed", opportunity_id: "o4", length_days: 14, started_on: "2026-11-02", status: "active" },
    ],
    validation_tasks: ["s1", "s2", "s3", "s4"].map(id => ({ sprint_id: id, title: `Next step of ${id}`, detail: "Done when: 3 replies", due_on: "2026-11-20", done_at: null, position: 0 })),
    founder_profiles: [{ user_id: USER, notify_weekly: true }, { user_id: "off", notify_weekly: false }],
    weekly_emails: [],
    opportunities: [{ id: "o1", title: "Clinic scheduling", run_id: "r1" }, { id: "o4", title: "Other", run_id: "r1" }],
    research_runs: [{ id: "r1", configuration: { brief: { language: "zh-Hant" } } }],
  };
  return { tables, client: memoryDb(tables, users) };
}
const recorder = (fail = 0) => {
  const sent = [];
  return { sent, provider: { send: async message => { if (fail-- > 0) throw new Error("EMAIL_PROVIDER_503"); sent.push(message); } } };
};

test("one email per founder per week, to confirmed founders who kept it on, in the report's language, with one-click opt-out", async () => {
  const { sendWeeklyEmails } = loadWeekly();
  const { tables, client } = world();
  const { sent, provider } = recorder();
  tracked.length = 0;
  const first = await sendWeeklyEmails({ env: production, client, provider, now });
  assert.deepEqual(first, { mode: "send", eligible: 3, sent: 1, skipped: 2, failed: 0, deferred: 0 }, "opted out and unconfirmed are skipped; the 1-day-old sprint is not eligible");
  assert.equal(sent.length, 1);
  const [email] = sent;
  assert.equal(email.to, `${USER}@example.com`);
  assert.equal(email.idempotencyKey, `weekly-2026-11-16-${USER}`);
  assert.match(email.subject, /^你本週的一步: Clinic scheduling$/, "the report's language");
  assert.match(email.text, /Next step of s1/);
  assert.match(email.text, new RegExp(`https://venturelens\\.example/unsubscribe\\?u=${USER}&t=${unsubscribeToken(SECRET, USER)}`));
  assert.equal(email.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(email.headers["List-Unsubscribe"], /^<https:\/\/venturelens\.example\/api\/notifications\/unsubscribe\?u=.+&t=.+>$/);
  assert.deepEqual(tables.weekly_emails.map(row => [row.user_id, row.week]), [[USER, "2026-11-16"]]);
  assert.deepEqual(tracked.map(e => e.event), ["weekly_email_sent"]);

  const again = await sendWeeklyEmails({ env: production, client, provider, now: new Date("2026-11-18T01:23:00Z") });
  assert.equal(again.sent, 1, "Wednesday: only the sprint that has just become old enough gets its first email");
  assert.equal(sent[1].to, "young@example.com");
  assert.equal(sent.filter(message => message.to === `${USER}@example.com`).length, 1, "nobody gets a second email in one week");
  const nextWeek = await sendWeeklyEmails({ env: production, client, provider, now: new Date("2026-11-23T01:23:00Z") });
  assert.equal(nextWeek.sent, 2, "next week: the founder again, and the sprint that is now old enough");
});

test("a failed send releases the week, so the next run retries; the cap defers the rest to the next run", async () => {
  const { sendWeeklyEmails } = loadWeekly();
  const { tables, client } = world();
  const failing = recorder(1);
  const failed = await sendWeeklyEmails({ env: production, client, provider: failing.provider, now });
  assert.deepEqual([failed.sent, failed.failed], [0, 1]);
  assert.deepEqual(tables.weekly_emails, [], "the claim is released");
  const retried = await sendWeeklyEmails({ env: production, client, provider: failing.provider, now });
  assert.equal(retried.sent, 1);

  const capped = world();
  tables.founder_profiles = [];
  capped.tables.founder_profiles = [];
  const limited = await sendWeeklyEmails({ env: { ...production, NOTIFY_WEEKLY_MAX: "1" }, client: capped.client, provider: recorder().provider, now });
  assert.deepEqual([limited.eligible, limited.sent, limited.deferred], [3, 1, 2], "founders with no saved choice are on by default; over the cap waits for the next run");
});

test("without a link secret the email links to the profile page and carries no one-click header; off without SMTP", async () => {
  const { sendWeeklyEmails } = loadWeekly();
  const { client } = world();
  const { sent, provider } = recorder();
  const { CRON_SECRET: _secret, ...unsigned } = production;
  await sendWeeklyEmails({ env: unsigned, client, provider, now });
  assert.match(sent[0].text, /: https:\/\/venturelens\.example\/profile$/);
  assert.doesNotMatch(sent[0].text, /unsubscribe\?u=/);
  assert.equal(sent[0].headers, undefined);
  assert.equal((await sendWeeklyEmails({ env: {}, client, provider, now })).mode, "off");
});

test("the opt-out only changes anything on POST, turns off weekly emails only, and the cron needs its secret", () => {
  const route = readFileSync(new URL("../app/api/notifications/unsubscribe/route.ts", import.meta.url), "utf8");
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /export async function GET/, "a link scanner's GET changes nothing");
  assert.match(route, /verifyUnsubscribeToken\(linkSecret\(/);
  const weekly = readFileSync(new URL("../lib/weekly.ts", import.meta.url), "utf8");
  assert.match(weekly, /update\(\{ notify_weekly: false \}\)\.eq\("user_id", userId\)/);
  assert.doesNotMatch(weekly, /notify_on_complete/, "report-ready emails are a separate choice");
  assert.match(readFileSync(new URL("../app/unsubscribe/page.tsx", import.meta.url), "utf8"), /verifyUnsubscribeToken/);
  assert.match(readFileSync(new URL("../app/api/cron/weekly-progress/route.ts", import.meta.url), "utf8"), /cronAuthorized\(request\.headers\.get\("authorization"\), process\.env\.CRON_SECRET\)/);
  const crons = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")).crons;
  assert.ok(crons.some(cron => cron.path === "/api/cron/weekly-progress" && /^\d+ \d+ \* \* \*$/.test(cron.schedule)), "runs daily");
});
