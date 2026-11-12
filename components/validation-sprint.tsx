"use client";
import { useId, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { feedbackSource } from "@/i18n/errors";
import { postJson } from "@/lib/api-client";
import {
  isOverdue, moveTask, sprintDay, sprintLengths, sprintProgress, sprintDecisions,
  type Sprint, type SprintDecision, type SprintLength, type SprintRequest, type SprintTask,
} from "@/lib/sprint-core";
import { Button } from "@/components/ui/button";
import { useOptionalWorkspace } from "@/components/demo-provider";
import { cn } from "@/lib/utils";

type Copy = ReturnType<typeof useCopy>;
const today = () => new Date().toISOString().slice(0, 10);
export function decisionLabel(copy: Copy, decision: SprintDecision) {
  switch (decision) {
    case "keep": return copy("Keep going");
    case "park": return copy("Park it");
    case "kill": return copy("Drop it");
  }
}
function decisionHelp(copy: Copy, decision: SprintDecision) {
  switch (decision) {
    case "keep": return copy("The evidence met your go criteria. Plan the next step.");
    case "park": return copy("Promising, but not now, or the evidence is mixed. Come back to it later.");
    case "kill": return copy("The evidence says no. Stop here and keep what you learned.");
  }
}

/**
 * Sends one sprint change and hands back the updated sprint. In the demo nothing is sent: a tick is applied locally and
 * anything else explains that the demo does not save.
 */
export function useSprintActions(demo: boolean, setSprint: (sprint: Sprint | null) => void, current: Sprint | null) {
  const copy = useCopy();
  const workspace = useOptionalWorkspace();
  const [busy, setBusy] = useState(false);
  async function send(request: SprintRequest): Promise<boolean> {
    if (demo) {
      if (request.action === "toggle_task" && current) {
        setSprint({ ...current, tasks: current.tasks.map((task) => task.id === request.task_id ? { ...task, done_at: request.done ? new Date().toISOString() : null } : task) });
        return true;
      }
      toast.info(copy("Demo workspace · Sprint changes are not saved."));
      return false;
    }
    if (busy) return false;
    setBusy(true);
    // A tick shows at once and is rolled back if it cannot be saved.
    const before = current;
    if (request.action === "toggle_task" && current) {
      setSprint({ ...current, tasks: current.tasks.map((task) => task.id === request.task_id ? { ...task, done_at: request.done ? new Date().toISOString() : null } : task) });
    }
    try {
      const result = await postJson("/api/sprints", request);
      if (!result.ok) {
        if (result.status === 401) window.location.assign("/login");
        if (request.action === "toggle_task") setSprint(before);
        toast.error(copy(feedbackSource(result.body.code)));
        return false;
      }
      setSprint(result.body.sprint as Sprint);
      // The dashboard's "Your active sprint" card reads the workspace, so refresh it in the background.
      void workspace?.refresh().catch(() => undefined);
      return true;
    } catch {
      if (request.action === "toggle_task") setSprint(before);
      toast.error(copy(feedbackSource("SAVE_FAILED")));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { send, busy };
}

/** "Start a 7 / 14 / 30-day sprint" for an opportunity without an active sprint. */
export function SprintStarter({ onStart, busy, previous }: { onStart: (length: SprintLength) => void; busy: boolean; previous: Sprint | null }) {
  const copy = useCopy();
  const format = useFormats();
  const [length, setLength] = useState<SprintLength>(14);
  const name = useId();
  return (
    <section aria-labelledby="sprint-start-heading" className="flex flex-col gap-4 rounded-xl border bg-background/70 p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h3 id="sprint-start-heading" className="font-semibold">{copy("Start a validation sprint")}</h3>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {copy("Turn these steps into a short plan with due dates, decide what result would mean go, and record your decision at the end.")}
        </p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{copy("Sprint length")}</legend>
        <div className="flex flex-wrap gap-2">
          {sprintLengths.map((days) => (
            <label key={days} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary">
              <input type="radio" name={name} value={days} checked={length === days} onChange={() => setLength(days)} className="size-4" />
              {copy("{days} days", { days })}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="button" className="w-fit" disabled={busy} onClick={() => onStart(length)}>{copy("Start the sprint")}</Button>
      {previous && previous.status !== "active" && (
        <p className="text-sm text-muted-foreground">
          {previous.decision
            ? copy("Your last sprint ended with: {decision}.", { decision: decisionLabel(copy, previous.decision) })
            : copy("Your last sprint, started on {date}, ended without a decision.", { date: format.date(previous.started_on) })}
        </p>
      )}
    </section>
  );
}

function TaskEditor({ task, onSave, onCancel, busy }: { task?: SprintTask; onSave: (values: { title: string; detail: string; due_on: string | null }) => void; onCancel: () => void; busy: boolean }) {
  const copy = useCopy();
  const [title, setTitle] = useState(task?.title ?? "");
  const [detail, setDetail] = useState(task?.detail ?? "");
  const [due, setDue] = useState(task?.due_on ?? "");
  const id = useId();
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim()) onSave({ title: title.trim(), detail: detail.trim(), due_on: due || null });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium" htmlFor={`${id}-title`}>
        {copy("Task")}
        <input id={`${id}-title`} className="field-select font-normal" value={title} maxLength={300} required onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium" htmlFor={`${id}-detail`}>
        <span>{copy("Notes")} <span className="font-normal text-muted-foreground">{copy("(optional)")}</span></span>
        <textarea id={`${id}-detail`} className="field-select min-h-16 resize-y font-normal" value={detail} maxLength={1000} onChange={(event) => setDetail(event.target.value)} />
      </label>
      <label className="flex w-fit flex-col gap-1 text-sm font-medium" htmlFor={`${id}-due`}>
        <span>{copy("Due date")} <span className="font-normal text-muted-foreground">{copy("(optional)")}</span></span>
        <input id={`${id}-due`} type="date" className="field-select font-normal" value={due} onChange={(event) => setDue(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !title.trim()}>{task ? copy("Save task") : copy("Add task")}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>{copy("Cancel")}</Button>
      </div>
    </form>
  );
}

/** The active sprint, or a finished one read-only: tasks, progress, go criteria and the decision. */
export function SprintPanel({ sprint, send, busy, demo }: { sprint: Sprint; send: (request: SprintRequest) => Promise<boolean>; busy: boolean; demo: boolean }) {
  const copy = useCopy();
  const format = useFormats();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [criteria, setCriteria] = useState(sprint.go_criteria);
  const [decision, setDecision] = useState<SprintDecision | null>(null);
  const [note, setNote] = useState("");
  const decisionName = useId();
  const active = sprint.status === "active";
  const now = today();
  const progress = sprintProgress(sprint.tasks);
  const day = sprintDay(sprint, now);
  return (
    <section aria-labelledby="sprint-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 id="sprint-heading" className="text-lg font-semibold">
          {copy("{days}-day validation sprint", { days: sprint.length_days })}
        </h3>
        <p className="text-sm text-muted-foreground">
          {active
            ? copy("Day {day} of {days} · started {date}", { day, days: sprint.length_days, date: format.date(sprint.started_on) })
            : sprint.decision
              ? copy("Finished · decision: {decision}", { decision: decisionLabel(copy, sprint.decision) })
              : copy("Ended without a decision")}
        </p>
        <div className="flex items-center gap-3">
          <progress className="h-2 w-full accent-primary" value={progress.done} max={Math.max(1, progress.total)} aria-label={copy("Sprint tasks complete")} />
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground" aria-live="polite">
            {copy("{count} of {total} tasks done", { count: progress.done, total: progress.total })}
          </span>
        </div>
        {demo && <p className="text-sm text-muted-foreground">{copy("Example sprint · Ticks reset on refresh, and nothing else is saved in the demo.")}</p>}
      </div>

      <ol className="flex flex-col">
        {sprint.tasks.map((task, index) => {
          const overdue = active && isOverdue(task, now);
          if (editing === task.id) {
            return (
              <li key={task.id} className="border-b py-3">
                <TaskEditor task={task} busy={busy} onCancel={() => setEditing(null)} onSave={async (values) => {
                  if (await send({ action: "edit_task", task_id: task.id, ...values })) setEditing(null);
                }} />
              </li>
            );
          }
          return (
            <li key={task.id} className="flex items-start gap-3 border-b py-4 last:border-0">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0"
                checked={!!task.done_at}
                disabled={!active || busy}
                aria-label={copy("Done: {task}", { task: task.title })}
                onChange={(event) => void send({ action: "toggle_task", task_id: task.id, done: event.currentTarget.checked })}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={cn("break-words font-medium", task.done_at && "text-muted-foreground line-through")}>{task.title}</span>
                {task.detail && <span className="whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">{task.detail}</span>}
                {task.due_on && (
                  <span className={cn("flex items-center gap-1 text-xs", overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    {overdue ? copy("Overdue · due {date}", { date: format.date(task.due_on) }) : copy("Due {date}", { date: format.date(task.due_on) })}
                  </span>
                )}
              </div>
              {active && (
                <div className="-ml-3 flex shrink-0 items-center sm:ml-0">
                  <Button type="button" variant="ghost" size="icon" disabled={busy || index === 0} aria-label={copy("Move up: {task}", { task: task.title })}
                    onClick={() => { const ids = moveTask(sprint.tasks, task.id, "up"); if (ids) void send({ action: "reorder", sprint_id: sprint.id, task_ids: ids }); }}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={busy || index === sprint.tasks.length - 1} aria-label={copy("Move down: {task}", { task: task.title })}
                    onClick={() => { const ids = moveTask(sprint.tasks, task.id, "down"); if (ids) void send({ action: "reorder", sprint_id: sprint.id, task_ids: ids }); }}>
                    <ArrowDown />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={copy("Edit: {task}", { task: task.title })} onClick={() => setEditing(task.id)}>
                    <Pencil />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={copy("Delete: {task}", { task: task.title })}
                    onClick={() => { if (window.confirm(copy("Delete this task?"))) void send({ action: "delete_task", task_id: task.id }); }}>
                    <Trash2 />
                  </Button>
                </div>
              )}
              </div>
            </li>
          );
        })}
      </ol>
      {active && (adding ? (
        <TaskEditor busy={busy} onCancel={() => setAdding(false)} onSave={async (values) => {
          if (await send({ action: "add_task", sprint_id: sprint.id, ...values })) setAdding(false);
        }} />
      ) : (
        <Button type="button" variant="outline" className="w-fit" disabled={busy} onClick={() => setAdding(true)}>
          <Plus data-icon="inline-start" />
          {copy("Add a task")}
        </Button>
      ))}

      <section aria-labelledby="go-criteria-heading" className="flex flex-col gap-2 border-t pt-5">
        <h4 id="go-criteria-heading" className="font-semibold">{copy("Go / no-go criteria")}</h4>
        <p className="text-sm text-muted-foreground">{copy("Decide now what result would make this worth continuing, so the end of the sprint is a check, not a mood.")}</p>
        {active ? (
          <form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); void send({ action: "criteria", sprint_id: sprint.id, go_criteria: criteria }); }}>
            <textarea
              className="field-select min-h-20 resize-y"
              aria-labelledby="go-criteria-heading"
              value={criteria}
              maxLength={1000}
              placeholder={copy("Example: at least 3 of 10 owners I interview describe this problem unprompted, and 2 agree to a paid pilot.")}
              onChange={(event) => setCriteria(event.target.value)}
            />
            <Button type="submit" variant="outline" className="w-fit" disabled={busy || criteria.trim() === sprint.go_criteria}>{copy("Save criteria")}</Button>
          </form>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{sprint.go_criteria || copy("No criteria were written down.")}</p>
        )}
      </section>

      <section aria-labelledby="decision-heading" className="flex flex-col gap-3 border-t pt-5">
        <h4 id="decision-heading" className="font-semibold">{copy("Decision")}</h4>
        {active ? (
          <form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); if (decision) void send({ action: "decide", sprint_id: sprint.id, decision, note }); }}>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm text-muted-foreground">{copy("When the sprint is done, record what you decided. This ends the sprint.")}</legend>
              {sprintDecisions.map((value) => (
                <label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-[:checked]:border-primary">
                  <input type="radio" name={decisionName} value={value} checked={decision === value} onChange={() => setDecision(value)} className="mt-0.5 size-4" />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{decisionLabel(copy, value)}</span>
                    <span className="text-muted-foreground">{decisionHelp(copy, value)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>{copy("What did you learn?")} <span className="font-normal text-muted-foreground">{copy("(optional)")}</span></span>
              <textarea className="field-select min-h-20 resize-y font-normal" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy || !decision}>{copy("Record decision")}</Button>
              <Button type="button" variant="ghost" disabled={busy}
                onClick={() => { if (window.confirm(copy("End this sprint without a decision? Its tasks stay visible."))) void send({ action: "abandon", sprint_id: sprint.id }); }}>
                {copy("End without a decision")}
              </Button>
            </div>
          </form>
        ) : sprint.decision ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium">{decisionLabel(copy, sprint.decision)}</p>
            {sprint.decision_note && <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{sprint.decision_note}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{copy("Ended without a decision")}</p>
        )}
      </section>
    </section>
  );
}
