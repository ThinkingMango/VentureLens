import test from "node:test";
import assert from "node:assert/strict";
import { validationFunnel, firstReports, weekStart, FOLLOW_DAYS, stepEvents } from "../lib/validation-funnel.ts";

const DAY = 86_400_000;
const now = new Date("2026-11-30T12:00:00Z");
const ago = days => new Date(now.getTime() - days * DAY).toISOString();
const report = (user, days) => ({ user_id: user, created_at: ago(days) });
const event = (user, step, days) => ({ user_id: user, event: stepEvents[step], created_at: ago(days) });

test("weekStart is the Monday of the week, in UTC", () => {
  assert.equal(weekStart(Date.parse("2026-11-30T12:00:00Z")), "2026-11-30"); // a Monday
  assert.equal(weekStart(Date.parse("2026-11-29T23:59:59Z")), "2026-11-23"); // Sunday belongs to the week before
  assert.equal(weekStart(Date.parse("2026-11-25T00:00:00Z")), "2026-11-23");
});

test("a founder's first report is their earliest completed run; bad times are ignored", () => {
  const first = firstReports([report("a", 3), report("a", 10), report("b", 1), { user_id: "b", created_at: "not a date" }]);
  assert.equal(first.get("a"), Date.parse(ago(10)));
  assert.equal(first.get("b"), Date.parse(ago(1)));
});

test("an empty window has no founders and no rates", () => {
  const funnel = validationFunnel({ reports: [], events: [], days: 30, now });
  assert.equal(funnel.founders, 0);
  assert.deepEqual(funnel.steps, { viewed: 0, sprint: 0, task: 0, evidence: 0, decision: 0 });
  assert.equal(funnel.actionRate.rate, null);
  assert.equal(funnel.medianDaysToFirstTask, null);
  assert.deepEqual(funnel.weeks, []);
});

test("the cohort is founders whose FIRST report is in the window; earlier founders with a new report are not new", () => {
  const funnel = validationFunnel({ reports: [report("new", 5), report("old", 50), report("old", 2)], events: [], days: 30, now });
  assert.equal(funnel.founders, 1);
});

test("steps count founders, once each, only within 30 days after the first report", () => {
  const reports = [report("a", 20)];
  const events = [
    event("a", "viewed", 20), event("a", "viewed", 19), // two views: one founder
    event("a", "sprint", 19), event("a", "task", 15), event("a", "task", 14),
    event("a", "decision", 21), // before the report: does not count
  ];
  const funnel = validationFunnel({ reports, events, days: 30, now });
  assert.deepEqual(funnel.steps, { viewed: 1, sprint: 1, task: 1, evidence: 0, decision: 0 });
  assert.equal(funnel.medianDaysToFirstTask, 5);
  assert.equal(funnel.maturing, 1, "the report is 20 days old, so this founder is still within their 30 days");
});

test("the 30-day boundary is inclusive, one millisecond later is not", () => {
  const start = now.getTime() - 40 * DAY;
  const at = ms => new Date(ms).toISOString();
  const reports = [{ user_id: "edge", created_at: at(start) }, { user_id: "late", created_at: at(start) }];
  const events = [
    { user_id: "edge", event: "task_completed", created_at: at(start + FOLLOW_DAYS * DAY) },
    { user_id: "late", event: "task_completed", created_at: at(start + FOLLOW_DAYS * DAY + 1) },
  ];
  const funnel = validationFunnel({ reports, events, days: 90, now });
  assert.equal(funnel.steps.task, 1);
});

test("the 30-day action rate uses only founders who have had the full 30 days, from the window shifted back 30 days", () => {
  // days = 30: the action-rate cohort is founders whose first report is 30 to 60 days old.
  const reports = [report("acted", 45), report("logged", 59), report("idle", 31), report("young", 10), report("ancient", 75)];
  const events = [
    event("acted", "task", 40),
    event("logged", "evidence", 50), // first-hand evidence counts as an action
    event("idle", "viewed", 30), event("idle", "sprint", 30), // viewing and starting a sprint are not actions
    event("young", "task", 5), // too young for the rate, but in the window's funnel
    event("ancient", "task", 70), // outside both
  ];
  const funnel = validationFunnel({ reports, events, days: 30, now });
  assert.deepEqual({ founders: funnel.actionRate.founders, acted: funnel.actionRate.acted }, { founders: 3, acted: 2 });
  assert.equal(funnel.actionRate.rate, 2 / 3);
  assert.equal(funnel.founders, 1, "the window's own cohort is only 'young': 'idle' (31 days) is outside a 30-day window");
});

test("cohort weeks group founders by the week of their first report; immature founders have no week action rate", () => {
  const reports = [report("a", 35), report("b", 34), report("c", 3)];
  const events = [event("a", "task", 30), event("c", "task", 1)];
  const funnel = validationFunnel({ reports, events, days: 90, now });
  assert.equal(funnel.weeks.length, 2);
  const [older, recent] = funnel.weeks;
  assert.ok(older.week < recent.week);
  assert.deepEqual({ founders: older.founders, mature: older.mature, acted: older.acted, rate: older.actionRate }, { founders: 2, mature: 2, acted: 1, rate: 0.5 });
  assert.deepEqual({ founders: recent.founders, mature: recent.mature, rate: recent.actionRate }, { founders: 1, mature: 0, rate: null });
  assert.equal(recent.steps.task, 1, "steps still count for immature founders");
});

test("events of founders without a report, and unknown events, are ignored", () => {
  const funnel = validationFunnel({
    reports: [report("a", 5)],
    events: [event("nobody", "task", 1), { user_id: "a", event: "report_rated", created_at: ago(1) }],
    days: 30, now,
  });
  assert.deepEqual(funnel.steps, { viewed: 0, sprint: 0, task: 0, evidence: 0, decision: 0 });
});

test("the funnel's events are recorded where founders act, after the response, without any text", async () => {
  const { readFileSync } = await import("node:fs");
  const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
  const page = read("../app/(workspace)/opportunities/[id]/page.tsx");
  assert.match(page, /after\(\(\) => trackDaily\("opportunity_viewed", \{ userId: user\.id, props: \{\} \}\)\)/);
  assert.ok(page.indexOf("trackDaily(") > page.indexOf("if (!opportunity) notFound()"), "only an opportunity the founder owns counts as a view");
  const workspace = read("../app/api/workspace/route.ts");
  assert.match(workspace, /if \(input\.completed && !current\.includes\(taskKey\)\) \{\s*after\(\(\) => track\("task_completed", \{ userId: user\.id, props: \{ origin: "checklist" \} \}\)\);/, "a first-step tick outside a sprint, once");
  assert.match(read("../app/api/sprints/route.ts"), /track\("task_completed", \{ userId: user\.id, props: \{ origin: "sprint" \} \}\)/);
  const events = read("../lib/events.ts");
  assert.match(events, /\.eq\("event", event\)\.eq\("user_id", options\.userId\)\.gte\("created_at", utcDayStart\(/, "a daily event checks today's events first");
});
