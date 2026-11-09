"use client";
import { useCopy } from "@/i18n/use-copy";
import { scoreBands } from "@/lib/report-presentation";
import { REVIEW_MAX_PENALTY } from "@/lib/research-core";

// How to read a score. Scores are strict on purpose, so without this a promising 55 reads as a failing grade.
/** `methodology` is the report's own: reports scored under v1 rules are described by those rules. */
export function ScoreScale({ methodology }: { methodology?: string }) {
  const copy = useCopy();
  return (
    <section aria-labelledby="score-scale-title" className="flex flex-col gap-3 rounded-xl bg-secondary/60 p-4">
      <h2 id="score-scale-title" className="text-sm font-semibold">
        {copy("How to read these scores")}
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {methodology === "evidence-driven-v1"
          ? copy(
              "This report was scored under earlier, stricter rules: the adversarial review could deduct up to 30 points, including again for evidence gaps the ratings already reflected. Its scores run lower than newer reports.",
            )
          : copy(
              "Each score starts from five ratings that are lowered where evidence is missing. The adversarial review then deducts up to {points} points for risks the ratings missed, and the score is capped at 70, or 85 with three or more independent supporting sources. A score in the 50s is a promising, still unvalidated opportunity.",
              { points: REVIEW_MAX_PENALTY },
            )}
      </p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {scoreBands.map((band, index) => (
          <div key={band.key} className="flex flex-col gap-0.5">
            <dt className="font-medium">
              {index === 0
                ? copy("{min}+ · {label}", { min: band.min, label: copy(band.label) })
                : index === scoreBands.length - 1
                  ? copy("Below {max} · {label}", { max: scoreBands[index - 1].min, label: copy(band.label) })
                  : copy("{min}–{max} · {label}", { min: band.min, max: scoreBands[index - 1].min - 1, label: copy(band.label) })}
            </dt>
            <dd className="text-muted-foreground">{copy(band.meaning)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
