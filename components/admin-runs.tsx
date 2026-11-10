"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { PageHeader } from "@/components/shared";
import { AdminNav } from "@/components/admin-nav";
import { formatDuration, languageLabel, modeLabel, statusLabel } from "@/components/admin-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { runStatuses, type RunFilters } from "@/lib/admin-runs-core";
import type { RunList } from "@/lib/admin-runs";

const field = "min-h-11 rounded-md border bg-background px-3 text-sm";

export function AdminRuns({ list, filters, errorCodes }: { list: RunList; filters: RunFilters; errorCodes: string[] }) {
  const copy = useCopy();
  const formats = useFormats();
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (filters.status) query.set("status", filters.status);
    if (filters.errorCode) query.set("error", filters.errorCode);
    if (filters.from) query.set("from", filters.from);
    if (filters.to) query.set("to", filters.to);
    if (page > 1) query.set("page", String(page));
    const text = query.toString();
    return text ? `/admin/runs?${text}` : "/admin/runs";
  };
  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <PageHeader
        title={copy("Research runs")}
        description={copy("Every research run, newest first, with its stage, error and cost. Only structural data is shown: no brief, profile or report text.")}
      />
      <Card className="p-4">
        <form method="get" action="/admin/runs" className="flex flex-wrap items-end gap-3" aria-label={copy("Filter research runs")}>
          <label className="flex flex-col gap-1 text-sm">
            {copy("Status")}
            <select name="status" defaultValue={filters.status ?? ""} className={field}>
              <option value="">{copy("Any status")}</option>
              {runStatuses.map(status => <option key={status} value={status}>{statusLabel(copy, status)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {copy("Error code")}
            <input name="error" list="admin-error-codes" defaultValue={filters.errorCode ?? ""} placeholder="INSUFFICIENT_EVIDENCE" className={`${field} w-64 font-mono`} autoComplete="off" />
            <datalist id="admin-error-codes">{errorCodes.map(code => <option key={code} value={code} />)}</datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {copy("Created from")}
            <input type="date" name="from" defaultValue={filters.from ?? ""} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {copy("Created to")}
            <input type="date" name="to" defaultValue={filters.to ?? ""} className={field} />
          </label>
          <Button type="submit" className="min-h-11">{copy("Apply filters")}</Button>
          <Button asChild variant="ghost" className="min-h-11"><Link href="/admin/runs">{copy("Clear filters")}</Link></Button>
        </form>
      </Card>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {copy("Runs matching: {count}", { count: list.total })}
      </p>
      {list.rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">{copy("No research runs match these filters.")}</Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="relative overflow-x-auto" role="region" tabIndex={0} aria-label={copy("Research runs")}>
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-background text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">{copy("Created")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{copy("Status")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{copy("Stage reached")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{copy("Error code")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{copy("Mode")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{copy("Report language")}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{copy("Duration")}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{copy("Committed cost")}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{copy("Opportunities")}</th>
                  <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">{copy("Open")}</span></th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map(run => (
                  <tr key={run.id} className="border-t hover:bg-secondary/30">
                    <td className="px-4 py-3 whitespace-nowrap">{formats.date(run.created_at, true)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{statusLabel(copy, run.status)}</Badge>
                      {run.retry_count > 0 && <span className="ml-2 text-xs text-muted-foreground">{copy("retried")}</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{run.stage}</td>
                    <td className="px-4 py-3 font-mono text-xs">{run.error_code ?? "—"}</td>
                    <td className="px-4 py-3">{modeLabel(copy, run.mode)}</td>
                    <td className="px-4 py-3">{languageLabel(copy, run.language)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatDuration(copy, run.durationMs)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formats.usd(run.committedUsd, 3)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{run.opportunities}</td>
                    <td className="px-2 py-1">
                      <Link href={`/admin/runs/${run.id}`} aria-label={copy("Inspect run {id}", { id: run.id.slice(0, 8) })} className="flex size-11 items-center justify-center rounded-md hover:bg-secondary">
                        <ArrowUpRight className="size-5 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {pages > 1 && (
        <nav aria-label={copy("Pages")} className="flex items-center justify-between gap-3 text-sm">
          {filters.page > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={pageHref(filters.page - 1)}>{copy("Newer runs")}</Link></Button> : <span />}
          <span className="text-muted-foreground">{copy("Page {page} of {pages}", { page: filters.page, pages })}</span>
          {filters.page < pages ? <Button asChild variant="outline" className="min-h-11"><Link href={pageHref(filters.page + 1)}>{copy("Older runs")}</Link></Button> : <span />}
        </nav>
      )}
    </div>
  );
}
