import { NextResponse } from "next/server";
import { sendWeeklyEmails } from "@/lib/weekly";
import { cronAuthorized } from "@/lib/cron-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Each email opens its own SMTP connection; the per-run cap (NOTIFY_WEEKLY_MAX, default 100) keeps a run well inside this.
export const maxDuration = 300;

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Weekly progress email (enhancement plan WP-17), scheduled daily in vercel.json. Each founder with an active sprint
 * gets at most one email per week (Monday to Sunday, UTC), so the Monday run reaches almost everyone and later runs
 * only catch new sprints, failed sends and anyone over the cap. Counts only in the response and the log.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET))
    return json({ code: "UNAUTHORIZED", error: "Not allowed." }, 401);
  try {
    const result = await sendWeeklyEmails();
    console.info("[notify] weekly progress", result);
    return json(result);
  } catch {
    return json({ code: "WEEKLY_FAILED", error: "Weekly emails could not be sent." }, 503);
  }
}
