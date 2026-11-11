import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/events";

// Report export (spec WP-11) happens in the browser: the Markdown file is built from data the page already has, and
// PDF is the browser's own "Save as PDF". This route only records that an export happened, as `report_exported`.

export const dynamic = "force-dynamic";
const requestSchema = z.strictObject({ format: z.enum(["markdown", "pdf"]) });
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
  const raw = await request.text().catch(() => "");
  if (raw.length > 200) return json({ code: "REQUEST_TOO_LARGE", error: "Request is too large." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ code: "INVALID_INPUT", error: "Check the form fields." }, 400);
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return json({ code: "INVALID_INPUT", error: "Check the form fields." }, 400);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ code: "AUTH_REQUIRED", error: "Your session has expired. Please log in again." }, 401);
  const { format } = parsed.data;
  after(() => track("report_exported", { userId: user.id, props: { format } }));
  return json({ ok: true });
}
