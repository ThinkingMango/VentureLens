import { NextResponse, type NextRequest } from "next/server";
import { parseEmailLink, verifyEmailLink } from "@/lib/email-auth";
import { createClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/workspace-schema";

// Handles the sign-in button in the Supabase email templates:
// {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
// The session is created here; /auth/callback then sends the founder to
// onboarding or to the page they asked for.
export async function GET(request: NextRequest) {
  const respond = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const params = request.nextUrl.searchParams;
  const link = parseEmailLink(params);
  if (!link) return respond("/login?notice=callback");
  try {
    const { data, error } = await verifyEmailLink(await createClient(), link);
    if (error || !data.session) return respond("/login?notice=callback");
    const next = safeReturnPath(params.get("next"));
    return respond(`/auth/callback?next=${encodeURIComponent(next)}`);
  } catch {
    return respond("/login?notice=configuration");
  }
}
