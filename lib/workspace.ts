import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  emptyProfile,
  noResearchAccess,
  opportunitySchema,
  type ResearchAccess,
  type WorkspaceData,
  type Profile,
} from "@/lib/workspace-schema";

export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return { supabase, user };
});

export async function readWorkspace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string },
): Promise<WorkspaceData> {
  const [
    profileResult,
    projectsResult,
    runsResult,
    opportunitiesResult,
    savesResult,
    accessResult,
  ] = await Promise.all([
    supabase
      .from("founder_profiles")
      .select(
        "name,role,industry,skills,hours,budget,goal,onboarding_completed",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("research_projects")
      .select("id,name,sector,model,geography,context,discovery_mode,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("research_runs")
      .select("id,project_id,status,stage,error_code,retry_count,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("opportunities")
      .select("id,title,score,payload")
      .eq("user_id", user.id)
      .order("score", { ascending: false }),
    supabase
      .from("saved_opportunities")
      .select("opportunity_id,completed_tasks,saved")
      .eq("user_id", user.id),
    supabase
      .from("research_dev_access")
      .select("max_runs,runs_used,expires_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const failed = [
    profileResult,
    projectsResult,
    runsResult,
    opportunitiesResult,
    savesResult,
    accessResult,
  ].some((r) => r.error);
  if (failed)
    throw new Error("We could not load your workspace. Please try again.");
  const row = profileResult.data;
  const profile: Profile = row
    ? {
        name: row.name,
        role: row.role,
        industry: row.industry,
        skills: row.skills,
        hours: row.hours,
        budget: row.budget,
        goal: row.goal,
      }
    : { ...emptyProfile };
  const opportunities = (opportunitiesResult.data ?? []).flatMap((item) => {
    const parsed = opportunitySchema.safeParse({
      ...item.payload,
      id: item.id,
      title: item.title,
      score: item.score,
    });
    return parsed.success ? [parsed.data] : [];
  });
  const grant = accessResult.data;
  const active =
    !!grant && new Date(grant.expires_at).getTime() > Date.now();
  const access: ResearchAccess = active
    ? {
        enabled: Math.max(0, grant.max_runs - grant.runs_used) > 0,
        remaining: Math.max(0, grant.max_runs - grant.runs_used),
        maxRuns: grant.max_runs,
        expiresAt: grant.expires_at,
      }
    : { ...noResearchAccess };
  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
    onboarded: row?.onboarding_completed ?? false,
    access,
    projects: projectsResult.data ?? [],
    runs: runsResult.data ?? [],
    opportunities,
    // A row can hold checklist progress for an opportunity that is not saved.
    saved: (savesResult.data ?? []).filter((s) => s.saved).map((s) => s.opportunity_id),
    completed: (savesResult.data ?? []).flatMap((s) => s.completed_tasks),
  };
}
export const loadWorkspace = cache(async () => {
  const { supabase, user } = await requireUser();
  return readWorkspace(supabase, user);
});
