import type { WorkspaceOpportunity } from "@/lib/workspace-schema";
import { safeSourceUrl } from "@/lib/research-core";
export function OpportunityEvidence({ opportunity: item }: { opportunity: WorkspaceOpportunity }) {
  if (!item.evidence?.length) return null;
  return <>
    <section className="surface flex flex-col gap-4 p-6">
      <h2 className="text-xl font-semibold">证据与来源</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{item.confidence}。以下是检索服务返回的网页摘录，不代表已完成访谈或全文尽调。</p>
      {item.evidence.map(source => {
        const url = safeSourceUrl(source.url);
        return <article key={source.source_key} className="flex flex-col gap-2 border-t pt-4">
          {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">{source.title}</a> : <h3 className="font-medium">{source.title}</h3>}
          <p className="break-all text-sm text-muted-foreground">{source.source_key} · {source.url}</p>
          <blockquote className="whitespace-pre-wrap text-sm leading-relaxed">{source.excerpt}</blockquote>
          <p className="text-sm text-muted-foreground">检索时间：{new Date(source.retrieved_at).toLocaleString("zh-CN")} · 发布日期：{source.published_at ?? "未知"}</p>
        </article>;
      })}
    </section>
    <section className="surface flex flex-col gap-4 p-6">
      <h2 className="text-xl font-semibold">评分、假设与反向审查</h2>
      <p className="leading-relaxed">{item.rationale}</p>
      <ul className="flex flex-col gap-2 text-sm leading-relaxed">{item.assumptions?.map(text => <li key={text}>{text}</li>)}</ul>
      <p className="leading-relaxed">{item.critique}（扣除 {item.penalty ?? 0} 分）</p>
      <h3 className="font-semibold">如何证伪这个机会</h3><p className="leading-relaxed">{item.falsification}</p>
      <h3 className="font-semibold">下一步验证</h3>
      <ul className="flex flex-col gap-2 text-sm leading-relaxed">{item.validation?.map(text => <li key={text}>{text}</li>)}</ul>
    </section>
  </>;
}
