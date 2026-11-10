"use client";
import { MobileDisclosure } from "@/components/mobile-disclosure";
import { choiceLabel } from "@/lib/research-options";
import { useCopy } from "@/i18n/use-copy";

import { useState } from "react";
import { useLocale } from "next-intl";
import Link from "@/components/workspace-link";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { useDemo } from "@/components/demo-provider";
import { demoNotice } from "@/lib/demo-notice";
import { useDemoContent } from "@/i18n/demo";
export function DemoResearchResults({
  savedOnly = false,
}: {
  savedOnly?: boolean;
}) {
  const copy = useCopy();
  const locale = useLocale();
  const { opportunities } = useDemoContent();
  const { run, saved, isDemo } = useDemo();
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
        : a.title.localeCompare(b.title, locale),
    );
  function download() {
    const text = [
      copy("VentureLens AI — SYNTHETIC DEMONSTRATION"),
      copy(demoNotice),
      copy("Research: {name}", { name: run.name }),
      copy("Configuration: {sector}; {model}; {geography}", {
        sector: choiceLabel(run.sectors, (v) => copy(v)),
        model: choiceLabel(run.models, (v) => copy(v)),
        geography: copy(run.geography),
      }),
      copy(
        "Demo results are fixed illustrative fixtures, not tailored AI output.",
      ),
      "",
      ...list.map((o) =>
        [
          o.title,
          copy("Demo score: {score}/100", { score: o.score }),
          copy("Buyer: {buyer}", { buyer: o.buyer }),
          copy("Description: {description}", { description: o.description }),
          copy("Illustrative monthly price: {price}", { price: o.revenue }),
          copy("Risk: {risk}", { risk: o.risk }),
          "",
        ].join("\n"),
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "venturelens-demo-research.txt";
    a.click();
    // Revoking synchronously can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      {!savedOnly && (
        <Link
          href="/research"
          className="flex w-fit items-center gap-2 text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          {copy("My research")}
        </Link>
      )}
      <PageHeader
        title={savedOnly ? copy("Saved opportunities") : run.name}
        description={
          savedOnly
            ? copy(
                "Review your shortlist and compare the assumptions behind each idea.",
              )
            : copy(
                "Research results · Compare buyer needs, economics, and validation priorities.",
              )
        }
      >
        <Button variant="outline" onClick={download}>
          <Download />
          {copy("Export demo brief")}
        </Button>
      </PageHeader>
      <DemoNote short />
      <MobileDisclosure title={copy("About this report")}>
        <div className="flex flex-col gap-3 border-y py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">{copy("Demonstration report")}</Badge>
            {!savedOnly && (
              <p className="text-sm text-muted-foreground">
                {choiceLabel(run.sectors, (v) => copy(v))} ·{" "}
                {choiceLabel(run.models, (v) => copy(v))} · {copy(run.geography)}
              </p>
            )}
          </div>
          <DemoNote />
          <details className="text-sm text-muted-foreground">
            <summary className="w-fit rounded-sm underline-offset-4 hover:text-primary hover:underline">
              {copy("How to interpret this report")}
            </summary>
            <p className="mt-2 max-w-3xl">
              {copy(
                "Scores and confidence labels compare invented scenarios; they do not measure verified demand. These fixed examples do not change with your research configuration. All amounts are monthly USD assumptions per customer, not forecasts.",
              )}
            </p>
          </details>
        </div>
      </MobileDisclosure>
      {!savedOnly && (
        <section
          aria-labelledby="research-summary"
          className="surface flex flex-col gap-4 p-5 md:p-6"
        >
          <h2 id="research-summary" className="text-lg font-semibold">
            {copy("Research summary")}
          </h2>
          <p className="max-w-3xl leading-relaxed">
            {copy(
              "Proposal preparation leads this four-workflow demo. Buyer access, review effort, and willingness to pay remain unvalidated for every opportunity.",
            )}
          </p>
          <div className="flex border-t pt-4">
            <Button
              variant="link"
              asChild
              className="h-auto min-h-11 justify-start p-0"
            >
              <Link href="/opportunities/proposal-copilot">
                {copy("Review leading hypothesis")}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </section>
      )}
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2
            className="text-lg font-semibold"
            aria-live="polite"
            aria-atomic="true"
          >
            {savedOnly
              ? copy(
                  "{count, plural, one {# saved opportunity} other {# saved opportunities}}",
                  { count: list.length },
                )
              : copy(
                  "{count, plural, one {# opportunity hypothesis} other {# opportunity hypotheses}}",
                  { count: list.length },
                )}
          </h2>
          <div
            className="flex rounded-md border bg-card p-1"
            role="group"
            aria-label={copy("Results view")}
          >
            <Button
              size="sm"
              variant={view === "cards" ? "secondary" : "ghost"}
              onClick={() => setView("cards")}
              aria-pressed={view === "cards"}
            >
              <LayoutGrid />
              {copy("Cards")}
            </Button>
            <Button
              size="sm"
              variant={view === "compare" ? "secondary" : "ghost"}
              onClick={() => setView("compare")}
              aria-pressed={view === "compare"}
            >
              <Columns3 />
              {copy("Compare")}
            </Button>
          </div>
        </div>
        <FieldGroup className="surface grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:flex md:flex-row md:items-end md:p-5">
          <Field className="col-span-2 min-w-0 md:flex-1">
            <FieldLabel htmlFor="opportunity-search">
              {copy("Search opportunities")}
            </FieldLabel>
            <Input
              id="opportunity-search"
              type="search"
              placeholder={copy("Idea, buyer, or industry")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <MobileDisclosure
            className="col-span-2 md:shrink-0"
            title={
              confidence !== "All confidence levels" || sort !== "Highest score"
                ? copy("Filters and sorting (modified)")
                : copy("Filters and sorting")
            }
          >
            <div className="grid grid-cols-2 gap-4 md:flex">
              <Field className="md:w-52 md:shrink-0">
                <FieldLabel htmlFor="confidence-filter">
                  {copy("Demo confidence")}
                </FieldLabel>
                <select
                  id="confidence-filter"
                  className="field-select"
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                >
                  {["All confidence levels", "Higher", "Medium", "Lower"].map(
                    (v) => (
                      <option key={v} value={v}>
                        {v === "All confidence levels"
                          ? copy("All levels")
                          : copy(v)}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Field className="md:w-44 md:shrink-0">
                <FieldLabel htmlFor="opportunity-sort">
                  {copy("Sort by")}
                </FieldLabel>
                <select
                  id="opportunity-sort"
                  className="field-select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="Highest score">{copy("Highest score")}</option>
                  <option value="Alphabetical">{copy("Alphabetical")}</option>
                </select>
              </Field>
            </div>
          </MobileDisclosure>
        </FieldGroup>
        {list.length === 0 ? (
          <div className="surface flex flex-col items-center gap-4 p-12 text-center">
            <Bookmark className="size-8 text-muted-foreground" />
            <h3 className="text-lg font-semibold">
              {query || confidence !== "All confidence levels"
                ? copy("No matching opportunities")
                : copy("No saved opportunities yet")}
            </h3>
            <p className="text-muted-foreground">
              {query || confidence !== "All confidence levels"
                ? copy("Try a broader search or a different confidence filter.")
                : copy(
                    "Save an opportunity from your research results to build your shortlist.",
                  )}
            </p>
            {query || confidence !== "All confidence levels" ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setConfidence("All confidence levels");
                }}
              >
                {copy("Clear filters")}
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/research/results">
                  {copy("Explore opportunities")}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            )}
          </div>
        ) : view === "cards" ? (
          <div className="grid gap-5 md:grid-cols-2">
            {list.map((o) => (
              <OpportunityCard key={o.id} opportunity={o} />
            ))}
          </div>
        ) : (
          <div
            className="surface overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label={copy(
              "Opportunity comparison; scroll horizontally to see all columns",
            )}
          >
            <table className="w-full min-w-[780px] text-left">
              <caption className="p-5 text-left text-sm text-muted-foreground">
                {copy(
                  "Synthetic comparison · All amounts in USD. Monthly price and delivery-cost scenarios are assumptions, not forecasts.",
                )}
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
                      scope="col"
                      key={t}
                      className="px-5 py-4 text-sm font-medium text-muted-foreground"
                    >
                      {copy(t)}
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
            {copy("A score is a starting point, not a verdict.")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy(
              "Open an opportunity to review its assumptions and plan buyer conversations.",
            )}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/research/new">
            <Plus />
            {copy("New exploration")}
          </Link>
        </Button>
      </div>
    </>
  );
}
