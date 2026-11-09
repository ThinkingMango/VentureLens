"use client";
import { MobileDisclosure } from "@/components/mobile-disclosure";
import { useCopy } from "@/i18n/use-copy";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/workspace-link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  UserRound,
  BriefcaseBusiness,
  Clock3,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Brand, DemoNote, PageHeader } from "@/components/shared";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useDemo } from "@/components/demo-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { ProfileChoice } from "@/components/profile-choice";
import {
  founderRoles,
  founderIndustries,
  founderGoals,
  skillSuggestions,
} from "@/lib/profile-options";
import { cn } from "@/lib/utils";
const steps = [
  {
    title: "Your starting point",
    description: "A little about you and where you’re headed.",
    icon: UserRound,
  },
  {
    title: "Your unfair advantage",
    description: "The experience that makes you different.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Your real-world constraints",
    description: "A business should fit the life you want.",
    icon: Clock3,
  },
  {
    title: "Your direction",
    description: "What would success look like for you?",
    icon: Target,
  },
];
export function Onboarding({ editing = false }: { editing?: boolean }) {
  const copy = useCopy();
  const { profile, setProfile, isDemo, href, busy } = useDemo();
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(profile);
  const [step, setStep] = useState(0);
  const [invalidField, setInvalidField] = useState<"name" | "skills" | null>(
    null,
  );
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const StepHeading = editing ? "h2" : "h1";
  const router = useRouter();
  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus();
    previousStep.current = step;
  }, [step]);
  const update = (key: keyof typeof draft, value: string) => {
    setDraft((p) => ({ ...p, [key]: value }));
    setError("");
    setInvalidField(null);
  };
  const select = (id: keyof typeof draft, label: string, options: string[]) => (
    <Field>
      <FieldLabel htmlFor={id}>{copy(label)}</FieldLabel>
      <select
        className="field-select"
        id={id}
        value={draft[id]}
        disabled={busy}
        onChange={(e) => update(id, e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {copy(o)}
          </option>
        ))}
      </select>
    </Field>
  );
  const form = (
    <div className="grid overflow-hidden rounded-xl border bg-card md:grid-cols-[240px_1fr]">
      <aside className="hidden flex-col gap-6 border-b bg-background p-6 md:flex md:border-r md:border-b-0">
        <p className="font-semibold">{copy("Your founder profile")}</p>
        <ol className="flex justify-between gap-4 md:flex-col md:gap-6">
          {steps.map((s, i) => (
            <li
              key={s.title}
              aria-current={step === i ? "step" : undefined}
              className={cn(
                "flex items-start gap-3",
                step !== i && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm",
                  step === i &&
                    "border-primary bg-primary text-primary-foreground",
                  step > i && "bg-secondary text-primary",
                )}
              >
                {step > i ? <Check className="size-4" /> : i + 1}
              </span>
              <span className="sr-only pt-0.5 text-sm font-medium md:not-sr-only">
                {copy(s.title)}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-auto hidden pt-8 text-sm text-muted-foreground">
          {copy("A few thoughtful answers.")}
          <br />
          {copy("A more personal perspective.")}
        </p>
      </aside>
      <div className="flex flex-col gap-6 p-5 sm:gap-8 sm:p-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <p className="shrink-0 text-sm text-muted-foreground">
              {copy("Step {step} of {total}", { step: step + 1, total: 4 })}
            </p>
            <div className="progress-track flex-1" aria-hidden="true">
              <div
                className="progress-fill"
                style={{ width: `${((step + 1) / 4) * 100}%` }}
              />
            </div>
          </div>
          <StepHeading
            ref={stepHeading}
            tabIndex={-1}
            className="text-2xl font-semibold"
          >
            {copy(steps[step].title)}
          </StepHeading>
          <p className="text-muted-foreground">
            {copy(steps[step].description)}
          </p>
        </div>
        <form
          className="flex flex-col gap-8"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setError("");
            setInvalidField(null);
            const missing =
              step === 0 && !draft.name.trim()
                ? "name"
                : step === 1 && !draft.skills.trim()
                  ? "skills"
                  : null;
            if (missing) {
              setInvalidField(missing);
              setError(
                missing === "name"
                  ? "Enter your name."
                  : "Add your skills or experience.",
              );
              document.getElementById(missing)?.focus();
              return;
            }
            if (step < 3) setStep(step + 1);
            else {
              try {
                await setProfile({
                  ...draft,
                  name: draft.name.trim(),
                  skills: draft.skills.trim(),
                  role: draft.role.trim(),
                  industry: draft.industry.trim(),
                  goal: draft.goal.trim(),
                });
                toast.success(
                  isDemo
                    ? copy("Demo profile updated")
                    : copy("Founder profile saved"),
                  {
                    description: copy(
                      isDemo
                        ? "Your preferences stay in memory until you refresh."
                        : "Your profile is saved privately to your account.",
                    ),
                  },
                );
                router.push(href("/dashboard"));
                router.refresh();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Your profile could not be saved.",
                );
              }
            }
          }}
        >
          <FieldGroup>
            {step === 0 && (
              <>
                <Field data-invalid={invalidField === "name"}>
                  <FieldLabel htmlFor="name">
                    {copy("What should we call you?")}
                  </FieldLabel>
                  <Input
                    id="name"
                    value={draft.name}
                    maxLength={80}
                    autoComplete="given-name"
                    disabled={busy}
                    aria-invalid={invalidField === "name"}
                    aria-describedby={
                      invalidField === "name" ? "profile-error" : undefined
                    }
                    required
                    onChange={(e) => update("name", e.target.value)}
                    placeholder={copy("Your first name")}
                  />
                </Field>
                <ProfileChoice
                  id="role"
                  label="Where are you in your founder journey?"
                  value={draft.role}
                  options={founderRoles}
                  maxLength={100}
                  disabled={busy}
                  onChange={(value) => update("role", value)}
                />
              </>
            )}
            {step === 1 && (
              <>
                <ProfileChoice
                  id="industry"
                  label="Which industry do you know best?"
                  value={draft.industry}
                  options={founderIndustries}
                  maxLength={100}
                  disabled={busy}
                  onChange={(value) => update("industry", value)}
                />
                <Field data-invalid={invalidField === "skills"}>
                  <FieldLabel htmlFor="skills">
                    {copy("What skills or experiences can you build on?")}
                  </FieldLabel>
                  <textarea
                    id="skills"
                    className="field-select min-h-28 resize-y"
                    value={draft.skills}
                    disabled={busy}
                    aria-invalid={invalidField === "skills"}
                    aria-describedby={
                      invalidField === "skills"
                        ? "skills-help profile-error"
                        : "skills-help"
                    }
                    required
                    maxLength={500}
                    onChange={(e) => update("skills", e.target.value)}
                  />
                  <p id="skills-help" className="text-sm text-muted-foreground">
                    {copy(
                      "Think domain expertise, technical abilities, and access to potential buyers.",
                    )}
                  </p>
                </Field>
                <MobileDisclosure title={copy("See skill examples")}>
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      {copy(
                        "Need a starting point? Add an example, then make it your own.",
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {skillSuggestions.map((suggestion) => {
                        const text = copy(suggestion);
                        const next = draft.skills.trim()
                          ? `${draft.skills.trim()}; ${text}`
                          : text;
                        return (
                          <Button
                            key={suggestion}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="min-h-11 text-left"
                            disabled={
                              busy ||
                              draft.skills.includes(text) ||
                              next.length > 500
                            }
                            onClick={() => update("skills", next)}
                          >
                            {text}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </MobileDisclosure>
              </>
            )}
            {step === 2 && (
              <>
                {select("hours", "How much time can you commit each week?", [
                  "Under 5 hours",
                  "5–10 hours",
                  "10–20 hours",
                  "20–40 hours",
                  "Full time",
                ])}
                {select("budget", "What is your initial budget?", [
                  "Under $1,000",
                  "$1,000–5,000",
                  "$5,000–15,000",
                  "$15,000+",
                ])}
              </>
            )}
            {step === 3 && (
              <>
                <ProfileChoice
                  id="goal"
                  label="What are you working toward?"
                  value={draft.goal}
                  options={founderGoals}
                  maxLength={150}
                  disabled={busy}
                  onChange={(value) => update("goal", value)}
                />
                <MobileDisclosure title={copy("Review your profile")}>
                  <div className="rounded-lg bg-background p-5">
                    <p className="font-medium">
                      {copy("Your profile, at a glance")}
                    </p>
                    <dl className="mt-4 flex flex-col gap-3 text-sm">
                      {[
                        ["Founder", draft.name],
                        ["Industry", draft.industry],
                        [
                          "Time",
                          copy("{hours} / week", { hours: copy(draft.hours) }),
                        ],
                        ["Budget", draft.budget],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">{copy(k)}</dt>
                          <dd className="text-right font-medium">
                            {k === "Founder" ? v : copy(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </MobileDisclosure>
              </>
            )}
          </FieldGroup>
          {error && (
            <p
              id="profile-error"
              role="alert"
              className="rounded-lg border p-4 text-sm"
            >
              {copy(error)}
            </p>
          )}
          <div className="flex items-center justify-between border-t pt-5">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setError("");
                setInvalidField(null);
                if (step > 0) setStep(step - 1);
                else router.push(editing ? href("/dashboard") : "/");
              }}
            >
              <ArrowLeft />
              {step > 0 ? copy("Back") : copy("Cancel")}
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy
                ? copy("Saving…")
                : step === 3
                  ? isDemo
                    ? copy("Save demo profile")
                    : copy("Save founder profile")
                  : copy("Continue")}
              <ArrowRight />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
  if (editing)
    return (
      <>
        <div className="sr-only md:not-sr-only">
          <PageHeader
            title={copy("Your founder profile")}
            description={copy(
              "The starting point for opportunities that fit you.",
            )}
          />
        </div>
        {form}
        <DemoNote />
      </>
    );
  return (
    <div className="hero-bg min-h-dvh">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-7">
        <Brand />
        <LanguageSwitcher />
        <Link
          href={isDemo ? "/dashboard" : "/demo/dashboard"}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          {isDemo
            ? copy("Skip to demo workspace")
            : copy("Explore the separate demo")}
        </Link>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8">
        <div className="mb-3 flex flex-col items-center gap-3 text-center">
          <span className="eyebrow">{copy("About two minutes")}</span>
          <h2 className="text-3xl font-semibold md:text-4xl">
            {copy("Better opportunities start with you.")}
          </h2>
          <p className="max-w-xl text-muted-foreground">
            {copy("Let’s build a picture of the founder behind the idea.")}{" "}
            {copy(
              "Your answers shape which opportunities are discovered and how they are scored.",
            )}
          </p>
        </div>
        {form}
        <DemoNote />
        <p className="text-center text-sm text-muted-foreground">
          {isDemo
            ? copy("Demo only. Your answers are not transmitted or persisted.")
            : copy(
                "Your answers are saved privately to your account. You can update them anytime.",
              )}
        </p>
      </main>
    </div>
  );
}
