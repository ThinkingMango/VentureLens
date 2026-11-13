import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import * as core from "../lib/sprint-core.ts";
import { messageKey, locales } from "../i18n/config.ts";

const require = createRequire(import.meta.url);
const { spreadDueDates, addDays, sprintDay, sprintProgress, nextTasks, isOverdue, moveTask, sprintRequestSchema, toSprint, demoSprint, summarizeSprint } = core;
function load(file, dependencies) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  new Function("require", "exports", "module", outputText)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module.exports, module);
  return module.exports;
}
const ID = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("due dates spread evenly, the last on the sprint's last day, matching the database", () => {
  // The same cases the SQL test checks against start_validation_sprint.
  assert.deepEqual(spreadDueDates(6, 14, "2026-11-11").map(day => (Date.parse(day) - Date.parse("2026-11-11")) / 86_400_000), [2, 5, 7, 9, 12, 14]);
  assert.deepEqual(spreadDueDates(4, 7, "2026-11-11").map(day => (Date.parse(day) - Date.parse("2026-11-11")) / 86_400_000), [2, 4, 5, 7]);
  assert.deepEqual(spreadDueDates(40, 7, "2026-11-11").slice(0, 3), ["2026-11-12", "2026-11-12", "2026-11-12"], "never before day 1");
  assert.equal(spreadDueDates(1, 30, "2026-12-15")[0], "2027-01-14", "across a year end");
  assert.deepEqual(spreadDueDates(0, 14, "2026-11-11"), []);
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
});

test("sprint helpers: the day, progress, next tasks, overdue and moving a task", () => {
  const sprint = { started_on: "2026-11-01", length_days: 14 };
  assert.deepEqual([sprintDay(sprint, "2026-10-30"), sprintDay(sprint, "2026-11-01"), sprintDay(sprint, "2026-11-04"), sprintDay(sprint, "2026-12-30")], [0, 1, 4, 14]);
  const tasks = [
    { id: "a", due_on: "2026-11-05", done_at: "x", position: 0 },
    { id: "b", due_on: null, done_at: null, position: 1 },
    { id: "c", due_on: "2026-11-09", done_at: null, position: 2 },
    { id: "d", due_on: "2026-11-03", done_at: null, position: 3 },
    { id: "e", due_on: "2026-11-09", done_at: null, position: 4 },
  ];
  assert.deepEqual(sprintProgress(tasks), { done: 1, total: 5, ratio: 0.2 });
  assert.deepEqual(nextTasks(tasks).map(t => t.id), ["d", "c", "e"], "soonest due first, ties in list order, undated last");
  assert.deepEqual([isOverdue(tasks[3], "2026-11-04"), isOverdue(tasks[0], "2026-11-30"), isOverdue(tasks[1], "2030-01-01")], [true, false, false]);
  assert.deepEqual(moveTask(tasks, "c", "up"), ["a", "c", "b", "d", "e"]);
  assert.deepEqual(moveTask(tasks, "e", "down"), null, "the last task cannot move down");
  assert.deepEqual(moveTask(tasks, "a", "up"), null);
});

test("sprint requests are strict: fixed lengths and decisions, bounded text, real dates", () => {
  const ok = (body) => sprintRequestSchema.safeParse(body).success;
  assert.ok(ok({ action: "start", opportunity_id: ID(1), length: 14, checklist: ["a", "b"] }));
  assert.ok(!ok({ action: "start", opportunity_id: ID(1), length: 10 }));
  assert.ok(!ok({ action: "start", opportunity_id: ID(1), length: 7, checklist: ["a", "b", "c", "d", "e"] }), "at most the four first steps");
  assert.ok(ok({ action: "decide", sprint_id: ID(1), decision: "park" }));
  assert.ok(!ok({ action: "decide", sprint_id: ID(1), decision: "maybe" }));
  assert.ok(!ok({ action: "add_task", sprint_id: ID(1), title: "  " }), "a task needs a title");
  assert.ok(!ok({ action: "add_task", sprint_id: ID(1), title: "x".repeat(301) }));
  assert.ok(!ok({ action: "add_task", sprint_id: ID(1), title: "x", due_on: "2026-02-30x" }));
  assert.ok(ok({ action: "add_task", sprint_id: ID(1), title: "Call five clinics", due_on: "2026-11-20" }));
  assert.ok(!ok({ action: "criteria", sprint_id: ID(1), go_criteria: "x".repeat(1001) }));
  assert.ok(!ok({ action: "toggle_task", task_id: ID(1), done: true, user_id: ID(2) }), "no extra fields");
  assert.ok(!ok({ action: "reorder", sprint_id: ID(1), task_ids: [] }));
});

