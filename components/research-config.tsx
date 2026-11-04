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
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
export function ResearchConfig() {
  const { run, setRun, profile } = useDemo();
  const [draft, setDraft] = useState(run);
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
        description="Give your research a little direction. We’ll help connect the dots."
      />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="surface p-6 md:p-8">
          <form
            className="flex flex-col gap-7"
            onSubmit={(e) => {
              e.preventDefault();
              setRun(draft);
              router.push("/research/results?demo=1");
            }}
          >
            <h2 className="text-lg font-semibold">Set your research focus</h2>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="research-name">Research name</FieldLabel>
                <Input
                  id="research-name"
                  value={draft.name}
                  maxLength={100}
                  required
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
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
                  maxLength={1000}
                  className="field-select min-h-24"
                  placeholder="A buyer group, a problem you’ve noticed, or a niche you know well…"
                />
                <p className="text-sm text-muted-foreground">
                  Demo note: configuration is shown in your research brief.
                  Results use the same synthetic fixture, not tailored AI
                  output.
                </p>
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
              <h2 className="font-semibold">Built around your profile</h2>
            </div>
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
