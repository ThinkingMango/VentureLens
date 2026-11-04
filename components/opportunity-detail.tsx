"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Users,
  Target,
  TriangleAlert,
  FileText,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { type Opportunity, scoreLabels, sources } from "@/lib/demo-data";
import { useDemo } from "@/components/demo-provider";
import {
  DemoNote,
  Confidence,
  SectionTitle,
  opportunityIcons,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
const tabs = ["Overview", "Evidence", "Economics", "Validation"] as const;
export function OpportunityDetail({
  opportunity: o,
  initialTab = "Overview",
}: {
  opportunity: Opportunity;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(
    tabs.find((t) => t.toLowerCase() === initialTab.toLowerCase()) ||
      "Overview",
  );
  const { saved, toggleSave, completed, toggleTask } = useDemo();
  const [source, setSource] = useState<(typeof sources)[number] | null>(null);
  const Icon = opportunityIcons[o.icon];
  const tasks = [
    {
      title: "Write down your riskiest assumption",
      text: `Start with: ${o.buyer.toLowerCase()} experience this problem often enough to pay for a solution.`,
    },
    {
      title: "Find five potential buyers",
      text: "Use your network and relevant professional communities. Ask permission before reaching out.",
    },
    {
      title: "Run problem-discovery conversations",
      text: "Ask about the last time this happened, their existing workaround, and what it costs them. Avoid pitching.",
    },
    {
      title: "Test a small, paid manual pilot",
      text: "Offer a clearly scoped concierge version. Test willingness to pay before automating the work.",
    },
  ];
  return (
    <>
      <Link
        href="/research/results"
        className="flex w-fit items-center gap-2 text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        Research results
      </Link>
      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-card text-primary">
            <Icon className="size-6" />
          </span>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {o.category} · Opportunity hypothesis
            </p>
            <h1 className="page-heading">{o.title}</h1>
            <p className="max-w-2xl text-muted-foreground">{o.description}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => toggleSave(o.id)}
          aria-pressed={saved.includes(o.id)}
        >
          <Bookmark
            className={
              saved.includes(o.id) ? "fill-primary/15 text-primary" : ""
            }
          />
          {saved.includes(o.id) ? "Saved" : "Save opportunity"}
        </Button>
      </div>
      <DemoNote className="rounded-lg border border-primary/15 bg-secondary p-4" />
      <nav
        aria-label="Opportunity sections"
        className="flex gap-6 overflow-x-auto border-b"
      >
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={cn(
              "shrink-0 border-b-2 border-transparent pb-4 font-medium text-muted-foreground",
              tab === t && "border-primary text-primary",
            )}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          {tab === "Overview" && (
            <>
              <section className="surface flex flex-col gap-6 p-6">
                <div className="flex items-center gap-2">
                  <Target className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">
                    The problem worth solving
                  </h2>
                </div>
                <p className="text-base leading-relaxed">{o.pain}</p>
                <div className="border-t pt-5">
                  <h3 className="font-semibold">The GenAI-enabled approach</h3>
                  <p className="mt-2 text-muted-foreground">
                    Combine relevant business context with guided drafting and
                    synthesis. Start with a narrow workflow, keep a human in
                    control of final decisions, and make the outcome easier to
                    review than a blank chatbot response.
                  </p>
                </div>
              </section>
              <section className="surface flex flex-col gap-5 p-6">
                <div className="flex items-center gap-2">
                  <Users className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">
                    Meet the likely buyer
                  </h2>
                </div>
                <h3 className="text-xl font-semibold">{o.buyer}</h3>
                <dl className="grid gap-5 sm:grid-cols-2">
                  {[
                    [
                      "Job to be done",
                      "Deliver high-quality work without adding headcount.",
                    ],
                    [
                      "Current alternative",
                      "Manual work, templates, and disconnected general-purpose tools.",
                    ],
                    [
                      "Potential buying trigger",
                      "Growing workload, a missed deadline, or a team capacity constraint.",
                    ],
                    [
                      "Where to start",
                      "Warm introductions and niche professional communities.",
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-sm font-medium">{k}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm text-muted-foreground">
                  Buyer characteristics are illustrative hypotheses to test, not
                  interview findings.
                </p>
              </section>
              <section className="surface p-6">
                <div className="mb-3 flex items-center gap-2">
                  <TriangleAlert className="size-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">
                    What could make this difficult
                  </h2>
                </div>
                <p className="leading-relaxed text-muted-foreground">
                  {o.risk}
                </p>
                <Button
                  variant="link"
                  className="mt-4 h-auto p-0"
                  onClick={() => setTab("Validation")}
                >
                  Turn assumptions into a validation plan
                  <ArrowRight />
                </Button>
              </section>
            </>
          )}
          {tab === "Evidence" && (
            <section className="surface flex flex-col gap-6 p-6">
              <SectionTitle
                title="Look beneath the score"
                description="Example evidence structure—not genuine market research."
              />
              <p className="text-muted-foreground">
                These fabricated source records show how future research could
                be organized. There are no verified external citations, live
                source links, or genuine interview participants in this
                demonstration.
              </p>
              {sources.map((s, i) => (
                <button
                  key={s.title}
                  className="flex items-start gap-4 rounded-lg border p-4 text-left hover:border-primary/40"
                  onClick={() => setSource(s)}
                >
                  <FileText className="mt-1 size-5 shrink-0 text-primary" />
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="text-sm text-muted-foreground">
                      Sample source {i + 1} · {s.type}
                    </span>
                    <span className="font-medium">{s.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {s.detail}
                    </span>
                    <span className="mt-2 text-sm font-medium text-primary">
                      Synthetic · Not verified
                    </span>
                  </div>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
              <div className="rounded-lg bg-background p-4">
                <h3 className="font-medium">What real evidence would need</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  A traceable source URL or interview record, collection date,
                  methodology, relevant quotation, and a clear separation
                  between observation and inference.
                </p>
              </div>
            </section>
          )}
          {tab === "Economics" && (
            <section className="surface flex flex-col gap-6 p-6">
              <SectionTitle
                title="A scenario, not a forecast"
                description="Illustrative monthly unit economics · USD"
              />
              <p className="text-muted-foreground">
                Use this to reason about a possible business model. These
                amounts are assumptions, not market-tested prices or revenue
                promises.
              </p>
              <dl className="flex flex-col gap-0">
                {[
                  ["Assumed monthly price / customer", o.revenue],
                  ["Assumed monthly delivery cost / customer", o.cost],
                  ["Example paying customers", "20"],
                  ["Setup, acquisition, and founder time", "Not included"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-6 border-b py-4"
                  >
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="shrink-0 text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="font-semibold">The assumptions that matter</h3>
              <ul className="flex list-disc flex-col gap-3 pl-5 text-muted-foreground">
                <li>Buyers encounter the problem repeatedly, not just once.</li>
                <li>
                  AI inference, hosting, and human review fit within the
                  delivery budget.
                </li>
                <li>
                  The outcome is valuable enough to support a subscription.
                </li>
                <li>
                  Acquisition cost, churn, taxes, and support still need to be
                  modeled.
                </li>
              </ul>
              <Button variant="outline" asChild>
                <Link href="/research/results">
                  Compare opportunity scenarios
                  <ArrowRight />
                </Link>
              </Button>
            </section>
          )}
          {tab === "Validation" && (
            <section className="surface flex flex-col gap-6 p-6">
              <SectionTitle
                title="Build conviction, one conversation at a time"
                description="Your first validation sprint · Demo checklist"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {
                    tasks.filter((_, i) => completed.includes(`${o.id}-${i}`))
                      .length
                  }{" "}
                  of {tasks.length} steps complete
                </span>
                <Badge variant="secondary">Resets on refresh</Badge>
              </div>
              {tasks.map((t, i) => (
                <label
                  key={t.title}
                  className="flex cursor-pointer items-start gap-4 rounded-lg border p-4"
                >
                  <input
                    type="checkbox"
                    checked={completed.includes(`${o.id}-${i}`)}
                    onChange={() => toggleTask(`${o.id}-${i}`)}
                    className="mt-1 size-4 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="font-medium">{t.title}</span>
                    <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                      {t.text}
                    </span>
                  </span>
                </label>
              ))}
              <div className="rounded-lg bg-secondary p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <MessageSquare className="size-4 text-primary" />A better
                  first question
                </h3>
                <p className="mt-3 text-muted-foreground">
                  “Walk me through the last time you dealt with this. What did
                  you do, and what happened next?”
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  toast.info("Interview integrations are not connected", {
                    description:
                      "Use this checklist to plan your own conversations. No messages or calendar invites are sent.",
                  })
                }
              >
                About scheduling interviews
                <ArrowUpRightIcon />
              </Button>
            </section>
          )}
        </div>
        <aside className="flex flex-col gap-6">
          <section className="surface flex flex-col gap-5 p-6">
            <div className="flex items-start justify-between">
              <h2 className="font-semibold">Opportunity score</h2>
              <Badge variant="outline">Demo</Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-tight text-primary">
                {o.score}
              </span>
              <span className="text-muted-foreground">/ 100</span>
            </div>
            <Confidence level={o.confidence} />
            <div className="flex flex-col gap-4 border-t pt-5">
              {scoreLabels.map((s, i) => (
                <div className="flex flex-col gap-2" key={s}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{s}</span>
                    <span className="font-medium tabular-nums">
                      {o.scores[i]}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${o.scores[i]}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Illustrative composite assessment. Not a probability of success,
              verified rating, or investment recommendation.
            </p>
          </section>
          <section className="flex flex-col gap-4 rounded-xl border border-primary/15 bg-secondary p-6">
            <Target className="size-6 text-primary" />
            <h2 className="text-lg font-semibold">
              The next step isn’t building.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              It’s finding out whether this problem matters enough to the people
              who experience it.
            </p>
            <Button
              onClick={() => {
                setTab("Validation");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Plan your validation
              <ArrowRight />
            </Button>
          </section>
        </aside>
      </div>
      <Dialog open={!!source} onOpenChange={(v) => !v && setSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{source?.title}</DialogTitle>
            <DialogDescription>
              Synthetic source record · No verified external source
            </DialogDescription>
          </DialogHeader>
          <p>{source?.detail}</p>
          <p className="text-muted-foreground">
            This is invented content for the interface demonstration. It is not
            evidence of buyer demand and should not be used to make business or
            investment decisions.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
function ArrowUpRightIcon() {
  return <ChevronRight />;
}
