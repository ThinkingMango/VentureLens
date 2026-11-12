"use client";
import { useId, useRef, useState } from "react";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCopy } from "@/i18n/use-copy";
import { feedbackSource } from "@/i18n/errors";
import { useDemo } from "@/components/demo-provider";
import { createClient } from "@/lib/supabase/client";
import { DELETE_CONFIRMATION, deleteConfirmed } from "@/lib/library-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * "Your data" on the profile page (WP-25): download everything stored for the account as JSON, or delete the account.
 * Deleting asks for the typed confirmation word, is refused while research is running, and signs the founder out.
 * Not shown in the demo, which stores nothing.
 */
export function AccountData() {
  const copy = useCopy();
  const { data, isDemo } = useDemo();
  const [downloading, setDownloading] = useState(false);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const hintId = useId();
  if (isDemo || !data) return null;

  async function download() {
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 401) window.location.assign("/login");
        throw new Error("EXPORT_UNAVAILABLE");
      }
      const blob = await response.blob();
      const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? "venturelens-export.json";
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(copy("Your data is downloading."));
    } catch {
      toast.error(copy("Your data could not be exported. Please try again."));
    } finally {
      setDownloading(false);
    }
  }

  async function remove() {
    if (!deleteConfirmed(typed) || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: DELETE_CONFIRMATION }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) window.location.assign("/login");
        throw new Error(body.code === "RUN_ACTIVE" ? "Stop your running research first, then delete your account." : feedbackSource(body.code));
      }
      // The server has signed the session out; clear this browser's copy too, then leave the workspace.
      await createClient().auth.signOut({ scope: "local" }).catch(() => undefined);
      window.location.assign("/?account=deleted");
    } catch (error) {
      toast.error(copy(error instanceof Error ? error.message : "Your change could not be saved."));
      setDeleting(false);
    }
  }

  return (
    <section aria-labelledby="account-data-heading" className="surface flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <h2 id="account-data-heading" className="text-lg font-semibold">{copy("Your data")}</h2>
      </div>
      <div className="flex flex-col gap-2">
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {copy("Download everything stored for your account as one JSON file: your profile, briefs, research runs, reports, sources, saved opportunities, sprints, feedback and usage records.")}
        </p>
        <Button type="button" variant="outline" className="min-h-11 self-start" disabled={downloading} onClick={() => void download()}>
          <Download data-icon="inline-start" />
          {downloading ? copy("Preparing your file…") : copy("Download my data")}
        </Button>
      </div>
      <div className="flex flex-col gap-2 border-t pt-4">
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {copy("Deleting your account permanently removes your profile, research, reports, sprints and settings, and signs you out. It cannot be undone.")}
        </p>
        <Button ref={trigger} type="button" variant="outline" className="min-h-11 self-start text-destructive hover:text-destructive" onClick={() => { setTyped(""); setOpen(true); }}>
          <Trash2 data-icon="inline-start" />
          {copy("Delete my account")}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={(value) => !deleting && setOpen(value)}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy("Delete your account?")}</DialogTitle>
            <DialogDescription>
              {copy("This permanently deletes your profile, briefs, research runs, reports, sources, saved opportunities, sprints, feedback and email settings, and signs you out. Download your data first if you want a copy.")}
            </DialogDescription>
          </DialogHeader>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            <li>{copy("Cost records of your research are kept without any link to you, for our accounts.")}</li>
            <li>{copy("Usage events stay without any link to you.")}</li>
            <li>{copy("A one-way code made from your email address is kept for 12 months, so a new account with the same address does not get a second set of free research runs.")}</li>
          </ul>
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
            <p id={hintId} className="text-sm text-muted-foreground">{copy("Research that is still running must be stopped first.")}</p>
            <DialogFooter className="mt-2 gap-2">
              <Button type="button" variant="outline" disabled={deleting} onClick={() => setOpen(false)}>{copy("Cancel")}</Button>
              <Button type="submit" variant="destructive" disabled={!deleteConfirmed(typed) || deleting}>
                {deleting ? copy("Deleting…") : copy("Delete my account permanently")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