test("stored rows read back safely, and the demo sprint and dashboard summary agree", () => {
  const sprint = toSprint({ id: "s", opportunity_id: "o", length_days: 30, started_on: "2026-11-01T00:00:00Z", go_criteria: null, status: "weird", decision: "keep" },
    [{ id: "t2", title: "B", position: 2, origin: "user", due_on: "2026-11-08" }, { id: "t1", title: "A", position: 1, origin: "x", done_at: "2026-11-02T10:00:00Z" }]);
  assert.deepEqual([sprint.length_days, sprint.started_on, sprint.go_criteria, sprint.status, sprint.decision], [30, "2026-11-01", "", "active", "keep"]);
  assert.deepEqual(sprint.tasks.map(t => [t.id, t.origin, t.due_on]), [["t1", "report", null], ["t2", "user", "2026-11-08"]]);
  const demo = demoSprint("o1", ["One", "Two", "Three", "Four", "Five"], "criteria", new Date("2026-11-11T12:00:00Z"));
  assert.deepEqual([demo.started_on, demo.length_days, demo.status, sprintProgress(demo.tasks).done], ["2026-11-08", 14, "active", 2]);
  assert.equal(demo.tasks.at(-1).due_on, "2026-11-22", "the last task is due on the last day");
  const summary = summarizeSprint(demo, "Proposal copilot");
  assert.deepEqual([summary.opportunityTitle, summary.done, summary.total, summary.next.map(t => t.title)], ["Proposal copilot", 2, 5, ["Three", "Four", "Five"]]);
});

