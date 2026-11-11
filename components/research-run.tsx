"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Check, Circle, LoaderCircle, ArrowLeft } from "lucide-react";
import { researchModels } from "@/lib/research-models";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared";
import { useDemo } from "@/components/demo-provider";
import { ResearchReportView } from "@/components/research-report";
import { ResearchOutcomeView } from "@/components/research-outcome";
import { ModelTag } from "@/components/model-tag";
import { ReportRating } from "@/components/report-feedback";
import { ExportButton } from "@/components/report-export";
import { exportFileName, reportToMarkdown } from "@/lib/report-export";
import { useLocale } from "next-intl";
import { pollInterval, retrievalProgress } from "@/lib/research-progress";
import { researchErrors, stageLabels } from "@/lib/research-core";
import type { ResearchDetail } from "@/lib/research-types";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { feedbackSource } from "@/i18n/errors";
import { getJson, postJson, ApiNetworkError } from "@/lib/api-client";
const stageHints: Record<string, string> = {
  queued: "Waiting for a worker to pick up the job.",
  discovery: "Generating up to eight narrow hypotheses from your brief and profile.",
  retrieval: "Searching the web for buyer pain, spending signals, competitors, and counter-evidence. This is the longest stage.",
  classification: "Tagging every excerpt by kind, reliability, and whether it supports or contradicts the idea.",
  evaluation: "Estimating buyer, pricing, cost, and risk for each candidate with enough evidence.",
  scoring: "Applying the weighted scorecard and evidence caps.",
  review: "Running an adversarial critique that can reject ideas or deduct points.",
  finalizing: "Saving the report and linked sources to your workspace.",
};
// A "Verify my idea" check has one candidate: the founder's own idea.
const verifyStageHints: Record<string, string> = {
  discovery: "Writing two searches for your idea: one for the problem, one for the alternatives buyers use.",
  retrieval: "Searching the web for evidence of the problem, what buyers spend, and the alternatives they use.",
  evaluation: "Estimating buyer, pricing, cost, and risk for your idea if the evidence is strong enough.",
  classification: "Tagging every excerpt by kind, reliability, and whether it supports or contradicts your idea.",
  scoring: "Applying the weighted scorecard and evidence caps to your idea.",
  review: "Running an adversarial critique that can reject your idea or deduct points.",
};
const stages = [
  "discovery",
  "retrieval",
  "classification",
  "evaluation",
  "scoring",
  "review",
  "finalizing",
];
async function fetchRun(url: string): Promise<ResearchDetail> {
  const result = await getJson(url).catch(() => null);
  if (!result?.ok)
    throw new Error(feedbackSource(result?.body.code, "STATUS_UNAVAILABLE"));
  return result.body as unknown as ResearchDetail;
}
export function ResearchRunView({
  initialData,
  rating = null,
  emailOnFinish = false,
}: {
  initialData: ResearchDetail;
  /** True when this run will send its "report ready" email (WP-08): email is on for this deployment and the founder. */
  emailOnFinish?: boolean;
  /** The founder's rating of this report (WP-13), if they gave one. */
  rating?: { rating: number; comment: string } | null;
}) {
  const copy = useCopy();
  const format = useFormats();
  const locale = useLocale();
  const { refresh } = useDemo();
  const [retrying, setRetrying] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [retryError, setRetryError] = useState("");
  const {
    data = initialData,
    error,
    mutate,
  } = useSWR(`/api/research/${initialData.id}`, fetchRun, {
    fallbackData: initialData,
    // Fast at first, then slower for long runs (lib/research-progress.ts); stops once the run has finished. SWR asks for
    // the interval with its cache, which is empty until the first fetch (the page starts from the server's data), so
    // fall back to that data: otherwise polling never starts.
    refreshInterval: (latest) => {
      const run = latest ?? initialData;
      return ["pending", "running"].includes(run.status) ? pollInterval(run.created_at) : 0;
    },
    onSuccess: (latest) => {
      if (["completed", "failed"].includes(latest.status)) void refresh();
    },
  });
  const active = ["pending", "running"].includes(data.status);
  const verifying = data.configuration.brief.discovery_mode === "verify";
  // Run focus (WP-03); runs started before it have none.
  const focusAngles: string[] = data.configuration.brief.angles ?? [];
  const completed = data.status === "completed" && !!data.report;
  const ExecutionContainer = completed ? "details" : "section";
  const index = stages.indexOf(data.stage);
  const retrieval = retrievalProgress(data.steps, data.progress?.candidates ?? null);
  const retryable =
    data.status === "failed" &&
    data.retry_count < 1 &&
    [
      "TRANSIENT_PROVIDER",
      "WORKFLOW_INTERRUPTED",
      "DISPATCH_FAILED",
      "INVALID_OUTPUT",
      "RETRIEVAL_UNAVAILABLE",
    ].includes(data.error_code ?? "");
  async function retry() {
    setRetrying(true);
    setRetryError("");
    try {
      let result;
      try {
        // A retry is not idempotent, so it is never re-sent; after a dropped connection the run's own
        // status shows whether the retry was accepted.
        result = await postJson("/api/research", { action: "retry", id: data.id });
      } catch (error) {
        if (!(error instanceof ApiNetworkError)) throw error;
        const latest = await mutate().catch(() => undefined);
        void refresh();
        if (latest && ["pending", "running"].includes(latest.status)) return;
        throw new Error(feedbackSource("NETWORK_ERROR"));
      }
      if (!result.ok)
        throw new Error(feedbackSource(result.body.code, "RETRY_UNAVAILABLE"));
      await mutate();
      void refresh();
    } catch (error) {
      setRetryError(
        error instanceof Error
          ? error.message
          : feedbackSource(null, "RETRY_UNAVAILABLE"),
      );
    } finally {
      setRetrying(false);
    }
  }
  return (
    <>
      <Link
        href="/research"
        className="flex w-fit items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        {copy("Research history")}
      </Link>
      <PageHeader
        title={data.configuration.brief.name}
        description={copy(
          data.status === "completed"
            ? "Your saved research report can be reopened from history at any time."
            : "Progress reflects server records. Leaving this page does not stop the workflow.",
        )}
      >
        {completed && data.report && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href="#execution-details" onClick={() => setExecutionOpen(true)}>
                {copy("Execution details")}
              </a>
            </Button>
            <ExportButton
              kind="report"
              demo={false}
              briefOption
              printHref={`/research/${data.id}/print`}
              markdown={(includeBrief) => {
                const generatedAt = new Date();
                const report = data.report!;
                const text = reportToMarkdown(
                  { id: data.id, created_at: data.created_at, completed_at: data.completed_at, report, outcome: data.outcome },
                  { copy, locale, generatedAt, includeBrief, brief: data.configuration.brief },
                );
                return { fileName: exportFileName(includeBrief ? data.configuration.brief.name : copy("VentureLens research report"), generatedAt), text };
              }}
            />
          </div>
        )}
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <ModelTag model={data.report?.model ?? data.model?.model ?? null} provider={data.report ? data.report.provider ?? data.model?.provider : data.model?.provider} planned={!data.report && !!data.model?.planned} />
        {data.model?.used.length > 1 && (
          <span className="text-sm text-muted-foreground">
            {copy("Models used: {models}", { models: data.model.used.map((id) => (researchModels as Record<string, { name: string }>)[id]?.name ?? id).join(", ") })}
          </span>
        )}
      </div>
      {(focusAngles.length > 0 || data.configuration.brief.explore_new) && (
        <div className="flex flex-wrap items-center gap-2 text-sm" aria-label={copy("Run focus")}>
          <span className="text-muted-foreground">{copy("Run focus")}</span>
          {focusAngles.map((angle) => (
            <span key={angle} className="rounded-full border px-2.5 py-1">{copy(angle)}</span>
          ))}
          {data.configuration.brief.explore_new && (
            <span className="rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-primary">{copy("Explore something new")}</span>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-muted-foreground">
          {copy(
            "Research status could not refresh. Showing the last server record.",
          )}{" "}
          <button
            className="ml-2 min-h-11 underline"
            onClick={() => { void mutate().catch(() => undefined); }}
          >
            {copy("Refresh status")}
          </button>
        </p>
      )}
      {completed && data.report && <ResearchReportView report={data.report} />}
      {completed && data.outcome && <ResearchOutcomeView outcome={data.outcome} variant="completed" runId={data.id} />}
      {data.status === "failed" && data.error_code === "INSUFFICIENT_EVIDENCE" && data.outcome && (
        <ResearchOutcomeView outcome={data.outcome} variant="failed" runId={data.id} />
      )}
      {(completed || (data.status === "failed" && data.error_code === "INSUFFICIENT_EVIDENCE" && !!data.outcome)) && (
        <ReportRating runId={data.id} initial={rating} />
      )}
      <ExecutionContainer
        id="execution-details"
        open={completed ? executionOpen : undefined}
        onToggle={
          completed
            ? (event) => setExecutionOpen(event.currentTarget.open)
            : undefined
        }
        className="surface p-5 sm:p-6"
        aria-label={copy("Research progress")}
      >
        {completed && (
          <summary className="rounded-sm">
            <span className="ml-2 font-medium">
              {copy("Execution details")}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground sm:ml-6">
              {copy("Estimated known cost")}:{" "}
              {format.usd(data.usage.estimated_usd, 4)}
              {" · "}
              {copy("Search requests")}:{" "}
              {format.number(data.usage.search_requests)}
            </span>
          </summary>
        )}
        <div
          className={
            completed ? "flex flex-col gap-5 pt-5" : "flex flex-col gap-5"
          }
        >
          <div
            className="flex items-center gap-3"
            role="status"
            aria-live="polite"
          >
            {active && (
              <LoaderCircle className="size-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            )}
            <h2 className="text-lg font-semibold">
              {copy(
                data.status === "failed"
                  ? "Research incomplete"
                  : (stageLabels[data.stage] ?? "Queued"),
              )}
            </h2>
          </div>
          {active && (
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {copy((verifying ? verifyStageHints[data.stage] : undefined) ?? stageHints[data.stage] ?? stageHints.queued)}{" "}
              {data.progress?.estimateMinutes
                ? verifying
                  ? copy("Checks like this usually take about {minutes} minutes.", { minutes: data.progress.estimateMinutes })
                  : copy("Runs like this usually take about {minutes} minutes.", { minutes: data.progress.estimateMinutes })
                : verifying
                  ? copy("A check usually takes about 2–3 minutes (an estimate until enough checks have run).")
                  : copy("A full run usually takes 5–10 minutes.")}{" "}
              {emailOnFinish
                ? copy("You can leave this page. We'll email you when it's ready.")
                : copy("You can leave this page; progress is saved on the server.")}
            </p>
          )}
          {active && data.stage === "retrieval" && !verifying && retrieval.total !== null && (
            <p className="text-sm font-medium">
              {copy("Searching {current} of {total} candidates…", { current: Math.min(retrieval.done + 1, retrieval.total), total: retrieval.total })}
            </p>
          )}
          {active && data.progress && data.progress.sources.length > 0 && (
            <section aria-labelledby="live-sources-heading" className="flex flex-col gap-2">
              <h3 id="live-sources-heading" className="text-sm font-semibold">
                {copy("{count, plural, one {# source found so far} other {# sources found so far}}", { count: data.progress.sourceCount })}
              </h3>
              <ul className="flex flex-col gap-1.5 text-sm">
                {data.progress.sources.map((source, i) => (
                  <li key={`${source.domain}-${i}`} className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span className="min-w-0 break-words">{source.title}</span>
                    {source.domain && <span className="text-xs text-muted-foreground">{source.domain}</span>}
                  </li>
                ))}
              </ul>
              {data.progress.sourceCount > data.progress.sources.length && (
                <p className="text-xs text-muted-foreground">{copy("Showing the latest {count}. Every source is listed in the report.", { count: data.progress.sources.length })}</p>
              )}
            </section>
          )}
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stages.map((stage, i) => {
              const done =
                data.status === "completed" ||
                data.steps.some((s) => s.stage_key === stage) ||
                (stage === "retrieval" && index > i);
              const current = active && data.stage === stage;
              const Icon = done ? Check : current ? LoaderCircle : Circle;
              return (
                <li
                  key={stage}
                  aria-current={current ? "step" : undefined}
                  className="flex items-center gap-2 text-sm"
                >
                  <Icon
                    className={`size-4 shrink-0 ${done || current ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span>
                    {copy(stageLabels[stage])}
                    {stage === "retrieval" && (active || data.steps.some(s => s.stage_key.startsWith("retrieval:"))) && (
                      <span className="block text-muted-foreground">
                        {copy(
                          "{count, plural, one {# candidate retrieved} other {# candidates retrieved}}",
                          {
                            count: data.steps.filter((s) =>
                              s.stage_key.startsWith("retrieval:"),
                            ).length,
                          },
                        )}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          {data.status === "failed" && (
            <div className="flex flex-col gap-4" role="alert">
              <p className="leading-relaxed">
                {copy(
                  researchErrors[data.error_code ?? ""] ??
                    "The task stopped without generating a report.",
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.quota_released === false
                  ? copy("This run used one of your research runs because your account has reached its limit of returned failed runs. Retrying this run, where offered, does not use another one.")
                  : copy("This run did not use up a research run: your allowance was restored. A retry takes the slot again until it completes.")}
              </p>
              {data.error_code === "BUDGET_EXCEEDED" && (
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {data.budget_block?.kind === "estimate"
                    ? copy("A complete {model} run is estimated to need a budget of at least {required}, but this run's budget is {remaining}. The run stopped before sending any provider request.", { model: data.budget_block.model, required: format.usd(data.budget_block.required_usd, 2), remaining: format.usd(data.budget_block.remaining_usd, 2) })
                    : data.budget_block
                    ? copy("The next {model} request needed a {required} reservation, but only {remaining} remained. This request was not sent or charged.", { model: data.budget_block.model, required: format.usd(data.budget_block.required_usd, 4), remaining: format.usd(data.budget_block.remaining_usd, 4) })
                    : copy("A request can be blocked before the displayed limit is spent: its estimated reservation must fit within the remaining budget.")}
                  {" "}{copy("Ask an administrator to choose a lower-cost model before creating another run. Existing progress and costs remain saved.")}
                </p>
              )}
              {!retryable && (
                <Button variant="outline" className="w-fit" asChild>
                  <Link href="/research/new">{copy("New research")}</Link>
                </Button>
              )}
              {retryable && (
                <Button
                  variant="outline"
                  className="w-fit"
                  disabled={retrying}
                  onClick={retry}
                >
                  {copy(
                    retrying ? "Submitting…" : "Retry once from saved progress",
                  )}
                </Button>
              )}
              {retryError && <p>{copy(retryError)}</p>}
            </div>
          )}
          <dl className="grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">
                {copy("Estimated known cost")}
              </dt>
              <dd>{format.usd(data.usage.estimated_usd, 4)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {copy("Committed budget / limit")}
              </dt>
              <dd>
                {format.usd(data.usage.committed_usd, 4)} /{" "}
                {format.usd(data.usage.budget_usd)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {copy("Search requests")}
              </dt>
              <dd>{format.number(data.usage.search_requests)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{copy("Tokens")}</dt>
              <dd>
                {format.number(
                  data.usage.input_tokens + data.usage.output_tokens,
                )}
              </dd>
            </div>
          </dl>
          {!!data.usage.uncertain_calls && (
            <p className="text-sm text-muted-foreground">
              {copy(
                "Costs for {count} calls are unconfirmed; their budget remains reserved.",
                { count: data.usage.uncertain_calls },
              )}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {copy(
              "Excludes hosting and Workflow costs. No user balance is charged.",
            )}
          </p>
        </div>
      </ExecutionContainer>
    </>
  );
}
