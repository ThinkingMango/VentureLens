import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { researchDetail } from "@/lib/research-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return json({ code: "NOT_FOUND", error: "Research task not found." }, 404);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ code: "AUTH_REQUIRED", error: "Please log in first." }, 401);
    const detail = await researchDetail(supabase, user.id, id);
    return detail
      ? json(detail)
      : json({ code: "NOT_FOUND", error: "Research task not found." }, 404);
  } catch {
    return json(
      {
        code: "STATUS_UNAVAILABLE",
        error: "Research status is temporarily unavailable. Refresh to try again.",
      },
      503,
    );
  }
}

/**
 * Deletes a finished run with everything made from it (WP-12), through delete_research_run: it refuses a run that is
 * still pending or running, and keeps the run's usage rows for cost accounting, detached from the founder (D6).
 * The page asks the founder to type a confirmation word first; the request repeats it, so a stray call deletes nothing.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = !!origin && new URL(origin).host === host;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) return json({ code: "INVALID_ORIGIN", error: "Request origin is not allowed." }, 403);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return json({ code: "NOT_FOUND", error: "Research task not found." }, 404);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || (body as { confirm?: unknown }).confirm !== "DELETE")
    return json({ code: "INVALID_INPUT", error: "Type the confirmation word to delete this run." }, 400);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ code: "AUTH_REQUIRED", error: "Please log in first." }, 401);
    const { error } = await supabase.rpc("delete_research_run", { p_run: id });
    if (error?.code === "P0002") return json({ code: "NOT_FOUND", error: "Research task not found." }, 404);
    if (error?.code === "55006") return json({ code: "RUN_ACTIVE", error: "This research is still running." }, 409);
    if (error) throw error;
    return json({ ok: true });
  } catch {
    return json({ code: "SAVE_FAILED", error: "Your change could not be saved. Please try again." }, 503);
  }
}
