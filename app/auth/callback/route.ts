import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/workspace-schema";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from("founder_profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!profileError) {
          const destination = safeReturnPath(
            request.nextUrl.searchParams.get("next"),
          );
          const next =
            destination === "/reset-password" || profile?.onboarding_completed
              ? destination
              : "/onboarding";
          const response = NextResponse.redirect(new URL(next, request.url));
          response.headers.set("Cache-Control", "private, no-store");
          return response;
        }
      }
    }
  }
  return NextResponse.redirect(new URL("/login?notice=callback", request.url));
}
