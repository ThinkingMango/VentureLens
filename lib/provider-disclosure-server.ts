import "server-only";
import { researchProviderSettings } from "@/lib/provider-settings";
import { providerDisclosure, type ProviderDisclosure } from "@/lib/provider-disclosure";

/**
 * The AI-processing disclosure for the public Privacy Policy and Support page, read on every request so a saved
 * provider change appears immediately. A public legal page must never fail or understate processing: when the policy
 * cannot be read, every provider a run could use is disclosed instead.
 */
export async function loadProviderDisclosure(): Promise<ProviderDisclosure> {
  try {
    return providerDisclosure(await researchProviderSettings());
  } catch (error) {
    console.warn("[disclosure] research policy unavailable; disclosing every provider", {
      message: error instanceof Error ? error.message : String(error),
    });
    return providerDisclosure(null);
  }
}
