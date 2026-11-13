"use client";
import Link from "next/link";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { PageHeader } from "@/components/shared";
import { AdminNav } from "@/components/admin-nav";
import { formatDuration, modeLabel } from "@/components/admin-labels";
import { flagReasons, type FeedbackMetrics, type FlagReason } from "@/lib/feedback-core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { metricWindows } from "@/lib/quality-metrics";
import { FOLLOW_DAYS, funnelSteps, type FunnelStep, type ValidationFunnel } from "@/lib/validation-funnel";
import type { QualityReport } from "@/lib/admin-runs";
import { cn } from "@/lib/utils";
import type { SignupSource } from "@/lib/signup-source";

function Metric({ label, value, definition }: { label: string; value: string; definition: string }) {
  return (
    <Card className="gap-2 p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground text-pretty">{definition}</p>
    </Card>
  );
}

export function AdminQuality({ report }: { report: QualityReport }) {
  const copy = useCopy();
  const formats = useFormats();
  const { metrics: m, days } = report;
  const percent = (value: number | null) => (value === null ? "—" : formats.number(value, { style: "percent", maximumFractionDigits: 0 }));
  const usd = (value: number | null) => (value === null ? "—" : formats.usd(value, 3));
  const number = (value: number | null, digits = 1) => (value === null ? "—" : formats.number(value, { maximumFractionDigits: digits }));
  const distribution = Object.entries(m.opportunitiesPerCompletedRun.distribution).sort(([a], [b]) => Number(a) - Number(b));
  const errors = Object.entries(m.errorCodes).sort(([, a], [, b]) => b - a);
  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <PageHeader
        title={copy("Research quality")}
        description={copy("How research runs performed over the chosen window, calculated from the run, usage, evidence and opportunity records.")}
      >
        <nav aria-label={copy("Time window")} className="flex shrink-0 gap-1">
          {metricWindows.map(window => (
            <Link
              key={window}
              href={`/admin/quality?days=${window}`}
              aria-current={window === days ? "page" : undefined}
              className={cn("inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-4 text-sm font-medium hover:bg-secondary", window === days ? "bg-secondary" : "text-muted-foreground")}
            >
              {copy("{days} days", { days: window })}
            </Link>
          ))}
        </nav>
      </PageHeader>
      <p className="text-sm text-muted-foreground">
        {copy("{total} runs created since {since}: {completed} completed, {failed} failed, {active} still active.", { total: m.runs.total, since: formats.date(report.since, true), completed: m.runs.completed, failed: m.runs.failed, active: m.runs.active })}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label={copy("Completion rate")} value={percent(m.completionRate)} definition={copy("Completed ÷ (completed + failed), leaving out runs the pre-flight budget check stopped before any request ({n}).", { n: m.runs.preflightBlocked })} />
        <Metric label={copy("Insufficient-evidence rate")} value={percent(m.insufficientEvidenceRate)} definition={copy("Runs that failed with INSUFFICIENT_EVIDENCE ÷ all finished runs.")} />
        <Metric label={copy("Opportunities per completed run")} value={number(m.opportunitiesPerCompletedRun.mean)} definition={copy("Mean number of opportunities that passed the gate and the review.")} />
        <Metric label={copy("Independent supporting domains")} value={number(m.supportingDomainsMedian)} definition={copy("Median per saved opportunity, counted as the evidence gate counts them.")} />
        <Metric label={copy("Vendor share of sources")} value={percent(m.vendorShare)} definition={copy("Sources classified as vendor ÷ all classified sources.")} />
        <Metric label={copy("Duration")} value={`${formatDuration(copy, m.duration.medianMs)} / ${formatDuration(copy, m.duration.p95Ms)}`} definition={copy("Median / 95th percentile from start to finish, over {n} finished runs.", { n: m.duration.runs })} />
        <Metric label={copy("Cost per completed run")} value={usd(m.cost.meanCompletedRunUsd)} definition={copy("Mean committed cost of one completed run.")} />
        <Metric label={copy("Spend per completed run")} value={usd(m.cost.spendPerCompletedRunUsd)} definition={copy("All spend in the window, failed runs included, ÷ completed runs.")} />
        <Metric label={copy("Spend per surviving opportunity")} value={usd(m.cost.spendPerOpportunityUsd)} definition={copy("All spend in the window ÷ opportunities that survived the gate and the review.")} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{copy("Opportunities per completed run")}</CardTitle>
            <CardDescription>{copy("How many completed runs produced each number of opportunities.")}</CardDescription>
          </CardHeader>
          <CardContent>
            {distribution.length === 0 ? <p className="text-sm text-muted-foreground">{copy("No completed runs in this window.")}</p> : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                {distribution.map(([n, runs]) => (
                  <div key={n} className="contents">
                    <dt>{copy("Opportunities: {n}", { n })}</dt>
                    <dd className="tabular-nums">{copy("Runs: {runs}", { runs })}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{copy("Failures by error code")}</CardTitle>
            <CardDescription>
              {copy("Total committed spend in the window: {usd}. Calls with unknown cost, counted at their reservation: {n}.", { usd: formats.usd(m.cost.totalUsd, 3), n: m.cost.uncertainCalls })}
              {m.cost.deletedRunsUsd > 0 && <> {copy("Includes {usd} from runs founders have since deleted.", { usd: formats.usd(m.cost.deletedRunsUsd, 3) })}</>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errors.length === 0 ? <p className="text-sm text-muted-foreground">{copy("No failed runs in this window.")}</p> : (
              <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
                {errors.map(([code, count]) => (
                  <div key={code} className="contents">
                    <dt><Link className="font-mono text-xs text-primary hover:underline" href={`/admin/runs?status=failed&error=${encodeURIComponent(code)}`}>{code}</Link></dt>
                    <dd className="tabular-nums">{count}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
      <SignupSection signups={report.signups} />
      <FunnelSection funnel={report.funnel} days={days} />
      <FeedbackSection feedback={report.feedback} />
    </div>
  );
}

type Copy = ReturnType<typeof useCopy>;

function sourceLabel(copy: Copy, source: SignupSource | "unknown") {
  switch (source) {
    case "landing_hero": return copy("Landing page, top");
    case "landing_close": return copy("Landing page, closing section");
    case "header": return copy("Header button");
    case "mobile_menu": return copy("Phone menu");
    case "mobile_bar": return copy("Phone call-to-action bar");
    case "footer": return copy("Footer");
    case "pricing_hero": return copy("Pricing page, top");
    case "pricing_close": return copy("Pricing page, closing section");
    case "demo": return copy("Demo workspace");
    case "unknown": return copy("Unknown or typed in");
  }
}

/** New accounts in the window by the call to action they came from. Counts of accounts only, never who. */
function SignupSection({ signups }: { signups: QualityReport["signups"] }) {
  const copy = useCopy();
  return (
    <section aria-labelledby="signups-heading" className="flex flex-col gap-4">
      <h2 id="signups-heading" className="text-lg font-semibold">{copy("Sign-ups by source")}</h2>
      {!signups ? <p className="text-sm text-muted-foreground">{copy("Product events could not be read.")}</p> : (
        <Card>
          <CardHeader>
            <CardTitle>{copy("{count, plural, one {# new account} other {# new accounts}}", { count: signups.total })}</CardTitle>
            <CardDescription>{copy("Where new accounts in this window came from, counted once per account when it first signs in.")}</CardDescription>
          </CardHeader>
          <CardContent>
            {signups.bySource.length === 0 ? <p className="text-sm text-muted-foreground">{copy("No sign-ups in this window.")}</p> : (
              <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
                {signups.bySource.map(row => (
                  <div key={row.source} className="contents">
                    <dt>{sourceLabel(copy, row.source)}</dt>
                    <dd className="tabular-nums">{row.count}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
function stepLabel(copy: Copy, step: FunnelStep) {
  switch (step) {
    case "viewed": return copy("Opened an opportunity");
    case "sprint": return copy("Started a sprint");
    case "task": return copy("Completed a task");
    case "evidence": return copy("Logged first-hand evidence");
    case "decision": return copy("Recorded a decision");
  }
}

/** Validation funnel (WP-15): what founders did in the 30 days after their first report. Founder counts only. */
function FunnelSection({ funnel, days }: { funnel: ValidationFunnel | null; days: number }) {
  const copy = useCopy();
  const formats = useFormats();
  const percent = (value: number | null) => (value === null ? "—" : formats.number(value, { style: "percent", maximumFractionDigits: 0 }));
  const share = (n: number, of: number) => (of > 0 ? percent(n / of) : "—");
  return (
    <section aria-labelledby="funnel-heading" className="flex flex-col gap-4">
      <h2 id="funnel-heading" className="text-lg font-semibold">{copy("Validation funnel")}</h2>
      {!funnel ? <p className="text-sm text-muted-foreground">{copy("Product events could not be read.")}</p> : (
        <>
          <p className="text-sm text-muted-foreground text-pretty">
            {copy("{founders} founders received their first report in the last {days} days. Each step counts founders who took it within {follow} days of that report; {maturing} of them have had fewer than {follow} days so far, so later steps can still grow.", {
              founders: funnel.founders, days, follow: FOLLOW_DAYS, maturing: funnel.maturing,
            })}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Metric
              label={copy("30-day action rate")}
              value={percent(funnel.actionRate.rate)}
              definition={copy("Founders who completed a validation task or logged first-hand evidence within {follow} days of their first report ÷ founders whose first report was between {from} and {to}, so all of them have had the full {follow} days ({acted} of {n}).", {
                follow: FOLLOW_DAYS, from: formats.date(funnel.actionRate.from), to: formats.date(funnel.actionRate.to), acted: funnel.actionRate.acted, n: funnel.actionRate.founders,
              })}
            />
            <Metric
              label={copy("Days to first completed task")}
              value={funnel.medianDaysToFirstTask === null ? "—" : formats.number(funnel.medianDaysToFirstTask, { maximumFractionDigits: 1 })}
              definition={copy("Median days from the first report to the first completed task, among founders in this window who completed one.")}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{copy("Steps after the first report")}</CardTitle>
              <CardDescription>{copy("Founders in this window who reached each step, and their share of the window's founders. A step can be reached without the one before it.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-2 text-sm">
                <div className="contents">
                  <dt>{copy("Received a first report")}</dt>
                  <dd className="tabular-nums">{funnel.founders}</dd>
                  <dd className="tabular-nums text-muted-foreground">{share(funnel.founders, funnel.founders)}</dd>
                </div>
                {funnelSteps.map(step => (
                  <div key={step} className="contents">
                    <dt>{stepLabel(copy, step)}</dt>
                    <dd className="tabular-nums">{funnel.steps[step]}</dd>
                    <dd className="tabular-nums text-muted-foreground">{share(funnel.steps[step], funnel.founders)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{copy("By week of first report")}</CardTitle>
              <CardDescription>{copy("Weeks start on Monday (UTC). The action rate counts only founders who have had the full {follow} days; until then it shows a dash.", { follow: FOLLOW_DAYS })}</CardDescription>
            </CardHeader>
            <CardContent>
              {funnel.weeks.length === 0 ? <p className="text-sm text-muted-foreground">{copy("No first reports in this window.")}</p> : (
                <div className="-mx-2 overflow-x-auto px-2">
                  <table className="w-full min-w-[36rem] text-sm">
                    <caption className="sr-only">{copy("Validation funnel by week of first report")}</caption>
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th scope="col" className="py-2 pr-4 font-medium">{copy("Week of")}</th>
                        <th scope="col" className="py-2 pr-4 font-medium">{copy("Founders")}</th>
                        {funnelSteps.map(step => <th key={step} scope="col" className="py-2 pr-4 font-medium">{stepLabel(copy, step)}</th>)}
                        <th scope="col" className="py-2 font-medium">{copy("30-day action rate")}</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {funnel.weeks.map(row => (
                        <tr key={row.week} className="border-t">
                          <th scope="row" className="py-2 pr-4 text-left font-normal">{formats.date(`${row.week}T00:00:00Z`)}</th>
                          <td className="py-2 pr-4">{row.founders}</td>
                          {funnelSteps.map(step => <td key={step} className="py-2 pr-4">{row.steps[step]}</td>)}
                          <td className="py-2">{row.actionRate === null ? "—" : copy("{rate} ({acted} of {n})", { rate: percent(row.actionRate), acted: row.acted, n: row.mature })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}

function reasonLabel(copy: Copy, reason: FlagReason) {
  switch (reason) {
    case "wrong": return copy("Wrong or not supported by the source");
    case "outdated": return copy("Outdated");
    case "irrelevant": return copy("Irrelevant to this opportunity");
    case "broken_link": return copy("Broken link");
    case "other": return copy("Something else");
  }
}

/** Report feedback (WP-13): what founders flagged, which source domains, and how they rated reports. */
function FeedbackSection({ feedback }: { feedback: FeedbackMetrics | null }) {
  const copy = useCopy();
  const formats = useFormats();
  const mean = (value: number | null) => (value === null ? "—" : formats.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const groupList = (rows: FeedbackMetrics["ratings"]["byMode"], label: (key: string) => string) =>
    rows.length === 0 ? <p className="text-sm text-muted-foreground">{copy("No ratings in this window.")}</p> : (
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
        {rows.map(row => (
          <div key={row.key} className="contents">
            <dt className="min-w-0 break-words">{label(row.key)}</dt>
            <dd className="tabular-nums">{copy("{mean} from {n} ratings", { mean: mean(row.mean), n: row.ratings })}</dd>
          </div>
        ))}
      </dl>
    );
  return (
    <section aria-labelledby="feedback-heading" className="flex flex-col gap-4">
      <h2 id="feedback-heading" className="text-lg font-semibold">{copy("Report feedback")}</h2>
      {!feedback ? <p className="text-sm text-muted-foreground">{copy("Report feedback could not be read.")}</p> : (
        <>
          <p className="text-sm text-muted-foreground">
            {copy("{flags} flags ({claims} claims, {sources} sources) and {ratings} ratings in this window. Average rating: {mean}.", {
              flags: feedback.flags.total, claims: feedback.flags.claims, sources: feedback.flags.sources, ratings: feedback.ratings.total, mean: mean(feedback.ratings.mean),
            })}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{copy("Flags by reason")}</CardTitle>
                <CardDescription>{copy("Claims and sources founders flagged, by the reason they chose.")}</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
                  {flagReasons.map(reason => (
                    <div key={reason} className="contents">
                      <dt>{reasonLabel(copy, reason)}</dt>
                      <dd className="tabular-nums">{feedback.flags.byReason[reason]}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{copy("Most-flagged domains")}</CardTitle>
                <CardDescription>{copy("Registrable domains of the sources founders flagged, most flags first.")}</CardDescription>
              </CardHeader>
              <CardContent>
                {feedback.flags.topDomains.length === 0 ? <p className="text-sm text-muted-foreground">{copy("No flagged sources in this window.")}</p> : (
                  <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
                    {feedback.flags.topDomains.map(row => (
                      <div key={row.domain} className="contents">
                        <dt className="min-w-0 break-all font-mono text-xs">{row.domain}</dt>
                        <dd className="tabular-nums">{row.flags}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{copy("Average rating by mode")}</CardTitle>
                <CardDescription>{copy("Ratings from 1 to 5, by the run's discovery mode.")}</CardDescription>
              </CardHeader>
              <CardContent>{groupList(feedback.ratings.byMode, key => modeLabel(copy, key === "unknown" ? null : key))}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{copy("Average rating by model")}</CardTitle>
                <CardDescription>{copy("Ratings from 1 to 5, by the model that wrote most of the run (most output tokens).")}</CardDescription>
              </CardHeader>
              <CardContent>{groupList(feedback.ratings.byModel, key => (key === "unknown" ? copy("Unknown") : key))}</CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
