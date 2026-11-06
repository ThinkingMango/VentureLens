import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdministrator } from "@/lib/admin-access";
import { administratorSettings, saveProviderSettings } from "@/lib/provider-settings";
import { providerSettingsSchema } from "@/lib/provider-settings-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function identity() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : user;
}

export async function GET() {
  try {
    const user = await identity();
    if (!user) return json({ code: "AUTH_REQUIRED" }, 401);
    if (!isAdministrator(user)) return json({ code: "ADMIN_REQUIRED" }, 403);
    return json(await administratorSettings(user));
  } catch {
    return json({ code: "SETTINGS_UNAVAILABLE" }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))) {
      return json({ code: "INVALID_ORIGIN" }, 403);
    }
    const user = await identity();
    if (!user) return json({ code: "AUTH_REQUIRED" }, 401);
    if (!isAdministrator(user)) return json({ code: "ADMIN_REQUIRED" }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ code: "INVALID_INPUT" }, 415);
    if (Number(request.headers.get("content-length") ?? 0) > 1024) return json({ code: "INVALID_INPUT" }, 413);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 1024) return json({ code: "INVALID_INPUT" }, 413);
    const parsed = providerSettingsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return json({ code: "INVALID_INPUT" }, 400);
    return json(await saveProviderSettings(user.id, parsed.data));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) return json({ code: "INVALID_INPUT" }, 400);
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") return json({ code: "ADMIN_REQUIRED" }, 403);
    if (error instanceof Error && error.message === "PROVIDER_NOT_CONFIGURED") return json({ code: "PROVIDER_NOT_CONFIGURED" }, 409);
    if (error instanceof Error && error.message === "BUDGET_TOO_LOW") return json({ code: "BUDGET_TOO_LOW", requiredUsd: (error as { requiredUsd?: number }).requiredUsd ?? null }, 409);
    return json({ code: "SETTINGS_UNAVAILABLE" }, 503);
  }
}
