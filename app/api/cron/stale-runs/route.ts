import { NextResponse } from "next/server";
import { sweepStaleRuns } from "@/lib/research-service";
import { cronAuthorized } from "@/lib/cron-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Scheduled stale-run cleanup (vercel.json). Ends every founder's runs that can no longer finish: a workflow that ended
 * without finishing its run, a run never dispatched, or one active past the age limit (lib/research-core.ts). Each run
 * is also checked when its page opens and before its founder starts another, so this only catches runs nobody opens.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET))
    return json({ code: "UNAUTHORIZED", error: "Not allowed." }, 401);
  try {
    const result = await sweepStaleRuns({ limit: 200 });
    if (result.ended.length) console.info("[research] stale runs ended", { checked: result.checked, ended: result.ended });
    return json({ checked: result.checked, ended: result.ended.length });
  } catch {
    return json({ code: "CLEANUP_FAILED", error: "Stale-run cleanup could not run." }, 503);
  }
}
