"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { ArrowRight, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { providerPlan, runCostEstimates, recommendedBudget, parseBudgetInput, settleBudgetInput, MIN_RESEARCH_BUDGET_USD, MAX_RESEARCH_BUDGET_USD, type ProviderSettings, type ProviderSettingsResponse, type ResearchProvider } from "@/lib/provider-settings-core";
import { useFormats } from "@/i18n/use-copy";
import { ProviderModelField } from "@/components/provider-model-field";
import { selectedModel, researchModels, qwenModelSchema, geminiModelSchema } from "@/lib/research-models";

const endpoint = "/api/admin/providers";
const names = { qwen: "Qwen", gemini: "Gemini" };
const providerNames = ["qwen", "gemini"] as const;
async function loadSettings(): Promise<ProviderSettingsResponse> {
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) throw new Error("SETTINGS_UNAVAILABLE");
  return response.json();
}

export function AdminProviders({ initialData }: { initialData: ProviderSettingsResponse }) {
  const t = useTranslations("admin");
  const formats = useFormats();
  const { data = initialData, error: loadError, mutate, isValidating } = useSWR(endpoint, loadSettings, { fallbackData: initialData });
  const [draft, setDraft] = useState<ProviderSettings | null>(null);
  // The budget text while it is being typed; null shows the saved or drafted value.
  const [budgetText, setBudgetText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<"saveFailed" | "notConfigured" | "accessExpired" | "budgetTooLowSaved" | null>(null);
  const settings = draft ?? data.settings;
  const changed = settings.primary !== data.settings.primary || settings.autoFallback !== data.settings.autoFallback || settings.qwenModel !== data.settings.qwenModel || settings.geminiModel !== data.settings.geminiModel || settings.budgetUsd !== data.settings.budgetUsd;
  const plan = providerPlan(settings);
  const configured = data.providers[plan.primary].configured && (!plan.fallback || data.providers[plan.fallback].configured);
  const estimates = runCostEstimates(settings);
  // The primary must fit with headroom (BUDGET_HEADROOM), the same rule the server applies on save.
  const primaryBudget = recommendedBudget(estimates.primary.requiredUsd);
  const primaryFits = primaryBudget <= settings.budgetUsd;
  const fallbackFits = !estimates.fallback || estimates.fallback.requiredUsd <= settings.budgetUsd;

  function change(patch: Partial<ProviderSettings>) {
    setDraft({ primary: settings.primary, autoFallback: settings.autoFallback, qwenModel: settings.qwenModel, geminiModel: settings.geminiModel, budgetUsd: settings.budgetUsd, ...patch });
    setSaveError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary: settings.primary, autoFallback: settings.autoFallback, qwenModel: settings.qwenModel, geminiModel: settings.geminiModel, budgetUsd: settings.budgetUsd }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setSaveError(body.code === "PROVIDER_NOT_CONFIGURED" ? "notConfigured" : body.code === "BUDGET_TOO_LOW" ? "budgetTooLowSaved" : [401, 403].includes(response.status) ? "accessExpired" : "saveFailed");
        return;
      }
      const saved: ProviderSettingsResponse = await response.json();
      await mutate(saved, { revalidate: false });
      setDraft(null);
      toast.success(t("saved"));
    } catch {
      setSaveError("saveFailed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("description")}>
        <Badge variant="secondary" className="gap-1.5"><ShieldCheck className="size-4" aria-hidden="true" />{t("administrator")}</Badge>
      </PageHeader>
      <div className="flex flex-col items-start gap-8 xl:flex-row">
        <form onSubmit={save} className="w-full min-w-0 flex-1" aria-busy={saving}>
          <Card>
            <CardHeader>
              <CardTitle><h2>{t("routing")}</h2></CardTitle>
              <CardDescription>{t("routingHelp")}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-disabled={saving}>
                  <FieldLabel htmlFor="primary-provider">{t("primary")}</FieldLabel>
                  <select
                    id="primary-provider" value={settings.primary} disabled={saving || !!loadError}
                    onChange={event => change({ primary: event.target.value as ResearchProvider })}
                    aria-describedby="primary-help"
                    className="h-12 w-full rounded-md border bg-card px-3 text-base text-foreground md:max-w-sm"
                  >
                    {providerNames.map(provider => <option key={provider} value={provider}>{names[provider]}</option>)}
                  </select>
                  <FieldDescription id="primary-help">{t("primaryHelp")}</FieldDescription>
                </Field>
                <ProviderModelField provider="qwen" model={settings.qwenModel} disabled={saving || !!loadError} onChange={model => change({ qwenModel: qwenModelSchema.parse(model) })} />
                <ProviderModelField provider="gemini" model={settings.geminiModel} disabled={saving || !!loadError} onChange={model => change({ geminiModel: geminiModelSchema.parse(model) })} />
                <p className="text-sm leading-relaxed text-muted-foreground">{t("modelBudget")}</p>
                <Field data-disabled={saving}>
                  <FieldLabel htmlFor="research-budget">{t("budget")}</FieldLabel>
                  <input
                    id="research-budget" type="number" inputMode="decimal" step="0.01" min={MIN_RESEARCH_BUDGET_USD} max={MAX_RESEARCH_BUDGET_USD}
                    value={budgetText ?? settings.budgetUsd} disabled={saving || !!loadError} aria-describedby="budget-help"
                    // Keep what is typed; apply it once it is a usable budget, and clamp only when the field is left.
                    onChange={event => { setBudgetText(event.target.value); const value = parseBudgetInput(event.target.value); if (value !== null) change({ budgetUsd: value }); }}
                    onBlur={() => { if (budgetText !== null) { change({ budgetUsd: settleBudgetInput(budgetText, settings.budgetUsd) }); setBudgetText(null); } }}
                    className="h-12 w-full rounded-md border bg-card px-3 text-base text-foreground md:max-w-xs"
                  />
                  <FieldDescription id="budget-help">{t("budgetHelp", { min: MIN_RESEARCH_BUDGET_USD, max: MAX_RESEARCH_BUDGET_USD })}</FieldDescription>
                </Field>
                <Separator />
                <Field orientation="horizontal" data-disabled={saving}>
                  <input
                    id="automatic-fallback" type="checkbox" checked={settings.autoFallback}
                    onChange={event => change({ autoFallback: event.target.checked })}
                    disabled={saving || !!loadError} aria-describedby="fallback-help"
                    className="size-5 shrink-0 accent-primary"
                  />
                  <FieldContent>
                    <FieldLabel htmlFor="automatic-fallback">{t("fallback")}</FieldLabel>
                    <FieldDescription id="fallback-help">{t("fallbackHelp")}</FieldDescription>
                  </FieldContent>
                </Field>
                <div className="flex flex-col gap-3 rounded-lg bg-background p-4 text-foreground" role="status" aria-live="polite">
                  <p className="text-sm font-medium">{t("nextRun")}</p>
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {researchModels[selectedModel(plan.primary, settings)].name}
                    {plan.fallback ? <><ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />{researchModels[selectedModel(plan.fallback, settings)].name}</> : <span className="text-sm font-normal text-muted-foreground">· {t("noFallback")}</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{t("costEstimate", { expected: formats.usd(estimates.primary.expectedUsd, 2), required: formats.usd(primaryBudget, 2) })}</p>
                  <p className="text-sm text-muted-foreground">{t("verifyEstimate", { expected: formats.usd(estimates.verify.primary.expectedUsd, 2), required: formats.usd(estimates.verify.primary.requiredUsd, 2) })}</p>
                  {!primaryFits && <p className="text-sm font-medium text-destructive">{t("budgetTooLow", { model: researchModels[estimates.primary.model].name, required: formats.usd(primaryBudget, 2) })}</p>}
                  {primaryFits && !fallbackFits && estimates.fallback && <p className="text-sm text-muted-foreground">{t("fallbackOverBudget", { model: researchModels[estimates.fallback.model].name, required: formats.usd(estimates.fallback.requiredUsd, 2) })}</p>}
                  <p className="text-sm text-muted-foreground">{t("fallbackLimit")}</p>
                </div>
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {changed ? t("unsaved") : data.settings.updatedAt ? t("lastSaved", { date: formats.date(data.settings.updatedAt, true) }) : t("defaults")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {changed && <Button type="button" variant="ghost" disabled={saving} onClick={() => { setDraft(null); setBudgetText(null); setSaveError(null); }}>{t("discard")}</Button>}
                <Button type="submit" disabled={!changed || saving || !!loadError || !configured || !primaryFits}>
                  {saving ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" data-icon="inline-start" /> : <Check aria-hidden="true" data-icon="inline-start" />}
                  {saving ? t("saving") : t("save")}
                </Button>
              </div>
            </CardFooter>
          </Card>
          {(saveError || loadError || !configured) && (
            <div className="flex flex-col gap-3 py-4" role="alert">
              <p className="text-sm">{t(saveError ?? (loadError ? "loadFailed" : "notConfigured"))}</p>
              {loadError && <Button type="button" variant="outline" disabled={isValidating} onClick={() => { void mutate().catch(() => undefined); }}>{isValidating ? t("loading") : t("reload")}</Button>}
            </div>
          )}
        </form>
        <aside className="flex w-full flex-col gap-6 xl:w-72" aria-label={t("details")}>
          <section className="flex flex-col gap-3" aria-labelledby="provider-status-title">
            <h2 id="provider-status-title" className="font-semibold">{t("credentials")}</h2>
            <p className="text-sm text-muted-foreground">{t("credentialsHelp")}</p>
            <dl className="flex flex-col gap-4">
              {providerNames.map(provider => (
                <div key={provider} className="flex flex-col gap-1">
                  <dt className="flex flex-wrap items-center justify-between gap-2 font-medium">{names[provider]}<Badge variant={data.providers[provider].configured ? "secondary" : "outline"}>{t(data.providers[provider].configured ? "configured" : "missing")}</Badge></dt>
                  <dd className="text-sm text-muted-foreground">{researchModels[selectedModel(provider, settings)].name}</dd>
                </div>
              ))}
            </dl>
          </section>
          <Separator />
          <section className="flex flex-col gap-2" aria-labelledby="admin-access-title">
            <h2 id="admin-access-title" className="font-semibold">{t("access")}</h2>
            <p className="text-sm text-muted-foreground">{t("accessHelp")}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">app_metadata.role = &quot;admin&quot;</p>
          </section>
          <p className="text-sm text-muted-foreground">{t("scope")}</p>
          <p className="text-sm text-muted-foreground">{t("disclosure")}</p>
        </aside>
      </div>
    </>
  );
}
