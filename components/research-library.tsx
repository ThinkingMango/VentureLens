"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowUpRight, Search, FileText } from "lucide-react";
import { PageHeader, DemoNote } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDemo } from "@/components/demo-provider";
export function ResearchLibrary() {
  const { run } = useDemo();
  const [query, setQuery] = useState("");
  const runs = [
    {
      title: run.name,
      sector: run.sector,
      count: 4,
      date: "Current demo session",
    },
    {
      title: "Recurring-revenue tools for small teams",
      sector: "B2B SaaS",
      count: 4,
      date: "Sample research history",
    },
  ].filter((r) => r.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <PageHeader
        title="Your research, all in one place."
        description="Every exploration is a step toward a more informed decision."
      >
        <Button asChild>
          <Link href="/research/new">
            <Plus />
            New research
          </Link>
        </Button>
      </PageHeader>
      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b p-5">
          <h2 className="font-semibold">Research library</h2>
          <div className="flex max-w-xs items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              aria-label="Search research"
              placeholder="Search research…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead className="bg-background text-sm text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Research</th>
                <th className="px-4 py-3 font-medium">Opportunities</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.title} className="border-t">
                  <td className="px-6 py-6">
                    <Link
                      href="/research/results"
                      className="flex items-center gap-3 hover:text-primary"
                    >
                      <FileText className="size-5 shrink-0 text-primary" />
                      <span>
                        <span className="font-medium">{r.title}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {r.sector} · {r.date}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-6">{r.count}</td>
                  <td className="px-4 py-6">
                    <Badge variant="secondary">Demo complete</Badge>
                  </td>
                  <td className="px-4 py-6">
                    <Link
                      href="/research/results"
                      aria-label={`Open ${r.title}`}
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
            No research matches “{query}”. Try a different search.
          </p>
        )}
      </div>
      <DemoNote />
    </>
  );
}
