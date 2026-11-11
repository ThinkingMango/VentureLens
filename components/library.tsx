"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CircleStop, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDemo } from "@/components/demo-provider";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { feedbackSource } from "@/i18n/errors";
import { scoreBands } from "@/lib/report-presentation";
import {
  DELETE_CONFIRMATION,
  activeFilterCount,
  defaultFilters,
  deleteConfirmed,
  discoveryModeOptions,
  scoreRangeKeys,
  type LibraryFilters,
  type RunInfo,
} from "@/lib/library-core";

// The library (spec WP-12): archive with undo, filters for the results and saved lists, and deleting a run.

const UNDO_MS = 7000;
const modeLabels = {
  founder: "Founder-led discovery",
  market: "Market-led discovery",
  combined: "Founder + market discovery",
  verify: "Idea check",
} as const;

/** Archive or restore an opportunity. Archiving offers Undo for a few seconds; a failure rolls back and says so. */
export function useArchive() {
  const copy = useCopy();
  const { setArchived } = useDemo();
  return async function change(item: { id: string; title: string }, archived: boolean) {
    try {
      await setArchived(item.id, archived);
      if (archived) {
        toast.success(copy("Archived “{title}”.", { title: item.title }), {
          duration: UNDO_MS,
          action: { label: copy("Undo"), onClick: () => void change(item, false) },
        });
      } else {
        toast.success(copy("Restored “{title}”.", { title: item.title }));
      }
    } catch (error) {
      toast.error(copy(error instanceof Error ? error.message : "Your change could not be saved."));
    }
  };
}

/** The archive control on a card or the opportunity page. Hidden in the demo, whose sample cannot be changed. */
export function ArchiveButton({ opportunity, compact = false }: { opportunity: { id: string; title: string }; compact?: boolean }) {
  const copy = useCopy();
  const { isDemo, data } = useDemo();
  const change = useArchive();
  if (isDemo) return null;
  // Read from the workspace, so the card and the opportunity page agree as soon as either changes it.
  const archived = !!data?.opportunities.find((item) => item.id === opportunity.id)?.archived_at;
  const label = archived ? copy("Restore {title}", { title: opportunity.title }) : copy("Archive {title}", { title: opportunity.title });
  const Icon = archived ? ArchiveRestore : Archive;
  return compact ? (
    <Button variant="ghost" size="icon" className="-mr-2 -mt-2 shrink-0" aria-label={label} title={label} onClick={() => void change(opportunity, !archived)}>
      <Icon className="text-muted-foreground" />
    </Button>
  ) : (
    <Button variant="outline" aria-label={label} onClick={() => void change(opportunity, !archived)}>
      <Icon data-icon="inline-start" />
      {archived ? copy("Restore") : copy("Archive")}
    </Button>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">{label}</label>
      <select id={id} className="field-select min-h-11" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  );
}

