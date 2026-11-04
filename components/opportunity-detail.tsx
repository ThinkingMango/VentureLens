"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "@/components/workspace-link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  FileText,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { type Opportunity, scoreLabels } from "@/lib/demo-data";
import { useDemo } from "@/components/demo-provider";
import { DemoNote, Confidence, SectionTitle } from "@/components/shared";
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
import { useDemoContent } from "@/i18n/demo";

const tabs = ["Overview", "Evidence", "Economics", "Validation"] as const;
export function OpportunityDetail({
  opportunity: original,
  initialTab = "Overview",
}: {
  opportunity: Opportunity;
  initialTab?: string;
}) {
  const copy = useCopy();
  const content = useDemoContent();
  const o = content.opportunity(original);
  const [tab, setTab] = useState(
    tabs.find((t) => t.toLowerCase() === initialTab.toLowerCase()) ||
      "Overview",
  );
  const { saved, toggleSave, completed, toggleTask } = useDemo();
  const [sourceIndex, setSourceIndex] = useState<number | null>(null);
  const sourceTrigger = useRef<HTMLButtonElement | null>(null);
  const report = content.report(o.id);
  const source = sourceIndex === null ? null : report.sources[sourceIndex];
  const tasks = [
    {
      title: "Write down your riskiest assumption",
      text: copy(
        "Start with this assumption: {buyer} experience this problem often enough to pay for a solution.",
        { buyer: o.buyer },
      ),
    },
    {
      title: "Find five potential buyers",
      text: "Use your network and relevant professional communities. Ask permission before reaching out.",
    },
    {
      title: "Run problem-discovery conversations",
      text: "Ask about the last time this happened, their existing workaround, and what it costs them. Avoid pitching.",
    },
    { title: "Test a small, paid manual pilot", text: report.firstTest },
  ];
  const taskCount = tasks.filter((_, i) =>
    completed.includes(`${o.id}-${i}`),
  ).length;
  return (
    <>
      <Link
        href="/research/results"
        className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {copy("Research results")}
      </Link>
      <header className="flex flex-col gap-5">
        <div className="flex flex-col items-start justify-between gap-4 xl:flex-row">
          <div className="flex max-w-3xl flex-col gap-3">
            <h1 className="page-heading text-balance">{o.title}</h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              {o.description}
            </p>
            <p className="text-sm text-muted-foreground">
              {o.category} {copy("· Opportunity hypothesis")}
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => toggleSave(o.id)}
            aria-pressed={saved.includes(o.id)}
          >
            <Bookmark
              className={
                saved.includes(o.id) ? "fill-primary/15 text-primary" : ""
              }
            />
            {saved.includes(o.id)
              ? copy("Saved opportunity")
              : copy("Save opportunity")}
          </Button>
        </div>
        <div className="border-y py-4">
          <DemoNote />
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <dt className="text-sm text-muted-foreground">
              {copy("Likely buyer")}
            </dt>
            <dd className="font-medium">{o.buyer}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">
              {copy("Price hypothesis / month")}
            </dt>
            <dd className="font-semibold tabular-nums">
              {o.revenue}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {copy("USD / customer")}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">
              {copy("Demo assessment")}
            </dt>
            <dd className="font-semibold tabular-nums">
              {o.score}/100{" "}
              <span className="text-sm font-normal text-muted-foreground">
                · {copy("{level} confidence", { level: copy(o.confidence) })}
              </span>
            </dd>
          </div>
        </dl>
      </header>
      <div
        role="tablist"
        aria-label={copy("Opportunity sections")}
        className="flex overflow-x-auto border-b"
      >
        {tabs.map((t) => (
          <button
            key={t}
            id={`tab-${t}`}
            role="tab"
            aria-selected={tab === t}
            aria-controls="report-panel"
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(event) => {
              let index = tabs.indexOf(t);
              if (event.key === "ArrowRight") index = (index + 1) % tabs.length;
              else if (event.key === "ArrowLeft")
                index = (index + tabs.length - 1) % tabs.length;
              else if (event.key === "Home") index = 0;
              else if (event.key === "End") index = tabs.length - 1;
              else return;
              event.preventDefault();
              setTab(tabs[index]);
              document.getElementById(`tab-${tabs[index]}`)?.focus();
            }}
            className={cn(
              "min-h-12 flex-1 shrink-0 border-b-2 border-transparent px-0 py-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:flex-none sm:px-5",
              tab === t && "border-primary text-primary",
            )}
          >
            {copy(t)}
          </button>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div
          id="report-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          tabIndex={0}
          className="surface min-w-0 overflow-hidden"
        >
          {tab === "Overview" && (
            <>
              <section className="report-section">
                <h2 className="text-xl font-semibold">
                  {copy("The problem worth solving")}
                </h2>
                <p className="max-w-prose text-lg leading-relaxed">{o.pain}</p>
                <div className="flex flex-col gap-3 border-t pt-5">
                  <h3 className="font-semibold">
                    {copy("The GenAI-enabled approach")}
                  </h3>
                  <p className="max-w-prose leading-relaxed text-muted-foreground">
                    {report.approach}
                  </p>
                </div>
              </section>
              <section className="report-section">
                <h2 className="text-xl font-semibold">
                  {copy("Buyer and buying context")}
                </h2>
                <p className="font-medium">{o.buyer}</p>
                <dl className="grid gap-6 sm:grid-cols-2">
                  {[
                    ["Job to be done", report.buyerJob],
                    ["Current alternative", report.alternative],
                    ["Potential buying trigger", report.trigger],
                    [
                      "Where to start",
                      "Warm introductions and niche professional communities.",
                    ],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-2">
                      <dt className="text-sm font-medium">{copy(k)}</dt>
                      <dd className="text-sm leading-relaxed text-muted-foreground">
                        {copy(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm text-muted-foreground">
                  {copy(
                    "Illustrative buyer hypotheses, not interview findings.",
                  )}
                </p>
              </section>
              <section className="report-section">
                <h2 className="text-xl font-semibold">
                  {copy("Key risk to validate")}
                </h2>
                <p className="max-w-prose leading-relaxed">{o.risk}</p>
                <Button
                  variant="link"
                  className="h-auto justify-start whitespace-normal p-0 text-left"
                  onClick={() => setTab("Validation")}
                >
                  {copy("Turn assumptions into a validation plan")}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </section>
            </>
          )}
          {tab === "Evidence" && (
            <>
              <section className="report-section">
                <SectionTitle
                  title={copy("Evidence and limitations")}
                  description={copy(
                    "Three synthetic source records · No verified citations",
                  )}
                />
                <p className="max-w-prose text-muted-foreground">
                  {copy(
                    "These invented records demonstrate how a research report separates observations, interpretations, and remaining uncertainty. No interviews or external research were conducted.",
                  )}
                </p>
              </section>
              {report.sources.map((s) => (
                <section key={s.title} className="report-section">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{s.type}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {copy("Synthetic · Not verified")}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold">{copy(s.title)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {copy(s.detail)}
                  </p>
                  <dl className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <dt className="text-sm font-medium">
                        {copy("Example observation")}
                      </dt>
                      <dd className="leading-relaxed">{s.observation}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className="text-sm font-medium">
                        {copy("Working interpretation")}
                      </dt>
                      <dd className="text-sm leading-relaxed text-muted-foreground">
                        {s.implication}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    variant="link"
                    className="h-auto justify-start p-0"
                    onClick={(event) => {
                      sourceTrigger.current = event.currentTarget;
                      setSourceIndex(report.sources.indexOf(s));
                    }}
                  >
                    <FileText data-icon="inline-start" />
                    {copy("Review source limitations")}
                    <ChevronRight data-icon="inline-end" />
                  </Button>
                </section>
              ))}
              <section className="report-section">
                <h3 className="font-semibold">
                  {copy("What real evidence would need")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {copy(
                    "A traceable source URL or interview record, collection date, methodology, relevant quotation, and a clear separation between observation and inference.",
                  )}
                </p>
              </section>
            </>
          )}
          {tab === "Economics" && (
            <section className="report-section">
              <SectionTitle
                title={copy("A scenario, not a forecast")}
                description={copy("Illustrative monthly unit economics · USD")}
              />
              <p className="max-w-prose text-muted-foreground">
                {copy(
                  "These amounts are assumptions, not market-tested prices. Compare the cost of delivering an outcome with what a buyer might pay.",
                )}
              </p>
              <dl className="flex flex-col">
                {[
                  ["Price / customer / month", o.revenue],
                  ["Delivery cost / customer / month", o.cost],
                  ["Example paying customers", "20"],
                  ["Setup, acquisition, and founder time", "Not included"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex flex-col justify-between gap-2 border-b py-4 sm:flex-row sm:gap-6"
                  >
                    <dt className="text-sm text-muted-foreground">{copy(k)}</dt>
                    <dd className="shrink-0 font-semibold tabular-nums sm:text-right">
                      {copy(v)}
                    </dd>
                  </div>
                ))}
              </dl>
              <h3 className="font-semibold">
                {copy("The assumptions that matter")}
              </h3>
              <ul className="flex list-disc flex-col gap-3 pl-5 text-muted-foreground">
                <li>
                  {copy(
                    "Buyers encounter the problem repeatedly, not just once.",
                  )}
                </li>
                <li>
                  {copy(
                    "AI inference, hosting, and human review fit within the delivery budget.",
                  )}
                </li>
                <li>
                  {copy(
                    "The outcome is valuable enough to support a subscription.",
                  )}
                </li>
                <li>
                  {copy(
                    "Acquisition cost, churn, taxes, and support still need to be modeled.",
                  )}
                </li>
              </ul>
              <Button variant="outline" asChild>
                <Link href="/research/results">
                  {copy("Compare opportunity scenarios")}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </section>
          )}
          {tab === "Validation" && (
            <section className="report-section">
              <SectionTitle
                title={copy("Your first validation sprint")}
                description={copy(
                  "Test the problem before building the product.",
                )}
              />
              <p className="text-sm text-muted-foreground">
                {copy(
                  "Demo checklist · Changes reset on refresh. No interviews are scheduled or messages sent.",
                )}
              </p>
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {copy("{count} of {total} steps complete", {
                    count: taskCount,
                    total: tasks.length,
                  })}
                </p>
                <progress
                  className="h-2 w-full accent-primary"
                  value={taskCount}
                  max={tasks.length}
                  aria-label={copy("Validation steps complete")}
                />
              </div>
              <div className="flex flex-col">
                {tasks.map((t, i) => (
                  <label
                    key={t.title}
                    className="flex cursor-pointer items-start gap-4 border-b py-5 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={completed.includes(`${o.id}-${i}`)}
                      onChange={() => toggleTask(`${o.id}-${i}`)}
                      className="mt-1 size-5 shrink-0"
                    />
                    <span className="flex flex-col gap-2">
                      <span className="font-medium">{copy(t.title)}</span>
                      <span className="text-sm leading-relaxed text-muted-foreground">
                        {copy(t.text)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex flex-col gap-3 border-t pt-5">
                <h3 className="font-semibold">
                  {copy("A better first question")}
                </h3>
                <blockquote className="max-w-prose text-base leading-relaxed">
                  {copy(
                    "“Walk me through the last time you dealt with this. What did you do, and what happened next?”",
                  )}
                </blockquote>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  toast.info(copy("Interview integrations are not connected"), {
                    description: copy(
                      "Use this checklist to plan your own conversations. No messages or calendar invites are sent.",
                    ),
                  })
                }
              >
                {copy("About scheduling interviews")}
                <ChevronRight data-icon="inline-end" />
              </Button>
            </section>
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-6">
          <section
            className="surface flex flex-col gap-5 p-6"
            aria-labelledby="score-title"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="score-title" className="font-semibold">
                {copy("Score breakdown")}
              </h2>
              <Badge variant="outline">{copy("Demo")}</Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold tabular-nums tracking-tight">
                {o.score}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
            <Confidence level={o.confidence} />
            <dl className="flex flex-col gap-4 border-t pt-5">
              {scoreLabels.map((s, i) => (
                <div key={s} className="flex flex-col gap-2">
                  <div className="flex justify-between gap-3 text-sm">
                    <dt className="text-muted-foreground">{copy(s)}</dt>
                    <dd className="font-medium tabular-nums">
                      {o.scores[i]}
                      <span className="sr-only"> {copy("out of 100")}</span>
                    </dd>
                  </div>
                  <div className="progress-track" aria-hidden="true">
                    <div
                      className="progress-fill"
                      style={{ width: `${o.scores[i]}%` }}
                    />
                  </div>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">
              {copy(
                "Illustrative composite assessment, not a probability of success or an investment recommendation. Confidence is relative within this demo.",
              )}
            </p>
          </section>
          <section className="flex flex-col gap-3 px-1">
            <h2 className="font-semibold">{copy("What to test first")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {report.firstTest}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setTab("Validation");
                document.getElementById("tab-Validation")?.focus();
                document
                  .getElementById("tab-Validation")
                  ?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
            >
              {copy("Plan your validation")}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </section>
        </aside>
      </div>
      <Dialog open={!!source} onOpenChange={(v) => !v && setSourceIndex(null)}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            sourceTrigger.current?.focus();
          }}
          className="max-h-[85dvh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>{source?.title}</DialogTitle>
            <DialogDescription>
              {copy("Synthetic source record · No verified external source")}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{source?.detail}</p>
          <h3 className="font-semibold">{copy("Limitations")}</h3>
          <p className="leading-relaxed">{source?.limitation}</p>
          <p className="text-sm text-muted-foreground">
            {copy(
              "This invented record is not evidence of buyer demand and should not be used for business or investment decisions.",
            )}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
