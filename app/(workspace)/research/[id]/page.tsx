import { getCopy } from "@/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/workspace";
import { researchDetail } from "@/lib/research-service";
import { ResearchRunView } from "@/components/research-run";
import { after } from "next/server";
import { track } from "@/lib/events";
export async function generateMetadata() {
  const copy = await getCopy();
  return {
    title: copy("Research run & report"),
    description: copy("Private VentureLens evidence research progress, sources, and complete reports."),
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireUser();
  const detail = await researchDetail(supabase, user.id, id);
  if (!detail) notFound();
  const outcome = detail.outcome;
  if (detail.status === "failed" && detail.error_code === "INSUFFICIENT_EVIDENCE" && outcome) {
    // Recorded after the response is sent, so the page never waits on analytics. Reason codes and counts only.
    const reasonCounts: Record<string, number> = {};
    for (const candidate of outcome.candidates) reasonCounts[candidate.reason] = (reasonCounts[candidate.reason] ?? 0) + 1;
    after(() => track("outcome_viewed", { userId: user.id, props: { reasonCounts } }));
  }
  return <ResearchRunView initialData={detail} rating={await reportRating(supabase, user.id, id)} />;
}

/** The founder's own rating of this report (WP-13). A read failure only hides the saved rating; the page still loads. */
async function reportRating(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, runId: string) {
  try {
    const { data, error } = await supabase.from("report_feedback").select("rating,comment").eq("run_id", runId).eq("user_id", userId).eq("target", "report").maybeSingle();
    return !error && data && typeof data.rating === "number" ? { rating: data.rating, comment: typeof data.comment === "string" ? data.comment : "" } : null;
  } catch {
    return null;
  }
}
