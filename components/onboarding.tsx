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
  Sparkles,
  ShieldCheck,
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
  founderRoleHints,
  founderIndustries,
  founderIndustryHints,
  founderGoals,
  founderGoalHints,
  skillSuggestions,
  interestSuggestions,
} from "@/lib/profile-options";
import {
  budgetOptions,
  hoursOptions,
  profileLanguages,
  revenueTargetOptions,
  riskOptions,
  strengthOptions,
  type Profile,
} from "@/lib/workspace-schema";
import { starterProfiles, starterTextFields } from "@/lib/starter-profiles";
import { cn } from "@/lib/utils";
const steps = [
  {
    title: "Your starting point",
    description: "A little about you and where you’re headed.",
    icon: UserRound,
    optional: false,
  },
  {
    title: "Your unfair advantage",
    description: "What you know, what you’ve seen and who you can reach that a newcomer can’t.",
    icon: BriefcaseBusiness,
    optional: false,
  },
  {
    title: "Your real-world constraints",
    description: "A business should fit the life you want.",
    icon: Clock3,
    optional: false,
  },
  {
    title: "Your direction",
    description: "What would success look like for you?",
    icon: Target,
    optional: false,
  },
  {
    title: "Make it personal",
    description: "Optional. What you would enjoy working on for years, so ideas fit you better.",
    icon: Sparkles,
    optional: true,
  },
  {
    title: "Boundaries",
    description: "Optional. What you are aiming for and what you will not do.",
    icon: ShieldCheck,
    optional: true,
  },
];
const lastStep = steps.length - 1;
// The last required step: from here the founder can save and skip the optional steps.
const lastRequiredStep = steps.findLastIndex((s) => !s.optional);
type TextField = "name" | "role" | "industry" | "skills" | "hours" | "budget" | "goal" | "interests" | "pain_points" | "distribution" | "strength" | "revenue_target" | "risk_tolerance" | "exclusions";
export function Onboarding({ editing = false }: { editing?: boolean }) {
  const copy = useCopy();
  const { profile, setProfile, isDemo, href, busy } = useDemo();
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Profile>(profile);
  const [step, setStep] = useState(0);
  // The starter profile the form was filled from, if any; recorded with the save, never saved on its own.
  const [starter, setStarter] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<"name" | "skills" | null>(
    null,
  );
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  // The first-run page title above the form is the h1, and the profile page owns it in edit mode.
  const StepHeading = "h2";
  const router = useRouter();
  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus();
    previousStep.current = step;
  }, [step]);
  const update = (key: TextField, value: string) => {
    setDraft((p) => ({ ...p, [key]: value }));
    setError("");
    setInvalidField(null);
  };
  const languages = draft.languages ?? [];
  const toggleLanguage = (language: (typeof profileLanguages)[number]) => {
    setDraft((p) => {
      const current = p.languages ?? [];
      return { ...p, languages: current.includes(language) ? current.filter((l) => l !== language) : [...current, language] };
    });
    setError("");
  };
  const applyStarter = (id: string) => {
    const template = starterProfiles.find((s) => s.id === id);
    if (!template) return;
    const filled: Partial<Profile> = { ...template.profile };
    // Free text is shown in the interface language; the fixed answers stay canonical. Name and languages are kept.
    for (const field of starterTextFields) filled[field] = copy(template.profile[field]);
    setDraft((p) => ({ ...p, ...filled }));
    setStarter(id);
    setError("");
    setInvalidField(null);
  };
  const select = (id: "hours" | "budget", label: string, options: string[]) => (
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
  // An optional single choice: "" means not answered.
  const optionalSelect = (id: "strength" | "revenue_target" | "risk_tolerance", label: string, options: readonly string[]) => (
    <Field>
      <FieldLabel htmlFor={id}>
        {copy(label)} <span className="font-normal text-muted-foreground">{copy("(optional)")}</span>
      </FieldLabel>
      <select
        className="field-select"
        id={id}
        value={draft[id] ?? ""}
        disabled={busy}
        onChange={(e) => update(id, e.target.value)}
      >
        <option value="">{copy("Not answered")}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {copy(o)}
          </option>
        ))}
      </select>
    </Field>
  );
  const textarea = (id: "interests" | "pain_points" | "distribution" | "exclusions", label: string, help: string, maxLength: number) => (
    <Field>
      <FieldLabel htmlFor={id}>
        {copy(label)} <span className="font-normal text-muted-foreground">{copy("(optional)")}</span>
      </FieldLabel>
      <textarea
        id={id}
        className="field-select min-h-24 resize-y"
        value={draft[id] ?? ""}
        disabled={busy}
        maxLength={maxLength}
        aria-describedby={`${id}-help`}
        onChange={(e) => update(id, e.target.value)}
      />
      <p id={`${id}-help`} className="text-sm text-muted-foreground">
        {copy(help)}
      </p>
    </Field>
  );
  async function save() {
    try {
      await setProfile(
        {
          ...draft,
          name: draft.name.trim(),
          skills: draft.skills.trim(),
          role: draft.role.trim(),
          industry: draft.industry.trim(),
          goal: draft.goal.trim(),
          interests: (draft.interests ?? "").trim(),
          pain_points: (draft.pain_points ?? "").trim(),
          distribution: (draft.distribution ?? "").trim(),
          exclusions: (draft.exclusions ?? "").trim(),
          languages,
        },
        starter ?? undefined,
      );
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
  const starterUsed = starterProfiles.find((s) => s.id === starter);
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
                {s.optional && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {copy("Optional")}
                  </span>
                )}
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
      <div className="flex min-w-0 flex-col gap-6 p-5 sm:gap-8 sm:p-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <p className="shrink-0 text-sm text-muted-foreground">
              {copy("Step {step} of {total}", { step: step + 1, total: steps.length })}
            </p>
            <div className="progress-track flex-1" aria-hidden="true">
              <div
                className="progress-fill"
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
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
            if (step < lastStep) setStep(step + 1);
            else await save();
          }}
        >
          <FieldGroup>
            {step === 0 && !editing && (
              <section aria-labelledby="starter-heading" className="flex flex-col gap-3 rounded-xl border bg-background p-4">
                <div className="flex flex-col gap-1">
                  <h3 id="starter-heading" className="font-medium">{copy("Start from an example")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {copy("Fills in the form with a common founder situation. You review and change every answer before anything is saved.")}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {starterProfiles.map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      variant="outline"
                      aria-pressed={starter === s.id}
                      disabled={busy}
                      className={cn("h-auto min-h-11 flex-col items-start gap-1 whitespace-normal py-3 text-left", starter === s.id && "border-primary bg-secondary")}
                      onClick={() => applyStarter(s.id)}
                    >
                      <span className="font-medium">{copy(s.title)}</span>
                      <span className="text-xs font-normal text-muted-foreground">{copy(s.description)}</span>
                    </Button>
                  ))}
                </div>
                <p role="status" className="text-sm text-primary">
                  {starterUsed
                    ? copy("Filled in from “{title}”. Check each step and change anything that does not fit you.", { title: copy(starterUsed.title) })
                    : ""}
                </p>
              </section>
            )}
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
                  hints={founderRoleHints}
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
                  hints={founderIndustryHints}
                  maxLength={100}
                  disabled={busy}
                  onChange={(value) => update("industry", value)}
                />
                <Field data-invalid={invalidField === "skills"}>
                  <FieldLabel htmlFor="skills">
                    {copy("What experience can you build on?")}
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
                      "Be specific: your role and seniority, the regions or markets you know, the decisions you have owned and the specialist know-how a newcomer would lack.",
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
                        const current = draft.skills.trim().replace(/[.。]$/, "");
                        const next = current ? `${current}; ${text}` : text;
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
                <p className="text-sm text-muted-foreground">
                  {copy(
                    "Each idea is scored on how much your industry, experience, insider view and reach give you an edge. The three answers below are optional, but they move that score most.",
                  )}
                </p>
                {textarea("pain_points", "Problems you’ve seen up close", "Costly workarounds, recurring failures or delays you have watched customers, suppliers, colleagues or an industry put up with.", 500)}
                {textarea("distribution", "Buyers, networks or communities you can reach", "For example former clients, suppliers and partners, peers in a professional body, or a newsletter. Reaching buyers directly is a real advantage.", 500)}
                {optionalSelect("strength", "Your main strength", strengthOptions)}
              </>
            )}
            {step === 2 && (
              <>
                {select("hours", "How much time can you commit each week?", [...hoursOptions])}
                {select("budget", "What is your initial budget?", [...budgetOptions])}
              </>
            )}
            {step === 3 && (
              <>
                <ProfileChoice
                  id="goal"
                  label="What are you working toward?"
                  value={draft.goal}
                  options={founderGoals}
                  hints={founderGoalHints}
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
            {step === 4 && (
              <>
                {textarea("interests", "What are you drawn to?", "Topics, industries or customers you would enjoy working with for years.", 500)}
                <div className="flex flex-wrap gap-2" aria-label={copy("Interest examples")} role="group">
                  {interestSuggestions.map((suggestion) => {
                    const text = copy(suggestion);
                    // Drop a trailing full stop so an example after a sentence reads "…shares; Health", not "…shares.; Health".
                    const current = (draft.interests ?? "").trim().replace(/[.。]$/, "");
                    const next = current ? `${current}; ${text}` : text;
                    return (
                      <Button
                        key={suggestion}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 text-left"
                        disabled={busy || current.includes(text) || next.length > 500}
                        onClick={() => update("interests", next)}
                      >
                        {text}
                      </Button>
                    );
                  })}
                </div>
              </>
            )}
            {step === 5 && (
              <>
                {optionalSelect("revenue_target", "What income are you aiming for?", revenueTargetOptions)}
                {optionalSelect("risk_tolerance", "How much risk are you comfortable with?", riskOptions)}
                {textarea("exclusions", "Things you won’t do", "For example: no hardware, no consumer apps, nothing that needs funding. Research avoids ideas that conflict with these.", 300)}
                <fieldset className="flex flex-col gap-3" aria-describedby="languages-help">
                  <legend className="text-sm font-medium">
                    {copy("Languages you can work in")}{" "}
                    <span className="font-normal text-muted-foreground">{copy("(optional)")}</span>
                  </legend>
                  <p id="languages-help" className="text-sm text-muted-foreground">
                    {copy("Choose up to 5.")}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {profileLanguages.map((language) => {
                      const checked = languages.includes(language);
                      return (
                        <label
                          key={language}
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm",
                            checked && "border-primary bg-secondary",
                            !checked && languages.length >= 5 && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            name="languages"
                            value={language}
                            checked={checked}
                            disabled={busy || (!checked && languages.length >= 5)}
                            onChange={() => toggleLanguage(language)}
                          />
                          {copy(language)}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              {step === lastRequiredStep && (
                <Button type="button" variant="outline" disabled={busy} onClick={() => void save()}>
                  {copy("Save now, skip the optional steps")}
                </Button>
              )}
              {steps[step].optional && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    if (step < lastStep) setStep(step + 1);
                    else void save();
                  }}
                >
                  {step < lastStep ? copy("Skip this step") : copy("Skip and save")}
                </Button>
              )}
              <Button type="submit" disabled={busy} aria-busy={busy}>
                {busy
                  ? copy("Saving…")
                  : step === lastStep
                    ? isDemo
                      ? copy("Save demo profile")
                      : copy("Save founder profile")
                    : copy("Continue")}
                <ArrowRight />
              </Button>
            </div>
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
          <h1 className="text-3xl font-semibold md:text-4xl">
            {copy("Better opportunities start with you.")}
          </h1>
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
