"use client";
import { OpportunityCard } from "@/components/opportunity-card";
import type { ResearchReport } from "@/lib/research-types";
import { useCopy, useFormats } from "@/i18n/use-copy";
const dimensions: Record<string, string> = {
  pain: "Buyer pain",
  demand: "Demand",
  economics: "Unit economics",
  feasibility: "Delivery feasibility",
  advantage: "Founder advantage",
};
export function ResearchReportView({ report }: { report: ResearchReport }) {
  const copy = useCopy();
  const format = useFormats();
  return (
    <>
      <section className="surface flex flex-col gap-4 p-6">
        <h2 className="text-xl font-semibold">
          {copy("Conclusions and research boundaries")}
        </h2>
        <p className="leading-relaxed">{report.summary}</p>
        <p className="text-sm text-muted-foreground">
          {copy(
            "Saved research stays in its original language. Changing the interface never regenerates or translates reports and original sources.",
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {report.model} · {format.date(report.generated_at, true)} UTC
        </p>
        <details className="border-t pt-4">
          <summary className="font-medium">
            {copy("Methodology, weights, and limitations")}
          </summary>
          <div className="flex flex-col gap-4 pt-4">
            <p className="text-sm">{report.methodology}</p>
            <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              {report.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <dl className="flex flex-wrap gap-5">
              {Object.entries(report.weights).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm text-muted-foreground">
                    {copy(dimensions[key] ?? key)}
                  </dt>
                  <dd>{format.number(value, { style: "percent" })}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">
              {copy(
                "Scores are capped at 70 with limited evidence and 85 otherwise. Adversarial review can only deduct points.",
              )}
            </p>
          </div>
        </details>
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        {report.opportunities.map((item) => (
          <OpportunityCard key={item.id} opportunity={item} />
        ))}
      </div>
    </>
  );
}
