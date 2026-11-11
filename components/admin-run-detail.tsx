"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { AdminNav } from "@/components/admin-nav";
import { formatDuration, gateLabel, languageLabel, modeLabel, retrievalLabel, statusLabel } from "@/components/admin-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RunInspection } from "@/lib/admin-runs";

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 break-words font-medium">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
const mono = (value: unknown) => (value === null || value === undefined || value === "" ? "—" : <span className="font-mono text-xs">{String(value)}</span>);

export function AdminRunDetail({ inspection }: { inspection: RunInspection }) {
  const copy = useCopy();
  const formats = useFormats();
  const { run, setup, failure, budgetBlock, timeline, usage, switches, candidates } = inspection;
  const date = (value: string | null | undefined) => (value ? formats.date(value, true) : "—");
  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <Link href="/admin/runs" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" /> {copy("All research runs")}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="page-heading">{copy("Run {id}", { id: run.id.slice(0, 8) })}</h1>
        <p className="text-muted-foreground">{copy("Structural data only. Brief, profile, candidate and report text are not shown to administrators.")}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>{copy("Overview")}</CardTitle></CardHeader>
        <CardContent>
          <Facts items={[
            [copy("Status"), <Badge key="s" variant="secondary">{statusLabel(copy, run.status)}</Badge>],
            [copy("Stage reached"), mono(run.stage)],
            [copy("Error code"), mono(run.error_code)],
            [copy("Mode"), modeLabel(copy, run.mode)],
            [copy("Report language"), languageLabel(copy, run.language)],
            [copy("Retries"), run.retry_count],
            [copy("Created"), date(run.created_at)],
            [copy("Started"), date(run.started_at)],
            [copy("Finished"), date(run.completed_at)],
            [copy("Duration"), formatDuration(copy, run.durationMs)],
            [copy("Committed cost"), formats.usd(run.committedUsd, 4)],
            [copy("Run budget"), formats.usd(run.budget_usd, 2)],
            [copy("Run slot returned"), run.status === "failed" ? (run.quota_released ? copy("Yes") : copy("No")) : "—"],
            [copy("Opportunities"), run.opportunities],
            [copy("Model"), mono(setup.model)],
            [copy("Provider at start"), mono(setup.provider)],
            [copy("Structured stages ran on"), mono(setup.active_provider)],
            [copy("Searches ran on"), mono(setup.search_provider ?? setup.active_provider)],
            [copy("Fallback allowed"), setup.fallback_allowed === undefined ? "—" : setup.fallback_allowed ? copy("Yes") : copy("No")],
            [copy("Configured model skipped"), setup.primary_skipped ? copy("{model}: needs a budget of {required}", { model: String(setup.primary_skipped), required: typeof setup.primary_required_usd === "number" ? formats.usd(setup.primary_required_usd, 4) : "—" }) : "—"],
            [copy("Methodology"), mono(setup.methodology)],
            [copy("Account"), mono(run.user_id)],
            [copy("Workflow"), mono(run.workflow_id)],
          ]} />
        </CardContent>
      </Card>

      {(failure || budgetBlock) && (
        <Card>
          <CardHeader>
            <CardTitle>{copy("Failure record")}</CardTitle>
            <CardDescription>{copy("The checkpoints the engine saved when the run stopped.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {failure && <Facts items={[[copy("Failed stage"), mono(failure.stage)], [copy("Error code"), mono(failure.code)], [copy("Error type"), mono(failure.name)], [copy("Provider HTTP status"), mono(failure.status)], [copy("Recorded"), date(typeof failure.at === "string" ? failure.at : null)]]} />}
            {budgetBlock && <Facts items={[[copy("Budget stop"), mono(budgetBlock.kind)], [copy("Stage"), mono(budgetBlock.stage)], [copy("Model"), mono(budgetBlock.model)], [copy("Needed"), typeof budgetBlock.required_usd === "number" ? formats.usd(budgetBlock.required_usd, 4) : "—"]]} />}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{copy("Candidates and the evidence gate")}</CardTitle>
          <CardDescription>{copy("Pass or fail comes from the evidence gate itself. A candidate passes with supporting sources from two independent domains, one of them non-vendor pain or demand evidence.")}</CardDescription>
        </CardHeader>
        <CardContent>
          {candidates.length === 0 ? <p className="text-sm text-muted-foreground">{copy("Discovery has not saved any candidates.")}</p> : (
            <div className="flex flex-col gap-4">
              {candidates.map(candidate => (
                <details key={candidate.key} className="rounded-lg border p-4">
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-mono font-semibold">{candidate.key}</span>
                    <Badge variant={candidate.gate === "passed" ? "default" : "secondary"}>{gateLabel(copy, candidate.gate)}</Badge>
                    <span>{retrievalLabel(copy, candidate.retrieval)}</span>
                    <span className="text-muted-foreground">{copy("Sources: {sources} · Domains: {domains} · Independent supporting domains: {supporting}", { sources: candidate.sources, domains: candidate.domains, supporting: candidate.supportingDomains })}</span>
                    <span className="text-muted-foreground">{candidate.vendorShare === null ? copy("Vendor share —") : copy("Vendor share {share}", { share: formats.number(candidate.vendorShare, { style: "percent" }) })}</span>
                  </summary>
                  {candidate.rows.length > 0 && (
                    <div className="relative mt-3 overflow-x-auto">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th scope="col" className="py-2 pr-4 font-medium">{copy("Domain")}</th>
                            <th scope="col" className="py-2 pr-4 font-medium">{copy("Reliability")}</th>
                            <th scope="col" className="py-2 pr-4 font-medium">{copy("Stance")}</th>
                            <th scope="col" className="py-2 pr-4 font-medium">{copy("Kind")}</th>
                            <th scope="col" className="py-2 font-medium">{copy("Relevant")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {candidate.rows.map((row, index) => (
                            <tr key={index} className="border-t">
                              <td className="py-2 pr-4">{mono(row.domain)}</td>
                              <td className="py-2 pr-4">{mono(row.reliability)}</td>
                              <td className="py-2 pr-4">{mono(row.stance)}</td>
                              <td className="py-2 pr-4">{mono(row.kind)}</td>
                              <td className="py-2">{row.relevant === null ? "—" : row.relevant ? copy("Yes") : copy("No")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </details>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy("Provider calls")}</CardTitle>
          <CardDescription>{copy("Each budgeted model or search call: reserved before it was sent, and committed once its cost was known. A call whose cost is unknown counts at its full reservation.")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {switches.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {switches.map((change, index) => (
                <li key={index}>{copy("Switched from {from} to {to} at {stage}", { from: change.from, to: change.to, stage: change.stage })}</li>
              ))}
            </ul>
          )}
          {usage.length === 0 ? <p className="text-sm text-muted-foreground">{copy("No provider calls were made.")}</p> : (
            <div className="relative overflow-x-auto" role="region" tabIndex={0} aria-label={copy("Provider calls")}>
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-medium">{copy("Stage")}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{copy("Provider")}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{copy("Model")}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{copy("Call status")}</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">{copy("Reserved")}</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">{copy("Committed")}</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">{copy("Tokens in / out")}</th>
                    <th scope="col" className="py-2 text-right font-medium">{copy("Searches")}</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="py-2 pr-4">{mono(row.stage)}</td>
                      <td className="py-2 pr-4">{mono(row.provider)}</td>
                      <td className="py-2 pr-4">{mono(row.model)}</td>
                      <td className="py-2 pr-4">{mono(row.status)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formats.usd(row.reservedUsd, 4)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formats.usd(row.committedUsd, 4)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formats.number(row.inputTokens)} / {formats.number(row.outputTokens)}</td>
                      <td className="py-2 text-right tabular-nums">{row.searchRequests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy("Stage timeline")}</CardTitle>
          <CardDescription>{copy("Checkpoints in the order they were saved, with the size of each saved output.")}</CardDescription>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? <p className="text-sm text-muted-foreground">{copy("No checkpoints were saved.")}</p> : (
            <ol className="flex flex-col gap-2 text-sm">
              {timeline.map(step => (
                <li key={step.key} className="flex flex-wrap justify-between gap-x-4 border-b pb-2 last:border-0">
                  <span className="font-mono text-xs">{step.key}</span>
                  <span className="text-muted-foreground tabular-nums">{date(step.created_at)} · {copy("{size} KB", { size: formats.number(step.bytes / 1024, { maximumFractionDigits: 1 }) })}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
