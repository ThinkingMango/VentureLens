"use client";
import { createContext, useContext, useId, useRef, useState } from "react";
import { Check, Flag, Star } from "lucide-react";
import { toast } from "sonner";
import { useCopy } from "@/i18n/use-copy";
import { feedbackSource } from "@/i18n/errors";
import { postJson } from "@/lib/api-client";
import { FEEDBACK_COMMENT_MAX, reasonsFor, type FlagReason, type FlagTarget } from "@/lib/feedback-core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Copy = ReturnType<typeof useCopy>;
function reasonLabel(copy: Copy, reason: FlagReason) {
  switch (reason) {
    case "wrong": return copy("Wrong or not supported by the source");
    case "outdated": return copy("Outdated");
    case "irrelevant": return copy("Irrelevant to this opportunity");
    case "broken_link": return copy("Broken link");
    case "other": return copy("Something else");
  }
}

type Flagging = { target: FlagTarget; key: string; label: string; trigger: HTMLElement | null };
type FlagContext = { flagged: Set<string>; open: (item: Flagging) => void };
const FlagContext = createContext<FlagContext | null>(null);
const flagId = (target: FlagTarget, key: string) => `${target}:${key}`;

/**
 * Flagging for one opportunity (WP-13): every Flag button on the page opens one shared dialog. In the demo nothing is
 * sent; the founder is told flags are not saved.
 */
