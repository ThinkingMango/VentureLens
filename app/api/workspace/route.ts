import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readWorkspace } from "@/lib/workspace";
import { profileSchema, projectSchema } from "@/lib/workspace-schema";
import { starterProfileIds } from "@/lib/starter-profiles";
import { track } from "@/lib/events";

export const dynamic = "force-dynamic";
const mutationSchema = z.discriminatedUnion("action", [
  // `starter` names the starter profile the founder began from, if any (recorded as starter_profile_used).
  z.object({ action: z.literal("profile"), profile: profileSchema, starter: z.enum(starterProfileIds).optional() }),
  z.object({ action: z.literal("project"), project: projectSchema }),
  // "Clear idea memory" (WP-04): later runs ignore ideas from before this moment.
  z.object({ action: z.literal("clear_memory") }),
  // "Email me when my research is ready" (WP-08).
  z.object({ action: z.literal("notify"), enabled: z.boolean() }),
  z.object({ action: z.literal("save"), id: z.uuid(), saved: z.boolean() }),
  // Archive or restore an opportunity (WP-12), through set_opportunity_archived: founders cannot update opportunities.
  z.object({ action: z.literal("archive"), id: z.uuid(), archived: z.boolean() }),
  z.object({
    action: z.literal("task"),
    id: z.uuid(),
    task: z.string().regex(/^[0-3]$/),
    completed: z.boolean(),
  }),
]);
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return json(
        {
          code: "AUTH_REQUIRED",
          error: "Please log in to access your workspace.",
        },
        401,
      );
    return json(await readWorkspace(supabase, user));
  } catch {
    return json(
      {
        code: "WORKSPACE_UNAVAILABLE",
        error: "Your workspace could not be loaded. Please try again.",
      },
      503,
    );
  }
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = !!origin && new URL(origin).host === host;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin)
    return json(
      { code: "INVALID_ORIGIN", error: "Request origin is not allowed." },
      403,
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ code: "JSON_REQUIRED", error: "JSON is required." }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > 12000)
    return json(
      { code: "REQUEST_TOO_LARGE", error: "Request is too large." },
      413,
    );
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 12000)
      return json(
        { code: "REQUEST_TOO_LARGE", error: "Request is too large." },
        413,
      );
    const parsed = mutationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return json(
        {
          code: "INVALID_INPUT",
          error: parsed.error.issues[0]?.message ?? "Check the form fields.",
        },
        400,
      );
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return json(
        {
          code: "AUTH_REQUIRED",
          error: "Your session has expired. Please log in again.",
        },
        401,
      );
    const input = parsed.data;
    if (input.action === "profile") {
      const { error } = await supabase
        .from("founder_profiles")
        .upsert(
          { user_id: user.id, ...input.profile, onboarding_completed: true },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      const starter = input.starter;
      if (starter) after(() => track("starter_profile_used", { userId: user.id, props: { id: starter } }));
    } else if (input.action === "notify") {
      const { error } = await supabase
        .from("founder_profiles")
        .update({ notify_on_complete: input.enabled })
        .eq("user_id", user.id);
      if (error) throw error;
    } else if (input.action === "clear_memory") {
      const { error } = await supabase
        .from("founder_profiles")
        .update({ history_reset_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
    } else if (input.action === "archive") {
      const { error } = await supabase.rpc("set_opportunity_archived", { p_id: input.id, p_archived: input.archived });
      if (error?.code === "P0002") return json({ code: "NOT_FOUND", error: "Opportunity not found." }, 404);
      if (error) throw error;
    } else if (input.action === "project") {
      const { error } = await supabase
        .from("research_projects")
        .insert({ user_id: user.id, ...input.project });
      if (error) throw error;
    } else {
      const { data: opportunity, error: lookupError } = await supabase
        .from("opportunities")
        .select("id")
        .eq("id", input.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!opportunity)
        return json(
          { code: "NOT_FOUND", error: "Opportunity not found." },
          404,
        );
      if (input.action === "save") {
        if (input.saved) {
          const { error } = await supabase
            .from("saved_opportunities")
            .upsert(
              { user_id: user.id, opportunity_id: input.id },
              { onConflict: "user_id,opportunity_id", ignoreDuplicates: true },
            );
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("saved_opportunities")
            .delete()
            .eq("user_id", user.id)
            .eq("opportunity_id", input.id);
          if (error) throw error;
        }
      } else {
        const { data: saved, error: savedError } = await supabase
          .from("saved_opportunities")
          .select("completed_tasks")
          .eq("user_id", user.id)
          .eq("opportunity_id", input.id)
          .maybeSingle();
        if (savedError) throw savedError;
        const taskKey = `${input.id}-${input.task}`;
        const current: string[] = saved?.completed_tasks ?? [];
        const completed_tasks = input.completed
          ? Array.from(new Set([...current, taskKey]))
          : current.filter((key) => key !== taskKey);
        const { error } = await supabase
          .from("saved_opportunities")
          .upsert(
            { user_id: user.id, opportunity_id: input.id, completed_tasks },
            { onConflict: "user_id,opportunity_id" },
          );
        if (error) throw error;
      }
    }
    return json(await readWorkspace(supabase, user));
  } catch (error) {
    if (error instanceof SyntaxError)
      return json({ code: "INVALID_INPUT", error: "Invalid JSON." }, 400);
    return json(
      {
        code: "SAVE_FAILED",
        error: "Your change could not be saved. Please try again.",
      },
      503,
    );
  }
}
