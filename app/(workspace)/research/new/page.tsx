import { z } from "zod";
import { getCopy } from "@/i18n/server";
import { ResearchConfig } from "@/components/research-config";
import { requireUser } from "@/lib/workspace";
import { projectSchema, type ResearchBrief } from "@/lib/workspace-schema";
import { outcomeSchema } from "@/lib/research-core";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("New research") };
}
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
/**
 * `?from=<run id>` starts the form from that run's brief ("Edit the brief and run again"). With `&idea=<candidate key>`
 * it starts a "Verify my idea" check of one candidate from that run's outcome ("Check this idea"), prefilled with the
 * candidate's title, buyer and problem. Both are read with the founder's own client, so row-level security limits them
 * to their own runs; anything missing or unreadable falls back to the usual starting brief.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const id = first(params.from);
  const ideaKey = first(params.idea);
  let initialBrief: ResearchBrief | undefined;
  if (id && z.uuid().safeParse(id).success) {
    const { supabase, user } = await requireUser();
    const { data } = await supabase.from("research_runs").select("configuration").eq("id", id).eq("user_id", user.id).maybeSingle();
    const parsed = projectSchema.safeParse((data?.configuration as { brief?: unknown } | undefined)?.brief);
    if (parsed.success) initialBrief = parsed.data;
    if (parsed.success && ideaKey && /^c\d{1,2}$/.test(ideaKey)) {
      const stage = await supabase.from("research_stages").select("output").eq("run_id", id).eq("user_id", user.id).eq("stage_key", "outcome").maybeSingle();
      const outcome = outcomeSchema.safeParse(stage.data?.output);
      const candidate = outcome.success ? outcome.data.candidates.find(item => item.key === ideaKey) : undefined;
      if (candidate) {
        const { idea: _previous, ...brief } = parsed.data;
        initialBrief = {
          ...brief,
          name: candidate.title.slice(0, 100),
          discovery_mode: "verify",
          idea: { title: candidate.title.slice(0, 180), buyer: candidate.buyer.slice(0, 300), pain: (candidate.pain ?? "").slice(0, 800), offer: "", price_hint: "" },
        };
      }
    }
  }
  return <ResearchConfig initialBrief={initialBrief} />;
}
