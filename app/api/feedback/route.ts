import { NextResponse, after, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { feedbackRequestSchema, flagTargetExists } from "@/lib/feedback-core";
import { track } from "@/lib/events";

// Report feedback (spec WP-13): flag a claim or source, or rate a report. Writes go through the founder's own session,
// so row-level security decides what they may write; the service role is used only to record the product event.

export const dynamic = "force-dynamic";
const MAX_BYTES = 4000;
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
    const parsed = feedbackRequestSchema.safeParse(body);
    if (!parsed.success) return json({ code: "INVALID_INPUT", error: "Check the form fields." }, 400);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ code: "AUTH_REQUIRED", error: "Your session has expired. Please log in again." }, 401);
    const input = parsed.data;

    if (input.action === "flag") {
      const { data: opportunity, error } = await supabase
        .from("opportunities").select("run_id,payload").eq("id", input.opportunity_id).eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (!opportunity || !flagTargetExists(opportunity.payload, input.target, input.target_key, input.reason))
        return json({ code: "NOT_FOUND", error: "This record is unavailable." }, 404);
      const { error: insertError } = await supabase.from("report_feedback").insert({
        user_id: user.id, run_id: opportunity.run_id, opportunity_id: input.opportunity_id,
        target: input.target, target_key: input.target_key, reason: input.reason, comment: input.comment,
      });
      if (insertError?.code === "23505") return json({ code: "ALREADY_FLAGGED", error: "You already flagged this." }, 409);
      if (insertError) throw insertError;
      const { reason, target } = input;
      after(() => track("claim_flagged", { userId: user.id, props: { reason, target } }));
      return json({ ok: true });
    }

    const { error } = await supabase.rpc("rate_report", { p_run_id: input.run_id, p_rating: input.rating, p_comment: input.comment });
    if (error?.code === "P0002") return json({ code: "NOT_FOUND", error: "This record is unavailable." }, 404);
    if (error) throw error;
    const { rating } = input;
    after(() => track("report_rated", { userId: user.id, props: { rating } }));
    return json({ ok: true, rating: { rating: input.rating, comment: input.comment } });
  } catch {
    return json({ code: "SAVE_FAILED", error: "Your change could not be saved. Please try again." }, 503);
  }
}
