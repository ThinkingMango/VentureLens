"use client";
import { MobileDisclosure } from "@/components/mobile-disclosure";
import { useCopy } from "@/i18n/use-copy";

import Link from "@/components/workspace-link";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Telescope,
  Lightbulb,
  Bookmark,
  Target,
  Check,
  FileText,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader, SectionTitle, DemoNote } from "@/components/shared";
import { OpportunityCard } from "@/components/opportunity-card";
import { ScoreChart } from "@/components/score-chart";
import { useDemoContent } from "@/i18n/demo";
import { useDemo } from "@/components/demo-provider";
import { ActiveSprintCard } from "@/components/active-sprint-card";
import { demoSprint, summarizeSprint } from "@/lib/sprint-core";
import { demoSteps } from "@/lib/opportunity-view";
export function DemoDashboard() {
  const copy = useCopy();
  const { opportunities } = useDemoContent();
  const { profile, saved, run } = useDemo();
  // The demo's one fixed example sprint (WP-10), the same one its first opportunity page shows.
  const first = opportunities[0];
  const sprintSummary = summarizeSprint(
    demoSprint(first.id, demoSteps(copy, []).map((step) => step.action), ""),
    first.title,
  );
  return (
    <>
      <PageHeader
        title={copy("Research overview")}
        description={copy(
          "Welcome back, {name}. Let’s find a business worth building.",
          { name: profile.name },
        )}
      >
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/research/new?mode=verify">
              <Lightbulb />
              {copy("Check an idea")}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/research/new">
              <Plus />
              {copy("New research")}
            </Link>
          </Button>
        </div>
      </PageHeader>
      <ActiveSprintCard sprint={sprintSummary} />
      <div>
        <section
          aria-label={copy("Workspace statistics")}
          className="terminal-stats"
        >
          {[
            {
              label: "Research runs",
              value: "2",
              detail: "2 completed demo runs",
              icon: Telescope,
            },
            {
              label: "Opportunities explored",
              value: "4",
              detail: "Across 3 industries",
              icon: Lightbulb,
            },
            {
              label: "Saved opportunities",
              value: String(saved.length),
              detail: "Your shortlist, taking shape",
              icon: Bookmark,
            },
            {
              label: "Top opportunity score",
              value: String(Math.max(...opportunities.map((o) => o.score))),
              detail: "Out of 100 · illustrative",
              icon: Target,
            },
          ].map((s) => (
            <div className="flex flex-col gap-2" key={s.label}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {copy(s.label)}
                </span>
                <s.icon className="size-[18px] shrink-0 text-muted-foreground" />
              </div>
              <p className="stat-value">{s.value}</p>
              <p className="hidden text-sm text-muted-foreground sm:block">
                {copy(s.detail)}
              </p>
            </div>
          ))}
        </section>
      </div>
      <section className="flex flex-col gap-5">
        <SectionTitle
          title={copy("Opportunities worth a closer look")}
          description={copy(
            "Demo results are fixed illustrative fixtures, not tailored AI output.",
          )}
          href="/research/results"
          label={copy("Explore all")}
        />
        <div className="grid gap-5 md:grid-cols-2">
          {opportunities.map((opportunity, index) => (
            <div
              key={opportunity.id}
              className={index > 1 ? "hidden md:block" : ""}
            >
              <OpportunityCard opportunity={opportunity} />
            </div>
          ))}
        </div>
      </section>
      <MobileDisclosure title={copy("Research activity and comparison")}>
        <div className="flex flex-col gap-6">
          {" "}
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <section className="surface flex flex-col gap-5 p-6">
              <SectionTitle
                title={copy("Your research workspace")}
                href="/research"
              />
              <div className="flex items-start gap-4 rounded-lg border p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <FileText className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Link
                    href="/research/results"
                    className="font-medium hover:text-primary"
                  >
                    {run.name}
                  </Link>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>{copy("4 opportunities")}</span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="size-3.5" />
                      {copy("Demo run")}
                    </span>
                  </div>
                </div>
                <Link
                  href="/research/results"
                  aria-label={copy("Open research results")}
                  className="-m-3 flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-secondary"
                >
                  <ArrowUpRight className="size-5 text-muted-foreground" />
                </Link>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-background p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                  <Check className="size-4" />
                </span>
                <p className="text-sm text-muted-foreground">
                  {copy("Your founder profile is ready.")}
                  <br />
                  <Link href="/profile" className="font-medium text-primary">
                    {copy("Fine-tune your preferences")}
                    <ArrowRight className="ml-1 inline size-3.5" />
                  </Link>
                </p>
              </div>
            </section>
            <Card>
              <CardHeader>
                <CardTitle>{copy("How the opportunities compare")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreChart />
              </CardContent>
            </Card>
          </div>
          <section className="flex flex-col justify-between gap-4 rounded-xl border border-dashed p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary">
                <Lightbulb className="size-5" />
              </span>
              <div>
                <h2 className="font-medium">
                  {copy("The best validation starts with a conversation.")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {copy(
                    "Pick one buyer problem. Talk to five people who live with it.",
                  )}
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link href="/opportunities/proposal-copilot?tab=validation">
                {copy("Plan your validation")}
                <ArrowRight />
              </Link>
            </Button>
          </section>
        </div>
      </MobileDisclosure>
      <DemoNote short />
    </>
  );
}