// The API route, with the session client and the event recorder replaced.
function route({ user = { id: "u1" }, sprintStatus = "active", taskSprint = ID(9), rpc = { data: ID(9), error: null }, insertError = null, toggled = [{ id: ID(3) }], tasks = [ID(3), ID(4)] } = {}) {
  const calls = { rpc: [], inserts: [], updates: [], deletes: [], events: [] };
  const from = table => {
    const filters = {};
    let op = "select", values = null;
    const query = {
      select: () => query, order: () => query, limit: () => query, in: () => query,
      eq: (key, value) => { filters[key] = value; return query; },
      is: (key, value) => { filters[`is:${key}`] = value; return query; },
      not: (key) => { filters[`not:${key}`] = true; return query; },
      update: v => { op = "update"; values = v; calls.updates.push({ table, values: v, filters }); return query; },
      delete: () => { op = "delete"; calls.deletes.push({ table, filters }); return query; },
      insert: async row => { calls.inserts.push({ table, row }); return { error: insertError }; },
      maybeSingle: async () => {
        if (table === "validation_sprints") return { data: filters.id === ID(9) || filters.id === taskSprint ? { status: sprintStatus, id: ID(9), opportunity_id: ID(1), length_days: 14, started_on: "2026-11-11" } : null, error: null };
        if (table === "validation_tasks" && filters.id) return { data: taskSprint ? { sprint_id: taskSprint } : null, error: null };
        if (table === "validation_tasks") return { data: { position: 4 }, error: null };
        return { data: null, error: null };
      },
      then: resolve => {
        if (table === "validation_tasks" && op === "update" && values && "done_at" in values) return resolve({ data: toggled, error: null });
        if (table === "validation_tasks" && op === "select") return resolve({ data: tasks.map((id, position) => ({ id, title: "t", position })), error: null });
        return resolve({ data: [], error: null });
      },
    };
    return query;
  };
  const supabase = { auth: { getUser: async () => ({ data: { user } }) }, from, rpc: async (name, args) => { calls.rpc.push({ name, args }); return rpc; } };
  const module = load("../app/api/sprints/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) }, after: fn => fn() },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/sprint-core": core,
    "@/lib/sprints": { readSprint: async () => ({ id: ID(9), tasks: [] }) },
    "@/lib/events": { track: async (event, options) => { calls.events.push({ event, ...options }); } },
  });
  const post = (body, headers = {}) => {
    const all = { origin: "https://app.example.com", host: "app.example.com", "content-type": "application/json", ...headers };
    return module.POST({ headers: { get: name => all[name] ?? null }, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
  };
  return { post, calls };
}

test("starting a sprint calls the seeding function with the page's first steps and records its length", async () => {
  const { post, calls } = route();
  const response = await post({ action: "start", opportunity_id: ID(1), length: 30, checklist: ["Step one", "Step two"] });
  assert.equal(response.status, 200);
  assert.deepEqual(calls.rpc, [{ name: "start_validation_sprint", args: { p_opportunity: ID(1), p_length: 30, p_checklist: ["Step one", "Step two"], p_labels: [] } }]);
  assert.deepEqual(calls.events, [{ event: "sprint_created", userId: "u1", props: { length: 30 } }]);
  assert.deepEqual((await route({ rpc: { data: null, error: { code: "23505" } } }).post({ action: "start", opportunity_id: ID(1), length: 7 })).body.code, "SPRINT_ACTIVE");
  assert.equal((await route({ rpc: { data: null, error: { code: "P0002" } } }).post({ action: "start", opportunity_id: ID(1), length: 7 })).status, 404);
  assert.equal((await route().post({ action: "start", opportunity_id: ID(1), length: 7 }, { origin: "https://evil.example" })).status, 403);
  assert.equal((await route({ user: null }).post({ action: "start", opportunity_id: ID(1), length: 7 })).status, 401);
});

test("tasks change only in an active sprint; ticks and decisions are recorded once, without any text", async () => {
  const tick = route();
  assert.equal((await tick.post({ action: "toggle_task", task_id: ID(3), done: true })).status, 200);
  assert.deepEqual(tick.calls.events, [{ event: "task_completed", userId: "u1", props: { origin: "sprint" } }]);
  const again = route({ toggled: [] });
  await again.post({ action: "toggle_task", task_id: ID(3), done: true });
  assert.equal(again.calls.events.length, 0, "ticking a task that was already done records nothing");
  const untick = route();
  await untick.post({ action: "toggle_task", task_id: ID(3), done: false });
  assert.equal(untick.calls.events.length, 0);

  const decide = route();
  await decide.post({ action: "decide", sprint_id: ID(9), decision: "kill", note: "Nobody would pay" });
  assert.deepEqual(decide.calls.updates[0].values, { status: "completed", decision: "kill", decision_note: "Nobody would pay" });
  assert.deepEqual(decide.calls.events, [{ event: "sprint_decided", userId: "u1", props: { decision: "kill" } }]);

  const closed = route({ sprintStatus: "completed" });
  assert.equal((await closed.post({ action: "add_task", sprint_id: ID(9), title: "Late task" })).body.code, "SPRINT_CLOSED");
  assert.equal((await closed.post({ action: "toggle_task", task_id: ID(3), done: true })).body.code, "SPRINT_CLOSED");
  assert.equal(closed.calls.inserts.length + closed.calls.updates.length, 0);
  assert.equal((await route({ taskSprint: null }).post({ action: "delete_task", task_id: ID(3) })).status, 404, "not the founder's task");

  const add = route();
  await add.post({ action: "add_task", sprint_id: ID(9), title: " Call the association ", due_on: "2026-11-20" });
  assert.deepEqual(add.calls.inserts[0].row, { user_id: "u1", sprint_id: ID(9), title: "Call the association", detail: "", due_on: "2026-11-20", position: 5, origin: "user" });
  const full = route({ insertError: { code: "23514", message: "TOO_MANY_TASKS" } });
  assert.equal((await full.post({ action: "add_task", sprint_id: ID(9), title: "One more" })).body.code, "TOO_MANY_TASKS");

  const reorder = route();
  await reorder.post({ action: "reorder", sprint_id: ID(9), task_ids: [ID(4), ID(3)] });
  assert.deepEqual(reorder.calls.updates.map(u => u.values.position), [0, 1]);
  assert.equal((await route().post({ action: "reorder", sprint_id: ID(9), task_ids: [ID(4), ID(5)] })).status, 400, "the order must list exactly the sprint's tasks");
});

test("the sprint panel and starter render in every language, and finished sprints are read-only", () => {
  for (const locale of locales) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    const t = createTranslator({ locale, messages, namespace: "ui" });
    const missing = [];
    const copy = (source, values) => (messages.ui[messageKey(source)] ? t(messageKey(source), values) : (missing.push(source), source));
    const pass = tag => ({ children, asChild, size, variant, ...props }) => createElement(tag, props, children);
    const { SprintPanel, SprintStarter } = load("../components/validation-sprint.tsx", {
      "@/i18n/use-copy": { useCopy: () => copy, useFormats: () => ({ date: value => value }) }, "@/i18n/errors": { feedbackSource: c => c },
      "@/lib/api-client": { postJson: async () => ({ ok: true, status: 200, body: {} }) }, "@/lib/sprint-core": core,
      "sonner": { toast: { info() {}, error() {}, success() {} } }, "@/components/ui/button": { Button: pass("button") }, "@/lib/utils": { cn: (...c) => c.filter(Boolean).join(" "), progressFill: (p) => ({ transform: `translateX(${p - 100}%)` }) },
      "@/components/demo-provider": { useOptionalWorkspace: () => null },
    });
    const sprint = demoSprint("o1", ["One", "Two", "Three"], "3 of 10 pay");
    const text = html => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const active = renderToStaticMarkup(createElement(SprintPanel, { sprint, send: async () => true, busy: false, demo: false }));
    const done = renderToStaticMarkup(createElement(SprintPanel, { sprint: { ...sprint, status: "completed", decision: "park", decision_note: "Revisit in spring" }, send: async () => true, busy: false, demo: false }));
    const starter = renderToStaticMarkup(createElement(SprintStarter, { onStart() {}, busy: false, previous: { ...sprint, status: "abandoned" } }));
    if (locale === "en") {
      assert.match(text(active), /14-day validation sprint Day 4 of 14 .* 2 of 3 tasks done/);
      assert.equal(active.match(/aria-label="Move up: /g).length, 3, "every task can be reordered, edited and deleted");
      assert.match(active, /aria-label="Delete: Three"/);
      assert.match(text(active), /Go \/ no-go criteria .* Save criteria Decision .* Keep going .* Park it .* Drop it .* Record decision End without a decision/);
      assert.match(active, /<textarea[^>]*placeholder="Example: at least 3 of 10 owners I interview/);
      assert.doesNotMatch(done, /Move up|Record decision|Add a task/, "a finished sprint cannot change");
      assert.match(text(done), /Finished · decision: Park it .* 3 of 10 pay .* Park it Revisit in spring/);
      assert.match(text(starter), /Start a validation sprint .* 7 days 14 days 30 days Start the sprint Your last sprint, started on .* ended without a decision\./);
      assert.match(starter, /value="14" checked=""|checked=""[^>]*value="14"/, "14 days is the default");
    }
    assert.deepEqual(missing, [], locale);
  }
});
