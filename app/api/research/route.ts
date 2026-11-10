import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "next-intl/server";
import { researchRequestSchema, profileSchema, profileColumns, profileV2FromRow } from "@/lib/workspace-schema";
import { reportLanguage } from "@/lib/research-core";
import { researchErrors, errorCode } from "@/lib/research-core";
import { dispatchResearch, researchDetail } from "@/lib/research-service";
export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    brief: researchRequestSchema,
    requestKey: z.uuid(),
  }),
  z.object({ action: z.literal("retry"), id: z.uuid() }),
]);
function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (!origin || new URL(origin).host !== host)
      return json({ code: "INVALID_ORIGIN", error: "Request origin is not allowed." }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return json({ code: "JSON_REQUIRED", error: "JSON is required." }, 415);
    if (Number(request.headers.get("content-length") ?? 0) > 10000)
      return json({ code: "REQUEST_TOO_LARGE", error: "Request is too large." }, 413);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 10000)
      return json({ code: "REQUEST_TOO_LARGE", error: "Request is too large." }, 413);
    const parsed = inputSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return json({ code: "INVALID_INPUT", error: "Check the research settings." }, 400);
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return json({ code: "AUTH_REQUIRED", error: "Please log in first." }, 401);
    if (!user.email_confirmed_at)
      return json({ code: "EMAIL_UNVERIFIED", error: "Please confirm your email first." }, 403);
    const admin = createAdminClient();
    let id: string;
    if (parsed.data.action === "start") {
      const profile = await supabase
        .from("founder_profiles")
        .select(profileColumns)
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile.error) throw new Error("WORKFLOW_INTERRUPTED");
      // A stale profile v2 answer reads as "not answered" rather than blocking the run.
      const validatedProfile = profileSchema.safeParse(profile.data && { ...profile.data, ...profileV2FromRow(profile.data) });
      if (!profile.data?.onboarding_completed || !validatedProfile.success)
        return json(
          { code: "PROFILE_REQUIRED", error: "Complete your founder profile first." },
          409,
        );
      const result = await admin.rpc("enqueue_research", {
        p_user: user.id,
        p_brief: {
          ...parsed.data.brief,
          discovery_mode: parsed.data.brief.discovery_mode ?? "combined",
          // The report is written in the language the founder chose; default to the interface language.
          language: reportLanguage(
            parsed.data.brief.language ?? (await getLocale().catch(() => "en")),
          ),
        },
        p_profile: validatedProfile.data,
        p_request: parsed.data.requestKey,
      });
      if (result.error) throw new Error(result.error.message);
      id = String(result.data);
    } else {
      id = parsed.data.id;
      const owned = await researchDetail(supabase, user.id, id);
      if (!owned)
        return json({ code: "NOT_FOUND", error: "Research task not found." }, 404);
      const result = await admin.rpc("retry_research", {
        p_run: id,
        p_user: user.id,
      });
      if (result.error) throw new Error(result.error.message);
      if (!result.data)
        return json(
          { code: "RETRY_UNAVAILABLE", error: "This task cannot be retried now." },
          409,
        );
    }
    try {
      await dispatchResearch(id, user.id);
    } catch (error) {
      /* The persisted failed state remains inspectable and retryable. */
      console.error("[research] dispatch error", { run: id, message: error instanceof Error ? error.message : String(error) });
    }
    return json({ id }, 202);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError)
      return json({ code: "INVALID_INPUT", error: "The request is malformed." }, 400);
    const code = errorCode(error);
    return json(
      { code, error: researchErrors[code] },
      ["DEV_ACCESS_REQUIRED", "DEV_QUOTA_EXCEEDED"].includes(code)
        ? 403
        : code === "RUN_ALREADY_ACTIVE"
          ? 409
          : 503,
    );
  }
}
