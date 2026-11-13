"use client";

import Link from "next/link";
import { ArrowRight, Check, Plus, X } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { EvidencePreview } from "@/components/evidence-preview";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { useDemoContent } from "@/i18n/demo";
import { REVIEW_MAX_PENALTY } from "@/lib/research-core";
import { plans } from "@/components/pricing";

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

// What a founder gets from a report, each outcome backed by the part of the report that delivers it.
const benefits = [
  {
    title: "Know which idea has real buyers",
    text: "Each hypothesis names who pays, what hurts, and what they use today, backed by pages where people describe the problem in their own words.",
  },
  {
    title: "Check every claim yourself",
    text: "Claims are numbered to the page they came from, with the excerpt in its original language, the website, and the date it was read.",
  },
  {
    title: "See exactly why an idea scored what it did",
    text: "Five weighted dimensions, a cap set by the evidence, and a second review that can only take points away.",
  },
  {
    title: "Leave with a test you can run this week",
    text: "The riskiest assumption, how to disprove it, and the first conversations and paid pilot to try, ready to turn into a 7, 14 or 30 day validation sprint.",
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

// The pricing answer reads the cheapest planned package from the pricing page, so the two never disagree.
const pricingQuestion = "What happens after the 10 free research runs?";
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
    q: "How is this different from asking a chatbot?",
    a: "A chatbot answers from what it remembers. VentureLens reads live web pages, drops any idea that lacks support from two independent websites, and shows you every page it used, so you can check the evidence instead of trusting the answer.",
  },
  {
    q: pricingQuestion,
    a: "Paid packages are planned, starting at {price} for {runs} runs. Final prices are published before checkout opens, and nothing is charged today.",
  },
  {
    q: "What happens to my data?",
    a: "Your founder profile and reports are private to your account. We never sell your data or use it to train our own AI models, and deleting your account deletes your profile, briefs and reports with it.",
  },
  {
    q: "Is live research available today?",
    a: "Yes. Every confirmed account receives 10 free research runs, valid for 90 days. A run that fails on our side is always returned, and one that stops because the evidence was too thin is returned up to a per-account limit. Paid credits for further runs are planned, and no payments are collected yet.",
  },
];

function RunLedger() {
  const copy = useCopy();
  const { opportunities } = useDemoContent();
  const kept = ledger.filter((row) => row.kind === "kept").length;
  return (
    <div className="surface ledger-surface overflow-hidden">
      <p className="border-b px-5 py-4 font-display text-xl leading-snug sm:px-6 md:text-2xl">
        {copy("{proposed} ideas proposed. {dropped} dropped. {kept} in the report.", {
          proposed: ledger.length,
          dropped: ledger.length - kept,
          kept,
        })}
      </p>
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
              className="ledger-row border-b px-5 py-4 last:border-b-0 sm:px-6"
            >
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-4">
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
                {opportunity && (
                  <span aria-hidden="true" className="terminal-number text-xl text-primary lg:hidden">
                    {opportunity.score}
                  </span>
                )}
                </div>
                {/* Phones: one track of four gates and a plain-language status. */}
                <div className="mt-3 flex flex-col gap-2 lg:hidden">
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
                    <p className="sr-only">
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
        {copy("Illustrative run with synthetic data; the four that survive are the demo’s opportunities.")}
      </p>
    </div>
  );
}

// Facts shown beside the primary action. Each is enforced in code (lib/research-core.ts, the refund trigger), never a
// quote or a number we cannot back.
const proofPoints = [
  "Every claim links to its source",
  "Ideas need two independent websites",
  "Runs that fail on our side are returned",
];

