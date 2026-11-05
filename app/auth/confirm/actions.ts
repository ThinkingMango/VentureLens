"use server";
import { redirect } from "next/navigation";
import { parseEmailLink, verifyEmailLink } from "@/lib/email-auth";
import { createClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/workspace-schema";

// Runs only when the founder submits the confirm form. Next.js rejects
// cross-origin Server Action posts, so another site cannot submit it for them.
export async function confirmEmailLink(formData: FormData) {
  const link = parseEmailLink(formData);
  if (!link) redirect("/login?notice=callback");
  const next = formData.get("next");
  let destination: string;
  try {
    const { data, error } = await verifyEmailLink(await createClient(), link);
    destination =
      error || !data.session
        ? "/login?notice=callback"
        : `/auth/callback?next=${encodeURIComponent(
            safeReturnPath(typeof next === "string" ? next : null),
          )}`;
  } catch {
    destination = "/login?notice=configuration";
  }
  redirect(destination);
}
