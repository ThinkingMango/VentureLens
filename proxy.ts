import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath } from "@/lib/workspace-schema";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPrivate =
    /^\/(dashboard|research|saved|profile|billing|onboarding|opportunities|admin)(\/|$)/.test(
      path,
    );
  const isAuth = path === "/login" || path === "/signup";
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (isPrivate)
      return NextResponse.redirect(
        new URL("/login?notice=configuration", request.url),
      );
    return response;
  }
  const supabase = createServerClient(url, key, {
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if ((isPrivate && !user) || (isAuth && user)) {
    // A signed-in founder who follows a /login?next=… link lands where the link pointed, not always on the dashboard.
    const target = new URL(user ? safeReturnPath(request.nextUrl.searchParams.get("next")) : "/login", request.url);
    if (!user) target.searchParams.set("next", path + request.nextUrl.search);
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response = redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/research/:path*",
    "/saved/:path*",
    "/profile/:path*",
    "/billing/:path*",
    "/onboarding/:path*",
    "/opportunities/:path*",
    "/login",
    "/signup",
    "/api/workspace/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
