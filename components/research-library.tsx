"use client";
import { useCopy, useFormats } from "@/i18n/use-copy";

import { useState } from "react";
import Link from "@/components/workspace-link";
import { Plus, ArrowUpRight, Search, FileText, X, SearchX } from "lucide-react";
import { PageHeader, DemoNote, EmptyState } from "@/components/shared";
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
  const allRuns = isDemo
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
      }));
  const runs = allRuns.filter((r) =>
    `${r.title} ${copy(r.sector)}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <>
      <PageHeader
        title={copy("Your research, all in one place.")}
        description={copy(
          "Every exploration is a step toward a more informed decision.",
        )}
      >
        {allRuns.length > 0 && (
          <Button asChild>
            <Link href="/research/new">
              <Plus />
              {copy("New research")}
            </Link>
          </Button>
        )}
      </PageHeader>
      {allRuns.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={copy("No research yet")}
          description={copy(
            "Describe a market or idea to explore. Each run searches the web for evidence and reports only the hypotheses that pass the evidence checks.",
          )}
          action={{ label: copy("New research"), href: "/research/new" }}
          secondary={{
            label: copy("See an example report in the separate demo"),
            href: "/demo/research/results",
          }}
        />
      ) : (
        <div className="surface overflow-hidden">
          <div className="flex flex-col items-start justify-between gap-4 border-b p-5 sm:flex-row sm:items-center">
            <h2 className="font-semibold">{copy("Research library")}</h2>
            <div className="relative flex w-full items-center gap-2 sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                className="pl-10 pr-11 [&::-webkit-search-cancel-button]:appearance-none"
                aria-label={copy("Search research")}
                placeholder={copy("Search research…")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0"
                  aria-label={copy("Clear search")}
                  onClick={() => setQuery("")}
                >
                  <X />
                </Button>
              )}
            </div>
          </div>
          {runs.length === 0 ? (
            <EmptyState
              plain
              icon={SearchX}
              title={copy("No matching research")}
              description={copy(
                "No research matches “{query}”. Try a different search.",
                { query: query.trim() },
              )}
              action={{
                label: copy("Clear search"),
                onClick: () => setQuery(""),
              }}
            />
          ) : (
            <>
              <div className="divide-y md:hidden">
                {runs.map((r) => (
                  <Link
                    key={r.id}
                    href={r.target}
                    className="flex items-start gap-3 p-5 hover:bg-secondary/40"
                  >
                    <span className="rounded-lg bg-secondary p-2.5 text-primary">
                      <FileText className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <h3 className="font-semibold">{r.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {copy(r.sector)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{copy(r.status)}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {r.count}{" "}
                          {isDemo
                            ? copy("Opportunities")
                            : copy("Completed runs")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {copy(r.date)}
                      </p>
                    </div>
                    <ArrowUpRight className="mt-1 size-4 shrink-0 text-primary" />
                  </Link>
                ))}
              </div>
              <div
                className="hidden overflow-x-auto md:block"
                role="region"
                tabIndex={0}
                aria-label={copy("Research library")}
              >
                <table className="w-full min-w-[620px] text-left">
                  <thead className="bg-background text-sm text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-6 py-3 font-medium">
                        {copy("Research")}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {isDemo
                          ? copy("Opportunities")
                          : copy("Completed runs")}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {copy("Status")}
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        {copy("Open")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-secondary/30">
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
                            aria-label={copy("Open {title}", {
                              title: r.title,
                            })}
                            className="flex size-11 items-center justify-center rounded-md hover:bg-secondary"
                          >
                            <ArrowUpRight className="size-5 text-muted-foreground" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
      <DemoNote />
    </>
  );
}
