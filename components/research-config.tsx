"use client";
import { MobileDisclosure } from "@/components/mobile-disclosure";
import { useCopy } from "@/i18n/use-copy";
import { feedbackSource } from "@/i18n/errors";
import { postJson, ApiNetworkError } from "@/lib/api-client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { localeNames, type Locale } from "@/i18n/config";
import Link from "@/components/workspace-link";
import {
  ArrowLeft,
  ArrowRight,
  Telescope,
  Check,
  UserRound,
  Clock3,
  Lock,
} from "lucide-react";
import { useDemo } from "@/components/demo-provider";
import type { ResearchBrief } from "@/lib/workspace-schema";
import { scoringWeights } from "@/lib/research-core";
import {
  anySector,
  businessModelGroups,
  businessModelLead,
  businessModels,
  maxBusinessModels,
  maxResearchSectors,
  researchSectors,
  targetMarketGroups,
  targetMarketLead,
  toggleChoice,
} from "@/lib/research-options";
import { PageHeader, DemoNote } from "@/components/shared";
import { ResearchAccessCard } from "@/components/research-access-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
const pipeline = [
  ["Discover", "Up to eight narrow hypotheses from your brief and profile."],
  [
    "Retrieve",
    "Live web search for buyer pain, spending, competitors, and counter-evidence.",
  ],
  ["Classify", "Every excerpt is tagged by kind, reliability, and stance."],
  [
    "Score & review",
    "Weighted scoring, then an adversarial pass that can only deduct.",
  ],
  ["Save", "A private report with linked sources you can reopen any time."],
];
// The three discovery modes, each described by what it changes in the engine (lib/research-engine.ts): where
// hypotheses start, whether the founder profile is read, and how much founder advantage weighs in the score. The weight
// is read from scoringWeights, so the copy cannot drift from the scoring.
const discoveryModes = [
  {
    value: "combined",
    title: "Combined discovery",
    text: "Weighs buyer demand and your fit together. Your advantage counts for {weight}% of the score.",
  },
  {
    value: "founder",
    title: "Founder advantage",
    text: "Starts from your skills, channels and resources. Your advantage counts for {weight}% of the score.",
  },
  {
    value: "market",
    title: "Market-first",
    text: "Starts only from buyer pain and spending. Your profile isn’t used, and advantage doesn’t count.",
  },
] as const;
// One option of a multi-choice field: a native checkbox (so keyboard, form and screen-reader behaviour come for free)
// drawn as a chip with a 44px touch target.
function ChoiceChip({
  value,
  label,
  checked,
  disabled,
  onToggle,
}: {
  value: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer select-none items-center gap-1.5 rounded-full border bg-card px-3.5 py-2 text-sm leading-tight transition-colors hover:border-primary/60 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:font-medium has-[:checked]:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:disabled]:hover:border-border">
      <input
        type="checkbox"
        className="sr-only"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
      />
      {checked && <Check aria-hidden className="size-4 shrink-0" />}
      {label}
    </label>
  );
}
export function ResearchConfig({ initialBrief }: { initialBrief?: ResearchBrief } = {}) {
  const copy = useCopy();
  const { run, setRun, profile, isDemo, href, busy, refresh, data } = useDemo();
  // A brief passed in (from an earlier run) wins; a first brief starts from the founder's own industry when it is one
  // of the research industries.
  const [draft, setDraft] = useState(() =>
    initialBrief ? initialBrief
    : !isDemo && !data?.projects.length && (researchSectors as readonly string[]).includes(profile.industry)
      ? { ...run, sectors: [profile.industry as (typeof run.sectors)[number]] }
      : run,
  );
  const [submitting, setSubmitting] = useState(false);
  const requestKey = useRef<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [formError, setFormError] = useState("");
  const router = useRouter();
  const locale = useLocale() as Locale;
  const accessBlocked = !isDemo && !data?.access.enabled;
  return (
    <>
      <Link
        href="/research"
        className="flex w-fit items-center gap-2 text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {copy("My research")}
      </Link>
      <PageHeader
        title={copy("What would you like to explore?")}
        description={
          isDemo
            ? copy(
                "Configure a research brief and preview a clearly labeled demonstration report.",
              )
            : copy(
                "Describe the market you want to explore. Live research retrieves real sources, scores each hypothesis, and saves a private report.",
              )
        }
      />
      {accessBlocked && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-warm/40 bg-warm-soft p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 size-5 shrink-0 text-warm" />
            <div className="flex flex-col gap-1">
              <p className="font-medium">{copy("No research runs left")}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {copy(
                  "Your brief will be saved to your workspace, but a live run cannot start until more runs are available. Paid credits are planned; explore a complete sample report in the demo meanwhile.",
                )}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/demo/research/results">
              {copy("Read a sample report")}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="surface p-6 md:p-8">
          <form
            className="flex flex-col gap-7"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || submitting) return;
              if (!draft.name.trim()) {
                setNameError(
                  "Enter a research name, such as Agency workflow research.",
                );
                document.getElementById("research-name")?.focus();
                return;
              }
              setNameError("");
              setFormError("");
              setSubmitting(true);
              try {
                const brief = { ...draft, name: draft.name.trim() };
                if (isDemo) {
                  await setRun(brief);
                  router.push(href("/research/results?demo=1"));
                } else if (accessBlocked) {
                  await setRun(brief);
                  router.push("/research");
                } else {
                  requestKey.current ??= crypto.randomUUID();
                  // The request key makes a start idempotent: re-sending after a dropped connection returns
                  // the run the first attempt created instead of a second run.
                  let result;
                  try {
                    result = await postJson(
                      "/api/research",
                      {
                        action: "start",
                        brief: { ...brief, language: locale },
                        requestKey: requestKey.current,
                      },
                      { networkRetries: 2 },
                    );
                  } catch (error) {
                    if (!(error instanceof ApiNetworkError)) throw error;
                    await refresh().catch(() => undefined);
                    throw new Error(feedbackSource("NETWORK_ERROR"));
                  }
                  const id =
                    typeof result.body.id === "string" ? result.body.id : null;
                  if (!result.ok || !id) {
                    // The server answered and created nothing, so an edited brief may start fresh.
                    if (result.status >= 400 && result.status < 500)
                      requestKey.current = null;
                    throw new Error(
                      feedbackSource(result.body.code, "START_FAILED"),
                    );
                  }
                  await refresh().catch(() => undefined);
                  router.push(`/research/${id}`);
                }
                router.refresh();
              } catch (error) {
                setFormError(
                  error instanceof Error && error.message
                    ? error.message
                    : feedbackSource("START_FAILED"),
                );
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <FieldGroup>
              <section
                aria-labelledby="research-focus-group"
                className="flex flex-col gap-5 rounded-xl bg-background/65 p-4 sm:p-5"
              >
                <h2 id="research-focus-group" className="text-lg font-semibold">
                  {copy("Set your research focus")}
                </h2>
              <Field data-invalid={!!nameError}>
                <FieldLabel htmlFor="research-name">
                  {copy("Research name (required)")}
                </FieldLabel>
                <Input
                  id="research-name"
                  value={draft.name}
                  maxLength={100}
                  required
                  placeholder={copy("e.g. GenAI tools for boutique agencies")}
                  aria-invalid={!!nameError}
                  aria-describedby={
                    nameError ? "research-name-error" : "research-name-help"
                  }
                  onChange={(e) => {
                    setDraft({ ...draft, name: e.target.value });
                    setNameError("");
                  }}
                />
                {nameError ? (
                  <FieldError id="research-name-error">
                    {copy(nameError)}
                  </FieldError>
                ) : (
                  <FieldDescription id="research-name-help">
                    {copy(
                      "Use a descriptive name so you can find this brief later. Up to 100 characters.",
                    )}
                  </FieldDescription>
                )}
              </Field>
              </section>
              <section
                aria-labelledby="discovery-preferences-group"
                className="flex flex-col gap-5 rounded-xl bg-background/65 p-4 sm:p-5"
              >
                <h2 id="discovery-preferences-group" className="text-lg font-semibold">
                  {copy("Discovery preferences")}
                </h2>
              <FieldSet id="discovery-mode" className="gap-3">
                <FieldLegend variant="label" className="mb-0">
                  {copy("Discovery mode")}
                </FieldLegend>
                <div className="grid gap-2">
                  {discoveryModes.map((mode) => (
                    <label
                      key={mode.value}
                      className="flex cursor-pointer gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/60 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
                    >
                      <input
                        type="radio"
                        name="discovery-mode"
                        value={mode.value}
                        checked={(draft.discovery_mode ?? "combined") === mode.value}
                        onChange={() =>
                          setDraft({ ...draft, discovery_mode: mode.value })
                        }
                        aria-describedby={`discovery-mode-${mode.value}-help`}
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="font-medium leading-snug">
                          {copy(mode.title)}
                        </span>
                        <span
                          id={`discovery-mode-${mode.value}-help`}
                          className="text-sm leading-snug text-muted-foreground"
                        >
                          {copy(mode.text, {
                            weight: Math.round(
                              scoringWeights[mode.value].advantage * 100,
                            ),
                          })}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </FieldSet>
              <FieldSet
                id="sectors"
                aria-describedby="sectors-help"
                className="gap-3"
              >
                <FieldLegend variant="label" className="mb-0">
                  {copy("Industry or market")}
                </FieldLegend>
                <div className="flex flex-wrap gap-2">
                  {[anySector, ...researchSectors.filter((v) => v !== anySector)].map((v) => {
                    const checked = draft.sectors.includes(v);
                    return (
                      <ChoiceChip
                        key={v}
                        value={v}
                        label={copy(v)}
                        checked={checked}
                        disabled={
                          !checked &&
                          v !== anySector &&
                          draft.sectors.filter((s) => s !== anySector).length >= maxResearchSectors
                        }
                        onToggle={() =>
                          setDraft({
                            ...draft,
                            sectors: toggleChoice(researchSectors, draft.sectors, v, anySector, maxResearchSectors),
                          })
                        }
                      />
                    );
                  })}
                </div>
                <FieldDescription id="sectors-help" aria-live="polite">
                  {draft.sectors.length >= maxResearchSectors
                    ? copy(
                        "You’ve chosen {count} industries, the most one run covers well. Untick one to choose another.",
                        { count: maxResearchSectors },
                      )
                    : copy(
                        "Choose up to {count}. Each run explores eight ideas in total, so fewer industries means deeper research in each.",
                        { count: maxResearchSectors },
                      )}
                </FieldDescription>
              </FieldSet>
              <FieldSet
                id="models"
                aria-describedby="models-help"
                className="gap-3"
              >
                <FieldLegend variant="label" className="mb-0">
                  {copy("Business model")}
                </FieldLegend>
                <div className="flex flex-wrap gap-2">
                  <ChoiceChip
                    value={businessModelLead}
                    label={copy(businessModelLead)}
                    checked={draft.models.includes(businessModelLead)}
                    disabled={false}
                    onToggle={() =>
                      setDraft({
                        ...draft,
                        models: toggleChoice(businessModels, draft.models, businessModelLead, businessModelLead, maxBusinessModels),
                      })
                    }
                  />
                </div>
                {businessModelGroups.map((group) => (
                  <div
                    key={group.label}
                    role="group"
                    aria-label={copy(group.label)}
                    className="flex flex-col gap-2"
                  >
                    <span aria-hidden className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {copy(group.label)}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {group.options.map((v) => (
                        <ChoiceChip
                          key={v}
                          value={v}
                          label={copy(v)}
                          checked={draft.models.includes(v)}
                          disabled={false}
                          onToggle={() =>
                            setDraft({
                              ...draft,
                              models: toggleChoice(businessModels, draft.models, v, businessModelLead, maxBusinessModels),
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <FieldDescription id="models-help">
                  {copy(
                    "Choose every model you would accept. Each idea uses one of them.",
                  )}
                </FieldDescription>
              </FieldSet>
              <Field>
                <FieldLabel htmlFor="geography">
                  {copy("Target market")}
                </FieldLabel>
                <select
                  id="geography"
                  className="field-select"
                  value={draft.geography}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      geography: e.target.value as typeof draft.geography,
                    })
                  }
                >
                  <option value={targetMarketLead}>{copy(targetMarketLead)}</option>
                  {targetMarketGroups.map((group) => (
                    <optgroup key={group.label} label={copy(group.label)}>
                      {group.options.map((v) => (
                        <option key={v} value={v}>
                          {copy(v)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              </section>
              <section
                aria-labelledby="research-constraints-group"
                className="flex flex-col gap-5 rounded-xl bg-background/65 p-4 sm:p-5"
              >
                <h2 id="research-constraints-group" className="text-lg font-semibold">
                  {copy("Your real-world constraints")}
                </h2>
              <Field>
                <FieldLabel htmlFor="context">
                  {copy("Anything else to keep in mind?")}{" "}
                  <span className="text-muted-foreground">
                    {copy("(optional)")}
                  </span>
                </FieldLabel>
                <textarea
                  id="context"
                  value={draft.context}
                  onChange={(event) =>
                    setDraft({ ...draft, context: event.target.value })
                  }
                  aria-describedby="context-help"
                  maxLength={1000}
                  className="field-select min-h-24"
                  placeholder={copy(
                    "A buyer group, a problem you’ve noticed, a city or region, or a niche you know well…",
                  )}
                />
                <FieldDescription id="context-help">
                  {isDemo
                    ? copy(
                        "Up to 1,000 characters. Demo notes stay in memory; results remain fixed synthetic examples.",
                      )
                    : copy(
                        "Up to 1,000 characters. Your brief is saved privately; the market context is sent to the research model and web retrieval, so leave out sensitive details.",
                      )}
                </FieldDescription>
              </Field>
              </section>
            </FieldGroup>
            <section
              aria-labelledby="research-review-group"
              className="flex flex-col gap-5 rounded-xl border bg-card p-4 sm:p-5"
            >
              <h2 id="research-review-group" className="text-lg font-semibold">
                {copy("Review and start")}
              </h2>
            {formError && (
              <p role="alert" className="rounded-lg border p-4 text-sm">
                {copy(formError)}
              </p>
            )}
            <div className="flex flex-col items-stretch justify-between gap-4 border-t pt-5 sm:flex-row sm:items-center">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {isDemo ? (
                  copy("0 credits used in demo mode")
                ) : accessBlocked ? (
                  copy("Saves the brief only · No live run on this account yet")
                ) : (
                  <>
                    <Clock3 className="size-4" />
                    {copy(
                      "Usually 5–10 minutes · Uses one research run, returned if the run fails (within a per-account limit)",
                    )}
                    {" · "}
                    {copy("Report in {language}", {
                      language: localeNames[locale],
                    })}
                  </>
                )}
              </span>
              <Button
                type="submit"
                disabled={busy || submitting}
                aria-busy={busy || submitting}
              >
                {busy || submitting
                  ? copy("Submitting…")
                  : isDemo
                    ? copy("Preview research results")
                    : accessBlocked
                      ? copy("Save brief")
                      : copy("Start evidence research")}
                <ArrowRight />
              </Button>
            </div>
            </section>
          </form>
        </section>
        <aside className="flex flex-col gap-5">
          {!isDemo && <ResearchAccessCard compact />}
          <MobileDisclosure title={copy("Your founder context")}>
            <section className="surface flex flex-col gap-4 p-6">
              <div className="flex items-center gap-2">
                <UserRound className="size-5 text-primary" />
                <h2 className="font-semibold">
                  {copy("Your founder context")}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {isDemo
                  ? copy(
                      "Reference your experience while exploring. Profile changes do not personalize demo results.",
                    )
                  : copy(
                      "A snapshot of your profile is saved with each run. Founder-advantage and combined modes use it; market-first does not.",
                    )}
              </p>
              <dl className="flex flex-col gap-4">
                {[
                  ["Experience", profile.industry],
                  [
                    "Time available",
                    copy("{hours} / week", { hours: copy(profile.hours) }),
                  ],
                  ["Starting budget", profile.budget],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-sm text-muted-foreground">{copy(k)}</dt>
                    <dd className="mt-1 font-medium">{copy(v)}</dd>
                  </div>
                ))}
              </dl>
              <Link
                href="/profile"
                className="text-sm font-medium text-primary"
              >
                {copy("Edit founder profile")}
                <ArrowRight className="ml-1 inline size-4" />
              </Link>
            </section>
          </MobileDisclosure>
          <section className="flex flex-col gap-4 rounded-xl bg-secondary p-6 text-foreground">
            <Telescope className="size-6 text-primary" />
            <h2 className="font-semibold">
              {isDemo
                ? copy("A structured view of the possibilities")
                : copy("What happens when you start")}
            </h2>
            {isDemo ? (
              <ul className="flex flex-col gap-3">
                {[
                  "Ranked opportunity hypotheses",
                  "Clear buyer and pain profiles",
                  "Evidence quality and key risks",
                  "Illustrative business economics",
                  "Practical validation next steps",
                ].map((t) => (
                  <li
                    key={t}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Check className="size-4 shrink-0 text-primary" />
                    {copy(t)}
                  </li>
                ))}
              </ul>
            ) : (
              <ol className="flex flex-col gap-3">
                {pipeline.map(([title, text], index) => (
                  <li key={title} className="flex gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span>
                      <span className="font-medium">{copy(title)}</span>
                      <span className="block text-muted-foreground">
                        {copy(text)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <DemoNote />
        </aside>
      </div>
    </>
  );
}
