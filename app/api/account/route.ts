import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteAccount } from "@/lib/account";
import { DELETE_CONFIRMATION } from "@/lib/library-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * "Delete my account" (WP-25). Same-origin only, with the typed confirmation word, for the signed-in founder only.
 * Refused while research is still running. The session is signed out afterwards.
 */
export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = !!origin && new URL(origin).host === host;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) return json({ code: "INVALID_ORIGIN", error: "Request origin is not allowed." }, 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || (body as { confirm?: unknown }).confirm !== DELETE_CONFIRMATION)
    return json({ code: "INVALID_INPUT", error: "Type the confirmation word to delete your account." }, 400);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ code: "AUTH_REQUIRED", error: "Please log in first." }, 401);
    const result = await deleteAccount(supabase, user.id);
    if (!result.ok && result.code === "RUN_ACTIVE") return json({ code: "RUN_ACTIVE", error: "Stop your running research first." }, 409);
    if (!result.ok) throw new Error(result.code);
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return json({ ok: true });
  } catch {
    return json({ code: "SAVE_FAILED", error: "Your change could not be saved. Please try again." }, 503);
  }
}
