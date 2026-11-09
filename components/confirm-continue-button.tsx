"use client";
import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useCopy } from "@/i18n/use-copy";
import { Button } from "@/components/ui/button";

// Lives inside the server-rendered confirm form, so the form still submits
// without JavaScript; with JavaScript it blocks double submits.
export function ContinueButton() {
  const copy = useCopy();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
      {pending ? (
        <LoaderCircle data-icon="inline-start" className="animate-spin" />
      ) : (
        <ArrowRight data-icon="inline-start" />
      )}
      {pending ? copy("Please wait…") : copy("Continue")}
    </Button>
  );
}