/** The one primary action, used in the hero and again at the close, with the reassurance that removes its risk. */
function PrimaryAction({ marker }: { marker: "start" | "end" }) {
  const copy = useCopy();
  return (
    <div className="flex flex-col gap-4">
      <div className="hero-actions flex flex-wrap gap-3" {...(marker === "start" ? { "data-cta-start": "" } : {})}>
        <Button asChild size="lg">
          <Link href="/signup">
            {copy("Get 10 free research runs")}
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <p className="max-w-[34rem] text-sm text-muted-foreground">
        {copy(
          "Free account, no card or password. Your runs stay valid for 90 days, and a full run usually takes 5–10 minutes.",
        )}
      </p>
      {/* The demo stays one step away, as a link rather than a second button competing with the account. */}
      <Link
        href="/demo/dashboard"
        className="-my-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
      >
        {copy("Or explore the demo first, no account needed")}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

export function Landing() {
  const copy = useCopy();
  const format = useFormats();
  const entry = plans.reduce((low, plan) => (plan.price < low.price ? plan : low));
  const faqAnswer = (faq: (typeof faqs)[number]) =>
    copy(faq.a, faq.q === pricingQuestion ? { price: format.usd(entry.price, 0), runs: entry.runs } : undefined);
  // FAQ structured data for search and answer engines, in the page's language and built from the same list.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: copy(faq.q),
      acceptedAnswer: { "@type": "Answer", text: faqAnswer(faq) },
    })),
  };
  return (
    <PublicShell>
      <main id="main-content" tabIndex={-1}>
        <section className="mx-auto max-w-7xl px-5 pb-14 pt-10 md:px-8 md:pb-24 md:pt-20">
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
              <PrimaryAction marker="start" />
              <ul aria-label={copy("Why you can trust a report")} className="flex flex-col gap-2 border-t pt-5 text-sm">
                {proofPoints.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    {copy(point)}
                  </li>
                ))}
              </ul>
            </div>
            <EvidencePreview />
          </div>
        </section>

        {/* Problem, then the proof that answers it: the run ledger. */}
        <section id="research-run" className="border-y bg-card">
          <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-24">
            <p className="max-w-3xl text-pretty font-display text-2xl leading-snug text-muted-foreground md:text-3xl">
              {copy("Idea lists are easy to find. Knowing which idea has paying buyers is the hard part.")}
            </p>
            <div className="mt-8 grid gap-6 md:mt-10 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-16">
              <h2 className="landing-heading max-w-2xl">
                {copy("Most ideas don’t survive the research. That’s the point.")}
              </h2>
              <p className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
                {copy(
                  "Every run proposes five to eight hypotheses, then tries to break them. These rules are enforced in code, not in a prompt, so an idea reaches your report only if the evidence holds up.",
                )}
              </p>
            </div>
            <div className="mt-8 md:mt-14">
              <RunLedger />
            </div>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 md:mt-12 md:gap-8 lg:grid-cols-4 lg:gap-10">
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

        <section id="whats-inside" className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
              <h2 className="landing-heading">{copy("What every report gives you")}</h2>
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
              {benefits.map((benefit) => (
                <div key={benefit.title} className="landing-rule flex flex-col gap-2 py-5 md:py-6">
                  <dt className="text-lg font-semibold leading-snug">{copy(benefit.title)}</dt>
                  <dd className="leading-relaxed text-muted-foreground">{copy(benefit.text)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="landing-rule flex flex-col gap-10 py-14 md:gap-14 md:py-24">
            <h2 className="landing-heading max-w-2xl">
              {copy("A better question than “What should I build?”")}
            </h2>
            <ol className="grid gap-8 md:grid-cols-3 md:gap-10 lg:gap-16">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 md:flex md:flex-col md:gap-3"
                >
                  <span
                    aria-hidden="true"
                    className="row-span-3 font-display text-4xl leading-none text-primary/80 md:text-5xl"
                  >
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold md:mt-2">{copy(step.title)}</h3>
                  <p className="leading-relaxed text-muted-foreground">{copy(step.text)}</p>
                  <p className="text-sm font-medium text-primary">{copy(step.detail)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="landing-rule py-14 md:py-24">
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
          <div className="landing-rule grid gap-8 py-14 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-24">
            <div className="flex flex-col gap-4">
              <h2 className="landing-heading">{copy("Straight answers before you start")}</h2>
              <p className="max-w-md text-muted-foreground">
                {copy("Still unsure? Open the demo and read a full sample report first.")}
              </p>
            </div>
            <div className="border-y">
              {faqs.map((faq) => (
                <details key={faq.q} className="faq-item accordion group">
                  <summary className="flex min-h-11 items-center justify-between gap-4 py-4 font-medium">
                    {copy(faq.q)}
                    <Plus
                      aria-hidden="true"
                      className="size-4 shrink-0 text-primary transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-45"
                    />
                  </summary>
                  <p className="max-w-2xl pb-5 leading-relaxed text-muted-foreground">{faqAnswer(faq)}</p>
                </details>
              ))}
            </div>
          </div>
          <script
            type="application/ld+json"
            // The FAQ text is our own copy; escaping "<" keeps it from ever closing the script element.
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }}
          />
        </section>

        {/* The close repeats the hero's action and reassurance, word for word. */}
        <section className="border-t bg-card" data-cta-end>
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-14 md:px-8 md:py-24 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-3xl flex-col gap-4">
              <h2 className="landing-heading">{copy("Your next chapter deserves a clearer lens.")}</h2>
              <p className="max-w-xl text-pretty text-muted-foreground">
                {copy(
                  "You don’t need another list of startup ideas. You need a thoughtful starting point for a business that fits you.",
                )}
              </p>
            </div>
            <div className="lg:shrink-0">
              <PrimaryAction marker="end" />
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
