import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { summarizeSprint, toSprint, type ActiveSprintSummary, type Sprint, type SprintLength } from "@/lib/sprint-core";

type Client = Awaited<ReturnType<typeof createClient>>;
const SPRINT_COLUMNS = "id,opportunity_id,length_days,started_on,go_criteria,status,decision,decision_note,created_at";
const TASK_COLUMNS = "id,sprint_id,title,detail,due_on,done_at,position,origin";

/** One sprint and its tasks, read through the founder's own session. */
export async function readSprint(supabase: Client, userId: string, sprintId: string): Promise<Sprint | null> {
  const [{ data: row, error }, { data: tasks, error: taskError }] = await Promise.all([
    supabase.from("validation_sprints").select(SPRINT_COLUMNS).eq("id", sprintId).eq("user_id", userId).maybeSingle(),
    supabase.from("validation_tasks").select(TASK_COLUMNS).eq("sprint_id", sprintId).eq("user_id", userId).order("position"),
  ]);
  if (error || taskError) throw new Error("SPRINT_UNAVAILABLE");
  return row ? toSprint(row, tasks ?? []) : null;
}

/**
 * The sprint shown on an opportunity's Validation tab: the active one, or else the most recent. Null when there is
 * none, or when sprints cannot be read (for example before the WP-10 migration), so the page falls back to the
 * checklist.
 */
export async function readOpportunitySprint(supabase: Client, userId: string, opportunityId: string): Promise<Sprint | null> {
  try {
    const { data, error } = await supabase.from("validation_sprints").select(SPRINT_COLUMNS)
      .eq("opportunity_id", opportunityId).eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
    if (error || !data?.length) return null;
    const row = data.find((sprint) => sprint.status === "active") ?? data[0];
    return await readSprint(supabase, userId, String(row.id));
  } catch {
    return null;
  }
}

/** The founder's active sprints for the dashboard, newest first, each with its next three tasks. Empty when unreadable. */
export async function readActiveSprints(supabase: Client, userId: string): Promise<ActiveSprintSummary[]> {
  try {
    const { data: sprints, error } = await supabase.from("validation_sprints").select("id,opportunity_id,length_days,started_on")
      .eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(5);
    if (error || !sprints?.length) return [];
    const ids = sprints.map((sprint) => String(sprint.id));
    const [{ data: tasks }, { data: opportunities }] = await Promise.all([
      supabase.from("validation_tasks").select("id,sprint_id,title,due_on,done_at,position").eq("user_id", userId).in("sprint_id", ids),
      supabase.from("opportunities").select("id,title").eq("user_id", userId).in("id", sprints.map((sprint) => String(sprint.opportunity_id))),
    ]);
    return sprints.map((sprint) => summarizeSprint({
      id: String(sprint.id), opportunity_id: String(sprint.opportunity_id), length_days: Number(sprint.length_days) as SprintLength,
      started_on: String(sprint.started_on).slice(0, 10),
      tasks: (tasks ?? []).filter((task) => task.sprint_id === sprint.id).map((task) => ({
        id: String(task.id), title: String(task.title), due_on: typeof task.due_on === "string" ? task.due_on : null,
        done_at: typeof task.done_at === "string" ? task.done_at : null, position: Number(task.position) || 0,
      })),
    }, String((opportunities ?? []).find((o) => o.id === sprint.opportunity_id)?.title ?? "")));
  } catch {
    return [];
  }
}
