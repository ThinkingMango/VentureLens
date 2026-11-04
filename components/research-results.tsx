"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  LayoutGrid,
  Columns3,
  Bookmark,
  Plus,
} from "lucide-react";
import { OpportunityCard } from "@/components/opportunity-card";
import { PageHeader, DemoNote } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDemo } from "@/components/demo-provider";
import { opportunities, demoNotice } from "@/lib/demo-data";
export function ResearchResults({
  savedOnly = false,
}: {
  savedOnly?: boolean;
}) {
  const { run, saved } = useDemo();
  const [query, setQuery] = useState("");
  const [confidence, setConfidence] = useState("All confidence levels");
  const [sort, setSort] = useState("Highest score");
  const [view, setView] = useState<"cards" | "compare">("cards");
  const list = opportunities
    .filter(
      (o) =>
        (!savedOnly || saved.includes(o.id)) &&
        `${o.title} ${o.category} ${o.buyer}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (confidence === "All confidence levels" || o.confidence === confidence),
    )
    .sort((a, b) =>
      sort === "Highest score"
        ? b.score - a.score
        : a.title.localeCompare(b.title),
    );
  function download() {
    const text = [
      "VentureLens AI — SYNTHETIC DEMONSTRATION",
      demoNotice,
      `Research: ${run.name}`,
      `Configuration: ${run.sector}; ${run.model}; ${run.geography}`,
      "Demo results are fixed illustrative fixtures, not tailored AI output.",
      "",
      ...list.map(
        (o) =>
          `${o.title}\nDemo score: ${o.score}/100\nBuyer: ${o.buyer}\nDescription: ${o.description}\nIllustrative monthly price: ${o.revenue}\nRisk: ${o.risk}\n`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "venturelens-demo-research.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      {!savedOnly && (
        <Link
          href="/research"
          className="flex w-fit items-center gap-2 text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          My research
        </Link>
      )}
      <PageHeader
        title={
          savedOnly
            ? "Your shortlist, taking shape."
            : "Possibilities worth investigating."
        }
        description={
          savedOnly
            ? "Keep the ideas that resonate. Compare them before you commit."
            : run.name
        }
      >
        <Button variant="outline" onClick={download}>
          <Download />
          Export demo brief
        </Button>
      </PageHeader>
      <div className="flex flex-col gap-4 rounded-xl border border-primary/15 bg-secondary p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-primary/20 text-primary">
            Synthetic research
          </Badge>
          {!savedOnly && (
            <p className="text-sm text-muted-foreground">
              {run.sector} · {run.model} · {run.geography}
            </p>
          )}
        </div>
        <DemoNote />
        <p className="text-sm text-muted-foreground">
          Higher confidence is a relative demo label, not independently verified
          evidence. Configuration changes do not alter these fixed example
          results.
        </p>
      </div>
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            {list.length}{" "}
            {savedOnly ? "saved opportunities" : "opportunity hypotheses"}
          </h2>
          <div
            className="flex rounded-md border bg-card p-1"
            aria-label="Results view"
          >
            <Button
              size="sm"
              variant={view === "cards" ? "secondary" : "ghost"}
              onClick={() => setView("cards")}
              aria-pressed={view === "cards"}
            >
              <LayoutGrid />
              Cards
            </Button>
            <Button
              size="sm"
              variant={view === "compare" ? "secondary" : "ghost"}
              onClick={() => setView("compare")}
              aria-pressed={view === "compare"}
            >
              <Columns3 />
              Compare
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            className="min-w-0 flex-1"
            aria-label="Search opportunities"
            placeholder="Search by idea, buyer, or industry…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="field-select sm:w-52"
            aria-label="Filter evidence confidence"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
          >
            {["All confidence levels", "Higher", "Medium", "Lower"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            className="field-select sm:w-44"
            aria-label="Sort opportunities"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option>Highest score</option>
            <option>Alphabetical</option>
          </select>
        </div>
        {list.length === 0 ? (
          <div className="surface flex flex-col items-center gap-4 p-12 text-center">
            <Bookmark className="size-8 text-muted-foreground" />
            <h3 className="text-lg font-semibold">
              No opportunities here yet.
            </h3>
            <p className="text-muted-foreground">
              {savedOnly
                ? "Save an opportunity from your research results to build your shortlist."
                : "Try a broader search or a different confidence filter."}
            </p>
            <Button asChild variant="outline">
              <Link href="/research/results">
                Explore opportunities
                <ArrowRight />
              </Link>
            </Button>
          </div>
        ) : view === "cards" ? (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {list.map((o) => (
              <OpportunityCard key={o.id} opportunity={o} />
            ))}
          </div>
        ) : (
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <caption className="p-5 text-left text-sm text-muted-foreground">
                Synthetic comparison · All amounts in USD. Monthly price and
                delivery-cost scenarios are assumptions, not forecasts.
              </caption>
              <thead className="border-y bg-background">
                <tr>
                  {[
                    "Opportunity",
                    "Demo score",
                    "Buyer",
                    "Price / month",
                    "Delivery cost / month",
                  ].map((t) => (
                    <th
                      key={t}
                      className="px-5 py-4 text-sm font-medium text-muted-foreground"
                    >
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.id} className="border-b last:border-b-0">
                    <td className="max-w-56 px-5 py-5">
                      <Link
                        className="font-medium text-primary hover:underline"
                        href={`/opportunities/${o.id}`}
                      >
                        {o.title}
                      </Link>
                    </td>
                    <td className="px-5 py-5 font-semibold">{o.score}/100</td>
                    <td className="max-w-48 px-5 py-5 text-sm text-muted-foreground">
                      {o.buyer}
                    </td>
                    <td className="px-5 py-5">{o.revenue}</td>
                    <td className="px-5 py-5">{o.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-dashed p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold">
            A score is a starting point, not a verdict.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open an opportunity to review its assumptions and plan buyer
            conversations.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/research/new">
            <Plus />
            New exploration
          </Link>
        </Button>
      </div>
    </>
  );
}
