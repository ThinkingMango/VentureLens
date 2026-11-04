"use client";

import { useCopy } from "@/i18n/use-copy";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ScanLine,
  Users,
  SlidersHorizontal,
  Telescope,
  Bookmark,
  LayoutDashboard,
  Aperture,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDemoContent } from "@/i18n/demo";
export function Landing() {
  const copy = useCopy();
  const { opportunities } = useDemoContent();
  return (
    <PublicShell>
      <main>
        <section className="mx-auto flex max-w-7xl flex-col items-center gap-7 px-5 pb-16 pt-16 text-center md:px-8 md:pt-24">
          <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm text-muted-foreground">
            <span className="demo-dot" />
            {copy("A clearer way to find your next business")}
            <ArrowUpRight className="size-3.5" />
          </div>
          <h1 className="max-w-4xl text-balance text-4xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-5xl md:text-6xl">
            {copy("Less guesswork.")}
            <br />
            <span className="text-primary">
              {copy("More business opportunity.")}
            </span>
          </h1>
          <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            {copy(
              "Turn your strengths into a shortlist of GenAI-enabled businesses worth exploring. Understand the buyer, weigh the evidence, and know what to validate next.",
            )}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                {copy("Find your next opportunity")}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/demo/dashboard">
                {copy("Explore the demo")}
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4" />
            {copy("No credit card. No hype. Just a clearer starting point.")}
          </p>
          <div className="mt-7 w-full overflow-hidden rounded-xl border bg-background text-left shadow-[0_16px_60px_-20px_color-mix(in_srgb,var(--foreground)_20%,transparent)]">
            <div className="flex h-12 items-center justify-between border-b bg-card px-5">
              <span className="flex items-center gap-2 font-medium">
                <Aperture className="size-5 text-primary" />
                VentureLens AI
              </span>
              <Badge variant="secondary">{copy("Synthetic demo")}</Badge>
            </div>
            <div className="flex">
              <div className="hidden w-48 shrink-0 flex-col gap-2 border-r bg-card p-4 md:flex">
                <p className="px-3 pb-3 text-sm text-muted-foreground">
                  {copy("YOUR WORKSPACE")}
                </p>
                {[
                  { icon: LayoutDashboard, label: "Overview", active: true },
                  { icon: Telescope, label: "My research" },
                  { icon: Bookmark, label: "Saved opportunities" },
                  { icon: Users, label: "Founder profile" },
                ].map((n) => (
                  <div
                    key={n.label}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${n.active ? "bg-secondary text-primary" : "text-muted-foreground"}`}
                  >
                    <n.icon className="size-4" />
                    {copy(n.label)}
                  </div>
                ))}
                <div className="mt-8 rounded-lg bg-secondary p-3 text-sm text-primary">
                  {copy("From possibility")}
                  <br />
                  <strong>{copy("to a plan.")}</strong>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-5 p-5 md:p-7">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold md:text-xl">
                      {copy("Your next business, in focus.")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {copy(
                        "Opportunities matched to your strengths and ambition.",
                      )}
                    </p>
                  </div>
                  <Link
                    href="/demo/research/results"
                    className="hidden items-center gap-1 text-sm text-primary sm:flex"
                  >
                    {copy("View research")}
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {opportunities.slice(0, 2).map((o) => (
                    <Link
                      href={`/demo/opportunities/${o.id}`}
                      key={o.id}
                      className="flex flex-col gap-4 rounded-lg border bg-card p-5 hover:border-primary/40"
                    >
                      <div className="flex justify-between">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
                          <FileText className="size-4" />
                        </span>
                        <span className="text-lg font-semibold text-primary">
                          {o.score}
                          <span className="text-sm font-normal text-muted-foreground">
                            {" "}
                            / 100
                          </span>
                        </span>
                      </div>
                      <div>
                        <p className="mb-1 text-sm text-muted-foreground">
                          {o.category}
                        </p>
                        <h3 className="font-semibold">{o.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {o.description}
                      </p>
                      <div className="flex items-center justify-between border-t pt-3">
                        <span className="text-sm text-primary">
                          {copy("Explore opportunity")}
                        </span>
                        <ArrowUpRight className="size-4 text-primary" />
                      </div>
                    </Link>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {copy(
                    "Illustrative opportunities and scores. Not verified findings or financial advice.",
                  )}
                </p>
              </div>
            </div>
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
          id="how-it-works"
          className="mx-auto max-w-7xl px-5 py-20 md:px-8"
        >
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <h2 className="max-w-xl text-balance text-3xl font-semibold md:text-4xl">
              {copy("A better question than")}
              <br />
              {copy("“What should I build?”")}
            </h2>
            <p className="max-w-md text-base text-muted-foreground">
              {copy(
                "Find the intersection of what you can build, who needs it, and what they might pay for.",
              )}
            </p>
          </div>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                icon: SlidersHorizontal,
                title: "Start with your unfair advantage.",
                text: "Map your experience, skills, constraints, and goals. Good opportunities should fit your life—not someone else’s.",
              },
              {
                icon: ScanLine,
                title: "See the opportunity, not just the idea.",
                text: "Explore buyer pain, competitive context, business economics, and evidence quality in one structured research brief.",
              },
              {
                icon: Users,
                title: "Make your next conversation count.",
                text: "Turn a promising hypothesis into a focused validation plan, with assumptions to test and buyers to talk to.",
              },
            ].map((f, i) => (
              <article
                key={f.title}
                className="flex flex-col items-start gap-5"
              >
                <span className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary">
                  <f.icon className="size-5" />
                </span>
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {copy("Step {step}", { step: i + 1 })}
                  </p>
                  <h3 className="text-xl font-semibold">{copy(f.title)}</h3>
                </div>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {copy(f.text)}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section className="mx-5 mb-20 flex max-w-7xl flex-col items-center gap-6 rounded-2xl bg-secondary px-6 py-16 text-center md:mx-8 xl:mx-auto">
          <h2 className="text-balance text-3xl font-semibold md:text-4xl">
            {copy("Your next chapter deserves a clearer lens.")}
          </h2>
          <p className="max-w-xl text-base text-muted-foreground">
            {copy(
              "You don’t need another list of startup ideas. You need a thoughtful starting point for a business that fits you.",
            )}
          </p>
          <Button asChild size="lg">
            <Link href="/signup">
              {copy("Build your founder profile")}
              <ArrowRight />
            </Link>
          </Button>
        </section>
      </main>
    </PublicShell>
  );
}
