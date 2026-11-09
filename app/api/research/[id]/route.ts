import { NextResponse } from "next/server";
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
