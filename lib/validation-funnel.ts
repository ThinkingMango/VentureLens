// Validation funnel for /admin/quality (enhancement plan WP-15, docs/ENHANCEMENT_PLAN.md §4).
// What founders do after their first report: open an opportunity, start a sprint, complete a task, log first-hand
// evidence, record a decision. Pure functions over product events the caller has already read, so every definition is
// unit-tested on fixed samples. Founders are counted, never events, and no founder is identified in the output.

const DAY_MS = 86_400_000;
/** How long after a founder's first report their actions count. */
export const FOLLOW_DAYS = 30;

export const funnelSteps = ["viewed", "sprint", "task", "evidence", "decision"] as const;
export type FunnelStep = (typeof funnelSteps)[number];
/** The product event that marks each step. */
export const stepEvents: Record<FunnelStep, string> = {
  viewed: "opportunity_viewed",
  sprint: "sprint_created",
  task: "task_completed",
  evidence: "evidence_logged",
  decision: "sprint_decided",
};
/** A real-world validation action (spec §1.3): a completed validation task or a logged piece of first-hand evidence. */
const actionSteps: readonly FunnelStep[] = ["task", "evidence"];

/** A `run_finished` event with status "completed": a report with at least one opportunity. */
export type FunnelReport = { user_id: string; created_at: string };
/** One of the step events in `stepEvents`. */
export type FunnelEvent = { user_id: string; event: string; created_at: string };

type Counts = Record<FunnelStep, number>;
const zero = (): Counts => ({ viewed: 0, sprint: 0, task: 0, evidence: 0, decision: 0 });
const time = (iso: string) => Date.parse(iso);

/** Monday 00:00 UTC of the week that contains `ms`, as YYYY-MM-DD. */
export function weekStart(ms: number): string {
  const date = new Date(ms);
  const day = date.getUTCDay(); // 0 = Sunday
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - ((day + 6) % 7))).toISOString().slice(0, 10);
}

/** Each founder's first completed report, in milliseconds. Unparseable times are ignored. */
export function firstReports(reports: FunnelReport[]): Map<string, number> {
  const first = new Map<string, number>();
  for (const report of reports) {
    const at = time(report.created_at);
    if (!Number.isFinite(at)) continue;
    const seen = first.get(report.user_id);
    if (seen === undefined || at < seen) first.set(report.user_id, at);
  }
  return first;
}

/**
 * The founder's first event for each step within FOLLOW_DAYS of their first report (inclusive at both ends), in
 * milliseconds. Events before the first report do not count.
 */
function stepTimes(start: number, events: FunnelEvent[]): Partial<Record<FunnelStep, number>> {
  const end = start + FOLLOW_DAYS * DAY_MS;
  const times: Partial<Record<FunnelStep, number>> = {};
  for (const step of funnelSteps) {
    for (const event of events) {
      if (event.event !== stepEvents[step]) continue;
      const at = time(event.created_at);
      if (!Number.isFinite(at) || at < start || at > end) continue;
      if (times[step] === undefined || at < times[step]!) times[step] = at;
    }
  }
  return times;
}
const acted = (times: Partial<Record<FunnelStep, number>>) => actionSteps.some(step => times[step] !== undefined);

export type ValidationFunnel = ReturnType<typeof validationFunnel>;

/**
 * - **Cohort:** founders whose first completed report falls in the window (the last `days` days).
 * - **Steps:** founders in the cohort who reached each step within FOLLOW_DAYS of that report. Founders whose report is
 *   less than FOLLOW_DAYS old are still counted, so recent windows understate later steps (`maturing` says how many).
 * - **30-day action rate:** founders whose first report is between `days + 30` and 30 days old, so every one of them has
 *   had the full 30 days, who completed a task or logged evidence in those 30 days.
 * - **Weeks:** the cohort by the week (Monday, UTC) of the first report; each week's action rate counts only founders
 *   who have had the full 30 days.
 */
export function validationFunnel(input: { reports: FunnelReport[]; events: FunnelEvent[]; days: number; now: Date }) {
  const now = input.now.getTime();
  const windowStart = now - input.days * DAY_MS;
  const matureEnd = now - FOLLOW_DAYS * DAY_MS;
  const matureStart = matureEnd - input.days * DAY_MS;
  const first = firstReports(input.reports);
  const eventsBy = new Map<string, FunnelEvent[]>();
  for (const event of input.events) {
    if (!first.has(event.user_id)) continue;
    const list = eventsBy.get(event.user_id);
    if (list) list.push(event);
    else eventsBy.set(event.user_id, [event]);
  }

  const steps = zero();
  let founders = 0;
  let maturing = 0;
  const daysToTask: number[] = [];
  const weeks = new Map<string, { founders: number; steps: Counts; mature: number; acted: number }>();
  let matureFounders = 0;
  let matureActed = 0;

  for (const [user, start] of first) {
    const times = stepTimes(start, eventsBy.get(user) ?? []);
    if (start >= matureStart && start <= matureEnd) {
      matureFounders++;
      if (acted(times)) matureActed++;
    }
    if (start < windowStart || start > now) continue;
    founders++;
    const mature = start <= matureEnd;
    if (!mature) maturing++;
    for (const step of funnelSteps) if (times[step] !== undefined) steps[step]++;
    if (times.task !== undefined) daysToTask.push((times.task - start) / DAY_MS);
    const key = weekStart(start);
    const week = weeks.get(key) ?? { founders: 0, steps: zero(), mature: 0, acted: 0 };
    week.founders++;
    for (const step of funnelSteps) if (times[step] !== undefined) week.steps[step]++;
    if (mature) {
      week.mature++;
      if (acted(times)) week.acted++;
    }
    weeks.set(key, week);
  }

  daysToTask.sort((a, b) => a - b);
  const middle = Math.floor(daysToTask.length / 2);
  const medianDays = !daysToTask.length ? null : daysToTask.length % 2 ? daysToTask[middle] : (daysToTask[middle - 1] + daysToTask[middle]) / 2;
  return {
    /** Founders whose first completed report is in the window. */
    founders,
    /** Of those, founders whose report is less than FOLLOW_DAYS old. */
    maturing,
    steps,
    /** The primary success measure (spec §1.3), over founders who have had the full 30 days. */
    actionRate: { founders: matureFounders, acted: matureActed, rate: matureFounders ? matureActed / matureFounders : null, from: new Date(matureStart).toISOString(), to: new Date(matureEnd).toISOString() },
    /** Median days from first report to first completed task, among cohort founders who completed one. */
    medianDaysToFirstTask: medianDays,
    weeks: [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, row]) => ({
      week, founders: row.founders, steps: row.steps, mature: row.mature, acted: row.acted, actionRate: row.mature ? row.acted / row.mature : null,
    })),
  };
}
