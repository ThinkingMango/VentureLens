"use client";
import { useCopy } from "@/i18n/use-copy";

import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const copy = useCopy();
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-semibold">
        {copy("Your workspace could not be loaded.")}
      </h1>
      <p className="leading-relaxed text-muted-foreground">
        {copy(
          "Please try again. If your session expired, log in again. Your saved records have not been removed.",
        )}
      </p>
      <Button onClick={reset}>{copy("Try again")}</Button>
      <Button variant="outline" asChild>
        <Link href="/login">{copy("Back to log in")}</Link>
      </Button>
      <Link className="text-primary" href="/demo/dashboard">
        {copy("Explore the separate demo")}
      </Link>
    </main>
  );
}
