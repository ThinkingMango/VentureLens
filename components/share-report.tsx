"use client";
import { useId, useRef, useState } from "react";
import { Copy, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useCopy } from "@/i18n/use-copy";
import { feedbackSource } from "@/i18n/errors";
import type { ShareState } from "@/lib/share-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * "Share" on a completed report (WP-26). Makes a read-only link anyone can open without signing in, shows it to copy,
 * and turns it off. Says plainly what the link shows and what it never shows before the founder makes it.
 */
export function ShareReportButton({ runId }: { runId: string }) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState<ShareState | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const linkId = useId();
  const endpoint = `/api/research/${runId}/share`;

  async function call(method: "GET" | "POST" | "DELETE") {
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method, cache: "no-store", ...(method === "GET" ? {} : { headers: { "Content-Type": "application/json" } }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) window.location.assign("/login");
        throw new Error(feedbackSource(body.code));
      }
      setShare(body.share ?? null);
      return body.share as ShareState;
    } catch (error) {
      toast.error(copy(error instanceof Error ? error.message : "Your change could not be saved."));
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(copy("Link copied."));
    } catch {
      toast.info(copy("Select the link and copy it."));
    }
  }

  return (
    <>
      <Button ref={trigger} type="button" variant="outline" onClick={() => { setOpen(true); if (share === undefined) void call("GET"); }}>
        <Share2 data-icon="inline-start" />
        {copy("Share")}
      </Button>
      <Dialog open={open} onOpenChange={(value) => !busy && setOpen(value)}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy("Share this report")}</DialogTitle>
            <DialogDescription>
              {copy("Anyone with the link can read the report without signing in. It is not listed or indexed anywhere, and you can turn it off at any time.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium">{copy("The link shows")}</p>
            <p className="text-muted-foreground">{copy("The summary, each opportunity's scores, claims, sources, economics and review, and the ideas that did not pass.")}</p>
            <p className="font-medium">{copy("It never shows")}</p>
            <p className="text-muted-foreground">{copy("Your profile, your brief, each score's rationale, your sprints, notes, ratings or email address.")}</p>
            <p className="rounded-md bg-warm-soft p-3 text-foreground">{copy("Other report text can still mention your skills or background where they affected an idea. Read the report before you share it.")}</p>
          </div>
          {share === undefined && busy && <p className="text-sm text-muted-foreground" role="status">{copy("Loading…")}</p>}
          {share && (
            <div className="flex flex-col gap-2">
              <label htmlFor={linkId} className="text-sm font-medium">{copy("Read-only link")}</label>
              <div className="flex gap-2">
                <Input id={linkId} readOnly value={share.url} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1" />
                <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={copy("Copy link")} onClick={() => void copyLink(share.url)}>
                  <Copy />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter className="mt-2 gap-2">
            {share ? (
              <Button type="button" variant="outline" className="text-destructive hover:text-destructive" disabled={busy} onClick={async () => { if ((await call("DELETE")) === null) toast.success(copy("The link is off. Anyone who opens it now sees that it is no longer available.")); }}>
                {copy("Turn off the link")}
              </Button>
            ) : (
              <Button type="button" disabled={busy || share === undefined} onClick={async () => { const made = await call("POST"); if (made) void copyLink(made.url); }}>
                <Link2 data-icon="inline-start" />
                {copy("Create a read-only link")}
              </Button>
            )}
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>{copy("Done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
