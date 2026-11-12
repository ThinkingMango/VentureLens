import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createShare, readShare, revokeShare } from "@/lib/shares";
import { sharePath } from "@/lib/share-core";
import { track } from "@/lib/events";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
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
async function context(params: Promise<{ id: string }>) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return { error: json({ code: "NOT_FOUND", error: "Research task not found." }, 404) } as const;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: json({ code: "AUTH_REQUIRED", error: "Please log in first." }, 401) } as const;
  return { id, supabase, user } as const;
}
const link = (request: NextRequest, token: string) => new URL(sharePath(token), request.nextUrl.origin).toString();

/** The report's live link (WP-26), or null when it has none or it has expired. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await context(params);
  if ("error" in ctx) return ctx.error;
  try {
    const share = await readShare(ctx.supabase, ctx.user.id, ctx.id);
    return json({ share: share ? { url: link(request, share.token), created_at: share.created_at, expires_at: share.expires_at } : null });
  } catch {
    return json({ code: "SAVE_FAILED", error: "Please try again." }, 503);
  }
}

/** Makes a read-only link to a completed report of the founder's own, or returns the live one. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return json({ code: "INVALID_ORIGIN", error: "Request origin is not allowed." }, 403);
  const ctx = await context(params);
  if ("error" in ctx) return ctx.error;
  try {
    const result = await createShare(ctx.supabase, ctx.user.id, ctx.id);
    if (!result.ok && result.code === "NOT_FOUND") return json({ code: "NOT_FOUND", error: "Research task not found." }, 404);
    if (!result.ok) throw new Error(result.code);
    after(() => track("report_shared", { userId: ctx.user.id, props: {} }));
    return json({ share: { url: link(request, result.token), created_at: result.created_at, expires_at: result.expires_at } });
  } catch {
    return json({ code: "SAVE_FAILED", error: "Your change could not be saved. Please try again." }, 503);
  }
}

/** Turns the link off. Anyone who opens it afterwards sees that it is no longer available. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return json({ code: "INVALID_ORIGIN", error: "Request origin is not allowed." }, 403);
  const ctx = await context(params);
  if ("error" in ctx) return ctx.error;
  if (!(await revokeShare(ctx.supabase, ctx.user.id, ctx.id))) return json({ code: "SAVE_FAILED", error: "Your change could not be saved. Please try again." }, 503);
  after(() => track("report_unshared", { userId: ctx.user.id, props: {} }));
  return json({ share: null });
}
