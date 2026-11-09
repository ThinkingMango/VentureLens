"use client";
import { Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { researchModels } from "@/lib/research-models";
import { useCopy } from "@/i18n/use-copy";

// Shared by the run page and the report. It lives on its own so those two modules do not import each other.
const providerNames: Record<string, string> = {
  "dashscope-beijing": "Qwen via DashScope",
  "google-gemini": "Gemini via Google",
};
export function ModelTag({ model, provider, planned = false }: { model: string | null; provider?: string | null; planned?: boolean }) {
  const copy = useCopy();
  if (!model) return null;
  const name = model === "mixed" ? copy("Mixed models") : (researchModels as Record<string, { name: string }>)[model]?.name ?? model;
  const vendor = provider ? providerNames[provider] : undefined;
  return (
    <Badge variant="secondary" className="gap-1.5 rounded-md font-medium" title={model}>
      <Cpu className="size-3.5" aria-hidden="true" />
      {planned ? copy("Planned model: {model}", { model: name }) : copy("Model: {model}", { model: name })}
      {vendor && <span className="font-normal text-muted-foreground">· {copy(vendor)}</span>}
    </Badge>
  );
}
