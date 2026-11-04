"use client";
import { OpportunityCard } from "@/components/opportunity-card";
import type { ResearchReport } from "@/lib/research-types";
export function ResearchReportView({ report }: { report: ResearchReport }) {
  return <>
    <section className="surface flex flex-col gap-4 p-6">
      <h2 className="text-xl font-semibold">研究结论与边界</h2>
      <p className="leading-relaxed">{report.summary}</p>
      <p className="text-sm text-muted-foreground">{report.methodology} · {report.model} · {new Date(report.generated_at).toLocaleString("zh-CN")}</p>
      <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">{report.limitations.map(item => <li key={item}>{item}</li>)}</ul>
      <p className="text-sm text-muted-foreground">权重：{Object.entries(report.weights).map(([key, value]) => `${({pain:"痛点",demand:"需求",economics:"单位经济",feasibility:"交付可行性",advantage:"创始人优势"} as Record<string,string>)[key] ?? key} ${Math.round(value * 100)}%`).join(" · ")}。证据较少的机会最高 70 分，其余最高 85 分；反向审查仅能扣分。</p>
    </section>
    <div className="grid gap-5 md:grid-cols-2">{report.opportunities.map(item => <OpportunityCard key={item.id} opportunity={item} />)}</div>
  </>;
}
