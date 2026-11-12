import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exportAccount } from "@/lib/account";
import { exportFileName } from "@/lib/account-core";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** "Download my data" (WP-25): every row stored for the signed-in founder, as one JSON file. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", error: "Please log in first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const now = new Date();
    const body = JSON.stringify(await exportAccount(supabase, user, now), null, 2);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(now)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ code: "EXPORT_UNAVAILABLE", error: "Your data could not be exported. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
