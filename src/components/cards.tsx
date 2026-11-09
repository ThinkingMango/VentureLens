import { Link } from "@tanstack/react-router";
import { Chip, Meter, ScoreMark } from "@/components/ui";
import type { Opportunity } from "@/lib/model";
import { fitNotes, openTask, type Profile } from "@/lib/model";

export function OppCard({
  opp,
  profile,
  compare,
  selected,
  onCompare,
}: {
  opp: Opportunity;
  profile: Profile;
  compare?: boolean;
  selected?: boolean;
  onCompare?: () => void;
}) {
  const note = fitNotes(opp, profile)[0];
  const task = openTask(opp);
  return (
    <article className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/opportunities/$id"
            params={{ id: opp.id }}
            className="font-display text-2xl leading-tight tracking-tight"
          >
            {opp.title}
          </Link>
          <p className="mt-2 text-sm text-muted">{opp.buyer}</p>
        </div>
        <div className="text-right">
          <ScoreMark score={opp.score} />
          <p className="mt-1 text-sm text-faint">of 100</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip>{opp.confidence} evidence</Chip>
        <Chip tone={opp.status === "killed" ? "bad" : opp.status === "paused" ? "warn" : "good"}>
          {opp.status === "testing" ? "In testing" : opp.status === "paused" ? "Paused" : "Killed"}
        </Chip>
      </div>
      <p className="mt-3 text-sm text-muted">{note}</p>
      {task ? (
        <p className="mt-3 border-t border-line pt-3 text-sm">
          <span className="text-faint">Next · </span>
          {task.label}
        </p>
      ) : null}
      <Meter score={opp.score} className="mt-4" />
      {compare ? (
        <button
          type="button"
          onClick={onCompare}
          aria-pressed={selected}
          className="mt-4 min-h-11 text-sm font-medium text-accent"
        >
          {selected ? "Remove from compare" : "Add to compare"}
        </button>
      ) : null}
    </article>
  );
}
