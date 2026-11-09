"use client";
import { useCopy, useFormats } from "@/i18n/use-copy";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  Circle,
  Compass,
  FlaskConical,
  Link2,
  Lock,
  Plus,
  Sparkles,
  Telescope,
} from "lucide-react";
import { useDemo } from "@/components/demo-provider";
import { PageHeader, SectionTitle, Confidence, ScoreRing } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OpportunityCard } from "@/components/opportunity-card";
import { Input } from "@/components/ui/input";
import type { WorkspaceOpportunity } from "@/lib/workspace-schema";
import { stageLabels } from "@/lib/research-core";
import { reportEvidenceCount } from "@/lib/report-presentation";
import { OpportunityEvidence } from "@/components/opportunity-evidence";
import { cn } from "@/lib/utils";

export const liveDimensionLabels = [
  "Buyer pain",
  "Demand",
  "Unit economics",
  "Delivery feasibility",
  "Founder advantage",
];

export function WorkspaceEmpty({
  title,
  description,
  actionHref = "/research/new",
  actionLabel = "Create research brief",
  onAction,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const copy = useCopy();
  return (
    <section className="surface flex flex-col items-start gap-4 p-6 md:p-8">
      <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
        <Telescope className="size-5" />
      </span>
      <h2 className="text-xl font-semibold">{copy(title)}</h2>
      <p className="max-w-2xl leading-relaxed text-muted-foreground">
        {copy(description)}
      </p>
      {onAction ? (
        <Button variant="outline" onClick={onAction}>
          {copy(actionLabel)}
        </Button>
      ) : (
        <Button asChild>
          <Link href={actionHref}>
            {copy(actionLabel)}
            <ArrowRight />
          </Link>
        </Button>
      )}
      <Link
        href="/demo/research/results"
        className="text-sm font-medium text-primary"
      >
        {copy("See an example report in the separate demo")}
        <ArrowRight className="ml-1 inline size-4" />
      </Link>
    </section>
  );
}

export function ResearchAccessCard({ compact = false }: { compact?: boolean }) {
  const copy = useCopy();
  const format = useFormats();
  const { data } = useDemo();
  const access = data?.access;
  if (!access) return null;
  if (access.enabled)
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-success/30 bg-success-soft p-4",
          compact && "p-4",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            <FlaskConical className="size-4 text-success" />
            {copy("Live research enabled")}
          </span>
          <Badge variant="outline" className="border-success/30 bg-card text-success">
            {copy("Included")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {copy(
            "{count, plural, one {# research run remaining} other {# research runs remaining}}",
            { count: access.remaining },
          )}
          {access.expiresAt
            ? ` · ${copy("Access until {date}", { date: format.date(access.expiresAt) })}`
            : ""}
        </p>
        {!compact && (
          <div className="progress-track" aria-hidden="true">
            <div
              className="progress-fill"
              style={{
                width: `${access.maxRuns ? (access.remaining / access.maxRuns) * 100 : 0}%`,
              }}
            />
          </div>
        )}
      </div>
    );
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
      <span className="flex items-center gap-2 font-medium">
        <Lock className="size-4 text-muted-foreground" />
        {access.maxRuns > 0
          ? copy("No research runs left")
          : copy("No research run on this account yet")}
      </span>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {access.maxRuns > 0
          ? copy(
              "You have used your free research run. Failed runs are returned automatically, and paid credits are planned. Your reports and briefs stay saved.",
            )
          : copy(
              "Every confirmed account receives one free research run. If yours is missing, sign out and back in, or contact support. You can build your profile, save briefs, and explore the full demo meanwhile.",
            )}
      </p>
      {!compact && (
        <Link
          href="/demo/research/results"
          className="flex items-center gap-1 text-sm font-medium text-primary"
        >
          {copy("Read a sample report")}
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

export function LiveDashboard() {
  const copy = useCopy();
  const { data, profile } = useDemo();
  if (!data) return null;
  const firstRun = data.runs[0];
  const completedRuns = data.runs.filter((run) => run.status === "completed").length;
  const checklist = [
    {
      title: "Build your founder profile",
      detail: "Done. Edit it any time; new research uses the latest version.",
      done: true,
      href: "/profile",
      action: "Edit profile",
    },
    {
      title: "Create your first research brief",
      detail: "Name the market, business model, and geography you want to explore.",
      done: data.projects.length > 0,
      href: "/research/new",
      action: "New research",
    },
    {
      title: "Run evidence-driven research",
      detail: data.access.enabled
        ? "Your first run is free. It takes several minutes and saves a full report to this workspace."
        : "Your free run has been used. Explore a complete sample report in the demo meanwhile.",
      done: completedRuns > 0,
      href: data.access.enabled ? "/research/new" : "/demo/research/results",
      action: data.access.enabled ? "Start research" : "Open sample report",
    },
    {
      title: "Save a shortlist and plan validation",
      detail: "Bookmark the strongest hypotheses and work through the validation checklist.",
      done: data.saved.length > 0,
      href: data.opportunities.length ? "/research/results" : "/demo/opportunities/proposal-copilot?tab=validation",
      action: data.opportunities.length ? "Browse results" : "See the checklist",
    },
  ];
  const doneCount = checklist.filter((item) => item.done).length;
  const fresh = data.projects.length === 0 && data.opportunities.length === 0;
  return (
    <>
      <PageHeader
        title={
          fresh
            ? copy("Welcome, {name}. Let’s find a business worth building.", { name: profile.name })
            : copy("A little clarity. A lot of possibility.")
        }
        description={
          fresh
            ? copy("Four steps take you from a founder profile to a shortlist you can validate with real buyers.")
            : copy("Welcome back, {name}. Your research workspace is ready.", { name: profile.name })
        }
      >
        <Button asChild>
          <Link href="/research/new">
            <Plus />
            {copy("New research")}
          </Link>
        </Button>
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="surface flex flex-col gap-5 p-6" aria-labelledby="getting-started">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Compass className="size-5 text-primary" />
              <h2 id="getting-started" className="text-lg font-semibold">
                {copy("Getting started")}
              </h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {copy("{count} of {total} steps complete", { count: doneCount, total: checklist.length })}
            </span>
          </div>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
          </div>
          <ol className="flex flex-col">
            {checklist.map((item, index) => (
              <li
                key={item.title}
                className="flex flex-col gap-3 border-t py-4 first:border-t-0 sm:flex-row sm:items-center"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium",
                    item.done
                      ? "border-success/30 bg-success-soft text-success"
                      : "bg-card text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {item.done ? <Check className="size-4" /> : index + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("font-medium", item.done && "text-muted-foreground line-through decoration-success/40")}>
                    {copy(item.title)}
                  </span>
                  <span className="text-sm text-muted-foreground">{copy(item.detail)}</span>
                </span>
                {!item.done && (
                  <Button asChild variant={index === doneCount ? "default" : "outline"} size="sm" className="sm:shrink-0">
                    <Link href={item.href}>
                      {copy(item.action)}
                      <ArrowRight />
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </section>
        <div className="flex flex-col gap-4">
          <ResearchAccessCard />
          <section
            aria-label={copy("Workspace statistics")}
            className="grid grid-cols-2 gap-4"
          >
            {[
              ["Research briefs", data.projects.length],
              ["Completed runs", completedRuns],
              ["Opportunities", data.opportunities.length],
              ["Saved opportunities", data.saved.length],
            ].map(([label, value]) => (
              <div key={label} className="surface flex flex-col gap-2 p-4">
                <p className="text-sm text-muted-foreground">
                  {copy(String(label))}
                </p>
                <p className="stat-value">{value}</p>
              </div>
            ))}
          </section>
        </div>
      </div>
      {data.projects.length > 0 && (
        <section className="surface flex flex-col gap-5 p-6">
          <SectionTitle title={copy("Your latest research")} href="/research" />
          <h2 className="font-semibold">{data.projects[0].name}</h2>
          <p className="text-muted-foreground">
            {copy(data.projects[0].sector)} · {copy(data.projects[0].geography)}
          </p>
          <p className="text-sm text-muted-foreground">
            {firstRun
              ? copy("Task status: {status}", {
                  status: copy(
                    firstRun.status === "failed"
                      ? "研究中止"
                      : (stageLabels[firstRun.stage] ?? "等待处理"),
                  ),
                })
              : copy("简报已保存，可创建新的研究任务。")}
          </p>
          <Button variant="outline" asChild className="w-fit">
            <Link
              href={firstRun ? `/research/${firstRun.id}` : "/research"}
            >
              {copy("查看研究任务")}
              <ArrowRight />
            </Link>
          </Button>
        </section>
      )}
      {data.opportunities.length > 0 && (
        <section className="flex flex-col gap-5">
          <SectionTitle
            title={copy("Your opportunities")}
            href="/research/results"
          />
          <div className="grid gap-5 md:grid-cols-2">
            {data.opportunities.slice(0, 2).map((opportunity) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        </section>
      )}
      {fresh && (
        <section className="flex flex-col justify-between gap-4 rounded-2xl bg-secondary p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-medium">{copy("Not sure what to expect?")}</h2>
              <p className="text-sm text-muted-foreground">
                {copy("The demo walks through a complete report, from scored hypotheses to linked sources and a validation checklist.")}
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/demo/research/results">
              {copy("Open the demo report")}
              <ArrowUpRight />
            </Link>
          </Button>
        </section>
      )}
      <p className="text-sm text-muted-foreground">
        {copy("Only records owned by your account appear here.")}{" "}
        <Link href="/profile" className="font-medium text-primary">
          {copy("Update founder profile")}
        </Link>
      </p>
    </>
  );
}
export function LiveResearchResults({
  savedOnly = false,
}: {
  savedOnly?: boolean;
}) {
  const copy = useCopy();
  const { data, saved } = useDemo();
  const [query, setQuery] = useState("");
  const list = (data?.opportunities ?? []).filter(
    (item) =>
      (!savedOnly || saved.includes(item.id)) &&
      `${item.title} ${item.category} ${item.buyer}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title={
          savedOnly
            ? copy("Saved opportunities")
            : copy("Your research results")
        }
        description={
          savedOnly
            ? copy("Your private shortlist, synced to your account.")
            : copy("Only completed research from your account appears here.")
        }
      />
      <Input
        type="search"
        aria-label={copy("Search opportunities")}
        placeholder={copy("Search by idea, buyer, or industry")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {list.length ? (
        <div className="grid gap-5 md:grid-cols-2">
          {list.map((item) => (
            <OpportunityCard key={item.id} opportunity={item} />
          ))}
        </div>
      ) : (
        <WorkspaceEmpty
          actionHref={savedOnly ? "/research/results" : "/research"}
          actionLabel={
            query
              ? "Clear search"
              : savedOnly
                ? "Browse research results"
                : "Open research history"
          }
          onAction={query ? () => setQuery("") : undefined}
          title={
            query
              ? copy("No matching opportunities")
              : savedOnly
                ? copy("Your shortlist starts here.")
                : copy("No research results yet.")
          }
          description={
            query
              ? copy("Try another search term.")
              : savedOnly
                ? copy(
                    "Save an opportunity from your completed research to add it here. Demonstration opportunities remain in the demo and are never copied into your account.",
                  )
                : copy(
                    "尚无通过证据核验的报告。可从研究历史查看任务进度或失败原因；检索不可用或证据不足时不会生成虚构结果。",
                  )
          }
        />
      )}
    </>
  );
}
export function LiveOpportunityDetail({
  opportunity: item,
}: {
  opportunity: WorkspaceOpportunity;
}) {
  const copy = useCopy();
  const { saved, toggleSave, completed, toggleTask, busy } = useDemo();
  const tasks = [
    "Write down the riskiest assumption",
    "Find five potential buyers",
    "Run problem-discovery conversations",
    "Test a small, paid manual pilot",
  ];
  const taskCount = tasks.filter((_, i) => completed.includes(`${item.id}-${i}`)).length;
  const sources = reportEvidenceCount([item]);
  return (
    <>
      <Link
        href="/research/results"
        className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowRight className="size-4 rotate-180" />
        {copy("Research results")}
      </Link>
      <PageHeader title={item.title} description={item.description}>
        <Button
          variant="outline"
          disabled={busy}
          aria-pressed={saved.includes(item.id)}
          onClick={() => toggleSave(item.id)}
        >
          <Bookmark className={saved.includes(item.id) ? "fill-primary/15 text-primary" : ""} />
          {saved.includes(item.id)
            ? copy("Saved opportunity")
            : copy("Save opportunity")}
        </Button>
      </PageHeader>
      <dl className="grid grid-cols-2 gap-4 border-y py-4 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
          <dt className="text-sm text-muted-foreground">{copy("Likely buyer")}</dt>
          <dd className="font-medium">{item.buyer}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-muted-foreground">{copy("Research score")}</dt>
          <dd className="font-semibold tabular-nums">
            {item.score}/100
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-muted-foreground">{copy("Linked sources")}</dt>
          <dd className="flex items-center gap-1.5 font-semibold tabular-nums">
            <Link2 className="size-4 text-primary" />
            {sources}
          </dd>
        </div>
      </dl>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="surface flex flex-col gap-5 p-6">
            <h2 className="text-xl font-semibold">
              {copy("Opportunity overview")}
            </h2>
            <dl className="flex flex-col gap-4">
              {[
                ["Buyer problem", item.pain],
                ["Key risk", item.risk],
                ["Business model and pricing assumptions", item.revenue],
                ["Delivery cost assumptions", item.cost],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">
                    {copy(String(label))}
                  </dt>
                  <dd className="mt-1 leading-relaxed">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <OpportunityEvidence opportunity={item} />
          <section className="surface flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                {copy("Your first validation sprint")}
              </h2>
              <span className="text-sm text-muted-foreground" aria-live="polite">
                {copy("{count} of {total} steps complete", { count: taskCount, total: tasks.length })}
              </span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${(taskCount / tasks.length) * 100}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">
              {copy(
                "Checklist progress is saved with this opportunity. No messages or meeting invitations are sent.",
              )}
            </p>
            {tasks.map((task, index) => (
              <label key={task} className="flex cursor-pointer items-center gap-3 border-t py-4">
                <input
                  className="size-5"
                  type="checkbox"
                  disabled={busy}
                  checked={completed.includes(`${item.id}-${index}`)}
                  onChange={() => toggleTask(`${item.id}-${index}`)}
                />
                <span className={cn(completed.includes(`${item.id}-${index}`) && "text-muted-foreground line-through")}>
                  {copy(task)}
                </span>
              </label>
            ))}
          </section>
        </div>
        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-6">
          <section className="surface flex flex-col gap-5 p-6" aria-labelledby="live-score-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="live-score-title" className="font-semibold">
                {copy("Score breakdown")}
              </h2>
              <Badge variant="outline">{copy("Evidence-driven")}</Badge>
            </div>
            <div className="flex items-center gap-4">
              <ScoreRing
                size="lg"
                score={item.score}
                label={copy("Research score: {score} out of 100", { score: item.score })}
              />
              <span className="text-sm text-muted-foreground">{copy("out of 100")}</span>
            </div>
            <Confidence level={item.confidence} />
            <dl className="flex flex-col gap-4 border-t pt-5">
              {liveDimensionLabels.map((label, i) => (
                <div key={label} className="flex flex-col gap-2">
                  <div className="flex justify-between gap-3 text-sm">
                    <dt className="text-muted-foreground">{copy(label)}</dt>
                    <dd className="font-medium tabular-nums">
                      {item.scores[i]}
                      <span className="sr-only"> {copy("out of 100")}</span>
                    </dd>
                  </div>
                  <div className="progress-track" aria-hidden="true">
                    <div className="progress-fill" style={{ width: `${item.scores[i]}%` }} />
                  </div>
                </div>
              ))}
            </dl>
            {typeof item.penalty === "number" && item.penalty > 0 && (
              <p className="text-sm text-muted-foreground">
                {copy("Review deduction: {points} points", { points: item.penalty })}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {copy("Scores compare hypotheses, not success probabilities. Validate with buyers.")}
            </p>
          </section>
          {item.validation?.[0] && (
            <section className="flex flex-col gap-3 px-1">
              <h2 className="font-semibold">{copy("What to test first")}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.validation[0]}</p>
            </section>
          )}
          <ul className="flex flex-col gap-2 px-1 text-sm text-muted-foreground">
            {[
              ["Dimension scores", "Model-estimated, 0–100, weighted by discovery mode."],
              ["Confidence", "Reflects how many independent sources support this hypothesis."],
            ].map(([k, v]) => (
              <li key={k} className="flex gap-2">
                <Circle className="mt-1.5 size-2 shrink-0 fill-current text-primary" />
                <span>
                  <strong className="font-medium text-foreground">{copy(k)}:</strong> {copy(v)}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
