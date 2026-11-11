"use client";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { useCopy } from "@/i18n/use-copy";
import { useDemo } from "@/components/demo-provider";

/**
 * "Email me when my research is ready" (WP-08). On by default; the email names the run and its outcome and links back
 * to it. Not shown in the demo, which sends no email.
 */
export function NotificationSettings() {
  const copy = useCopy();
  const { data, isDemo, busy, setNotify } = useDemo();
  if (isDemo || !data) return null;
  const enabled = data.notifyOnComplete !== false;
  return (
    <section aria-labelledby="notify-heading" className="surface flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Mail className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <h2 id="notify-heading" className="text-lg font-semibold">{copy("Email notifications")}</h2>
      </div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          role="switch"
          className="mt-1 size-5 shrink-0"
          checked={enabled}
          disabled={busy}
          aria-describedby="notify-help"
          onChange={async (event) => {
            const next = event.currentTarget.checked;
            try {
              await setNotify(next);
              toast.success(next ? copy("We'll email you when your research is ready.") : copy("Research emails are off."));
            } catch (error) {
              toast.error(copy(error instanceof Error ? error.message : "Your changes could not be saved."));
            }
          }}
        />
        <span className="flex flex-col gap-1">
          <span className="font-medium">{copy("Email me when my research is ready")}</span>
          <span id="notify-help" className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {copy("One email per run, sent to {email} when it finishes or stops. It names the run and its outcome; your profile, brief and report stay in VentureLens.", { email: data.email })}
          </span>
        </span>
      </label>
    </section>
  );
}
