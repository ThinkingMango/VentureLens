"use client";
import { useCopy } from "@/i18n/use-copy";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, Plus, Telescope } from "lucide-react";
import { useDemo } from "@/components/demo-provider";
import { PageHeader, SectionTitle } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { OpportunityCard } from "@/components/opportunity-card";
import { Input } from "@/components/ui/input";
import type { WorkspaceOpportunity } from "@/lib/workspace-schema";
import { stageLabels } from "@/lib/research-core";
import { OpportunityEvidence } from "@/components/opportunity-evidence";

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
      <Telescope className="size-6 text-primary" />
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
export function LiveDashboard() {
  const copy = useCopy();
  const { data, profile } = useDemo();
  if (!data) return null;
  return (
    <>
      <PageHeader
        title={copy("A little clarity. A lot of possibility.")}
        description={copy(
          "Welcome back, {name}. Your research workspace is ready.",
          { name: profile.name },
        )}
      >
        <Button asChild>
          <Link href="/research/new">
            <Plus />
            {copy("New research")}
          </Link>
        </Button>
      </PageHeader>
      <section
        aria-label={copy("Workspace statistics")}
        className="grid grid-cols-2 gap-4 xl:grid-cols-4"
      >
        {[
          ["Research briefs", data.projects.length],
          ["Research runs", data.runs.length],
          ["Opportunities", data.opportunities.length],
          ["Saved opportunities", data.saved.length],
        ].map(([label, value]) => (
          <div key={label} className="surface flex flex-col gap-4 p-5">
            <p className="text-sm text-muted-foreground">
              {copy(String(label))}
            </p>
            <p className="stat-value">{value}</p>
          </div>
        ))}
      </section>
      {data.projects.length === 0 ? (
        <WorkspaceEmpty
          title={copy("Start with a question worth exploring.")}
          description={copy(
            "创建第一份研究简报。获授权的开发账号可启动 Qwen 与真实外部检索；研究配置、证据及报告私有保存，绝不添加演示结果。",
          )}
        />
      ) : (
        <section className="surface flex flex-col gap-5 p-6">
          <SectionTitle title={copy("Your latest research")} href="/research" />
          <h2 className="font-semibold">{data.projects[0].name}</h2>
          <p className="text-muted-foreground">
            {copy(data.projects[0].sector)} · {copy(data.projects[0].geography)}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.runs[0]
              ? copy("Task status: {status}", {
                  status: copy(
                    data.runs[0].status === "failed"
                      ? "研究中止"
                      : (stageLabels[data.runs[0].stage] ?? "等待处理"),
                  ),
                })
              : copy("简报已保存，可创建新的研究任务。")}
          </p>
          <Button variant="outline" asChild className="w-fit">
            <Link
              href={data.runs[0] ? `/research/${data.runs[0].id}` : "/research"}
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
  return (
    <>
      <PageHeader title={item.title} description={item.description}>
        <Button
          variant="outline"
          disabled={busy}
          aria-pressed={saved.includes(item.id)}
          onClick={() => toggleSave(item.id)}
        >
          <Bookmark />
          {saved.includes(item.id)
            ? copy("Saved opportunity")
            : copy("Save opportunity")}
        </Button>
      </PageHeader>
      <section className="surface flex flex-col gap-5 p-6">
        <h2 className="text-xl font-semibold">
          {copy("Opportunity overview")}
        </h2>
        <dl className="flex flex-col gap-4">
          {[
            ["Buyer", item.buyer],
            ["Buyer problem", item.pain],
            ["Key risk", item.risk],
            ["Price hypothesis / month", item.revenue],
            ["Delivery cost / month", item.cost],
            ["Assessment score", `${item.score}/100`],
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
        <h2 className="text-xl font-semibold">
          {copy("Your first validation sprint")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {copy(
            "Checklist progress is saved with this opportunity. No messages or meeting invitations are sent.",
          )}
        </p>
        {tasks.map((task, index) => (
          <label key={task} className="flex items-center gap-3 border-t py-4">
            <input
              className="size-5"
              type="checkbox"
              disabled={busy}
              checked={completed.includes(`${item.id}-${index}`)}
              onChange={() => toggleTask(`${item.id}-${index}`)}
            />
            {copy(task)}
          </label>
        ))}
      </section>
    </>
  );
}
