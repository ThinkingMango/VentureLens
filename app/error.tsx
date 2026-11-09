"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { errorDigest } from "@/lib/error-digest";

// Any page outside the workspace (the landing page, pricing, sign-in) can land here, so the message is not about the
// workspace. retry() re-fetches the failed server content; reset() would only re-render the same failure.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const copy = useCopy();
  const digest = errorDigest(error);
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-semibold">{copy("Something went wrong.")}</h1>
      <p className="leading-relaxed text-muted-foreground">
        {copy("Please try again. If it keeps happening, contact support and include the reference below.")}
      </p>
      {digest && <p className="font-mono text-sm text-muted-foreground">{copy("Reference: {digest}", { digest })}</p>}
      <Button onClick={() => retry()}>{copy("Try again")}</Button>
      <Button variant="outline" asChild>
        <Link href="/">{copy("Go to the home page")}</Link>
      </Button>
    </main>
  );
}
