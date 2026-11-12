import { z } from "zod";

// Validation sprints (spec WP-10). Pure rules shared by the API route, the pages and the tests. The database applies
// the same rules (supabase/migrations/20261111120000_validation_sprints.sql); tests check that both agree.

export const sprintLengths = [7, 14, 30] as const;
export type SprintLength = (typeof sprintLengths)[number];
export const sprintDecisions = ["keep", "park", "kill"] as const;
export type SprintDecision = (typeof sprintDecisions)[number];
export const MAX_TASKS = 50;
/**
 * The fixed first steps every opportunity page shows. Progress on them is kept by index (`{opportunity id}-{i}` in
 * saved_opportunities.completed_tasks), so the order must not change; a sprint seeds them first to keep those ticks.
 */
export const firstSteps = [
  "Write down the riskiest assumption",
  "Find five potential buyers",
  "Run problem-discovery conversations",
  "Test a small, paid manual pilot",
] as const;

export type SprintTask = {
  id: string;
  title: string;
  detail: string;
  due_on: string | null;
  done_at: string | null;
  position: number;
  origin: "report" | "user";
};
export type Sprint = {
  id: string;
  opportunity_id: string;
  length_days: SprintLength;
  started_on: string;
  go_criteria: string;
  status: "active" | "completed" | "abandoned";
  decision: SprintDecision | null;
  decision_note: string;
  tasks: SprintTask[];
};

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
/** Adds whole days to a YYYY-MM-DD date, in UTC. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDay(date);
}
/**
 * Due dates for `count` tasks spread evenly across a sprint that starts on `startedOn`: task k (from 1) is due on day
 * round(length × k / count), at least day 1, so the last task falls on the sprint's last day. Postgres rounds halves
 * away from zero, as Math.round does for the positive values here.
 */
export function spreadDueDates(count: number, length: number, startedOn: string): string[] {
  return Array.from({ length: count }, (_, i) => addDays(startedOn, Math.max(1, Math.round((length * (i + 1)) / count))));
}

