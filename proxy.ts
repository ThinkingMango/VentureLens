import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdministrator } from "@/lib/admin-access";

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
  if (user && /^\/admin(\/|$)/.test(path) && !isAdministrator(user)) {
    // Operator pages answer a signed-in non-administrator with a real 404 before anything renders, so neither the
    // status nor the page title reveals them. The pages check the claim again themselves (lib/admin-guard.ts).
    const hidden = NextResponse.rewrite(new URL("/__not-found", request.url));
    response.cookies.getAll().forEach((cookie) => hidden.cookies.set(cookie));
    response = hidden;
  } else if ((isPrivate && !user) || (isAuth && user)) {
    const target = new URL(user ? "/dashboard" : "/login", request.url);
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
