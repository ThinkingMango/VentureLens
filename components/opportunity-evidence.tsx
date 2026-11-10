"use client";
import type { WorkspaceOpportunity } from "@/lib/workspace-schema";
import { safeSourceUrl } from "@/lib/research-core";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { citationNumbers, claimsBySection, sourceAnchor, type claimSectionOrder } from "@/lib/report-presentation";

type Copy = ReturnType<typeof useCopy>;
function sectionTitle(copy: Copy, section: (typeof claimSectionOrder)[number]) {
  switch (section) {
    case "buyer": return copy("Buyer");
    case "pain": return copy("Pain");
    case "demand": return copy("Demand");
    case "competition": return copy("Competition");
    case "economics": return copy("Economics");
    case "risk": return copy("Risk");
  }
}
/**
 * Methodology v3 (WP-07): what the research claims, section by section, each claim with numbered chips that jump to the
 * source cards below. Opportunities from earlier methodologies have no claims, and this renders nothing for them.
 */
function OpportunityClaims({ opportunity: item, numbers }: { opportunity: WorkspaceOpportunity; numbers: Map<string, number> }) {
  const copy = useCopy();
  const groups = claimsBySection(item.claims);
  if (!groups.length) return null;
  const titles = new Map((item.evidence ?? []).map((source) => [source.source_key, source.title]));
  return (
    <section aria-labelledby="claims-heading" className="surface flex flex-col gap-4 p-6">
      <h2 id="claims-heading" className="text-xl font-semibold">{copy("What the research claims")}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {copy("Each claim links to the sources it rests on. Inferences are the research model's reasoning; assumptions are not backed by a source yet.")}
      </p>
      {groups.map((group) => (
        <div key={group.section} className="flex flex-col gap-2">
          <h3 className="font-semibold">{sectionTitle(copy, group.section)}</h3>
          <ul className="flex flex-col gap-3">
            {group.claims.map((claim, index) => (
              <li key={`${group.section}-${index}`} className="flex flex-col gap-1 text-sm leading-relaxed">
                <p>
                  {claim.kind !== "observed" && (
                    <span className={claim.kind === "assumption" ? "mr-2 rounded bg-warm-soft px-1.5 py-0.5 text-xs font-semibold" : "mr-2 rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold"}>
                      {claim.kind === "assumption" ? copy("Assumption") : copy("Inference")}
                    </span>
                  )}
                  {claim.text}
                  {claim.source_keys.map((key) => {
                    const number = numbers.get(key);
                    if (!number) return null;
                    return (
                      <a
                        key={key}
                        href={`#${sourceAnchor(key)}`}
                        className="ml-1 inline-flex min-h-6 min-w-6 items-center justify-center rounded px-1 align-baseline text-xs font-semibold text-primary underline-offset-2 hover:underline"
                        aria-label={copy("Source {number}: {title}", { number, title: titles.get(key) ?? key })}
                      >
                        [{number}]
                      </a>
                    );
                  })}
                </p>
                {claim.kind === "assumption" && claim.confirm && (
                  <p className="text-muted-foreground">{copy("To confirm: {hint}", { hint: claim.confirm })}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
export function OpportunityEvidence({
  opportunity: item,
}: {
  opportunity: WorkspaceOpportunity;
}) {
  const copy = useCopy();
  const format = useFormats();
  if (!item.evidence?.length) return null;
  const numbers = citationNumbers(item.evidence);
  return (
    <>
      <OpportunityClaims opportunity={item} numbers={numbers} />
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
              id={sourceAnchor(source.source_key)}
              tabIndex={-1}
              className="flex scroll-mt-24 flex-col gap-3 rounded-xl bg-background/70 p-4 transition-shadow target:ring-2 target:ring-primary sm:p-5"
            >
              {source.stance === "contradicts" && (
                // Counter-evidence is kept visible but must never read as support for the opportunity.
                <p className="w-fit rounded-md bg-warm-soft px-2 py-1 text-xs font-semibold text-foreground">
                  {copy("Counter-evidence: this source contradicts the opportunity")}
                </p>
              )}
              <div className="flex items-baseline gap-2">
                <span className="shrink-0 text-sm font-semibold text-muted-foreground" aria-hidden="true">
                  [{numbers.get(source.source_key)}]
                </span>
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
              </div>
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
