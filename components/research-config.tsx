"use client";
import { MobileDisclosure } from "@/components/mobile-disclosure";
import { useCopy } from "@/i18n/use-copy";
import { feedbackSource } from "@/i18n/errors";
import { postJson, ApiNetworkError } from "@/lib/api-client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Lightbulb,
  Compass,
} from "lucide-react";
import { useDemo } from "@/components/demo-provider";
import { ideaSchema, type ResearchBrief, type ResearchIdea } from "@/lib/workspace-schema";
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
  angleOptions,
  maxAngles,
  visibleAngles,
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
// "Verify my idea" (WP-05): what a check does, in place of the discovery pipeline.
const verifyPipeline = [
  ["Search twice", "One search for evidence of the problem and what buyers spend, one for the alternatives they use today."],
  ["Classify", "Every excerpt is tagged by kind, reliability, and stance."],
  ["Score & review", "The same evidence rules, scoring and adversarial review as discovery."],
  ["Verdict", "Supported by independent evidence, or not yet, with the sources and what would change it."],
];
const blankIdea: ResearchIdea = { title: "", buyer: "", pain: "", offer: "", price_hint: "" };
type IdeaField = "title" | "buyer" | "pain";
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
// The form's sections are numbered, so a long brief reads as a short sequence of steps.
function StepNumber({ n, done = false }: { n: number; done?: boolean }) {
  return (
    <span aria-hidden="true" className="step-number" data-done={done || undefined}>
      {done ? <Check className="size-3.5" strokeWidth={2.5} /> : n}
    </span>
  );
}
type BriefStep = { id: string; title: string; summary?: string; done: boolean; optional?: boolean };
// Wide screens: a sticky outline of the brief, with what has been chosen so far and a link to each section.
function BriefOutline({ steps }: { steps: BriefStep[] }) {
  const copy = useCopy();
  return (
    <nav aria-label={copy("On this page")} className="surface hidden flex-col gap-4 p-6 xl:sticky xl:top-24 xl:flex">
      <h2 className="font-semibold">{copy("Your brief")}</h2>
      <ol className="brief-outline flex flex-col">
        {steps.map((step, index) => (
          <li key={step.id}>
            <a href={`#${step.id}`} className="flex gap-3 rounded-lg py-2 pr-2 hover:text-primary">
              <StepNumber n={index + 1} done={step.done} />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium leading-snug">
                  {copy(step.title)}
                  {step.optional && <span className="font-normal text-muted-foreground"> {copy("(optional)")}</span>}
                </span>
                {step.summary && (
                  <span className="truncate text-sm text-muted-foreground">{step.summary}</span>
                )}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
export function ResearchConfig({ initialBrief }: { initialBrief?: ResearchBrief } = {}) {
  const copy = useCopy();
  const { run, setRun, profile, isDemo, href, busy, refresh, data } = useDemo();
  // A brief passed in (from an earlier run) wins; a first brief starts from the founder's own industry when it is one
  // of the research industries.
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState(() => {
    const start: ResearchBrief = initialBrief ? initialBrief
      : !isDemo && !data?.projects.length && (researchSectors as readonly string[]).includes(profile.industry)
        ? { ...run, sectors: [profile.industry as (typeof run.sectors)[number]] }
        : run;
    // "Check an idea" links open the form on the idea side.
    return searchParams.get("mode") === "verify" && start.discovery_mode !== "verify"
      ? { ...start, discovery_mode: "verify" as const, idea: start.idea ?? blankIdea }
      : start;
  });
  const verify = draft.discovery_mode === "verify";
  const idea = draft.idea ?? blankIdea;
  const [ideaErrors, setIdeaErrors] = useState<Partial<Record<IdeaField, string>>>({});
  // Choosing between checking an idea and discovering opportunities. Industries and business models stay on the brief
  // either way; an idea is kept only while checking one.
  function chooseKind(kind: "verify" | "discover") {
    if (kind === "verify") setDraft({ ...draft, discovery_mode: "verify", idea: draft.idea ?? blankIdea });
    else {
      const { idea: _idea, ...rest } = draft;
      setDraft({ ...rest, discovery_mode: "combined" });
    }
    setIdeaErrors({});
    setFormError("");
  }
  function setIdea(patch: Partial<ResearchIdea>) {
    setDraft({ ...draft, idea: { ...idea, ...patch } });
  }
  const [submitting, setSubmitting] = useState(false);
  // Run focus (WP-03): the first eight angles are shown until "Show all", unless one beyond them is already chosen.
  const [allAngles, setAllAngles] = useState(false);
  const angles = draft.angles ?? [];
  const shownAngles = allAngles || angles.some((angle) => angleOptions.indexOf(angle) >= visibleAngles) ? angleOptions : angleOptions.slice(0, visibleAngles);
  const toggleAngle = (angle: (typeof angleOptions)[number]) =>
    setDraft({ ...draft, angles: angles.includes(angle) ? angles.filter((a) => a !== angle) : angles.length < maxAngles ? [...angles, angle] : angles });
  const requestKey = useRef<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [formError, setFormError] = useState("");
  const router = useRouter();
  const locale = useLocale() as Locale;
  const accessBlocked = !isDemo && !data?.access.enabled;
  const modeTitle = discoveryModes.find((mode) => mode.value === (draft.discovery_mode ?? "combined"))?.title;
  const list = (values: readonly string[]) => values.map((value) => copy(value)).join(", ");
  const ideaReady = [idea.title, idea.buyer, idea.pain].every((value) => value.trim());
  const steps: BriefStep[] = [
    {
      id: "research-kind",
      title: "What would you like to do?",
      summary: copy(verify ? "I have an idea — check it" : "Find opportunities for me"),
      done: true,
    },
    ...(verify
      ? [{ id: "brief-idea", title: "Your idea", summary: idea.title.trim() || undefined, done: ideaReady }]
      : [
          { id: "brief-focus", title: "Set your research focus", summary: draft.name.trim() || undefined, done: !!draft.name.trim() },
          {
            id: "brief-preferences",
            title: "Discovery preferences",
            summary: [modeTitle && copy(modeTitle), list(draft.sectors)].filter(Boolean).join(" · "),
            done: true,
          },
          {
            id: "brief-constraints",
            title: "Your real-world constraints",
            summary: angles.length ? copy("{count} of {max} chosen", { count: angles.length, max: maxAngles }) : undefined,
            done: angles.length > 0 || !!draft.explore_new || !!draft.context?.trim(),
            optional: true,
          },
        ]),
    { id: "brief-review", title: "Review and start", done: false },
  ];
  const runMeta = (
    <>
      {isDemo ? (
        copy("0 credits used in demo mode")
      ) : accessBlocked ? (
        copy("Saves the brief only · No live run on this account yet")
      ) : (
        <>
          <Clock3 className="size-4 shrink-0" />
          {verify
            ? copy("About 2–3 minutes (an estimate until enough checks have run) · Uses one research run, returned if the run fails (within a per-account limit)")
            : copy(
                "Usually 5–10 minutes · Uses one research run, returned if the run fails (within a per-account limit)",
              )}
          {" · "}
          {copy("Report in {language}", {
            language: localeNames[locale],
          })}
        </>
      )}
    </>
  );
  const number = (id: string) => steps.findIndex((step) => step.id === id) + 1;
  const done = (id: string) => steps.find((step) => step.id === id)?.done ?? false;
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
        <section className="surface min-w-0 p-6 md:p-8">
          <form
            id="research-form"
            className="flex flex-col gap-8"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || submitting) return;
              if (verify) {
                const checked = ideaSchema.safeParse(idea);
                if (!checked.success) {
                  const errors: Partial<Record<IdeaField, string>> = {};
                  for (const issue of checked.error.issues) {
                    const field = issue.path[0] as IdeaField;
                    if (["title", "buyer", "pain"].includes(field) && !errors[field]) errors[field] = issue.message;
                  }
                  setIdeaErrors(errors);
                  document.getElementById(`idea-${Object.keys(errors)[0] ?? "title"}`)?.focus();
                  return;
                }
                setIdeaErrors({});
              } else if (!draft.name.trim()) {
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
                // A check is named after its idea unless the founder named it.
                const brief = verify
                  ? { ...draft, name: (draft.name.trim() || idea.title.trim()).slice(0, 100), idea: ideaSchema.parse(idea) }
                  : { ...draft, name: draft.name.trim() };
                if (isDemo) {
                  await setRun(brief);
                  router.push(href(verify ? "/research/verify-example" : "/research/results?demo=1"));
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
            <FieldSet id="research-kind" className="gap-3">
              <FieldLegend className="flex items-center gap-3 text-lg font-semibold">
                <StepNumber n={1} done />
                {copy("What would you like to do?")}
              </FieldLegend>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["verify", Lightbulb, "I have an idea — check it", "Describe one idea. VentureLens looks for independent evidence for and against it, and gives a verdict."],
                  ["discover", Compass, "Find opportunities for me", "Describe a market. VentureLens proposes eight ideas and keeps only those with independent evidence."],
                ] as const).map(([kind, Icon, title, text]) => (
                  <label
                    key={kind}
                    className="flex min-h-11 cursor-pointer flex-col gap-2 rounded-xl border bg-card p-5 transition-colors hover:border-primary/60 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="research-kind"
                        value={kind}
                        checked={verify === (kind === "verify")}
                        onChange={() => chooseKind(kind)}
                        aria-describedby={`research-kind-${kind}-help`}
                        className="size-4 shrink-0"
                      />
                      <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="font-semibold leading-snug">{copy(title)}</span>
                    </span>
                    <span id={`research-kind-${kind}-help`} className="text-sm leading-snug text-muted-foreground">
                      {copy(text)}
                    </span>
                  </label>
                ))}
              </div>
            </FieldSet>
            {verify ? (
            <FieldGroup>
              <section
                id="brief-idea"
                aria-labelledby="idea-group"
                className="brief-section flex flex-col gap-5"
              >
                <h2 id="idea-group" className="flex items-center gap-3 text-lg font-semibold">
                  <StepNumber n={number("brief-idea")} done={done("brief-idea")} />
                  {copy("Your idea")}
                </h2>
                <Field data-invalid={!!ideaErrors.title}>
                  <FieldLabel htmlFor="idea-title">{copy("The idea, in a few words (required)")}</FieldLabel>
                  <Input
                    id="idea-title"
                    value={idea.title}
                    maxLength={180}
                    placeholder={copy("e.g. Appointment reminders for physiotherapy clinics")}
                    aria-invalid={!!ideaErrors.title}
                    aria-describedby={ideaErrors.title ? "idea-title-error" : undefined}
                    onChange={(e) => { setIdea({ title: e.target.value }); setIdeaErrors({ ...ideaErrors, title: undefined }); }}
                  />
                  {ideaErrors.title && <FieldError id="idea-title-error">{copy(ideaErrors.title)}</FieldError>}
                </Field>
                <Field data-invalid={!!ideaErrors.buyer}>
                  <FieldLabel htmlFor="idea-buyer">{copy("Who would buy it? (required)")}</FieldLabel>
                  <Input
                    id="idea-buyer"
                    value={idea.buyer}
                    maxLength={300}
                    placeholder={copy("e.g. Owners of one- or two-room physiotherapy clinics")}
                    aria-invalid={!!ideaErrors.buyer}
                    aria-describedby={ideaErrors.buyer ? "idea-buyer-error" : undefined}
                    onChange={(e) => { setIdea({ buyer: e.target.value }); setIdeaErrors({ ...ideaErrors, buyer: undefined }); }}
                  />
                  {ideaErrors.buyer && <FieldError id="idea-buyer-error">{copy(ideaErrors.buyer)}</FieldError>}
                </Field>
                <Field data-invalid={!!ideaErrors.pain}>
                  <FieldLabel htmlFor="idea-pain">{copy("What problem does it solve for them? (required)")}</FieldLabel>
                  <textarea
                    id="idea-pain"
                    value={idea.pain}
                    maxLength={800}
                    className="field-select min-h-24"
                    placeholder={copy("e.g. Missed appointments cost them revenue every week, and calling patients takes the front desk hours.")}
                    aria-invalid={!!ideaErrors.pain}
                    aria-describedby={ideaErrors.pain ? "idea-pain-error" : undefined}
                    onChange={(e) => { setIdea({ pain: e.target.value }); setIdeaErrors({ ...ideaErrors, pain: undefined }); }}
                  />
                  {ideaErrors.pain && <FieldError id="idea-pain-error">{copy(ideaErrors.pain)}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="idea-offer">
                    {copy("What would you offer?")}{" "}
                    <span className="text-muted-foreground">{copy("(optional)")}</span>
                  </FieldLabel>
                  <textarea
                    id="idea-offer"
                    value={idea.offer}
                    maxLength={800}
                    className="field-select min-h-20"
                    placeholder={copy("e.g. Automatic SMS and WhatsApp reminders with one-tap rescheduling")}
                    onChange={(e) => setIdea({ offer: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="idea-price">
                    {copy("A price you have in mind")}{" "}
                    <span className="text-muted-foreground">{copy("(optional)")}</span>
                  </FieldLabel>
                  <Input
                    id="idea-price"
                    value={idea.price_hint}
                    maxLength={100}
                    placeholder={copy("e.g. $49 a month per clinic")}
                    onChange={(e) => setIdea({ price_hint: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="verify-geography">{copy("Target market")}</FieldLabel>
                  <select
                    id="verify-geography"
                    className="field-select"
                    value={draft.geography}
                    onChange={(e) => setDraft({ ...draft, geography: e.target.value as typeof draft.geography })}
                  >
                    <option value={targetMarketLead}>{copy(targetMarketLead)}</option>
                    {targetMarketGroups.map((group) => (
                      <optgroup key={group.label} label={copy(group.label)}>
                        {group.options.map((v) => (
                          <option key={v} value={v}>{copy(v)}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <FieldDescription>{copy("Searches are written in this market's language.")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="verify-context">
                    {copy("Focus for this check")}{" "}
                    <span className="text-muted-foreground">{copy("(optional)")}</span>
                  </FieldLabel>
                  <textarea
                    id="verify-context"
                    value={draft.context}
                    onChange={(event) => setDraft({ ...draft, context: event.target.value })}
                    maxLength={1000}
                    className="field-select min-h-20"
                    placeholder={copy("e.g. Only independent clinics, not hospital groups")}
                  />
                  <FieldDescription>
                    {copy("Your idea and focus are sent to the research model and web search, so leave out confidential details.")}
                  </FieldDescription>
                </Field>
              </section>
            </FieldGroup>
            ) : (
            <FieldGroup>
              <section
                id="brief-focus"
                aria-labelledby="research-focus-group"
                className="brief-section flex flex-col gap-5"
              >
                <h2 id="research-focus-group" className="flex items-center gap-3 text-lg font-semibold">
                  <StepNumber n={number("brief-focus")} done={done("brief-focus")} />
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
                id="brief-preferences"
                aria-labelledby="discovery-preferences-group"
                className="brief-section flex flex-col gap-5"
              >
                <h2 id="discovery-preferences-group" className="flex items-center gap-3 text-lg font-semibold">
                  <StepNumber n={number("brief-preferences")} done={done("brief-preferences")} />
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
                id="brief-constraints"
                aria-labelledby="research-constraints-group"
                className="brief-section flex flex-col gap-5"
              >
                <h2 id="research-constraints-group" className="flex items-center gap-3 text-lg font-semibold">
                  <StepNumber n={number("brief-constraints")} done={done("brief-constraints")} />
                  {copy("Your real-world constraints")}
                </h2>
              <FieldSet id="angles" aria-describedby="angles-help angles-count" className="gap-3">
                <FieldLegend variant="label" className="mb-0">
                  {copy("Angles for this run")}{" "}
                  <span className="font-normal text-muted-foreground">{copy("(optional)")}</span>
                </FieldLegend>
                <div className="flex flex-wrap gap-2">
                  {shownAngles.map((angle) => (
                    <ChoiceChip
                      key={angle}
                      value={angle}
                      label={copy(angle)}
                      checked={angles.includes(angle)}
                      disabled={!angles.includes(angle) && angles.length >= maxAngles}
                      onToggle={() => toggleAngle(angle)}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <p
                    id="angles-count"
                    aria-live="polite"
                    className={angles.length >= 4 ? "text-sm font-medium text-amber-700 dark:text-amber-400" : "text-sm text-muted-foreground"}
                  >
                    {angles.length >= maxAngles
                      ? copy("{count} of {max} chosen, the most one run can respect. Untick one to choose another.", { count: angles.length, max: maxAngles })
                      : angles.length >= 4
                        ? copy("{count} of {max} chosen. Many angles narrow the search; fewer ideas may pass.", { count: angles.length, max: maxAngles })
                        : copy("{count} of {max} chosen", { count: angles.length, max: maxAngles })}
                  </p>
                  {shownAngles.length < angleOptions.length && (
                    <Button type="button" variant="link" className="h-auto min-h-11 px-0" onClick={() => setAllAngles(true)}>
                      {copy("Show all {count}", { count: angleOptions.length })}
                    </Button>
                  )}
                </div>
                <FieldDescription id="angles-help">
                  {copy("Quick constraints for this run only. Your founder profile is not changed.")}
                </FieldDescription>
              </FieldSet>
              <Field orientation="horizontal" className="items-start gap-3">
                <input
                  id="explore-new"
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                  checked={draft.explore_new ?? false}
                  aria-describedby="explore-new-help"
                  onChange={(event) => setDraft({ ...draft, explore_new: event.target.checked })}
                />
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="explore-new">{copy("Explore something new")}</FieldLabel>
                  <FieldDescription id="explore-new-help">
                    {copy("Steers this run away from the kind of ideas you have already seen. It needs at least one earlier run; without one it has no effect.")}
                  </FieldDescription>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="context">
                  {copy("Focus for this run")}{" "}
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
                    "For example: dental clinics in Osaka · tools for freelance translators · problems I saw running a café",
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
            )}
            <section
              id="brief-review"
              aria-labelledby="research-review-group"
              className="brief-section flex flex-col gap-5"
            >
              <h2 id="research-review-group" className="flex items-center gap-3 text-lg font-semibold">
                <StepNumber n={number("brief-review")} />
                {copy("Review and start")}
              </h2>
              {/* What this run will use, so the founder checks the brief without scrolling back up. */}
              <dl className="grid gap-x-6 gap-y-4 rounded-xl bg-background/65 p-4 sm:grid-cols-2 sm:p-5">
                {(verify
                  ? [
                      ["Your idea", idea.title.trim() || "—"],
                      ["Target market", copy(draft.geography)],
                    ]
                  : [
                      ["Discovery mode", modeTitle ? copy(modeTitle) : "—"],
                      ["Industry or market", list(draft.sectors) || "—"],
                      ["Business model", list(draft.models) || "—"],
                      ["Target market", copy(draft.geography)],
                    ]
                ).map(([label, value]) => (
                  <div key={label} className="flex min-w-0 flex-col gap-1">
                    <dt className="text-sm text-muted-foreground">{copy(label)}</dt>
                    <dd className="font-medium leading-snug">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="flex items-center gap-2 text-sm text-muted-foreground sm:hidden">{runMeta}</p>
            {formError && (
              <p role="alert" className="rounded-lg border p-4 text-sm">
                {copy(formError)}
              </p>
            )}
            </section>
            {/* Pinned to the bottom of the screen while the form is in view, so the run can start from anywhere. */}
            <div className="brief-actions flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              {/* Phones pin the button alone; the run details sit in the review step above. */}
              <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">{runMeta}</span>
              <Button
                type="submit"
                className="shrink-0"
                disabled={busy || submitting}
                aria-busy={busy || submitting}
              >
                {busy || submitting
                  ? copy("Submitting…")
                  : isDemo
                    ? copy("Preview research results")
                    : accessBlocked
                      ? copy("Save brief")
                      : verify
                        ? copy("Check this idea")
                        : copy("Start evidence research")}
                <ArrowRight />
              </Button>
            </div>
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
                {(verify ? verifyPipeline : pipeline).map(([title, text], index) => (
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
          <BriefOutline steps={steps} />
        </aside>
      </div>
    </>
  );
}
