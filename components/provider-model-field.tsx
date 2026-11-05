"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { GOOGLE_API_BASE, QWEN_API_TEMPLATE, MODEL_CATALOG_CHECKED_AT, qwenModelIds, geminiModelIds, researchModels, type ResearchModelId } from "@/lib/research-models";
import type { ResearchProvider } from "@/lib/provider-settings-core";

export function ProviderModelField({ provider, model, disabled, onChange }: {
  provider: ResearchProvider;
  model: ResearchModelId;
  disabled: boolean;
  onChange: (model: string) => void;
}) {
  const t = useTranslations("admin");
  const ids = provider === "qwen" ? qwenModelIds : geminiModelIds;
  const info = researchModels[model];
  const generationUrl = provider === "qwen" ? `${QWEN_API_TEMPLATE}/chat/completions` : `${GOOGLE_API_BASE}/models/${model}:generateContent`;
  const searchUrl = provider === "qwen" ? `${QWEN_API_TEMPLATE}/responses` : generationUrl;
  const docs = provider === "qwen" ? "https://www.alibabacloud.com/help/en/model-studio/web-search#web-search-with-responses-api" : `https://ai.google.dev/gemini-api/docs/models/${model}`;

  return (
    <Field data-disabled={disabled}>
      <FieldLabel htmlFor={`${provider}-model`}>{t("modelLabel", { provider: provider === "qwen" ? "Qwen" : "Gemini" })}</FieldLabel>
      <select id={`${provider}-model`} value={model} disabled={disabled} onChange={event => onChange(event.target.value)} aria-describedby={`${provider}-model-help`} className="h-12 w-full rounded-md border bg-card px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {ids.map(id => <option key={id} value={id}>{researchModels[id].name} · {t(researchModels[id].capability)}</option>)}
      </select>
      <FieldDescription id={`${provider}-model-help`}>{t(info.capability)}</FieldDescription>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{t("webSearch")}</Badge>
        <span className="text-sm text-muted-foreground">{t(provider === "qwen" ? "qwenSearch" : "googleSearch")}</span>
      </div>
      <details className="min-w-0 text-sm">
        <summary className="cursor-pointer py-2 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">{t("apiDetails")}</summary>
        <dl className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1"><dt className="text-muted-foreground">{t("modelId")}</dt><dd className="break-all font-mono">{model}</dd></div>
          <div className="flex flex-col gap-1"><dt className="text-muted-foreground">{t("generationApi")}</dt><dd className="break-all font-mono">{generationUrl}</dd></div>
          <div className="flex flex-col gap-1"><dt className="text-muted-foreground">{t("searchApi")}</dt><dd className="break-all font-mono">{searchUrl}</dd></div>
        </dl>
        <p className="flex flex-wrap items-center gap-2 py-2 text-muted-foreground"><a href={docs} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">{t("documentation")}</a><span>{t("catalogChecked", { date: MODEL_CATALOG_CHECKED_AT })}</span></p>
        {provider === "qwen" && <p className="text-muted-foreground">{t("workspaceEndpoint", { WorkspaceId: "{WorkspaceId}" })}</p>}
      </details>
    </Field>
  );
}
