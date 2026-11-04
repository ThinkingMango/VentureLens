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
const stages = ["discovery", "retrieval", "classification", "evaluation", "scoring", "review", "finalizing"];
async function fetchRun(url: string): Promise<ResearchDetail> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "无法读取研究任务。");
  return data;
}
export function ResearchRunView({ initialData }: { initialData: ResearchDetail }) {
  const { refresh } = useDemo();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const { data = initialData, error, mutate } = useSWR(`/api/research/${initialData.id}`, fetchRun, {
    fallbackData: initialData,
    refreshInterval: (latest) => latest && ["pending", "running"].includes(latest.status) ? 3000 : 0,
    onSuccess: (latest) => { if (["completed", "failed"].includes(latest.status)) void refresh(); },
  });
  const active = ["pending", "running"].includes(data.status);
  const index = stages.indexOf(data.stage);
  const retryable = data.status === "failed" && data.retry_count < 1 && ["TRANSIENT_PROVIDER", "WORKFLOW_INTERRUPTED", "DISPATCH_FAILED"].includes(data.error_code ?? "");
  return <>
    <Link href="/research" className="flex w-fit items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />研究历史</Link>
    <PageHeader title={data.configuration.brief.name} description={data.status === "completed" ? "已保存的真实研究报告，可随时从历史记录重新打开。" : "进度来自服务器记录；离开页面不会中止工作流。"} />
    {error && <p role="alert" className="text-sm text-muted-foreground">{error.message} 正在显示最后一次记录。<button className="ml-2 underline" onClick={() => void mutate()}>重新读取</button></p>}
    <section className="surface flex flex-col gap-5 p-6" aria-label="研究进度">
      <div className="flex items-center gap-3" role="status" aria-live="polite">{active && <LoaderCircle className="size-5 animate-spin text-primary" />}<h2 className="text-lg font-semibold">{data.status === "failed" ? "研究未完成" : stageLabels[data.stage] ?? "等待处理"}</h2></div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stages.map((stage, i) => {
        const done = data.status === "completed" || data.steps.some(s => s.stage_key === stage) || (stage === "retrieval" && index > i);
        const current = active && data.stage === stage;
        const Icon = done ? Check : current ? LoaderCircle : Circle;
        return <li key={stage} aria-current={current ? "step" : undefined} className="flex items-center gap-2 text-sm"><Icon className={`size-4 shrink-0 ${done || current ? "text-primary" : "text-muted-foreground"}`} /><span>{stageLabels[stage]}{stage === "retrieval" && active && ` · ${data.steps.filter(s => s.stage_key.startsWith("retrieval:")).length} 个候选已检索`}</span></li>;
      })}</ol>
      {data.status === "failed" && <div className="flex flex-col gap-4" role="alert">
        <p className="leading-relaxed">{researchErrors[data.error_code ?? ""] ?? "任务已中止，未生成报告。"}</p>
        {retryable && <Button variant="outline" className="w-fit" disabled={retrying} onClick={async () => {
          setRetrying(true); setRetryError("");
          try {
            const response = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retry", id: data.id }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "重试失败。");
            await mutate();
          } catch (error) { setRetryError(error instanceof Error ? error.message : "重试失败。"); }
          finally { setRetrying(false); }
        }}>{retrying ? "提交中…" : "从已保存阶段重试一次"}</Button>}
        {retryError && <p>{retryError}</p>}
      </div>}
      <p className="text-sm leading-relaxed text-muted-foreground">已知估算费用 US${data.usage.estimated_usd.toFixed(4)} · 已占用预算 US${data.usage.committed_usd.toFixed(4)} / US${data.usage.budget_usd.toFixed(2)} · {data.usage.search_requests} 次检索 · {data.usage.input_tokens + data.usage.output_tokens} tokens{data.usage.uncertain_calls ? ` · ${data.usage.uncertain_calls} 次调用费用未确认，保留预算预留` : ""}。不包含托管及 Workflow 费用，不扣用户余额。</p>
    </section>
    {data.status === "completed" && data.report && <ResearchReportView report={data.report} />}
  </>;
}
