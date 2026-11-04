"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Telescope,
  Check,
  UserRound,
} from "lucide-react";
import { useDemo } from "@/components/demo-provider";
import { PageHeader, DemoNote } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
export function ResearchConfig() {
  const { run, setRun, profile } = useDemo();
  const [draft, setDraft] = useState(run);
  const [nameError, setNameError] = useState("");
  const router = useRouter();
  return (
    <>
      <Link
        href="/research"
        className="flex w-fit items-center gap-2 text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        My research
      </Link>
      <PageHeader
        title="What would you like to explore?"
        description="Configure a research brief and preview a clearly labeled demonstration report."
      />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="surface p-6 md:p-8">
          <form
            className="flex flex-col gap-7"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.name.trim()) {
                setNameError(
                  "Enter a research name, such as Agency workflow research.",
                );
                document.getElementById("research-name")?.focus();
                return;
              }
              setRun({ ...draft, name: draft.name.trim() });
              router.push("/research/results?demo=1");
            }}
          >
            <h2 className="text-lg font-semibold">Set your research focus</h2>
            <FieldGroup>
              <Field data-invalid={!!nameError}>
                <FieldLabel htmlFor="research-name">
                  Research name (required)
                </FieldLabel>
                <Input
                  id="research-name"
                  value={draft.name}
                  maxLength={100}
                  required
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
                  <FieldError id="research-name-error">{nameError}</FieldError>
                ) : (
                  <FieldDescription id="research-name-help">
                    Use a descriptive name so you can find this brief later. Up
                    to 100 characters.
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="sector">Industry or market</FieldLabel>
                <select
                  id="sector"
                  className="field-select"
                  value={draft.sector}
                  onChange={(e) =>
                    setDraft({ ...draft, sector: e.target.value })
                  }
                >
                  {[
                    "Professional services",
                    "B2B SaaS",
                    "Finance & operations",
                    "Education",
                    "Healthcare",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="model">Business model</FieldLabel>
                <select
                  id="model"
                  className="field-select"
                  value={draft.model}
                  onChange={(e) =>
                    setDraft({ ...draft, model: e.target.value })
                  }
                >
                  {[
                    "B2B subscription",
                    "Productized service",
                    "Usage-based software",
                    "Open to possibilities",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="geography">Target market</FieldLabel>
                <select
                  id="geography"
                  className="field-select"
                  value={draft.geography}
                  onChange={(e) =>
                    setDraft({ ...draft, geography: e.target.value })
                  }
                >
                  {[
                    "United States",
                    "United Kingdom",
                    "European Union",
                    "Global / English-speaking",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="context">
                  Anything else to keep in mind?{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </FieldLabel>
                <textarea
                  id="context"
                  aria-describedby="context-help"
                  maxLength={1000}
                  className="field-select min-h-24"
                  placeholder="A buyer group, a problem you’ve noticed, or a niche you know well…"
                />
                <FieldDescription id="context-help">
                  Up to 1,000 characters. This demo does not save or process
                  these notes. Configuration appears in the brief, but results
                  remain the same synthetic examples.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5">
              <span className="text-sm text-muted-foreground">
                0 credits used in demo mode
              </span>
              <Button type="submit">
                Preview research results
                <ArrowRight />
              </Button>
            </div>
          </form>
        </section>
        <aside className="flex flex-col gap-5">
          <section className="surface flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2">
              <UserRound className="size-5 text-primary" />
              <h2 className="font-semibold">Your founder context</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Reference your experience while exploring. Profile changes do not
              personalize demo results.
            </p>
            <dl className="flex flex-col gap-4">
              {[
                ["Experience", profile.industry],
                ["Time available", `${profile.hours} / week`],
                ["Starting budget", profile.budget],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-muted-foreground">{k}</dt>
                  <dd className="mt-1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <Link href="/profile" className="text-sm font-medium text-primary">
              Edit founder profile
              <ArrowRight className="ml-1 inline size-4" />
            </Link>
          </section>
          <section className="flex flex-col gap-4 rounded-xl bg-secondary p-6 text-foreground">
            <Telescope className="size-6 text-primary" />
            <h2 className="font-semibold">
              A structured view of the possibilities
            </h2>
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
                  {t}
                </li>
              ))}
            </ul>
          </section>
          <DemoNote />
        </aside>
      </div>
    </>
  );
}
