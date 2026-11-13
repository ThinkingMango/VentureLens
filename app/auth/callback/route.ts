import { NextResponse, after, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/workspace-schema";
import { trackOnce } from "@/lib/events";
import { SIGNUP_SOURCE_KEY, isNewAccount, parseSignupSource } from "@/lib/signup-source";

export async function GET(request: NextRequest) {
  const respond = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  try {
    if (request.nextUrl.searchParams.has("error"))
      return respond("/login?notice=callback");
    const supabase = await createClient();
    const code = request.nextUrl.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return respond("/login?notice=callback");
    }
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return respond("/login?notice=callback");
    const { data: profile, error: profileError } = await supabase
      .from("founder_profiles")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError) return respond("/login?notice=configuration");
    // Sign-up attribution: an account created in the last day that has not finished onboarding is signing in for the
    // first time. trackOnce keeps it to one event per account, even if the founder signs in again before onboarding.
    if (!profile?.onboarding_completed && isNewAccount(user.created_at, new Date())) {
      const source = parseSignupSource(user.user_metadata?.[SIGNUP_SOURCE_KEY]) ?? "unknown";
      after(() => trackOnce("signup_completed", { userId: user.id, props: { source } }));
    }
    const destination = safeReturnPath(
      request.nextUrl.searchParams.get("next"),
    );
    return respond(profile?.onboarding_completed ? destination : "/onboarding");
  } catch {
    return respond("/login?notice=configuration");
  }
}
