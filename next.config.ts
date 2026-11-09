import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import createNextIntlPlugin from "next-intl/plugin";
const config: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No page may be framed by another site (clickjacking), including /admin and /auth/confirm, which an
          // allowlist of routes previously missed. X-Frame-Options covers browsers without frame-ancestors.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Only directives that cannot break Next.js's inline scripts. A script-src policy needs per-request nonces.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'",
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
