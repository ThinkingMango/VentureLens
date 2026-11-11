"use client";

import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  sourceKinds, recencyOptions, defaultSourcePolicy, sameSourcePolicy, retrievalLimits,
  MIN_CANDIDATES, MAX_CANDIDATES, MIN_PAGES_PER_IDEA, MAX_PAGES_PER_IDEA,
  type SourceKind, type SourcePolicy,
} from "@/lib/provider-settings-core";

const selectClass = "h-12 w-full rounded-md border bg-card px-3 text-base text-foreground md:max-w-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const checkboxClass = "size-5 shrink-0 accent-primary";
const range = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, index) => min + index);

/**
 * Breadth and depth of evidence collection for new research runs (lib/source-policy.ts). Part of the provider form on
 * /admin: it edits the draft, and the form's single Save button stores it with the provider policy.
 */
export function AdminSources({ policy, disabled, onChange }: { policy: SourcePolicy; disabled: boolean; onChange: (policy: SourcePolicy) => void }) {
  const t = useTranslations("admin");
  const set = (patch: Partial<SourcePolicy>) => onChange({ ...policy, ...patch });
  const toggleKind = (kind: SourceKind, on: boolean) => set({ kinds: sourceKinds.filter(item => item === kind ? on : policy.kinds.includes(item)) });
  const discovery = retrievalLimits(policy, "combined");
  const verify = retrievalLimits(policy, "verify");
  const searches = policy.candidates * (policy.alternativesSearch ? 2 : 1);

  return (
    <section className="flex flex-col gap-6" aria-labelledby="sources-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id="sources-title" className="font-semibold">{t("sources")}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("sourcesHelp")}</p>
        </div>
        {!sameSourcePolicy(policy, defaultSourcePolicy) && (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange({ ...defaultSourcePolicy, kinds: [...defaultSourcePolicy.kinds] })}>
            <RotateCcw aria-hidden="true" data-icon="inline-start" />{t("sourcesReset")}
          </Button>
        )}
      </div>

      <FieldSet data-disabled={disabled}>
        <FieldLegend>{t("breadth")}</FieldLegend>
        <FieldDescription>{t("breadthHelp")}</FieldDescription>
        <FieldGroup>
          <fieldset className="flex flex-col gap-3" aria-describedby="source-kinds-help">
            <legend className="text-sm font-medium">{t("sourceKinds")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {sourceKinds.map(kind => {
                const checked = policy.kinds.includes(kind);
                // At least one source type stays selected: the last one cannot be cleared.
                const locked = checked && policy.kinds.length === 1;
                return (
                  <Field key={kind} orientation="horizontal" data-disabled={disabled || locked}>
                    <input id={`source-kind-${kind}`} type="checkbox" checked={checked} disabled={disabled || locked} onChange={event => toggleKind(kind, event.target.checked)} className={checkboxClass} />
                    <FieldLabel htmlFor={`source-kind-${kind}`} className="font-normal">{t(`sourceKind_${kind}`)}</FieldLabel>
                  </Field>
                );
              })}
            </div>
            <p id="source-kinds-help" className="text-sm text-muted-foreground">{t("sourceKindsHelp")}</p>
          </fieldset>

          <Field orientation="horizontal" data-disabled={disabled}>
            <input id="sector-communities" type="checkbox" checked={policy.sectorCommunities} disabled={disabled} onChange={event => set({ sectorCommunities: event.target.checked })} aria-describedby="sector-communities-help" className={checkboxClass} />
            <FieldContent>
              <FieldLabel htmlFor="sector-communities">{t("sectorCommunities")}</FieldLabel>
              <FieldDescription id="sector-communities-help">{t("sectorCommunitiesHelp")}</FieldDescription>
            </FieldContent>
          </Field>

          <Field orientation="horizontal" data-disabled={disabled}>
            <input id="alternatives-search" type="checkbox" checked={policy.alternativesSearch} disabled={disabled} onChange={event => set({ alternativesSearch: event.target.checked })} aria-describedby="alternatives-search-help" className={checkboxClass} />
            <FieldContent>
              <FieldLabel htmlFor="alternatives-search">{t("alternativesSearch")}</FieldLabel>
              <FieldDescription id="alternatives-search-help">{t("alternativesSearchHelp")}</FieldDescription>
            </FieldContent>
          </Field>

          <Field data-disabled={disabled}>
            <FieldLabel htmlFor="vendor-pages">{t("vendorPages")}</FieldLabel>
            <select id="vendor-pages" value={policy.vendorPages} disabled={disabled} onChange={event => set({ vendorPages: event.target.value === "0" ? 0 : 1 })} aria-describedby="vendor-pages-help" className={selectClass}>
              <option value={1}>{t("vendorPagesOne")}</option>
              <option value={0}>{t("vendorPagesNone")}</option>
            </select>
            <FieldDescription id="vendor-pages-help">{t("vendorPagesHelp")}</FieldDescription>
          </Field>

          <Field data-disabled={disabled}>
            <FieldLabel htmlFor="source-recency">{t("recency")}</FieldLabel>
            <select id="source-recency" value={policy.recency} disabled={disabled} onChange={event => set({ recency: recencyOptions.find(option => option === event.target.value) ?? "any" })} aria-describedby="source-recency-help" className={selectClass}>
              {recencyOptions.map(option => <option key={option} value={option}>{t(`recency_${option}`)}</option>)}
            </select>
            <FieldDescription id="source-recency-help">{t("recencyHelp")}</FieldDescription>
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet data-disabled={disabled}>
        <FieldLegend>{t("depth")}</FieldLegend>
        <FieldDescription>{t("depthHelp")}</FieldDescription>
        <FieldGroup>
          <Field data-disabled={disabled}>
            <FieldLabel htmlFor="source-candidates">{t("candidates")}</FieldLabel>
            <select id="source-candidates" value={policy.candidates} disabled={disabled} onChange={event => set({ candidates: Number(event.target.value) })} aria-describedby="source-candidates-help" className={selectClass}>
              {range(MIN_CANDIDATES, MAX_CANDIDATES).map(count => <option key={count} value={count}>{t("candidatesOption", { count })}</option>)}
            </select>
            <FieldDescription id="source-candidates-help">{t("candidatesHelp")}</FieldDescription>
          </Field>
          <Field data-disabled={disabled}>
            <FieldLabel htmlFor="source-pages">{t("pagesPerIdea")}</FieldLabel>
            <select id="source-pages" value={policy.pagesPerIdea} disabled={disabled} onChange={event => set({ pagesPerIdea: Number(event.target.value) })} aria-describedby="source-pages-help" className={selectClass}>
              {range(MIN_PAGES_PER_IDEA, MAX_PAGES_PER_IDEA).map(count => <option key={count} value={count}>{t("pagesOption", { count })}</option>)}
            </select>
            <FieldDescription id="source-pages-help">{t("pagesPerIdeaHelp")}</FieldDescription>
          </Field>
        </FieldGroup>
      </FieldSet>

      <p className="text-sm text-muted-foreground">
        {t("sourcesSummary", { searches, ideas: policy.candidates, pages: discovery.evidence, results: discovery.sources, verifyPages: verify.evidence })}
      </p>
      <p className="text-sm text-muted-foreground">{t("sourcesGate")}</p>
    </section>
  );
}
