"use client";
import Link from "next/link";
import { MailX } from "lucide-react";
import { useCopy } from "@/i18n/use-copy";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";

export type UnsubscribeState = { kind: "confirm"; userId: string; token: string } | { kind: "done" | "invalid" | "error" };

/**
 * The page the weekly email's opt-out link opens (WP-17). It changes nothing by itself: email security scanners open
 * links, so turning emails off takes a click on the button, which posts the signed link to the server.
 */
export function Unsubscribe({ state }: { state: UnsubscribeState }) {
  const copy = useCopy();
  return (
    <PublicShell>
      <main id="main-content" className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-16 sm:px-6">
        <MailX className="size-8 text-primary" aria-hidden="true" />
        {state.kind === "confirm" && (
          <>
            <h1 className="text-2xl font-semibold">{copy("Stop weekly progress emails?")}</h1>
            <p className="leading-relaxed text-muted-foreground">
              {copy("You will no longer get the weekly email about your validation sprint. Emails about finished research runs are not affected. You can turn weekly emails back on from your profile at any time.")}
            </p>
            <form method="post" action="/api/notifications/unsubscribe">
              <input type="hidden" name="u" value={state.userId} />
              <input type="hidden" name="t" value={state.token} />
              <input type="hidden" name="from" value="page" />
              <Button type="submit" className="min-h-11">{copy("Stop weekly emails")}</Button>
            </form>
          </>
        )}
        {state.kind === "done" && (
          <>
            <h1 className="text-2xl font-semibold" role="status">{copy("Weekly emails are off")}</h1>
            <p className="leading-relaxed text-muted-foreground">{copy("You can turn them back on from your profile at any time.")}</p>
          </>
        )}
        {(state.kind === "invalid" || state.kind === "error") && (
          <>
            <h1 className="text-2xl font-semibold">{state.kind === "invalid" ? copy("This link is not valid") : copy("Your change could not be saved")}</h1>
            <p className="leading-relaxed text-muted-foreground">{copy("Sign in and turn weekly emails off on your profile page instead.")}</p>
          </>
        )}
        {state.kind !== "confirm" && (
          <Button asChild variant="outline" className="min-h-11 self-start">
            <Link href="/profile">{copy("Go to your profile")}</Link>
          </Button>
        )}
      </main>
    </PublicShell>
  );
}
