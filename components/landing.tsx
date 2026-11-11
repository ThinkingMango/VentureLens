"use client";

import Link from "next/link";
import { ArrowRight, Check, Plus, X } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { EvidencePreview } from "@/components/evidence-preview";
import { useCopy } from "@/i18n/use-copy";
import { useDemoContent } from "@/i18n/demo";
import { REVIEW_MAX_PENALTY } from "@/lib/research-core";

const steps = [
  {
    title: "Describe where you’re starting from",
    text: "Your experience, skills, constraints and goals. Good opportunities should fit your life, not someone else’s.",
    detail: "Four short questions. About two minutes.",
  },
  {
    title: "Run the research",
    text: "Ask VentureLens to find opportunities in a market, or to check an idea you already have. It searches the web, reads the pages, and scores what the evidence supports.",
    detail: "Follow progress live, or leave and get an email when the report is ready.",
  },
  {
    title: "Test it with real buyers",
    text: "Turn the report’s first steps into a 7, 14 or 30-day validation sprint. Decide up front what result means go.",
    detail: "At the end, record your decision: keep going, park it, or drop it.",
  },
];

// The four gates every candidate passes through, in the order the engine applies them (lib/research-core.ts).
const gates = [
  "Evidence found",
  "Two independent websites",
  "Buyer demand, not vendor pages",
  "Survives review",
];

type LedgerRow =
  | { kind: "kept"; demoIndex: number }
  | { kind: "dropped"; title: string; stoppedAt: number; reason: string };

// An illustrative run: the four survivors are the demo's opportunities; the dropped ideas show real gate reasons.
const ledger: LedgerRow[] = [
  { kind: "kept", demoIndex: 0 },
  {
    kind: "dropped",
    title: "Bookkeeping autopilot for freelancers",
    stoppedAt: 2,
    reason: "Every supporting page was a vendor selling the same thing.",
  },
  { kind: "kept", demoIndex: 1 },
  {
    kind: "dropped",
    title: "Lease review assistant for small landlords",
    stoppedAt: 1,
    reason: "All the support came from a single forum.",
  },
  { kind: "kept", demoIndex: 2 },
  {
    kind: "dropped",
    title: "Grant-writing assistant for small charities",
    stoppedAt: 0,
    reason: "No page described the problem from the buyer’s side.",
  },
  { kind: "kept", demoIndex: 3 },
  {
    kind: "dropped",
    title: "Session notes for private therapists",
    stoppedAt: 3,
    reason: "Health-data rules apply, and free tools already do most of it.",
  },
];

const rules = [
  {
    title: "Two independent websites, minimum",
    text: "Support has to come from at least two unrelated sites, and at least one has to show real buyer pain or demand, not a vendor’s sales page.",
  },
  {
    title: "Scores are capped by evidence",
    text: "Fewer than three independent sources caps a score at 70. Even strong evidence tops out at 85. A score compares hypotheses; it is not a chance of success.",
  },
  {
    title: "Review can only subtract",
    text: "A second pass argues against every idea. It can reject one or take away up to {points} points. It can never add any back.",
  },
  {
    title: "No evidence, no report",
    text: "If retrieval fails or the evidence is thin, the run stops and says so. The list is never padded to look complete.",
  },
];

const reportParts = [
  {
    title: "Ranked opportunity hypotheses",
    text: "Up to eight concrete, narrow business ideas matched to your profile, each stated as a hypothesis to test rather than a promise.",
  },
  {
    title: "A named buyer and a real pain",
    text: "Who pays, what hurts, what they do today instead, and the trigger that makes them look for help.",
  },
  {
    title: "Claims tied to their sources",
    text: "Each claim is numbered to the pages that support or contradict it, with the excerpt in its original language, the website, and the date it was read.",
  },
  {
    title: "An explainable score",
    text: "Five weighted dimensions with visible weights and caps. Scores compare hypotheses; they are never success probabilities.",
  },
  {
    title: "An adversarial critique",
    text: "A second pass argues against each idea, names the free alternatives and regulatory risks, and can only deduct points.",
  },
  {
    title: "A validation plan you can run",
    text: "The riskiest assumption, a falsification test, and the first conversations and paid pilot to attempt this month.",
  },
  {
    title: "Yours to keep and question",
    text: "Reports stay in your private library. Export one as Markdown or PDF, and flag any claim or source you think is wrong.",
  },
];

