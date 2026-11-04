import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
const config: NextConfig = {
  async headers() {
    return [
      {
        source:
          "/:path(dashboard|research|saved|profile|billing|onboarding|opportunities|reset-password|login|signup)/:rest*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
      {
        source: "/:path*",
        headers: [
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
export default withWorkflow(config);
