import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import createNextIntlPlugin from "next-intl/plugin";
const config: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking protection on every route (it previously skipped /, /admin, /auth/confirm and /demo).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Directives that cannot break Next.js inline scripts; a nonce-based script-src is a separate change.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
const withNextIntl = createNextIntlPlugin();
export default withWorkflow(withNextIntl(config));
