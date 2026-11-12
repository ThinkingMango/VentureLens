import "server-only";
import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createShare, readShare, revokeShare } from "@/lib/shares";
import { sharePath, type ShareTarget } from "@/lib/share-core";
import { track } from "@/lib/events";

/**
 * The share API for a report (`/api/research/[id]/share`, WP-26) and for one opportunity
 * (`/api/opportunities/[id]/share`). Both routes call these handlers with their own target, so the rules can never drift
 * apart: signed-in owners only, same-origin writes, and "not found" for anything that is not theirs.
 */
type Params = { params: Promise<{ id: string }> };
type Kind = ShareTarget["kind"];

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return !!origin && new URL(origin).host === host;
  } catch {
    return false;
  }
}
const notFound = (kind: Kind) => json({ code: "NOT_FOUND", error: kind === "report" ? "Research task not found." : "Opportunity not found." }, 404);
const target = (kind: Kind, id: string): ShareTarget => (kind === "report" ? { kind, runId: id } : { kind, opportunityId: id });
async function context(kind: Kind, params: Params["params"]) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return { error: notFound(kind) } as const;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: json({ code: "AUTH_REQUIRED", error: "Please log in first." }, 401) } as const;
  return { target: target(kind, id), supabase, user } as const;
}
const link = (request: NextRequest, token: string) => new URL(sharePath(token), request.nextUrl.origin).toString();

/** The live link, or null when there is none or it has expired. */
export async function getShare(kind: Kind, request: NextRequest, { params }: Params) {
  const ctx = await context(kind, params);
  if ("error" in ctx) return ctx.error;
  try {
    const share = await readShare(ctx.supabase, ctx.user.id, ctx.target);
    return json({ share: share ? { url: link(request, share.token), created_at: share.created_at, expires_at: share.expires_at } : null });
  } catch {
    return json({ code: "SAVE_FAILED", error: "Please try again." }, 503);
  }
}

/** Makes a read-only link to the founder's own completed report or opportunity, or returns the live one. */
export async function postShare(kind: Kind, request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return json({ code: "INVALID_ORIGIN", error: "Request origin is not allowed." }, 403);
  const ctx = await context(kind, params);
  if ("error" in ctx) return ctx.error;
  try {
    const result = await createShare(ctx.supabase, ctx.user.id, ctx.target);
    if (!result.ok && result.code === "NOT_FOUND") return notFound(kind);
    if (!result.ok) throw new Error(result.code);
    after(() => track("report_shared", { userId: ctx.user.id, props: { target: kind } }));
    return json({ share: { url: link(request, result.token), created_at: result.created_at, expires_at: result.expires_at } });
  } catch {
    return json({ code: "SAVE_FAILED", error: "Your change could not be saved. Please try again." }, 503);
  }
}

/** Turns the link off. Anyone who opens it afterwards sees that it is no longer available. */
export async function deleteShare(kind: Kind, request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return json({ code: "INVALID_ORIGIN", error: "Request origin is not allowed." }, 403);
  const ctx = await context(kind, params);
  if ("error" in ctx) return ctx.error;
  if (!(await revokeShare(ctx.supabase, ctx.user.id, ctx.target))) return json({ code: "SAVE_FAILED", error: "Your change could not be saved. Please try again." }, 503);
  after(() => track("report_unshared", { userId: ctx.user.id, props: { target: kind } }));
  return json({ share: null });
}
