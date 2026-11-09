"use client";
import type { WorkspaceOpportunity } from "@/lib/workspace-schema";
import { safeSourceUrl } from "@/lib/research-core";
import { useCopy, useFormats } from "@/i18n/use-copy";
export function OpportunityEvidence({
  opportunity: item,
}: {
  opportunity: WorkspaceOpportunity;
}) {
  const copy = useCopy();
  const format = useFormats();
  if (!item.evidence?.length) return null;
  return (
    <>
      <section className="surface flex flex-col gap-4 p-6">
        <h2 className="text-xl font-semibold">
          {copy("Evidence and original sources")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {copy(
            "These are webpage excerpts returned by retrieval services, not completed interviews or full due diligence.",
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {copy("Source excerpts are kept in their original language so you can verify them yourself.")}
        </p>
        {item.evidence.map((source) => {
          const url = safeSourceUrl(source.url);
          return (
            <article
              key={source.source_key}
              className="flex flex-col gap-3 rounded-xl bg-background/70 p-4 sm:p-5"
            >
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  {source.title}
                </a>
              ) : (
                <h3 className="font-medium">{source.title}</h3>
              )}
              <p className="break-all text-sm text-muted-foreground">
                {source.source_key} · {source.url}
              </p>
              {source.excerpt && (
                <blockquote className="whitespace-pre-wrap text-sm leading-relaxed">
                  {source.excerpt}
                </blockquote>
              )}
              <p className="text-sm text-muted-foreground">
                {copy("Retrieved: {date} UTC · Published: {published}", {
                  date: format.date(source.retrieved_at, true),
                  published: source.published_at ?? copy("Unknown"),
                })}
              </p>
            </article>
          );
        })}
      </section>
      <section className="surface flex flex-col gap-4 p-6">
        <h2 className="text-xl font-semibold">
          {copy("Scoring, assumptions, and adversarial review")}
        </h2>
        <p className="leading-relaxed">{item.rationale}</p>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          {item.assumptions?.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
        <p className="leading-relaxed">{item.critique}</p>
        <p className="text-sm text-muted-foreground">
          {copy("Review deduction: {points} points", {
            points: item.penalty ?? 0,
          })}
        </p>
        <h3 className="font-semibold">
          {copy("How to falsify this opportunity")}
        </h3>
        <p className="leading-relaxed">{item.falsification}</p>
        <h3 className="font-semibold">{copy("Next validation steps")}</h3>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          {item.validation?.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
