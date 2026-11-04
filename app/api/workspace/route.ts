import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readWorkspace } from "@/lib/workspace";
import { profileSchema, projectSchema } from "@/lib/workspace-schema";

export const dynamic = "force-dynamic";
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("profile"), profile: profileSchema }),
  z.object({ action: z.literal("project"), project: projectSchema }),
  z.object({ action: z.literal("save"), id: z.uuid(), saved: z.boolean() }),
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
      return json({ error: "Please log in to access your workspace." }, 401);
    return json(await readWorkspace(supabase, user));
  } catch {
    return json(
      { error: "Your workspace could not be loaded. Please try again." },
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
    return json({ error: "Request origin is not allowed." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "JSON is required." }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > 12000)
    return json({ error: "Request is too large." }, 413);
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 12000)
      return json({ error: "Request is too large." }, 413);
    const parsed = mutationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return json(
        { error: parsed.error.issues[0]?.message ?? "Check the form fields." },
        400,
      );
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return json(
        { error: "Your session has expired. Please log in again." },
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
      if (!opportunity) return json({ error: "Opportunity not found." }, 404);
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
      return json({ error: "Invalid JSON." }, 400);
    return json(
      { error: "Your change could not be saved. Please try again." },
      503,
    );
  }
}
