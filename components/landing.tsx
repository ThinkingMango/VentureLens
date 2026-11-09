"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ScanLine,
  Users,
  SlidersHorizontal,
  Link2,
  Scale,
  Swords,
  ListChecks,
  Target,
  Ban,
  Globe2,
  Lightbulb,
  BriefcaseBusiness,
  Compass,
  Sparkles,
} from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { EvidencePreview } from "@/components/evidence-preview";
import { useCopy } from "@/i18n/use-copy";

const reportParts = [
  {
    icon: Lightbulb,
    title: "Ranked opportunity hypotheses",
    text: "Up to twelve concrete, narrow business ideas matched to your profile, each stated as a hypothesis to test rather than a promise. Only those with independent evidence make the report.",
  },
  {
    icon: Target,
    title: "A named buyer and a real pain",
    text: "Who pays, what hurts, what they do today instead, and the trigger that makes them look for help.",
  },
  {
    icon: Link2,
    title: "Linked original sources",
    text: "Every claim points to a retrieved web page with its excerpt, domain, and retrieval date. Nothing is cited from memory.",
  },
  {
    icon: Scale,
    title: "An explainable score",
    text: "Five weighted dimensions with visible weights and caps. Scores compare hypotheses; they are never success probabilities.",
  },
  {
    icon: Swords,
    title: "An adversarial critique",
    text: "A second pass argues against each idea, names the free alternatives and regulatory risks, and can only deduct points.",
  },
  {
    icon: ListChecks,
    title: "A validation plan you can run",
    text: "The riskiest assumption, a falsification test, and the first conversations and paid pilot to attempt this month.",
  },
];

const steps = [
  {
    icon: SlidersHorizontal,
    title: "Start with your unfair advantage.",
    text: "Map your experience, skills, constraints, and goals. Good opportunities should fit your life—not someone else’s.",
    detail: "Four short questions. Two minutes.",
  },
  {
    icon: ScanLine,
    title: "See the opportunity, not just the idea.",
    text: "Explore buyer pain, competitive context, business economics, and evidence quality in one structured research brief.",
    detail:
      "Discovery, web retrieval, classification, scoring, and review run as one durable job.",
  },
  {
    icon: Users,
    title: "Make your next conversation count.",
    text: "Turn a promising hypothesis into a focused validation plan, with assumptions to test and buyers to talk to.",
    detail:
      "Save a shortlist, track the checklist, and come back when you have real answers.",
  },
];

const rules = [
  {
    icon: Globe2,
    title: "Two independent domains, minimum",
    text: "An opportunity only enters the report when supporting evidence comes from at least two unrelated websites, and at least one is not a vendor selling the solution.",
  },
  {
    icon: Scale,
    title: "Scores are capped, not inflated",
    text: "With limited evidence a score cannot exceed 70. Even with strong evidence it tops out at 85. The number says “worth testing”, never “guaranteed”.",
  },
  {
    icon: Swords,
    title: "Review can only subtract",
    text: "The adversarial pass can reject a hypothesis or deduct up to 30 points. It can never add enthusiasm back in.",
  },
  {
    icon: Ban,
    title: "No evidence, no report",
    text: "If retrieval fails or the evidence is thin, the run stops and tells you so. We would rather return nothing than something invented.",
  },
];

const audiences = [
  {
    icon: Compass,
    title: "Aspiring founders",
    text: "You know you want to build something recurring, but every idea list feels generic. Start from what you already know and who you can already reach.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Independent professionals",
    text: "Consultants, fractional leaders, and specialists who want to productize expertise into a GenAI-enabled service with monthly revenue.",
  },
  {
    icon: Sparkles,
    title: "Side-business explorers",
    text: "Limited hours and a modest budget. You need the narrow, reachable problems, not the moonshots.",
  },
];

const faqs = [
  {
    q: "Is this just an AI idea generator?",
    a: "No. Ideas are only the first stage. Each one must survive web retrieval, evidence classification, independent-source rules, and an adversarial review before it reaches your report. Candidates without evidence are dropped rather than dressed up.",
  },
  {
    q: "What can I try without an account?",
    a: "The whole workspace. The demo walks through a complete research journey with clearly labeled synthetic data, so you can see the report structure, scoring, and validation plan before you sign up.",
  },
  {
    q: "What does a research run actually produce?",
    a: "A saved report with the scored opportunity hypotheses that passed the evidence check (up to twelve, depending on the research budget), a recommendation of which to test first, the original source excerpts behind each one, the weights used, a critique, a falsification test, and next validation steps. Reports stay in your private workspace and can be reopened any time.",
  },
  {
    q: "Which languages are supported?",
    a: "The interface is available in English, Simplified Chinese, and Traditional Chinese. Source excerpts are always kept in their original language so you can verify them yourself.",
  },
  {
    q: "Is live research available today?",
    a: "Yes. Every confirmed account receives one free, evidence-driven research run. If a run fails before producing a report, it is returned to you automatically. Paid credits for further runs are planned, and no payments are collected yet.",
  },
];

