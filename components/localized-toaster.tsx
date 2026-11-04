"use client";
import { Toaster } from "sonner";
import { useCopy } from "@/i18n/use-copy";
export function LocalizedToaster() {
  const copy = useCopy();
  return (
    <Toaster
      position="bottom-right"
      containerAriaLabel={copy("Notifications")}
      toastOptions={{ closeButtonAriaLabel: copy("Close") }}
    />
  );
}
