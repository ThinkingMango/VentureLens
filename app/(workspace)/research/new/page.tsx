import { z } from "zod";
import { getCopy } from "@/i18n/server";
import { ResearchConfig } from "@/components/research-config";
import { requireUser } from "@/lib/workspace";
import { projectSchema } from "@/lib/workspace-schema";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("New research") };
}
/**
 * `?from=<run id>` starts the form from that run's brief, for "Edit the brief and run again" on a run where nothing
 * passed. The brief is read with the founder's own client, so row-level security limits it to their own runs; anything
 * missing or unreadable falls back to the usual starting brief.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { from } = await searchParams;
  const id = Array.isArray(from) ? from[0] : from;
  let initialBrief;
  if (id && z.uuid().safeParse(id).success) {
    const { supabase, user } = await requireUser();
    const { data } = await supabase.from("research_runs").select("configuration").eq("id", id).eq("user_id", user.id).maybeSingle();
    const parsed = projectSchema.safeParse((data?.configuration as { brief?: unknown } | undefined)?.brief);
    if (parsed.success) initialBrief = parsed.data;
  }
  return <ResearchConfig initialBrief={initialBrief} />;
}
