"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { errorDigest } from "@/lib/error-digest";

// Errors inside the signed-in workspace, where the usual cause is a failed workspace load or an expired session.
export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  const copy = useCopy();
  const digest = errorDigest(error);
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-semibold">{copy("Your workspace could not be loaded.")}</h1>
      <p className="leading-relaxed text-muted-foreground">
        {copy("Please try again. If your session expired, log in again. Your saved records have not been removed.")}
      </p>
      {digest && <p className="font-mono text-sm text-muted-foreground">{copy("Reference: {digest}", { digest })}</p>}
      <Button onClick={() => retry()}>{copy("Try again")}</Button>
      <Button variant="outline" asChild>
        <Link href="/login">{copy("Back to log in")}</Link>
      </Button>
      <Link className="text-primary" href="/demo/dashboard">
        {copy("Explore the separate demo")}
      </Link>
    </main>
  );
}
