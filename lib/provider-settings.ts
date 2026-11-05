import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdministrator } from "@/lib/admin-access";
import { QWEN_MODEL } from "@/lib/qwen-core";
import { GEMINI_MODEL } from "@/lib/research-fallback-core";
import {
  assertProvidersConfigured,
  providerSettingsSchema,
  readStoredProviderSettings,
  type ProviderAvailability,
  type ProviderSettingsResponse,
} from "@/lib/provider-settings-core";

const metadataKey = "research_provider_settings";

export function providerAvailability(): ProviderAvailability {
  return {
    qwen: { configured: !!process.env.DASHSCOPE_API_KEY && !!process.env.DASHSCOPE_WORKSPACE_ID, model: QWEN_MODEL },
    gemini: { configured: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY, model: GEMINI_MODEL },
  };
}

export function administratorSettings(user: User): ProviderSettingsResponse {
  if (!isAdministrator(user)) throw new Error("ADMIN_REQUIRED");
  return { settings: readStoredProviderSettings(user.app_metadata?.[metadataKey]), providers: providerAvailability() };
}

export async function saveProviderSettings(actorId: string, input: unknown): Promise<ProviderSettingsResponse> {
  const settings = providerSettingsSchema.parse(input);
  const client = createAdminClient();
  const current = await client.auth.admin.getUserById(actorId);
  if (current.error) throw new Error("SETTINGS_UNAVAILABLE");
  const actor = current.data.user;
  if (!isAdministrator(actor)) throw new Error("ADMIN_REQUIRED");
  const providers = providerAvailability();
  assertProvidersConfigured(settings, providers);
  const stored = { ...settings, updatedAt: new Date().toISOString() };
  // app_metadata is server-owned; user_metadata must never authorize or configure research spending.
  const saved = await client.auth.admin.updateUserById(actor.id, {
    app_metadata: { [metadataKey]: stored },
  });
  if (saved.error) throw new Error("SETTINGS_UNAVAILABLE");
  return { settings: stored, providers };
}

export async function researchProviderSettings(): Promise<ProviderSettingsResponse["settings"]> {
  const client = createAdminClient();
  let page = 1;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("WORKFLOW_INTERRUPTED");
    const administrator = data.users.find(isAdministrator);
    if (administrator) return readStoredProviderSettings(administrator.app_metadata?.[metadataKey]);
    if (!data.nextPage) return readStoredProviderSettings(undefined);
    page = data.nextPage;
  }
}
