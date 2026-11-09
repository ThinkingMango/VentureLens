import { providerPlan, type ProviderSettings, type ResearchProvider } from "./provider-settings-core.ts";
import { researchModels, selectedModel, type ResearchModelId } from "./research-models.ts";

// What the public Privacy Policy and Support page say about AI processing, derived from the same research policy
// (public.app_settings, key "research") that new runs read. Only these derived facts reach the browser; the budget
// and anything about credentials stay on the server.

export type DisclosedProvider = {
  provider: ResearchProvider;
  model: ResearchModelId;
  /** Display name of the model, e.g. "Qwen 3.8 Flash". A proper noun, shown untranslated. */
  modelName: string;
  /** The company that processes requests for this provider, as named in the Privacy Policy. */
  processor: string;
  /** Whether this provider processes requests in mainland China. */
  processesInChina: boolean;
};

export type ProviderDisclosure =
  | {
      /** The saved policy was read: primary and fallback are exactly what new runs use. */
      known: true;
      primary: DisclosedProvider;
      fallback: DisclosedProvider | null;
      /** True when any provider that new runs may use processes requests in mainland China. */
      processesInChina: boolean;
      /** When an administrator last saved the policy; null while the defaults are in use. */
      settingsUpdatedAt: string | null;
    }
  | {
      /** The policy could not be read, so every provider a run could use is disclosed. */
      known: false;
      providers: DisclosedProvider[];
      processesInChina: true;
      settingsUpdatedAt: null;
    };

const processors: Record<ResearchProvider, { processor: string; processesInChina: boolean }> = {
  qwen: { processor: "Alibaba Cloud Model Studio", processesInChina: true },
  gemini: { processor: "Google", processesInChina: false },
};

function describe(provider: ResearchProvider, settings: Partial<Pick<ProviderSettings, "qwenModel" | "geminiModel">>): DisclosedProvider {
  const model = selectedModel(provider, settings);
  return { provider, model, modelName: researchModels[model].name, ...processors[provider] };
}

/**
 * Builds the public disclosure from the saved research policy. Pass `null` when the policy could not be read: the
 * result then names every provider a run could use, so the notice never understates where data may go.
 */
export function providerDisclosure(settings: (ProviderSettings & { updatedAt?: string | null }) | null): ProviderDisclosure {
  if (!settings) {
    // Default models: with the policy unreadable, the provider names are what matters for the disclosure.
    return { known: false, providers: [describe("qwen", {}), describe("gemini", {})], processesInChina: true, settingsUpdatedAt: null };
  }
  const plan = providerPlan(settings);
  const primary = describe(plan.primary, settings);
  const fallback = plan.fallback ? describe(plan.fallback, settings) : null;
  return {
    known: true,
    primary,
    fallback,
    processesInChina: primary.processesInChina || !!fallback?.processesInChina,
    settingsUpdatedAt: settings.updatedAt ?? null,
  };
}
