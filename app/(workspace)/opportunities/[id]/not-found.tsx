"use client";
import { useCopy } from "@/i18n/use-copy";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// The opportunity page calls notFound() when the record does not exist or belongs to another account.
export default function OpportunityNotFound() {
  const copy = useCopy();
  return (
    <main className="mx-auto flex max-w-lg flex-col items-start gap-5 py-16">
      <h1 className="text-3xl font-semibold">{copy("This opportunity isn’t here.")}</h1>
      <p className="text-muted-foreground">
        {copy("It may have been removed, or the link points to research from another account.")}
      </p>
      <Button asChild>
        <Link href="/research/results">{copy("Back to your research results")}</Link>
      </Button>
    </main>
  );
}