/** The sprint's day today (1 on the start day), capped to its length; 0 before it starts. */
export function sprintDay(sprint: Pick<Sprint, "started_on" | "length_days">, today: string): number {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${sprint.started_on}T00:00:00Z`)) / 86_400_000);
  return Math.max(0, Math.min(sprint.length_days, days + 1));
}
export function sprintProgress(tasks: Pick<SprintTask, "done_at">[]) {
  const done = tasks.filter((task) => task.done_at).length;
  return { done, total: tasks.length, ratio: tasks.length ? done / tasks.length : 0 };
}
/** Tasks still to do, soonest due first (undated last), then in list order. */
export function nextTasks<T extends Pick<SprintTask, "due_on" | "done_at" | "position">>(tasks: T[], count = 3): T[] {
  return tasks
    .filter((task) => !task.done_at)
    .sort((a, b) => (a.due_on ?? "9999-12-31").localeCompare(b.due_on ?? "9999-12-31") || a.position - b.position)
    .slice(0, count);
}
export function isOverdue(task: Pick<SprintTask, "due_on" | "done_at">, today: string): boolean {
  return !task.done_at && !!task.due_on && task.due_on < today;
}
/** Moves one task up or down by one place; returns the task ids in their new order, or null at either end. */
export function moveTask(tasks: Pick<SprintTask, "id" | "position">[], id: string, direction: "up" | "down"): string[] | null {
  const ordered = [...tasks].sort((a, b) => a.position - b.position).map((task) => task.id);
  const index = ordered.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ordered.length) return null;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered;
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid date");
const title = z.string().trim().min(1).max(300);
const detail = z.string().trim().max(1000);
export const sprintRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("start"), opportunity_id: z.uuid(), length: z.union([z.literal(7), z.literal(14), z.literal(30)]),
    // The page's fixed first steps, in the founder's language, so the sprint keeps their earlier ticks.
    checklist: z.array(z.string().trim().max(300)).max(4).default([]),
    // WP-16: the field labels for tasks made from a report's next steps, in the founder's language: where, where to
    // look (a suggestion), done when, stop if. The database writes the task details with them.
    labels: z.array(z.string().trim().max(40)).max(4).default([]),
  }),
  z.strictObject({ action: z.literal("criteria"), sprint_id: z.uuid(), go_criteria: z.string().trim().max(1000) }),
  z.strictObject({ action: z.literal("decide"), sprint_id: z.uuid(), decision: z.enum(sprintDecisions), note: z.string().trim().max(1000).default("") }),
  z.strictObject({ action: z.literal("abandon"), sprint_id: z.uuid() }),
  z.strictObject({ action: z.literal("add_task"), sprint_id: z.uuid(), title, detail: detail.default(""), due_on: day.nullable().default(null) }),
  z.strictObject({ action: z.literal("edit_task"), task_id: z.uuid(), title, detail: detail.default(""), due_on: day.nullable() }),
  z.strictObject({ action: z.literal("toggle_task"), task_id: z.uuid(), done: z.boolean() }),
  z.strictObject({ action: z.literal("delete_task"), task_id: z.uuid() }),
  z.strictObject({ action: z.literal("reorder"), sprint_id: z.uuid(), task_ids: z.array(z.uuid()).min(1).max(MAX_TASKS) }),
]);
export type SprintRequest = z.infer<typeof sprintRequestSchema>;

/** Reads a stored sprint and its tasks into the page's shape, tasks in list order. */
export function toSprint(row: Record<string, unknown>, tasks: Record<string, unknown>[]): Sprint {
  return {
    id: String(row.id),
    opportunity_id: String(row.opportunity_id),
    length_days: (sprintLengths as readonly number[]).includes(Number(row.length_days)) ? (Number(row.length_days) as SprintLength) : 14,
    started_on: String(row.started_on).slice(0, 10),
    go_criteria: typeof row.go_criteria === "string" ? row.go_criteria : "",
    status: row.status === "completed" || row.status === "abandoned" ? row.status : "active",
    decision: (sprintDecisions as readonly string[]).includes(String(row.decision)) ? (row.decision as SprintDecision) : null,
    decision_note: typeof row.decision_note === "string" ? row.decision_note : "",
    tasks: tasks
      .map((task) => ({
        id: String(task.id), title: String(task.title ?? ""), detail: typeof task.detail === "string" ? task.detail : "",
        due_on: typeof task.due_on === "string" ? task.due_on.slice(0, 10) : null, done_at: typeof task.done_at === "string" ? task.done_at : null,
        position: Number(task.position) || 0, origin: task.origin === "user" ? "user" as const : "report" as const,
      }))
      .sort((a, b) => a.position - b.position),
  };
}

/**
 * The demo's one fixed example sprint: 14 days, started four days ago, the first two tasks done. Built from the demo
 * opportunity's own (translated) steps, so it reads like a real sprint.
 */
/** `details`: each task's detail, by position (WP-16 next steps carry where, done when and stop if). */
export function demoSprint(opportunityId: string, titles: string[], goCriteria: string, now = new Date(), details: string[] = []): Sprint {
  const startedOn = addDays(now.toISOString().slice(0, 10), -3);
  const due = spreadDueDates(titles.length, 14, startedOn);
  return {
    id: `demo-sprint-${opportunityId}`, opportunity_id: opportunityId, length_days: 14, started_on: startedOn, go_criteria: goCriteria,
    status: "active", decision: null, decision_note: "",
    tasks: titles.map((title, i) => ({ id: `demo-task-${i}`, title, detail: details[i] ?? "", due_on: due[i], done_at: i < 2 ? now.toISOString() : null, position: i, origin: "report" as const })),
  };
}

/** What the dashboard shows of an active sprint: its opportunity, how far along it is, and the next three tasks. */
export type ActiveSprintSummary = {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  lengthDays: number;
  startedOn: string;
  done: number;
  total: number;
  next: Pick<SprintTask, "id" | "title" | "due_on">[];
};
export function summarizeSprint(sprint: Pick<Sprint, "id" | "opportunity_id" | "length_days" | "started_on"> & { tasks: Pick<SprintTask, "id" | "title" | "due_on" | "done_at" | "position">[] }, opportunityTitle: string): ActiveSprintSummary {
  const progress = sprintProgress(sprint.tasks);
  return {
    id: sprint.id, opportunityId: sprint.opportunity_id, opportunityTitle, lengthDays: sprint.length_days, startedOn: sprint.started_on,
    done: progress.done, total: progress.total, next: nextTasks(sprint.tasks).map(({ id, title, due_on }) => ({ id, title, due_on })),
  };
}
