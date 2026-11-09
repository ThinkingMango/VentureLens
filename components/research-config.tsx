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
import { PageHeader, DemoNote } from "@/components/shared";
import { ResearchAccessCard } from "@/components/live-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
  FieldError,
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
export function ResearchConfig() {
  const copy = useCopy();
  const { run, setRun, profile, isDemo, href, busy, refresh, data } = useDemo();
  const [draft, setDraft] = useState(run);
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
            <h2 className="text-lg font-semibold">
              {copy("Set your research focus")}
            </h2>
            <FieldGroup>
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
              <Field>
                <FieldLabel htmlFor="discovery-mode">
                  {copy("发现模式")}
                </FieldLabel>
                <select
                  id="discovery-mode"
                  className="field-select"
                  value={draft.discovery_mode ?? "combined"}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      discovery_mode: e.target.value as
                        "founder" | "market" | "combined",
                    })
                  }
                >
                  <option value="combined">
                    {copy("综合发现 · Combined Discovery")}
                  </option>
                  <option value="founder">
                    {copy("创始人优势 · Founder Advantage")}
                  </option>
                  <option value="market">
                    {copy("市场优先 · Market-First")}
                  </option>
                </select>
                <FieldDescription>
                  {copy(
                    "市场优先不使用个人背景进行机会发现或评分；其余模式结合你的技能和资源。",
                  )}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="sector">
                  {copy("Industry or market")}
                </FieldLabel>
                <select
                  id="sector"
                  className="field-select"
                  value={draft.sector}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sector: e.target.value as typeof draft.sector,
                    })
                  }
                >
                  {[
                    "Professional services",
                    "B2B SaaS",
                    "Finance & operations",
                    "Education",
                    "Healthcare",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {copy(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="model">
                  {copy("Business model")}
                </FieldLabel>
                <select
                  id="model"
                  className="field-select"
                  value={draft.model}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      model: e.target.value as typeof draft.model,
                    })
                  }
                >
                  {[
                    "B2B subscription",
                    "Productized service",
                    "Usage-based software",
                    "Open to possibilities",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {copy(v)}
                    </option>
                  ))}
                </select>
              </Field>
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
                  {[
                    "United States",
                    "United Kingdom",
                    "European Union",
                    "Global / English-speaking",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {copy(v)}
                    </option>
                  ))}
                </select>
              </Field>
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
                    "A buyer group, a problem you’ve noticed, or a niche you know well…",
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
            </FieldGroup>
            {formError && (
              <p role="alert" className="rounded-lg border p-4 text-sm">
                {copy(formError)}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {isDemo ? (
                  copy("0 credits used in demo mode")
                ) : accessBlocked ? (
                  copy("Saves the brief only · No live run on this account yet")
                ) : (
                  <>
                    <Clock3 className="size-4" />
                    {copy(
                      "Usually 5–10 minutes · Uses one research run, returned if the run fails",
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