export function Landing() {
  const copy = useCopy();
  return (
    <PublicShell>
      <main id="main-content" tabIndex={-1}>
        <section className="hero-bg overflow-hidden border-b">
          <div className="hero-layout mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-16 lg:py-20">
            <div className="hero-copy">
              <p className="eyebrow">
                {copy("Evidence-first opportunity research for founders")}
              </p>
              <h1 className="text-balance">
                {copy("Find a business worth building.")}
                <br />
                <span className="italic">{copy("Then prove it.")}</span>
              </h1>
              <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
                {copy(
                  "Turn your experience into evidence-backed business ideas, with scores, risks, and a practical validation plan.",
                )}
              </p>
              <div className="hero-actions flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg">
                  <Link href="/demo/dashboard">
                    {copy("Explore the live demo")}
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/signup">
                    {copy("Create a free account")}
                    <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            </div>
            <EvidencePreview />
          </div>
        </section>

        <section className="border-b bg-card">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 py-6 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4 md:px-8">
            {[
              "Built around your founder profile",
              "Evidence before enthusiasm",
              "Recurring-revenue thinking",
              "Validation, not speculation",
            ].map((text) => (
              <p key={text} className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" />
                {copy(text)}
              </p>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow">{copy("How it works")}</p>
            <h2 className="editorial-title mt-3 text-balance text-4xl md:text-5xl">
              {copy("A better question than “What should I build?”")}
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              {copy(
                "Find the intersection of what you can build, who needs it, and what they might pay for.",
              )}
            </p>
          </div>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="surface flex flex-col gap-5 p-6">
                <div className="flex items-center justify-between">
                  <span className="step-number">{index + 1}</span>
                  <step.icon className="size-5 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold">{copy(step.title)}</h3>
                <p className="leading-relaxed text-muted-foreground">{copy(step.text)}</p>
                <p className="mt-auto pt-2 text-sm font-medium text-primary">{copy(step.detail)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="whats-inside" className="border-y bg-card">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
            <div className="max-w-2xl">
              <h2 className="editorial-title text-balance text-4xl md:text-5xl">
                {copy("Inside every research report")}
              </h2>
              <p className="mt-4 text-muted-foreground">
                {copy(
                  "Not a chat transcript. A structured, saved brief you can read in ten minutes and act on the same day.",
                )}
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {reportParts.map((part) => (
                <article key={part.title} className="flex gap-4 rounded-2xl bg-background p-5 sm:p-6">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <part.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{copy(part.title)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy(part.text)}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="eyebrow">{copy("Honest by design")}</p>
              <h2 className="editorial-title mt-3 text-balance text-4xl md:text-5xl">
                {copy("Rules the research engine cannot break")}
              </h2>
              <p className="mt-4 max-w-lg text-muted-foreground">
                {copy(
                  "Most AI tools are optimized to sound convincing. VentureLens is built to be checkable. These rules are enforced in code, not in a prompt.",
                )}
              </p>
            </div>
            <div className="grid gap-4">
              {rules.map((rule) => (
                <article key={rule.title} className="surface flex gap-4 p-5 sm:p-6">
                  <rule.icon className="mt-1 size-5 shrink-0 text-primary" />
                  <div>
                    <h3 className="text-lg font-semibold">{copy(rule.title)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy(rule.text)}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y bg-secondary/60">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8">
            <h2 className="editorial-title max-w-3xl text-balance text-4xl md:text-5xl">
              {copy("Built for people who would rather test than guess")}
            </h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {audiences.map((audience) => (
                <article key={audience.title} className="border-t border-primary/20 pt-5">
                  <audience.icon className="size-6 text-primary" />
                  <h3 className="mt-4 text-lg font-semibold">{copy(audience.title)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy(audience.text)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
          <div className="grid gap-10 md:grid-cols-[1fr_1.5fr]">
            <div>
              <h2 className="editorial-title text-balance text-4xl md:text-5xl">
                {copy("Straight answers before you start")}
              </h2>
              <p className="mt-4 text-muted-foreground">
                {copy("Still unsure? Open the demo and read a full sample report first.")}
              </p>
              <Button asChild variant="outline" className="mt-6 w-full sm:w-auto">
                <Link href="/demo/research/results">
                  {copy("Read a sample report")}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {faqs.map((faq) => (
                <details key={faq.q} className="surface group p-5">
                  <summary className="flex min-h-11 items-center justify-between gap-4 font-medium">
                    {copy(faq.q)}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{copy(faq.a)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-5 mb-20 rounded-2xl bg-primary px-6 py-14 text-primary-foreground md:mx-8 xl:mx-auto xl:max-w-7xl">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <h2 className="editorial-title text-balance text-4xl md:text-5xl">
              {copy("Your next chapter deserves a clearer lens.")}
            </h2>
            <p className="max-w-xl text-primary-foreground/85">
              {copy(
                "You don’t need another list of startup ideas. You need a thoughtful starting point for a business that fits you.",
              )}
            </p>
            <Button asChild size="lg" variant="outline" className="border-card bg-card text-primary hover:bg-secondary">
              <Link href="/signup">
                {copy("Build your founder profile")}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
