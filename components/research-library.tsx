"use client";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { choiceLabel } from "@/lib/research-options";

import { useState } from "react";
import Link from "@/components/workspace-link";
import { Plus, ArrowUpRight, Search, FileText, X } from "lucide-react";
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
            sectors: run.sectors as readonly string[],
            count: 4,
            date: copy("Current demo session"),
          },
          {
            id: "demo-history",
            target: "/research/results",
            status: "Demo complete",
            title: copy("Recurring-revenue tools for small teams"),
            sectors: ["B2B SaaS"] as readonly string[],
            count: 4,
            date: copy("Sample research history"),
          },
          {
            id: "demo-no-result",
            target: "/research/no-result",
            status: "Nothing passed",
            title: copy("Clinic tools for independent physiotherapists"),
            sectors: ["Healthcare"] as readonly string[],
            count: 0,
            date: copy("Sample research history"),
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
              ? "Brief saved"
              : latest.status === "failed"
                ? "Research stopped"
                : latest.status === "pending"
                  ? "Queued"
                  : (stageLabels[latest.stage] ?? latest.status);
          })(),
          title: project.name,
          sectors: project.sectors as readonly string[],
          count:
            data?.runs.filter(
              (item) =>
                item.project_id === project.id && item.status === "completed",
            ).length ?? 0,
          date: copy("{date} UTC", { date: format.date(project.created_at) }),
        }))
  ).filter((r) =>
    `${r.title} ${choiceLabel(r.sectors, (v) => copy(v))}`
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
        <Button asChild>
          <Link href="/research/new">
            <Plus />
            {copy("New research")}
          </Link>
        </Button>
      </PageHeader>
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
              className="pl-10 pr-11"
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
        <div className="grid gap-3 p-3 md:hidden">
          {runs.map((r) => (
            <Link
              key={r.id}
              href={r.target}
              className="flex items-start gap-3 rounded-xl border bg-card p-5 hover:border-primary/40 hover:bg-secondary/40"
            >
              <span className="rounded-lg bg-secondary p-2.5 text-primary">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <h3 className="font-semibold">{r.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {choiceLabel(r.sectors, (v) => copy(v))}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{copy(r.status)}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {isDemo
                      ? copy("{count, plural, one {# opportunity} other {# opportunities}}", { count: r.count })
                      : copy("{count, plural, one {# completed run} other {# completed runs}}", { count: r.count })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{r.date}</p>
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
                  {isDemo ? copy("Opportunities") : copy("Completed runs")}
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
                          {choiceLabel(r.sectors, (v) => copy(v))} · {r.date}
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
        {runs.length === 0 && (
          <p role="status" className="p-10 text-center text-muted-foreground">
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
