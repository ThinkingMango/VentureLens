"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Check, Circle, LoaderCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared";
import { useDemo } from "@/components/demo-provider";
import { ResearchReportView } from "@/components/research-report";
import { researchErrors, stageLabels } from "@/lib/research-core";
import type { ResearchDetail } from "@/lib/research-types";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { feedbackSource } from "@/i18n/errors";
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
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok)
    throw new Error(feedbackSource(data.code, "STATUS_UNAVAILABLE"));
  return data;
}
export function ResearchRunView({
  initialData,
}: {
  initialData: ResearchDetail;
}) {
  const copy = useCopy();
  const format = useFormats();
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
    refreshInterval: (latest) =>
      latest && ["pending", "running"].includes(latest.status) ? 3000 : 0,
    onSuccess: (latest) => {
      if (["completed", "failed"].includes(latest.status)) void refresh();
    },
  });
  const active = ["pending", "running"].includes(data.status);
  const completed = data.status === "completed" && !!data.report;
  const ExecutionContainer = completed ? "details" : "section";
  const index = stages.indexOf(data.stage);
  const retryable =
    data.status === "failed" &&
    data.retry_count < 1 &&
    ["TRANSIENT_PROVIDER", "WORKFLOW_INTERRUPTED", "DISPATCH_FAILED"].includes(
      data.error_code ?? "",
    );
  async function retry() {
    setRetrying(true);
    setRetryError("");
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", id: data.id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(feedbackSource(result.code, "RETRY_UNAVAILABLE"));
      await mutate();
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
        {completed && (
          <Button variant="outline" asChild>
            <a href="#execution-details" onClick={() => setExecutionOpen(true)}>
              {copy("Execution details")}
            </a>
          </Button>
        )}
      </PageHeader>
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
                  : (stageLabels[data.stage] ?? "等待处理"),
              )}
            </h2>
          </div>
          {active && (
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {copy(stageHints[data.stage] ?? stageHints.queued)}{" "}
              {copy("A full run usually takes 5–10 minutes. You can leave this page; progress is saved on the server.")}
            </p>
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
              {data.error_code === "BUDGET_EXCEEDED" && (
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {data.budget_block
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
