import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdministrator } from "@/lib/admin-access";
import { QWEN_MODEL } from "@/lib/qwen-core";
import { GEMINI_MODEL } from "@/lib/research-fallback-core";
import {
  RESEARCH_SETTINGS_KEY,
  assertProvidersConfigured,
  providerSettingsSchema,
  readStoredProviderSettings,
  type ProviderAvailability,
  type ProviderSettingsResponse,
} from "@/lib/provider-settings-core";

export function providerAvailability(): ProviderAvailability {
  return {
    qwen: { configured: !!process.env.DASHSCOPE_API_KEY && !!process.env.DASHSCOPE_WORKSPACE_ID, model: QWEN_MODEL },
    gemini: { configured: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY, model: GEMINI_MODEL },
  };
}

// The research policy lives in public.app_settings (service role only). Missing row → defaults.
export async function researchProviderSettings(): Promise<ProviderSettingsResponse["settings"]> {
  const { data, error } = await createAdminClient()
    .from("app_settings")
    .select("value")
    .eq("key", RESEARCH_SETTINGS_KEY)
    .maybeSingle();
  if (error) throw new Error("WORKFLOW_INTERRUPTED");
  return readStoredProviderSettings(data?.value);
}

export async function administratorSettings(user: User): Promise<ProviderSettingsResponse> {
  if (!isAdministrator(user)) throw new Error("ADMIN_REQUIRED");
  return { settings: await researchProviderSettings(), providers: providerAvailability() };
}

export async function saveProviderSettings(actorId: string, input: unknown): Promise<ProviderSettingsResponse> {
  const settings = providerSettingsSchema.parse(input);
  const client = createAdminClient();
  // Re-check the actor against the auth server; the session cookie alone is not trusted for writes.
  const current = await client.auth.admin.getUserById(actorId);
  if (current.error) throw new Error("SETTINGS_UNAVAILABLE");
  if (!isAdministrator(current.data.user)) throw new Error("ADMIN_REQUIRED");
  const providers = providerAvailability();
  assertProvidersConfigured(settings, providers);
  const updatedAt = new Date().toISOString();
  const stored = { ...settings, updatedAt };
  const saved = await client
    .from("app_settings")
    .upsert({ key: RESEARCH_SETTINGS_KEY, value: stored, updated_by: actorId, updated_at: updatedAt }, { onConflict: "key" });
  if (saved.error) throw new Error("SETTINGS_UNAVAILABLE");
  return { settings: stored, providers };
}