const audiences = [
  {
    title: "Aspiring founders",
    text: "You know you want to build something recurring, but every idea list feels generic. Start from what you already know and who you can already reach.",
  },
  {
    title: "Independent professionals",
    text: "Consultants, fractional leaders, and specialists who want to productize expertise into a GenAI-enabled service with monthly revenue.",
  },
  {
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
    q: "Can I check an idea I already have?",
    a: "Yes. Choose “I have an idea — check it” when you start a run. VentureLens looks for independent evidence for and against that one idea, scores it the same way, and gives a verdict.",
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

function RunLedger() {
  const copy = useCopy();
  const { opportunities } = useDemoContent();
  const kept = ledger.filter((row) => row.kind === "kept").length;
  return (
    <div className="surface ledger-surface overflow-hidden">
      <div
        aria-hidden="true"
        className="ledger-head hidden border-b bg-background/50 px-6 py-3 text-xs leading-snug text-muted-foreground lg:grid"
      >
        <span>{copy("Hypothesis")}</span>
        {gates.map((gate) => (
          <span key={gate}>{copy(gate)}</span>
        ))}
        <span className="text-right">{copy("Score")}</span>
      </div>
      <ol aria-label={copy("An illustrative research run")}>
        {ledger.map((row, index) => {
          const isKept = row.kind === "kept";
          const opportunity = isKept ? opportunities[row.demoIndex] : null;
          const title = opportunity ? opportunity.title : copy((row as Extract<LedgerRow, { kind: "dropped" }>).title);
          const stoppedAt = isKept ? gates.length : row.stoppedAt;
          const reason = row.kind === "dropped" ? copy(row.reason) : null;
          return (
            <li
              key={index}
              className="ledger-row border-b px-5 py-5 last:border-b-0 sm:px-6 lg:py-4"
            >
              <div className="min-w-0">
                {opportunity ? (
                  <Link
                    href={`/demo/opportunities/${opportunity.id}`}
                    className="-my-3 inline-block py-3 font-medium leading-snug text-foreground underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
                  >
                    {title}
                  </Link>
                ) : (
                  <s className="ledger-struck leading-snug">{title}</s>
                )}
                {/* Phones: one track of four gates and a plain-language status. */}
                <div className="mt-4 flex flex-col gap-3 lg:hidden">
                  <span className="ledger-track" aria-hidden="true">
                    {gates.map((gate, gateIndex) => (
                      <span
                        key={gate}
                        data-state={
                          gateIndex < stoppedAt
                            ? "passed"
                            : gateIndex === stoppedAt
                              ? "stopped"
                              : "unreached"
                        }
                      />
                    ))}
                  </span>
                  {opportunity ? (
                    <p className="text-sm text-primary">
                      {copy("In the report with a score of {score}", { score: opportunity.score })}
                    </p>
                  ) : (
                    <p className="flex flex-col gap-1 text-sm leading-relaxed">
                      <span className="text-muted-foreground">
                        {copy("Dropped at: {gate}", { gate: copy(gates[stoppedAt]) })}
                      </span>
                      <span className="text-warm-ink">{reason}</span>
                    </p>
                  )}
                </div>
              </div>
              {/* From 1024px: one column per gate. Each cell names its gate for screen readers. */}
              {gates.map((gate, gateIndex) => {
                if (gateIndex < stoppedAt)
                  return (
                    <span key={gate} className="hidden items-center lg:flex">
                      <Check className="size-4 text-primary" aria-hidden="true" />
                      <span className="sr-only">{copy("{gate}: passed", { gate: copy(gate) })}</span>
                    </span>
                  );
                if (gateIndex === stoppedAt)
                  return (
                    <span
                      key={gate}
                      className="hidden items-start gap-2 text-sm leading-snug text-warm-ink lg:flex"
                      style={{ gridColumn: `span ${gates.length - gateIndex + 1}` }}
                    >
                      <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>
                        <span className="sr-only">{copy("{gate}: dropped here.", { gate: copy(gate) })} </span>
                        {reason}
                      </span>
                    </span>
                  );
                return null;
              })}
              {opportunity && (
                <span className="terminal-number hidden text-right text-2xl text-primary lg:block">
                  <span className="sr-only">{copy("Score")} </span>
                  {opportunity.score}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="border-t bg-background/50 px-5 py-4 text-sm text-muted-foreground sm:px-6">
        {copy(
          "{proposed} ideas proposed, {dropped} dropped, {kept} in the report. Illustrative run with synthetic data; the four that survive are the demo’s opportunities.",
          { proposed: ledger.length, dropped: ledger.length - kept, kept },
        )}
      </p>
    </div>
  );
}

export function Landing() {
  const copy = useCopy();
  return (
    <PublicShell>
      <main id="main-content" tabIndex={-1}>
        <section className="mx-auto max-w-7xl px-5 pb-16 pt-12 md:px-8 md:pb-24 md:pt-20">
          <div className="hero-layout">
            <h1 className="hero-title landing-title">
              {copy("Find a business worth building.")} {copy("Then prove it.")}
            </h1>
            <div className="hero-copy md:pt-2">
              <p className="max-w-[34rem] text-pretty text-lg leading-relaxed text-muted-foreground">
                {copy(
                  "Start from your experience, or from an idea you already have. VentureLens searches the web for independent evidence, drops what it can’t support, and gives you a scored report with a plan to test what’s left.",
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
                  <Link href="/signup">{copy("Create a free account")}</Link>
                </Button>
              </div>
              <p className="max-w-[34rem] text-sm text-muted-foreground">
                {copy("The demo needs no account. Every confirmed account includes one free research run.")}
              </p>
            </div>
            <EvidencePreview />
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="landing-rule flex flex-col gap-10 py-16 md:gap-14 md:py-24">
            <h2 className="landing-heading max-w-2xl">
              {copy("A better question than “What should I build?”")}
            </h2>
            <ol className="grid gap-10 md:grid-cols-3 md:gap-10 lg:gap-16">
              {steps.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-3">
                  <span
                    aria-hidden="true"
                    className="font-display text-5xl leading-none text-primary/80"
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold">{copy(step.title)}</h3>
                  <p className="leading-relaxed text-muted-foreground">{copy(step.text)}</p>
                  <p className="text-sm font-medium text-primary">{copy(step.detail)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="research-run" className="border-y bg-card">
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-16">
              <h2 className="landing-heading max-w-2xl">
                {copy("Most ideas don’t survive the research. That’s the point.")}
              </h2>
              <p className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
                {copy(
                  "Every run proposes five to eight hypotheses, then tries to break them. These rules are enforced in code, not in a prompt, so an idea reaches your report only if the evidence holds up.",
                )}
              </p>
            </div>
            <div className="mt-10 md:mt-14">
              <RunLedger />
            </div>
            <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
              {rules.map((rule) => (
                <li key={rule.title} className="landing-rule flex flex-col gap-2 pt-5">
                  <h3 className="font-semibold">{copy(rule.title)}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {copy(rule.text, { points: REVIEW_MAX_PENALTY })}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="whats-inside" className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
              <h2 className="landing-heading">{copy("Inside every research report")}</h2>
              <p className="max-w-md text-muted-foreground">
                {copy(
                  "Not a chat transcript. A structured, saved brief you can read in ten minutes and act on the same day.",
                )}
              </p>
              <Button asChild variant="outline" className="mt-2 w-full sm:w-fit">
                <Link href="/demo/research/results">{copy("Read a sample report")}</Link>
              </Button>
            </div>
            <dl>
              {reportParts.map((part) => (
                <div
                  key={part.title}
                  className="landing-rule grid gap-1.5 py-5 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] sm:gap-8"
                >
                  <dt className="font-semibold leading-snug">{copy(part.title)}</dt>
                  <dd className="leading-relaxed text-muted-foreground">{copy(part.text)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="landing-rule py-16 md:py-24">
            <h2 className="landing-heading max-w-3xl">
              {copy("Built for people who would rather test than guess")}
            </h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
              {audiences.map((audience) => (
                <div key={audience.title} className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold">{copy(audience.title)}</h3>
                  <p className="leading-relaxed text-muted-foreground">{copy(audience.text)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="landing-rule grid gap-8 py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-24">
            <div className="flex flex-col gap-4">
              <h2 className="landing-heading">{copy("Straight answers before you start")}</h2>
              <p className="max-w-md text-muted-foreground">
                {copy("Still unsure? Open the demo and read a full sample report first.")}
              </p>
            </div>
            <div className="border-y">
              {faqs.map((faq) => (
                <details key={faq.q} className="faq-item group">
                  <summary className="flex min-h-11 items-center justify-between gap-4 py-4 font-medium">
                    {copy(faq.q)}
                    <Plus
                      aria-hidden="true"
                      className="size-4 shrink-0 text-primary transition-transform group-open:rotate-45"
                    />
                  </summary>
                  <p className="max-w-2xl pb-5 leading-relaxed text-muted-foreground">{copy(faq.a)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-card">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-16 md:px-8 md:py-24 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-3xl flex-col gap-4">
              <h2 className="landing-heading">{copy("Your next chapter deserves a clearer lens.")}</h2>
              <p className="max-w-xl text-pretty text-muted-foreground">
                {copy(
                  "You don’t need another list of startup ideas. You need a thoughtful starting point for a business that fits you.",
                )}
              </p>
            </div>
            <div className="hero-actions flex flex-wrap gap-3 lg:shrink-0">
              <Button asChild size="lg">
                <Link href="/signup">
                  {copy("Build your founder profile")}
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/demo/dashboard">{copy("Explore the live demo")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
