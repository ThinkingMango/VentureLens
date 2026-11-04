"use client";
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
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="surface flex flex-col items-start gap-4 p-6 md:p-8">
      <Telescope className="size-6 text-primary" />
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="max-w-2xl leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Button asChild>
        <Link href="/research/new">
          Create research brief
          <Plus />
        </Link>
      </Button>
      <Link
        href="/demo/research/results"
        className="text-sm font-medium text-primary"
      >
        See an example report in the separate demo
        <ArrowRight className="ml-1 inline size-4" />
      </Link>
    </section>
  );
}
export function LiveDashboard() {
  const { data, profile } = useDemo();
  if (!data) return null;
  return (
    <>
      <PageHeader
        title="A little clarity. A lot of possibility."
        description={`Welcome back, ${profile.name}. Your research workspace is ready.`}
      >
        <Button asChild>
          <Link href="/research/new">
            <Plus />
            New research
          </Link>
        </Button>
      </PageHeader>
      <section
        aria-label="Workspace statistics"
        className="grid grid-cols-2 gap-4 xl:grid-cols-4"
      >
        {[
          ["Research briefs", data.projects.length],
          ["Research runs", data.runs.length],
          ["Opportunities", data.opportunities.length],
          ["Saved opportunities", data.saved.length],
        ].map(([label, value]) => (
          <div key={label} className="surface flex flex-col gap-4 p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="stat-value">{value}</p>
          </div>
        ))}
      </section>
      {data.projects.length === 0 ? (
        <WorkspaceEmpty
          title="Start with a question worth exploring."
          description="创建第一份研究简报。获授权的开发账号可启动 Qwen 与真实外部检索；研究配置、证据及报告私有保存，绝不添加演示结果。"
        />
      ) : (
        <section className="surface flex flex-col gap-5 p-6">
          <SectionTitle title="Your latest research" href="/research" />
          <h2 className="font-semibold">{data.projects[0].name}</h2>
          <p className="text-muted-foreground">
            {data.projects[0].sector} · {data.projects[0].geography}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.runs[0] ? `任务状态：${data.runs[0].status === "failed" ? "研究中止" : stageLabels[data.runs[0].stage] ?? data.runs[0].status}` : "简报已保存，可创建新的研究任务。"}
          </p>
          <Button variant="outline" asChild className="w-fit">
            <Link href={data.runs[0] ? `/research/${data.runs[0].id}` : "/research"}>
              查看研究任务
              <ArrowRight />
            </Link>
          </Button>
        </section>
      )}
      {data.opportunities.length > 0 && (
        <section className="flex flex-col gap-5">
          <SectionTitle title="Your opportunities" href="/research/results" />
          <div className="grid gap-5 md:grid-cols-2">
            {data.opportunities.slice(0, 2).map((opportunity) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        </section>
      )}
      <p className="text-sm text-muted-foreground">
        Only records owned by your account appear here.{" "}
        <Link href="/profile" className="font-medium text-primary">
          Update founder profile
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
        title={savedOnly ? "Saved opportunities" : "Your research results"}
        description={
          savedOnly
            ? "Your private shortlist, synced to your account."
            : "Only completed research from your account appears here."
        }
      />
      <Input
        type="search"
        aria-label="Search opportunities"
        placeholder="Search by idea, buyer, or industry"
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
          title={
            query
              ? "No matching opportunities"
              : savedOnly
                ? "Your shortlist starts here."
                : "No research results yet."
          }
          description={
            query
              ? "Try another search term."
              : savedOnly
                ? "Save an opportunity from your completed research to add it here. Demonstration opportunities remain in the demo and are never copied into your account."
                : "尚无通过证据核验的报告。可从研究历史查看任务进度或失败原因；检索不可用或证据不足时不会生成虚构结果。"
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
          {saved.includes(item.id) ? "Saved opportunity" : "Save opportunity"}
        </Button>
      </PageHeader>
      <section className="surface flex flex-col gap-5 p-6">
        <h2 className="text-xl font-semibold">Opportunity overview</h2>
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
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 leading-relaxed">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <OpportunityEvidence opportunity={item} />
      <section className="surface flex flex-col gap-4 p-6">
        <h2 className="text-xl font-semibold">Your first validation sprint</h2>
        <p className="text-sm text-muted-foreground">
          Checklist progress is saved with this opportunity. No messages or
          meeting invitations are sent.
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
            {task}
          </label>
        ))}
      </section>
    </>
  );
}