/** Filters above the results and saved lists. Search stays first; the rest narrow what is shown. */
export function LibraryFilterBar({
  filters,
  onChange,
  runs,
  archivedCount,
  shown,
  total,
}: {
  filters: LibraryFilters;
  onChange: (next: LibraryFilters) => void;
  runs: RunInfo[];
  archivedCount: number;
  shown: number;
  total: number;
}) {
  const copy = useCopy();
  const format = useFormats();
  const set = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => onChange({ ...filters, [key]: value });
  const active = activeFilterCount(filters);
  return (
    <section aria-label={copy("Filter opportunities")} className="flex flex-col gap-4">
      <Input
        type="search"
        aria-label={copy("Search opportunities")}
        placeholder={copy("Search by idea, buyer, or industry")}
        value={filters.query}
        onChange={(event) => set("query", event.target.value)}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect label={copy("Confidence")} value={filters.confidence} onChange={(value) => set("confidence", value as LibraryFilters["confidence"])}>
          <option value="any">{copy("Any confidence")}</option>
          <option value="moderate">{copy("Moderate confidence")}</option>
          <option value="limited">{copy("Limited confidence")}</option>
        </FilterSelect>
        <FilterSelect label={copy("Score")} value={filters.score} onChange={(value) => set("score", value as LibraryFilters["score"])}>
          <option value="any">{copy("Any score")}</option>
          {scoreRangeKeys.map((key) => {
            const index = scoreBands.findIndex((band) => band.key === key);
            const band = scoreBands[index];
            const text = index === 0
              ? copy("{min}+ · {label}", { min: band.min, label: copy(band.label) })
              : index === scoreBands.length - 1
                ? copy("Below {max} · {label}", { max: scoreBands[index - 1].min, label: copy(band.label) })
                : copy("{min}–{max} · {label}", { min: band.min, max: scoreBands[index - 1].min - 1, label: copy(band.label) });
            return <option key={key} value={key}>{text}</option>;
          })}
        </FilterSelect>
        <FilterSelect label={copy("Research mode")} value={filters.mode} onChange={(value) => set("mode", value as LibraryFilters["mode"])}>
          <option value="any">{copy("Any mode")}</option>
          {discoveryModeOptions.map((mode) => <option key={mode} value={mode}>{copy(modeLabels[mode])}</option>)}
        </FilterSelect>
        <FilterSelect label={copy("Research run")} value={filters.run} onChange={(value) => set("run", value)}>
          <option value="any">{copy("Any run")}</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {copy("{name} · {date}", { name: run.name || copy("Untitled research"), date: format.date(run.created_at) })}
            </option>
          ))}
        </FilterSelect>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 shrink-0" checked={filters.showArchived} onChange={(event) => set("showArchived", event.currentTarget.checked)} />
          <span>{copy("Show archived ({count})", { count: archivedCount })}</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">{copy("Showing {shown} of {total}", { shown, total })}</p>
          {(active > 0 || filters.query) && (
            <Button variant="ghost" onClick={() => onChange({ ...defaultFilters })}>{copy("Clear filters")}</Button>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * "Delete this research" on a finished run's page: a dialog that asks the founder to type DELETE. Everything made from
 * the run goes with it; a run that is still working cannot be deleted.
 */
export function DeleteRunButton({ runId, title, compact = false, onDeleted }: {
  runId: string;
  /** The research's name, for the compact button's accessible label in a list. */
  title?: string;
  /** An icon-only button for list rows. */
  compact?: boolean;
  /** Called after deleting instead of leaving the page (the research list stays where it is). */
  onDeleted?: () => void;
}) {
  const copy = useCopy();
  const router = useRouter();
  const { refresh } = useDemo();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const hintId = useId();
  async function remove() {
    if (!deleteConfirmed(typed) || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/research/${runId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: DELETE_CONFIRMATION }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) window.location.assign("/login");
        throw new Error(feedbackSource(body.code));
      }
      toast.success(copy("Research deleted."));
      setOpen(false);
      await refresh().catch(() => undefined);
      if (onDeleted) onDeleted();
      else router.replace("/research");
    } catch (error) {
      toast.error(copy(error instanceof Error ? error.message : "Your change could not be saved."));
      setDeleting(false);
    }
  }
  return (
    <>
      {compact ? (
        <Button
          ref={trigger}
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 text-muted-foreground hover:text-destructive"
          aria-label={title ? copy("Delete {title}", { title }) : copy("Delete research")}
          onClick={() => { setTyped(""); setOpen(true); }}
        >
          <Trash2 />
        </Button>
      ) : (
        <Button ref={trigger} type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setTyped(""); setOpen(true); }}>
          <Trash2 data-icon="inline-start" />
          {copy("Delete research")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={(value) => !deleting && setOpen(value)}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy("Delete this research?")}</DialogTitle>
            <DialogDescription>
              {copy("This permanently deletes the report, its opportunities, sources, saves, flags and validation sprints. It cannot be undone, and it does not give back a research run.")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void remove();
            }}
          >
            <label htmlFor={inputId} className="text-sm font-medium">
              {copy("Type {word} to confirm", { word: DELETE_CONFIRMATION })}
            </label>
            <Input id={inputId} autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-describedby={hintId} value={typed} onChange={(event) => setTyped(event.target.value)} />
            <p id={hintId} className="text-sm text-muted-foreground">{copy("Archive opportunities instead if you may want them later.")}</p>
            <DialogFooter className="mt-2 gap-2">
              <Button type="button" variant="outline" disabled={deleting} onClick={() => setOpen(false)}>{copy("Cancel")}</Button>
              <Button type="submit" variant="destructive" disabled={!deleteConfirmed(typed) || deleting}>
                {deleting ? copy("Deleting…") : copy("Delete permanently")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * "Stop research" on a run that is still working: a confirmation dialog, then the run ends as cancelled. Its saved
 * sources and costs stay on the page, and it can be deleted afterwards like any finished run.
 */
export function CancelRunButton({ runId, onCancelled }: { runId: string; onCancelled: () => Promise<unknown> | void }) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  async function stop() {
    if (cancelling) return;
    setCancelling(true);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", id: runId }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      // 409: the run finished on its own while the dialog was open; the refreshed page shows how it ended.
      if (!response.ok && response.status !== 409) {
        if (response.status === 401) window.location.assign("/login");
        throw new Error(feedbackSource(body.code));
      }
      if (response.ok) toast.success(copy("Research stopped."));
      setOpen(false);
      await onCancelled();
    } catch (error) {
      toast.error(copy(error instanceof Error ? error.message : "Your change could not be saved."));
    } finally {
      setCancelling(false);
    }
  }
  return (
    <>
      <Button ref={trigger} type="button" variant="outline" className="w-fit" onClick={() => setOpen(true)}>
        <CircleStop data-icon="inline-start" />
        {copy("Stop research")}
      </Button>
      <Dialog open={open} onOpenChange={(value) => !cancelling && setOpen(value)}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy("Stop this research?")}</DialogTitle>
            <DialogDescription>
              {copy("The run stops before its next search or model request, and no report is produced. Sources found so far stay on this page. A stopped run cannot be resumed: start a new one when you are ready.")}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {copy("If nothing has been spent yet, the research run goes back to your allowance. Otherwise it counts like any other unfinished run.")}
          </p>
          <DialogFooter className="mt-2 gap-2">
            <Button type="button" variant="outline" disabled={cancelling} onClick={() => setOpen(false)}>{copy("Keep running")}</Button>
            <Button type="button" variant="destructive" disabled={cancelling} onClick={() => void stop()}>
              {cancelling ? copy("Stopping…") : copy("Stop research")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
