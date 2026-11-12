import { NextResponse, after, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sprintRequestSchema } from "@/lib/sprint-core";
import { readSprint } from "@/lib/sprints";
import { track } from "@/lib/events";

// Validation sprints (spec WP-10). Every write goes through the founder's own session, so row-level security decides
// what is allowed; this route adds the rules a policy cannot express (only an active sprint changes) and the events.

export const dynamic = "force-dynamic";
const MAX_BYTES = 16_000;
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return !!origin && new URL(origin).host === host;
  } catch {
    return false;
  }
}
const notFound = () => json({ code: "NOT_FOUND", error: "This record is unavailable." }, 404);
const closed = () => json({ code: "SPRINT_CLOSED", error: "This sprint has ended." }, 409);
type Client = Awaited<ReturnType<typeof createClient>>;

/** The sprint a task belongs to, if both are the founder's. */
async function taskSprint(supabase: Client, userId: string, taskId: string) {
  const { data, error } = await supabase.from("validation_tasks").select("sprint_id").eq("id", taskId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? String(data.sprint_id) : null;
}
async function sprintStatus(supabase: Client, userId: string, sprintId: string) {
  const { data, error } = await supabase.from("validation_sprints").select("status").eq("id", sprintId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? String(data.status) : null;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json({ code: "INVALID_ORIGIN", error: "Request origin is not allowed." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ code: "JSON_REQUIRED", error: "JSON is required." }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) return json({ code: "REQUEST_TOO_LARGE", error: "Request is too large." }, 413);
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BYTES) return json({ code: "REQUEST_TOO_LARGE", error: "Request is too large." }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ code: "INVALID_INPUT", error: "Check the form fields." }, 400);
    }
    const parsed = sprintRequestSchema.safeParse(body);
    if (!parsed.success) return json({ code: "INVALID_INPUT", error: "Check the form fields." }, 400);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ code: "AUTH_REQUIRED", error: "Your session has expired. Please log in again." }, 401);
    const input = parsed.data;
    let sprintId: string;

    if (input.action === "start") {
      const { data, error } = await supabase.rpc("start_validation_sprint", { p_opportunity: input.opportunity_id, p_length: input.length, p_checklist: input.checklist, p_labels: input.labels });
      if (error?.code === "P0002") return notFound();
      if (error?.code === "23505") return json({ code: "SPRINT_ACTIVE", error: "This opportunity already has an active sprint." }, 409);
      if (error || typeof data !== "string") throw error ?? new Error("SPRINT_NOT_STARTED");
      sprintId = data;
      const length = input.length;
      after(() => track("sprint_created", { userId: user.id, props: { length } }));
    } else if (input.action === "criteria" || input.action === "decide" || input.action === "abandon" || input.action === "add_task" || input.action === "reorder") {
      sprintId = input.sprint_id;
      const status = await sprintStatus(supabase, user.id, sprintId);
      if (!status) return notFound();
      if (status !== "active") return closed();
      if (input.action === "criteria") {
        const { error } = await supabase.from("validation_sprints").update({ go_criteria: input.go_criteria }).eq("id", sprintId).eq("user_id", user.id);
        if (error) throw error;
      } else if (input.action === "decide" || input.action === "abandon") {
        const values = input.action === "decide" ? { status: "completed", decision: input.decision, decision_note: input.note } : { status: "abandoned" };
        const { error } = await supabase.from("validation_sprints").update(values).eq("id", sprintId).eq("user_id", user.id).eq("status", "active");
        if (error) throw error;
        if (input.action === "decide") {
          const decision = input.decision;
          after(() => track("sprint_decided", { userId: user.id, props: { decision } }));
        }
      } else if (input.action === "add_task") {
        const { data: last } = await supabase.from("validation_tasks").select("position").eq("sprint_id", sprintId).eq("user_id", user.id).order("position", { ascending: false }).limit(1).maybeSingle();
        const { error } = await supabase.from("validation_tasks").insert({
          user_id: user.id, sprint_id: sprintId, title: input.title, detail: input.detail, due_on: input.due_on,
          position: Math.min(1000, (last ? Number(last.position) : -1) + 1), origin: "user",
        });
        if (error?.code === "23514" && /TOO_MANY_TASKS/.test(error.message ?? "")) return json({ code: "TOO_MANY_TASKS", error: "A sprint can hold 50 tasks." }, 409);
        if (error) throw error;
      } else {
        const { data: current, error } = await supabase.from("validation_tasks").select("id").eq("sprint_id", sprintId).eq("user_id", user.id);
        if (error) throw error;
        const ids = new Set((current ?? []).map((task) => String(task.id)));
        if (ids.size !== input.task_ids.length || !input.task_ids.every((id) => ids.has(id))) return json({ code: "INVALID_INPUT", error: "Check the form fields." }, 400);
        for (const [position, id] of input.task_ids.entries()) {
          const { error: moveError } = await supabase.from("validation_tasks").update({ position }).eq("id", id).eq("user_id", user.id);
          if (moveError) throw moveError;
        }
      }
    } else {
      const found = await taskSprint(supabase, user.id, input.task_id);
      if (!found) return notFound();
      sprintId = found;
      if ((await sprintStatus(supabase, user.id, sprintId)) !== "active") return closed();
      if (input.action === "edit_task") {
        const { error } = await supabase.from("validation_tasks").update({ title: input.title, detail: input.detail, due_on: input.due_on }).eq("id", input.task_id).eq("user_id", user.id);
        if (error) throw error;
      } else if (input.action === "toggle_task") {
        const update = supabase.from("validation_tasks")
          .update({ done_at: input.done ? new Date().toISOString() : null }).eq("id", input.task_id).eq("user_id", user.id);
        const { data: changed, error } = await (input.done ? update.is("done_at", null) : update.not("done_at", "is", null)).select("id");
        if (error) throw error;
        // Counted once per tick: ticking a task that is already done changes nothing and records nothing.
        if (input.done && changed?.length) after(() => track("task_completed", { userId: user.id, props: { origin: "sprint" } }));
      } else {
        const { error } = await supabase.from("validation_tasks").delete().eq("id", input.task_id).eq("user_id", user.id);
        if (error) throw error;
      }
    }
    const sprint = await readSprint(supabase, user.id, sprintId);
    return sprint ? json({ sprint }) : notFound();
  } catch {
    return json({ code: "SAVE_FAILED", error: "Your change could not be saved. Please try again." }, 503);
  }
}
