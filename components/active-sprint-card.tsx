"use client";
import Link from "@/components/workspace-link";
import { ArrowRight, CalendarDays, Target } from "lucide-react";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { Button } from "@/components/ui/button";
import { isOverdue, sprintDay, type ActiveSprintSummary } from "@/lib/sprint-core";
import { cn } from "@/lib/utils";

/** "Your active sprint" (WP-10): the newest active validation sprint, its progress and next three tasks. */
export function ActiveSprintCard({ sprint, others = 0 }: { sprint: ActiveSprintSummary; others?: number }) {
  const copy = useCopy();
  const format = useFormats();
  const today = new Date().toISOString().slice(0, 10);
  const day = sprintDay({ started_on: sprint.startedOn, length_days: sprint.lengthDays as 7 | 14 | 30 }, today);
  const href = `/opportunities/${sprint.opportunityId}?tab=validation`;
  return (
    <section aria-labelledby="active-sprint-heading" className="surface flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="size-5 text-primary" aria-hidden="true" />
          <h2 id="active-sprint-heading" className="text-lg font-semibold">{copy("Your active sprint")}</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {copy("Day {day} of {days} · {count} of {total} tasks done", { day, days: sprint.lengthDays, count: sprint.done, total: sprint.total })}
        </span>
      </div>
      <p className="font-medium">{sprint.opportunityTitle}</p>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${sprint.total ? (sprint.done / sprint.total) * 100 : 0}%` }} />
      </div>
      {sprint.next.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{copy("Next up")}</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {sprint.next.map((task) => {
              const overdue = isOverdue({ due_on: task.due_on, done_at: null }, today);
              return (
                <li key={task.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 break-words">{task.title}</span>
                  {task.due_on && (
                    <span className={cn("flex shrink-0 items-center gap-1 text-xs", overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      {overdue ? copy("Overdue · due {date}", { date: format.date(task.due_on) }) : copy("Due {date}", { date: format.date(task.due_on) })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{copy("Every task is done. Record your decision to finish the sprint.")}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" className="w-fit">
          <Link href={href}>
            {copy("Open the sprint")}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
        {others > 0 && (
          <span className="text-sm text-muted-foreground">
            {copy("{count, plural, one {# other active sprint} other {# other active sprints}}", { count: others })}
          </span>
        )}
      </div>
    </section>
  );
}
