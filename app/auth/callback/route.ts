import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/workspace-schema";

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
    const destination = safeReturnPath(
      request.nextUrl.searchParams.get("next"),
    );
    return respond(profile?.onboarding_completed ? destination : "/onboarding");
  } catch {
    return respond("/login?notice=configuration");
  }
}
