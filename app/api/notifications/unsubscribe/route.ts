import { NextResponse, type NextRequest } from "next/server";
import { turnOffWeeklyEmails } from "@/lib/weekly";
import { linkSecret, verifyUnsubscribeToken, type WeeklyEnv } from "@/lib/weekly-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Turns off a founder's weekly emails without signing in (WP-17). The founder id and its signed token arrive in the
 * query string: from a mail app's own unsubscribe button (RFC 8058: a POST with "List-Unsubscribe=One-Click"), or from
 * the confirm button on /unsubscribe. Only POST changes anything, so a link scanner opening the email's link cannot
 * unsubscribe anyone. The token turns off weekly emails for that founder and does nothing else.
 */
export async function POST(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let userId = params.get("u");
  let token = params.get("t");
  const form = await request.formData().catch(() => null);
  if (form) {
    userId ??= typeof form.get("u") === "string" ? String(form.get("u")) : null;
    token ??= typeof form.get("t") === "string" ? String(form.get("t")) : null;
  }
  const fromPage = form?.get("from") === "page";
  if (!verifyUnsubscribeToken(linkSecret(process.env as WeeklyEnv), userId, token)) {
    return fromPage
      ? NextResponse.redirect(new URL("/unsubscribe?status=invalid", request.url), 303)
      : NextResponse.json({ code: "INVALID_LINK", error: "This link is not valid." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    await turnOffWeeklyEmails(userId!);
  } catch {
    return fromPage
      ? NextResponse.redirect(new URL("/unsubscribe?status=error", request.url), 303)
      : NextResponse.json({ code: "UNSUBSCRIBE_FAILED", error: "Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return fromPage
    ? NextResponse.redirect(new URL("/unsubscribe?status=done", request.url), 303)
    : NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
