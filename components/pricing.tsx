"use client";
import { useCopy, useFormats } from "@/i18n/use-copy";

import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Planned packages. Nothing is gated by package: every account gets the whole product, so the only real differences
// are how many runs a package holds, whether it renews, and what one run costs. The per-run price is derived, never typed.
export const plans = [
  { name: "Opportunity Sprint", price: 29, runs: 5, monthly: false, description: "For a focused first exploration." },
  { name: "Explorer", price: 39, runs: 10, monthly: true, description: "For founders finding their direction." },
  { name: "Builder", price: 79, runs: 30, monthly: true, description: "For a more active research practice." },
] as const;

export const perRun = (plan: (typeof plans)[number]) => plan.price / plan.runs;

/**
 * The planned packages as one comparison: price, runs and price per run. Used on /pricing and the demo billing page.
 * Each row is a definition list, so its labels are read out on every screen; the column header is visual only.
 */
export function PlanTable({ bleed = true }: { bleed?: boolean }) {
  const copy = useCopy();
  const format = useFormats();
  const cheapest = Math.min(...plans.map(perRun));
  return (
    // Public pages run it edge to edge on phones; inside the workspace it stays a card like its neighbours.
    <div className={cn("surface overflow-hidden", bleed && "bleed-on-phone")}>
      <div
        aria-hidden="true"
        className="plan-row hidden border-b bg-background/50 px-6 py-3 text-xs text-muted-foreground md:grid"
      >
        <span>{copy("Package")}</span>
        <span>{copy("Price")}</span>
        <span>{copy("Research runs")}</span>
        <span className="text-right">{copy("About per run")}</span>
      </div>
      <ul aria-label={copy("Planned packages")}>
        {plans.map((plan) => (
          <li key={plan.name} className="plan-row grid grid-cols-3 gap-x-4 gap-y-5 border-b md:gap-y-0 px-5 py-6 last:border-b-0 sm:px-6">
            <div className="col-span-3 flex flex-col gap-1">
              <h3 className="text-lg font-semibold leading-snug">{copy(plan.name)}</h3>
              <p className="text-sm text-muted-foreground">{copy(plan.description)}</p>
            </div>
            {/* Phones: each figure's label and value sit on rows shared across the three columns (subgrid), so the
                values line up even when a label wraps. */}
            <dl className="contents">
              <div className="row-span-2 grid grid-rows-subgrid gap-1 md:row-span-1 md:flex md:flex-col">
                <dt className="text-sm text-muted-foreground md:sr-only">{copy("Price")}</dt>
                <dd>
                  <span className="text-2xl font-semibold tabular-nums tracking-tight">{format.usd(plan.price, 0)}</span>
                  <span className="block text-sm text-muted-foreground md:ml-1.5 md:inline">
                    {plan.monthly ? copy("/ month") : copy("one-time")}
                  </span>
                </dd>
              </div>
              <div className="row-span-2 grid grid-rows-subgrid gap-1 md:row-span-1 md:flex md:flex-col">
                <dt className="text-sm text-muted-foreground md:sr-only">{copy("Research runs")}</dt>
                <dd className="tabular-nums">
                  {plan.monthly
                    ? copy("{count} a month", { count: plan.runs })
                    : copy("{count} runs", { count: plan.runs })}
                </dd>
              </div>
              <div className="row-span-2 grid grid-rows-subgrid gap-1 md:row-span-1 md:flex md:flex-col">
                <dt className="text-sm text-muted-foreground md:sr-only">{copy("About per run")}</dt>
                <dd
                  className={cn(
                    "terminal-number font-display text-3xl leading-none md:text-right md:text-4xl",
                    perRun(plan) === cheapest ? "text-primary" : "text-foreground",
                  )}
                >
                  {format.usd(perRun(plan), 2)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <p className="border-t bg-background/50 px-5 py-4 text-sm text-muted-foreground sm:px-6">
        {copy(
          "Every package is planned to include the whole product: founder profile, finding opportunities or checking your own idea, reports with linked sources, your library and exports, and validation sprints.",
        )}
      </p>
    </div>
  );
}

type StatementEntry = { title: string; detail: string; change: number; kind: "added" | "report" | "stopped" | "returned" };

// An example statement that walks through the refund rule in public.release_failed_research_run
// (supabase/migrations/20261109150000_cap_failed_run_refunds.sql).
const statement: StatementEntry[] = [
  { title: "Opportunity Sprint added", detail: "Planned package", change: 5, kind: "added" },
  {
    title: "Research run: proposal tools for agencies",
    detail: "Report saved with four opportunities.",
    change: -1,
    kind: "report",
  },
  {
    title: "Research run: bookkeeping for freelancers",
    detail: "Stopped: the evidence was too thin for a report.",
    change: -1,
    kind: "stopped",
  },
  {
    title: "Credit returned",
    detail: "Thin evidence is returned up to a per-account limit. Past it, the run keeps its credit, and retrying it is free.",
    change: 1,
    kind: "returned",
  },
  {
    title: "Idea check: a lease-review assistant",
    detail: "Stopped: a search provider was unavailable.",
    change: -1,
    kind: "stopped",
  },
  {
    title: "Credit returned",
    detail: "A failure on our side is always returned.",
    change: 1,
    kind: "returned",
  },
];

function CreditStatement() {
  const copy = useCopy();
  let balance = 0;
  const rows = statement.map((entry) => ({ ...entry, balance: (balance += entry.change) }));
  return (
    <div className="surface bleed-on-phone overflow-hidden">
      <div
        aria-hidden="true"
        className="statement-row grid border-b bg-background/50 px-5 py-3 text-xs text-muted-foreground sm:px-6"
      >
        <span>{copy("Entry")}</span>
        <span className="text-right">{copy("Credits")}</span>
        <span className="text-right">{copy("Balance")}</span>
      </div>
      <ol aria-label={copy("An example credit statement")}>
        {rows.map((row, index) => (
          <li key={index} className="statement-row grid border-b px-5 py-5 last:border-b-0 sm:px-6 md:py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-medium leading-snug">{copy(row.title)}</span>
              <span
                className={cn(
                  "text-sm leading-relaxed",
                  row.kind === "stopped" ? "text-warm-ink" : "text-muted-foreground",
                )}
              >
                {copy(row.detail)}
              </span>
            </div>
            <span
              className={cn(
                "terminal-number text-lg md:text-right",
                row.change > 0 ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="sr-only">{copy("Credits")}: </span>
              {row.change > 0 ? `+${row.change}` : `−${Math.abs(row.change)}`}
            </span>
            <span className="terminal-number text-lg text-right">
              <span className="sr-only">{copy("Balance")}: </span>
              {row.balance}
            </span>
          </li>
        ))}
      </ol>
      <p className="border-t bg-background/50 px-5 py-4 text-sm text-muted-foreground sm:px-6">
        {copy(
          "Example statement. Two runs stopped and both credits came back, so five credits bought one report and leave four.",
        )}
      </p>
    </div>
  );
}

const faqs = [
  {
    q: "What does a research credit cover?",
    a: "One credit is one research run, whether VentureLens finds opportunities for you or checks an idea you already have. The demo does not consume credits or call a live research provider.",
  },
  {
    q: "Are the opportunities verified?",
    a: "Live reports link every claim to the web pages behind it, with the date each was read, and drop ideas without independent evidence. That is evidence to test, not proof of demand: validate findings with real buyers. The demo uses synthetic data.",
  },
  {
    q: "Will these prices change?",
    a: "These packages are the working baseline while we measure real cost per completed report. Final prices, credit rollover, and refund terms will be published before checkout opens.",
  },
  {
    q: "Can I cancel a subscription?",
    a: "Recurring packages are illustrative. Subscription creation, renewal, cancellation, invoices, and billing management will require a future Stripe integration.",
  },
  {
    q: "How do I get access to live research now?",
    a: "Create a free account and confirm your email. Ten research runs, valid for 90 days, are granted automatically and shown on the New research page; complete your founder profile and start a brief to use them.",
  },
];

export function Pricing() {
  const copy = useCopy();
  return (
    <PublicShell>
      <main id="main-content" tabIndex={-1}>
        <section className="mx-auto max-w-7xl px-5 pb-16 pt-12 md:px-8 md:pb-20 md:pt-20">
          <div className="flex flex-col gap-8 md:gap-10">
            <h1 className="landing-title max-w-5xl">{copy("Your first 10 research runs are free.")}</h1>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-end md:gap-16">
              <p className="max-w-[36rem] text-pretty text-lg leading-relaxed text-muted-foreground">
                {copy(
                  "Every confirmed account gets 10 full research runs, valid for 90 days: discovery, web evidence, scoring, adversarial review and a saved report each time. Paid credits are planned but not on sale yet, so nothing on this page can charge you.",
                )}
              </p>
              <div className="hero-actions flex flex-wrap gap-3 md:justify-end" data-cta-start>
                <Button asChild size="lg">
                  <Link href="/signup">
                    {copy("Create a free account")}
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/demo/dashboard">{copy("Try the demo")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="packages" className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="landing-rule flex flex-col gap-10 py-16 md:py-20">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16">
              <h2 className="landing-heading">{copy("Planned packages")}</h2>
              <p className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
                {copy(
                  "One credit is one research run. Nothing is held back for bigger packages; they differ only in how many runs you get and what each one costs.",
                )}
              </p>
            </div>
            <PlanTable />
            <p className="-mt-4 text-sm text-muted-foreground">
              {copy("Illustrative packages in USD. Checkout and subscriptions are not connected.")}
            </p>
          </div>
        </section>

        <section id="credits" className="border-y bg-card">
          <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 py-16 md:px-8 md:py-24">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16">
              <h2 className="landing-heading">{copy("You don’t pay for our failures.")}</h2>
              <p className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
                {copy(
                  "Failures on our side always return the credit. When the evidence is too thin for a report, the credit also returns, up to a per-account limit that prevents abuse. Your free runs work this way today, and paid credits will too.",
                )}
              </p>
            </div>
            <CreditStatement />
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="grid gap-8 py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-24">
            <h2 className="landing-heading">{copy("A few things worth knowing")}</h2>
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
                  <p className="max-w-2xl pb-5 leading-relaxed text-muted-foreground">{copy(faq.a)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-card" data-cta-end>
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-16 md:px-8 md:py-24 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-3xl flex-col gap-4">
              <h2 className="landing-heading">{copy("Start with your free runs. Decide about credits later.")}</h2>
              <p className="max-w-xl text-pretty text-muted-foreground">
                {copy("No card, no subscription. The demo needs no account at all.")}
              </p>
            </div>
            <div className="hero-actions flex flex-wrap gap-3 lg:shrink-0">
              <Button asChild size="lg">
                <Link href="/signup">
                  {copy("Create a free account")}
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/demo/dashboard">{copy("Try the demo")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