export function FlagProvider({ opportunityId, demo, children }: { opportunityId: string; demo: boolean; children: React.ReactNode }) {
  const copy = useCopy();
  const [item, setItem] = useState<Flagging | null>(null);
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set());
  const trigger = useRef<HTMLElement | null>(null);
  const formId = useId();
  const markFlagged = (current: Flagging) => setFlagged((items) => new Set(items).add(flagId(current.target, current.key)));

  function open(next: Flagging) {
    trigger.current = next.trigger;
    setReason(null);
    setComment("");
    setItem(next);
  }
  async function send() {
    if (!item || !reason || sending) return;
    if (demo) {
      toast.info(copy("Demo workspace · Flags are not saved."));
      setItem(null);
      return;
    }
    setSending(true);
    try {
      const result = await postJson("/api/feedback", { action: "flag", opportunity_id: opportunityId, target: item.target, target_key: item.key, reason, comment });
      if (result.ok) {
        toast.success(copy("Thanks. Your flag was saved."));
        markFlagged(item);
        setItem(null);
      } else if (result.body.code === "ALREADY_FLAGGED") {
        toast.info(copy("You already flagged this."));
        markFlagged(item);
        setItem(null);
      } else {
        if (result.status === 401) window.location.assign("/login");
        toast.error(copy(feedbackSource(result.body.code)));
      }
    } catch {
      toast.error(copy(feedbackSource("SAVE_FAILED")));
    } finally {
      setSending(false);
    }
  }
  return (
    <FlagContext.Provider value={{ flagged, open }}>
      {children}
      <Dialog open={!!item} onOpenChange={(value) => !value && setItem(null)}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{item?.target === "source" ? copy("Flag this source") : copy("Flag this claim")}</DialogTitle>
            <DialogDescription className="line-clamp-3">{item?.label}</DialogDescription>
          </DialogHeader>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{copy("What is the problem?")}</legend>
              {item && reasonsFor(item.target).map((value) => (
                <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm has-[:checked]:border-primary">
                  <input type="radio" name="flag-reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="size-4" />
                  {reasonLabel(copy, value)}
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-2 text-sm font-medium">
              <span>
                {copy("Comment")} <span className="font-normal text-muted-foreground">{copy("(optional)")}</span>
              </span>
              <textarea className="field-select min-h-24 resize-y font-normal" value={comment} maxLength={FEEDBACK_COMMENT_MAX} onChange={(event) => setComment(event.target.value)} />
            </label>
            <p className="text-sm text-muted-foreground">{copy("Flags help us improve the research. They do not change this report.")}</p>
          </form>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setItem(null)}>{copy("Cancel")}</Button>
            <Button type="submit" form={formId} disabled={!reason || sending}>{copy("Send flag")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FlagContext.Provider>
  );
}

/** A small "Flag" control on a claim or a source card. Outside a FlagProvider it renders nothing. */
export function FlagButton({ target, targetKey, label, className }: { target: FlagTarget; targetKey: string; label: string; className?: string }) {
  const copy = useCopy();
  const context = useContext(FlagContext);
  if (!context) return null;
  const done = context.flagged.has(flagId(target, targetKey));
  const short = label.length > 80 ? `${label.slice(0, 79)}…` : label;
  return (
    // Once flagged the button stays focusable (aria-disabled, not disabled), so focus can return to it when the dialog closes.
    <button
      type="button"
      aria-disabled={done || undefined}
      onClick={(event) => {
        if (!done) context.open({ target, key: targetKey, label, trigger: event.currentTarget });
      }}
      aria-label={done ? copy("Flagged: {label}", { label: short }) : target === "source" ? copy("Flag source: {label}", { label: short }) : copy("Flag claim: {label}", { label: short })}
      className={cn("inline-flex min-h-8 items-center gap-1 rounded px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground aria-disabled:cursor-default aria-disabled:hover:text-muted-foreground", className)}
    >
      {done ? <Check className="size-3.5" aria-hidden="true" /> : <Flag className="size-3.5" aria-hidden="true" />}
      {done ? copy("Flagged") : copy("Flag")}
    </button>
  );
}

const ratingLabels = ["Not useful", "Slightly useful", "Somewhat useful", "Useful", "Very useful"] as const;

/** The 1–5 rating at the end of a report (WP-13). One rating per report: saving again changes it. */
export function ReportRating({ runId, initial }: { runId: string; initial: { rating: number; comment: string } | null }) {
  const copy = useCopy();
  const [saved, setSaved] = useState(initial);
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [sending, setSending] = useState(false);
  const name = useId();
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!rating || sending) return;
    setSending(true);
    try {
      const result = await postJson("/api/feedback", { action: "rate", run_id: runId, rating, comment });
      if (result.ok) {
        setSaved({ rating, comment: comment.trim() });
        toast.success(copy("Thanks. Your rating was saved."));
      } else {
        if (result.status === 401) window.location.assign("/login");
        toast.error(copy(feedbackSource(result.body.code)));
      }
    } catch {
      toast.error(copy(feedbackSource("SAVE_FAILED")));
    } finally {
      setSending(false);
    }
  }
  const unchanged = !!saved && saved.rating === rating && saved.comment === comment.trim();
  return (
    <section id="rate-report" aria-labelledby="rate-report-heading" className="surface flex scroll-mt-24 flex-col gap-4 p-5 sm:p-6">
      <h2 id="rate-report-heading" className="text-lg font-semibold">{copy("Rate this report")}</h2>
      <form className="flex flex-col gap-4" onSubmit={(event) => void save(event)}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm text-muted-foreground">{copy("How useful was this report?")}</legend>
          <div className="flex flex-wrap gap-1">
            {ratingLabels.map((label, index) => {
              const value = index + 1;
              return (
                <label key={value} className="relative flex size-11 cursor-pointer items-center justify-center rounded-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                  <input type="radio" name={name} value={value} checked={rating === value} onChange={() => setRating(value)} className="peer sr-only" />
                  <Star aria-hidden="true" className={cn("size-7 text-muted-foreground", rating !== null && value <= rating && "fill-primary text-primary")} />
                  <span className="sr-only">{copy("{n} of 5: {label}", { n: value, label: copy(label) })}</span>
                </label>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">{rating ? copy(ratingLabels[rating - 1]) : copy("Choose 1 to 5 stars.")}</p>
        </fieldset>
        <label className="flex flex-col gap-2 text-sm font-medium">
          <span>
            {copy("Comment")} <span className="font-normal text-muted-foreground">{copy("(optional)")}</span>
          </span>
          <textarea className="field-select min-h-20 resize-y font-normal" value={comment} maxLength={FEEDBACK_COMMENT_MAX} onChange={(event) => setComment(event.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!rating || sending || unchanged}>{saved ? copy("Update rating") : copy("Save rating")}</Button>
          {saved && <span className="text-sm text-muted-foreground">{copy("Your rating: {n} of 5", { n: saved.rating })}</span>}
        </div>
      </form>
    </section>
  );
}
