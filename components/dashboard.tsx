"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Telescope,
  Lightbulb,
  Bookmark,
  Target,
  Sparkles,
  Check,
  Compass,
  FileText,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader, SectionTitle, DemoNote } from "@/components/shared";
import { OpportunityCard } from "@/components/opportunity-card";
import { ScoreChart } from "@/components/score-chart";
import { opportunities } from "@/lib/demo-data";
import { useDemo } from "@/components/demo-provider";
export function Dashboard() {
  const { profile, saved, run } = useDemo();
  return (
    <>
      <PageHeader
        title={`A little clarity. A lot of possibility.`}
        description={`Welcome back, ${profile.name}. Let’s find a business worth building.`}
      >
        <Button asChild>
          <Link href="/research/new">
            <Plus />
            New research
          </Link>
        </Button>
      </PageHeader>
      <section className="relative flex flex-col justify-between gap-7 overflow-hidden rounded-xl border border-primary/15 bg-secondary p-6 sm:flex-row sm:items-center xl:p-8">
        <div className="flex max-w-xl flex-col items-start gap-4">
          <Badge
            variant="outline"
            className="gap-1.5 rounded-md border-primary/20 bg-card/70 text-primary"
          >
            <Sparkles className="size-3.5" />
            Your next chapter starts with evidence
          </Badge>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-balance">
              Big ideas deserve a closer look.
            </h2>
            <p className="max-w-lg leading-relaxed text-muted-foreground">
              Find recurring-revenue opportunities that fit your strengths. Move
              beyond inspiration—with a clearer view of the buyer, the market,
              and your next step.
            </p>
          </div>
          <Button asChild className="mt-1">
            <Link href="/research/new">
              Explore new opportunities
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <div
          className="hidden h-36 w-48 shrink-0 items-center justify-center lg:flex"
          aria-hidden="true"
        >
          <div className="relative flex size-32 items-center justify-center rounded-full border border-primary/15">
            <div className="flex size-24 items-center justify-center rounded-full border border-primary/25">
              <div className="flex size-14 items-center justify-center rounded-full bg-card shadow-sm">
                <Compass className="size-8 text-primary" strokeWidth={1.4} />
              </div>
            </div>
            <span className="absolute right-0 top-1 flex size-8 items-center justify-center rounded-lg border bg-card text-primary">
              <Sparkles className="size-4" />
            </span>
            <span className="absolute bottom-0 left-1 flex size-8 items-center justify-center rounded-lg border bg-card text-primary">
              <Target className="size-4" />
            </span>
          </div>
        </div>
      </section>
      <section
        aria-label="Workspace statistics"
        className="grid grid-cols-2 gap-4 xl:grid-cols-4"
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
            value: "87",
            detail: "Out of 100 · illustrative",
            icon: Target,
          },
        ].map((s) => (
          <div className="surface flex flex-col gap-4 p-5" key={s.label}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className="size-[18px] shrink-0 text-muted-foreground" />
            </div>
            <p className="stat-value">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.detail}</p>
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-5">
        <SectionTitle
          title="Opportunities worth a closer look"
          description="A few possibilities, selected for your founder profile."
          href="/research/results"
          label="Explore all"
        />
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {opportunities.slice(0, 2).map((o) => (
            <OpportunityCard key={o.id} opportunity={o} />
          ))}
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="surface flex flex-col gap-5 p-6">
          <SectionTitle title="Your research workspace" href="/research" />
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
                <span>4 opportunities</span>
                <span className="flex items-center gap-1">
                  <Clock3 className="size-3.5" />
                  Demo run
                </span>
              </div>
            </div>
            <Link href="/research/results" aria-label="Open research results">
              <ArrowUpRight className="size-5 text-muted-foreground" />
            </Link>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-background p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Check className="size-4" />
            </span>
            <p className="text-sm text-muted-foreground">
              Your founder profile is ready.
              <br />
              <Link href="/profile" className="font-medium text-primary">
                Fine-tune your preferences
                <ArrowRight className="ml-1 inline size-3.5" />
              </Link>
            </p>
          </div>
        </section>
        <Card>
          <CardHeader>
            <CardTitle>How the opportunities compare</CardTitle>
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
              The best validation starts with a conversation.
            </h2>
            <p className="text-sm text-muted-foreground">
              Pick one buyer problem. Talk to five people who live with it.
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/opportunities/proposal-copilot?tab=validation">
            Plan your validation
            <ArrowRight />
          </Link>
        </Button>
      </section>
      <DemoNote short />
    </>
  );
}
