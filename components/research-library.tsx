"use client";
import { useCopy, useFormats } from "@/i18n/use-copy";

import { useState } from "react";
import Link from "@/components/workspace-link";
import { Plus, ArrowUpRight, Search, FileText } from "lucide-react";
import { PageHeader, DemoNote } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDemo } from "@/components/demo-provider";
import { stageLabels } from "@/lib/research-core";
export function ResearchLibrary() {
  const copy = useCopy();
  const format = useFormats();
  const { run, data, isDemo } = useDemo();
  const [query, setQuery] = useState("");
  const runs = (
    isDemo
      ? [
          {
            id: "demo-current",
            target: "/research/results",
            status: "Demo complete",
            title: run.name,
            sector: run.sector,
            count: 4,
            date: "Current demo session",
          },
          {
            id: "demo-history",
            target: "/research/results",
            status: "Demo complete",
            title: copy("Recurring-revenue tools for small teams"),
            sector: "B2B SaaS",
            count: 4,
            date: "Sample research history",
          },
        ]
      : (data?.projects ?? []).map((project) => ({
          id: project.id,
          target: data?.runs.find((item) => item.project_id === project.id)
            ? `/research/${data.runs.find((item) => item.project_id === project.id)!.id}`
            : "/research/new",
          status: (() => {
            const latest = data?.runs.find(
              (item) => item.project_id === project.id,
            );
            return !latest
              ? "简报已保存"
              : latest.status === "failed"
                ? "研究中止"
                : latest.status === "pending"
                  ? "等待处理"
                  : (stageLabels[latest.stage] ?? latest.status);
          })(),
          title: project.name,
          sector: project.sector,
          count:
            data?.runs.filter(
              (item) =>
                item.project_id === project.id && item.status === "completed",
            ).length ?? 0,
          date: `${format.date(project.created_at)} UTC`,
        }))
  ).filter((r) => r.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <PageHeader
        title={copy("Your research, all in one place.")}
        description={copy(
          "Every exploration is a step toward a more informed decision.",
        )}
      >
        <Button asChild>
          <Link href="/research/new">
            <Plus />
            {copy("New research")}
          </Link>
        </Button>
      </PageHeader>
      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b p-5">
          <h2 className="font-semibold">{copy("Research library")}</h2>
          <div className="flex max-w-xs items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              aria-label={copy("Search research")}
              placeholder={copy("Search research…")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead className="bg-background text-sm text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">{copy("Research")}</th>
                <th className="px-4 py-3 font-medium">
                  {isDemo ? copy("Opportunities") : copy("Completed runs")}
                </th>
                <th className="px-4 py-3 font-medium">{copy("Status")}</th>
                <th className="px-4 py-3 font-medium">{copy("Open")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-6 py-6">
                    <Link
                      href={r.target}
                      className="flex items-center gap-3 hover:text-primary"
                    >
                      <FileText className="size-5 shrink-0 text-primary" />
                      <span>
                        <span className="font-medium">{r.title}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {copy(r.sector)} · {copy(r.date)}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-6">{r.count}</td>
                  <td className="px-4 py-6">
                    <Badge variant="secondary">{copy(r.status)}</Badge>
                  </td>
                  <td className="px-4 py-6">
                    <Link
                      href={r.target}
                      aria-label={copy("Open {title}", { title: r.title })}
                    >
                      <ArrowUpRight className="size-5 text-muted-foreground" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {runs.length === 0 && (
          <p className="p-10 text-center text-muted-foreground">
            {query
              ? copy("No research matches “{query}”. Try a different search.", {
                  query: query,
                })
              : copy(
                  "No research briefs yet. Create your first brief to get started.",
                )}
          </p>
        )}
      </div>
      {runs.length === 0 &&
        (query ? (
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => setQuery("")}
          >
            {copy("Clear search")}
          </Button>
        ) : (
          <Button asChild className="w-fit">
            <Link href="/research/new">
              {copy("New research")}
              <Plus />
            </Link>
          </Button>
        ))}
      <DemoNote />
    </>
  );
}
