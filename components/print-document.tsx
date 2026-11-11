import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/report-export";
import type { ExportFact, ExportOpportunity, ExportReport } from "@/lib/report-export";

// The print views (spec WP-11): a report or an opportunity as a plain document, rendered on the server from the same
// export document as the Markdown download. No app navigation; print CSS (globals.css, `.print-doc`) starts each
// opportunity on a new page and prints each link's URL beside its text. Saving as PDF is the browser's own print dialog.

type Level = 1 | 2 | 3 | 4 | 5 | 6;
function Heading({ level, children, className }: { level: number; children: ReactNode; className?: string }) {
  const Tag = `h${Math.min(6, Math.max(1, level)) as Level}` as const;
  return <Tag className={className}>{children}</Tag>;
}
function Facts({ items }: { items: ExportFact[] }) {
  if (!items.length) return null;
  return (
    <dl className="print-facts">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).filter((part) => part.trim()).map((part, index) => (
        <p key={index}>{part}</p>
      ))}
    </>
  );
}

export function PrintToolbar({ backHref, backLabel, hint }: { backHref: string; backLabel: string; hint: string }) {
  return (
    <div className="print-hide mb-8 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
      <a href={backHref} className="flex min-h-11 w-fit items-center gap-2 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </a>
      <div className="flex flex-col gap-2 sm:items-end">
        <PrintButton />
        <p className="text-sm text-muted-foreground sm:text-right">{hint}</p>
      </div>
    </div>
  );
}

export function OpportunityDocument({ op, level = 1, label }: { op: ExportOpportunity; level?: number; label?: string }) {
  return (
    <>
      <Heading level={level} className={level === 1 ? "print-title" : "print-opportunity-title"}>
        {label ? `${label} ${op.title}` : op.title}
      </Heading>
      {op.description && <Paragraphs text={op.description} />}
      <Facts items={op.facts} />
      <p className="print-verdict">
        <strong>{op.verdict.label} · {op.verdict.score}</strong>: {op.verdict.meaning}
      </p>
      {op.rationale && <Paragraphs text={op.rationale} />}
      <Heading level={level + 1}>{op.pain.heading}</Heading>
      <Paragraphs text={op.pain.text} />
      <Heading level={level + 1}>{op.dimensions.heading}</Heading>
      <Facts items={op.dimensions.items} />
      {op.breakdown && (
        <>
          <Heading level={level + 2}>{op.breakdown.heading}</Heading>
          <Facts items={op.breakdown.items} />
          {op.breakdown.note && <p className="print-note">{op.breakdown.note}</p>}
        </>
      )}
      {op.claims && (
        <>
          <Heading level={level + 1}>{op.claims.heading}</Heading>
          {op.claims.groups.map((group) => (
            <section key={group.title}>
              <Heading level={level + 2}>{group.title}</Heading>
              <ul>
                {group.claims.map((claim, index) => (
                  <li key={index}>
                    <strong>{claim.kind}:</strong> {claim.text}
                    {claim.citations.length > 0 && <span className="print-cites"> {claim.citations.map((n) => `[${n}]`).join("")}</span>}
                    {claim.confirm && <p className="print-note">{claim.confirm}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
      {op.assumptions && (
        <>
          <Heading level={level + 1}>{op.assumptions.heading}</Heading>
          <ul>
            {op.assumptions.items.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </>
      )}
      <Heading level={level + 1}>{op.economics.heading}</Heading>
      <Facts items={op.economics.items} />
      <Heading level={level + 1}>{op.risk.heading}</Heading>
      <Paragraphs text={op.risk.text} />
      {op.risk.review.map((item) => (
        <section key={item.label}>
          <Heading level={level + 2}>{item.label}</Heading>
          <Paragraphs text={item.value} />
        </section>
      ))}
      {op.validation && (
        <>
          <Heading level={level + 1}>{op.validation.heading}</Heading>
          <ol>
            {op.validation.items.map((item, index) => <li key={index}>{item}</li>)}
          </ol>
        </>
      )}
      {op.sources && (
        <>
          <Heading level={level + 1}>{op.sources.heading}</Heading>
          <p className="print-note">{op.sources.note}</p>
          <ol className="print-sources">
            {op.sources.items.map((source) => (
              <li key={source.number} value={source.number}>
                <p>
                  <strong>[{source.number}]</strong>{" "}
                  {source.url ? <a href={source.url} rel="noopener noreferrer">{source.title}</a> : source.title}
                </p>
                {source.details.length > 0 && <p className="print-note">{source.details.join(" · ")}</p>}
                {source.quote && <blockquote>{source.quote}</blockquote>}
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="print-note print-footer">{op.footer}</p>
    </>
  );
}

export function ReportDocument({ doc }: { doc: ExportReport }) {
  return (
    <>
      <header>
        <h1 className="print-title">{doc.title}</h1>
        <p className="print-note">{doc.generatedOn}</p>
        <Facts items={doc.facts} />
      </header>
      {doc.verdict && (
        <section>
          <h2>{doc.verdict.title}</h2>
          <Paragraphs text={doc.verdict.text} />
        </section>
      )}
      {doc.summary && (
        <section>
          <h2>{doc.summary.heading}</h2>
          <Paragraphs text={doc.summary.text} />
        </section>
      )}
      {doc.limitations && (
        <section>
          <h2>{doc.limitations.heading}</h2>
          <ul>
            {doc.limitations.items.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </section>
      )}
      {doc.brief && (
        <section>
          <h2>{doc.brief.heading}</h2>
          <Facts items={doc.brief.items} />
        </section>
      )}
      {doc.notPassed && (
        <section>
          <h2>{doc.notPassed.heading}</h2>
          <ul>
            {doc.notPassed.items.map((item, index) => (
              <li key={index}>
                <strong>{item.title}</strong> ({item.buyer}): {item.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
      {doc.opportunities.map((op, index) => (
        <section key={op.id} className="print-break">
          {/* Inside the first opportunity's page, so the heading never ends a page on its own. */}
          {index === 0 && <h2>{doc.opportunitiesHeading}</h2>}
          <OpportunityDocument op={op} level={3} label={`${index + 1}.`} />
        </section>
      ))}
    </>
  );
}
