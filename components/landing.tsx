"use client";

import { MobileDisclosure } from "@/components/mobile-disclosure";
import { useCopy } from "@/i18n/use-copy";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ScanLine,
  Users,
  SlidersHorizontal,
  ShieldCheck,
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
  Languages,
} from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { EvidencePreview } from "@/components/evidence-preview";

const reportParts = [
  {
    icon: Lightbulb,
    title: "Ranked opportunity hypotheses",
    text: "Up to eight concrete, narrow business ideas matched to your profile, each stated as a hypothesis to test rather than a promise.",
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
    a: "A saved report with up to eight scored opportunity hypotheses, the original source excerpts behind each one, the weights used, a critique, a falsification test, and next validation steps. Reports stay in your private workspace and can be reopened any time.",
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
      <main id="main-content">
        <section className="hero-bg relative overflow-hidden">
          <div className="hero-layout relative mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
            <div className="terminal-masthead">
              <span>
                {copy("Evidence-first opportunity research for founders")}
              </span>
              <span>{copy("English · 简体中文 · 繁體中文")}</span>
            </div>
            <div className="hero-copy">
              <h1 className="max-w-4xl text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl md:text-6xl">
                {copy("Find a business worth building.")}
                <br />
                <span>{copy("Then prove it.")}</span>
              </h1>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
                {copy(
                  "VentureLens turns your experience into a shortlist of GenAI-enabled, recurring-revenue businesses—each backed by linked sources, an explainable score, a critique, and a validation plan.",
                )}
              </p>
              <div className="hero-actions flex flex-wrap gap-3">
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
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-primary" />
                  {copy("No credit card")}
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="size-4 text-primary" />
                  {copy("Private workspace")}
                </li>
                <li className="flex items-center gap-1.5">
                  <Languages className="size-4 text-primary" />
                  {copy("English · 简体中文 · 繁體中文")}
                </li>
              </ul>
            </div>
            <MobileDisclosure title={copy("Preview a sample report")}>
              <EvidencePreview />
            </MobileDisclosure>
          </div>
        </section>
        <section className="border-y bg-background">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-5 py-7 text-sm text-muted-foreground">
            {[
              "Built around your founder profile",
              "Evidence before enthusiasm",
              "Recurring-revenue thinking",
              "Validation, not speculation",
            ].map((t) => (
              <span key={t} className="flex items-center gap-2">
                <Check className="size-4 text-primary" />
                {copy(t)}
              </span>
            ))}
          </div>
        </section>
        <section
          id="whats-inside"
          className="mx-auto max-w-7xl px-5 py-20 md:px-8"
        >
          <div className="flex flex-col gap-4 md:max-w-2xl">
            <p className="eyebrow">{copy("What you get")}</p>
            <h2 className="text-balance text-3xl font-semibold md:text-4xl">
              {copy("Inside every research report")}
            </h2>
            <p className="text-base text-muted-foreground">
              {copy(
                "Not a chat transcript. A structured, saved brief you can read in ten minutes and act on the same day.",
              )}
            </p>
          </div>
          <div className="mt-10 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {reportParts.map((part) => (
              <article
                key={part.title}
                className="flex flex-col gap-3 border-t py-6"
              >
                <span className="text-primary">
                  <part.icon className="size-5" />
                </span>
                <h3 className="text-lg font-semibold">{copy(part.title)}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {copy(part.text)}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="border-y bg-background">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="flex flex-col gap-4">
                <p className="eyebrow">{copy("How it works")}</p>
                <h2 className="max-w-xl text-balance text-3xl font-semibold md:text-4xl">
                  {copy("A better question than")}
                  <br />
                  {copy("“What should I build?”")}
                </h2>
              </div>
              <p className="max-w-md text-base text-muted-foreground">
                {copy(
                  "Find the intersection of what you can build, who needs it, and what they might pay for.",
                )}
              </p>
            </div>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((f, i) => (
                <li key={f.title} className="flex flex-col gap-5 border-t py-6">
                  <div className="flex items-center justify-between">
                    <span className="step-number">{i + 1}</span>
                    <f.icon className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-semibold">{copy(f.title)}</h3>
                    <p className="text-base leading-relaxed text-muted-foreground">
                      {copy(f.text)}
                    </p>
                  </div>
                  <p className="mt-auto border-t pt-4 text-sm text-muted-foreground">
                    {copy(f.detail)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="band-dark">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8">
            <div className="flex flex-col gap-4 md:max-w-2xl">
              <p className="eyebrow text-[#9fb7ff]">
                {copy("Honest by design")}
              </p>
              <h2 className="text-balance text-3xl font-semibold md:text-4xl">
                {copy("Rules the research engine cannot break")}
              </h2>
              <p className="muted-on-dark text-base">
                {copy(
                  "Most AI tools are optimized to sound convincing. VentureLens is built to be checkable. These rules are enforced in code, not in a prompt.",
                )}
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {rules.map((rule) => (
                <article
                  key={rule.title}
                  className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#9fb7ff]">
                    <rule.icon className="size-5" />
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-semibold">
                      {copy(rule.title)}
                    </h3>
                    <p className="muted-on-dark text-sm leading-relaxed">
                      {copy(rule.text)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-20 md:px-8">
          <div className="flex flex-col gap-4 md:max-w-2xl">
            <p className="eyebrow">{copy("Who it’s for")}</p>
            <h2 className="text-balance text-3xl font-semibold md:text-4xl">
              {copy("Built for people who would rather test than guess")}
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {audiences.map((a) => (
              <article
                key={a.title}
                className="flex flex-col gap-4 rounded-2xl bg-secondary p-6"
              >
                <a.icon className="size-6 text-primary" />
                <h3 className="text-lg font-semibold">{copy(a.title)}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {copy(a.text)}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section id="faq" className="border-t bg-background">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 md:grid-cols-[1fr_1.6fr] md:px-8">
            <div className="flex flex-col gap-4">
              <p className="eyebrow">{copy("Questions")}</p>
              <h2 className="text-balance text-3xl font-semibold md:text-4xl">
                {copy("Straight answers before you start")}
              </h2>
              <p className="text-base text-muted-foreground">
                {copy(
                  "Still unsure? Open the demo and read a full sample report first.",
                )}
              </p>
              <Button asChild variant="outline" className="w-fit">
                <Link href="/demo/research/results">
                  {copy("Read a sample report")}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {faqs.map((f) => (
                <details key={f.q} className="surface group p-5">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium">
                    {copy(f.q)}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {copy(f.a)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-5 mb-20 mt-20 flex max-w-7xl flex-col items-center gap-6 rounded-lg border bg-card px-6 py-16 text-center text-white md:mx-8 xl:mx-auto">
          <h2 className="text-balance text-3xl font-semibold md:text-4xl">
            {copy("Your next chapter deserves a clearer lens.")}
          </h2>
          <p className="max-w-xl text-base text-white/80">
            {copy(
              "You don’t need another list of startup ideas. You need a thoughtful starting point for a business that fits you.",
            )}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-border bg-primary text-primary-foreground hover:bg-[var(--primary-deep)]"
            >
              <Link href="/signup">
                {copy("Build your founder profile")}
                <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/demo/dashboard">
                {copy("Explore the demo")}
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
