"use client";
import { useId, useRef, useState } from "react";
import { Download, FileDown, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { postJson } from "@/lib/api-client";
import { useCopy } from "@/i18n/use-copy";

/** Records an export (`report_exported`). Fire and forget: an export never waits on, or fails because of, analytics. */
export function recordExport(format: "markdown" | "pdf") {
  void postJson("/api/exports", { format }).catch(() => undefined);
}

/** Saves text as a file in the browser, with no server round trip. */
export function downloadText(fileName: string, text: string, type = "text/markdown;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The "Export" button and its dialog (spec WP-11): download Markdown built from the data the page already has, or open
 * the print view to save as PDF. `markdown` builds the file on demand. `briefOption` shows "Include my brief" (reports
 * only; off by default); the founder profile is never exported. The demo shows the dialog but exports nothing.
 */
export function ExportButton({
  kind,
  demo,
  printHref,
  markdown,
  briefOption = false,
}: {
  kind: "report" | "opportunity";
  demo: boolean;
  printHref: string;
  markdown: (includeBrief: boolean) => { fileName: string; text: string };
  briefOption?: boolean;
}) {
  const copy = useCopy();
  const [open, setOpen] = useState(false);
  const [includeBrief, setIncludeBrief] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const demoNotice = () => toast.info(copy("Demo workspace · Exports are available for your own reports."));
  function download() {
    if (demo) return demoNotice();
    try {
      const file = markdown(briefOption && includeBrief);
      downloadText(file.fileName, file.text);
      recordExport("markdown");
      toast.success(copy("Markdown file downloaded."));
      setOpen(false);
    } catch {
      toast.error(copy("The file could not be created. Please try again."));
    }
  }
  const href = briefOption && includeBrief ? `${printHref}?brief=1` : printHref;
  return (
    <>
      <Button ref={trigger} type="button" variant="outline" onClick={() => setOpen(true)}>
        <FileDown data-icon="inline-start" />
        {kind === "report" ? copy("Export report") : copy("Export")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{kind === "report" ? copy("Export this report") : copy("Export this opportunity")}</DialogTitle>
            <DialogDescription>
              {copy("Download a Markdown file, or open a print view and choose “Save as PDF”. Your founder profile is never included.")}
            </DialogDescription>
          </DialogHeader>
          {briefOption && (
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0"
                checked={includeBrief}
                aria-describedby={hintId}
                onChange={(event) => setIncludeBrief(event.currentTarget.checked)}
              />
              <span className="flex flex-col gap-1">
                <span className="font-medium">{copy("Include my brief")}</span>
                <span id={hintId} className="text-sm text-muted-foreground">
                  {copy("Adds the brief's name, industries, market, focus and idea. Leave it off to share the findings only.")}
                </span>
              </span>
            </label>
          )}
          <DialogFooter className="gap-2">
            {demo ? (
              <Button type="button" variant="outline" onClick={demoNotice}>
                <Printer data-icon="inline-start" />
                {copy("Print / Save as PDF")}
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <a href={href} target="_blank" rel="noopener">
                  <Printer data-icon="inline-start" />
                  {copy("Print / Save as PDF")}
                  <span className="sr-only"> {copy("(opens in a new tab)")}</span>
                </a>
              </Button>
            )}
            <Button type="button" onClick={download}>
              <Download data-icon="inline-start" />
              {copy("Download Markdown")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The print view's own button: the browser's print dialog, where "Save as PDF" is one of the destinations. */
export function PrintButton() {
  const copy = useCopy();
  return (
    <Button
      type="button"
      onClick={() => {
        recordExport("pdf");
        window.print();
      }}
    >
      <Printer data-icon="inline-start" />
      {copy("Print / Save as PDF")}
    </Button>
  );
}
