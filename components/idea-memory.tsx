"use client";
import { useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";
import { useCopy, useFormats } from "@/i18n/use-copy";
import { useDemo } from "@/components/demo-provider";
import { Button } from "@/components/ui/button";

/**
 * "Clear idea memory" (WP-04). New research avoids ideas from the founder's recent runs; clearing the memory lets those
 * ideas come back. Reports and saved opportunities are not changed. Asks for confirmation first. Not shown in the demo.
 */
export function IdeaMemory() {
  const copy = useCopy();
  const format = useFormats();
  const { data, isDemo, busy, clearMemory } = useDemo();
  const [confirming, setConfirming] = useState(false);
  if (isDemo || !data) return null;
  const resetAt = data.memoryResetAt;
  return (
    <section aria-labelledby="idea-memory-heading" className="surface flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <History className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <h2 id="idea-memory-heading" className="text-lg font-semibold">{copy("Idea memory")}</h2>
      </div>
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
        {copy("New research avoids ideas you have already seen in your recent runs, so each run brings something new.")}
      </p>
      {resetAt && (
        <p className="text-sm">{copy("Last cleared on {date}.", { date: format.date(resetAt) })}</p>
      )}
      {confirming ? (
        <div role="group" aria-labelledby="idea-memory-confirm" className="flex flex-col gap-3 rounded-lg border p-4">
          <p id="idea-memory-confirm" className="text-sm">
            {copy("Earlier ideas may be suggested again in new research. Your reports and saved opportunities are not changed.")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              aria-busy={busy}
              onClick={async () => {
                try {
                  await clearMemory();
                  setConfirming(false);
                  toast.success(copy("Idea memory cleared"));
                } catch (error) {
                  toast.error(copy(error instanceof Error ? error.message : "Your changes could not be saved."));
                }
              }}
            >
              {copy("Clear idea memory")}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              {copy("Cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-fit" disabled={busy} onClick={() => setConfirming(true)}>
          {copy("Clear idea memory")}
        </Button>
      )}
    </section>
  );
}
