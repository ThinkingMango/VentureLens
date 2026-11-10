import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  emptyProfile,
  profileColumns,
  profileV2FromRow,
  noResearchAccess,
  opportunitySchema,
  type ResearchAccess,
  type WorkspaceData,
  type WorkspaceOpportunity,
  type Profile,
} from "@/lib/workspace-schema";

/**
 * The workspace list is sent to the browser on every workspace page, so it leaves out what only the opportunity page
 * renders: source excerpts and the long review text. Cards keep the title, scores, economics, the first validation
 * step and the source links they count. The opportunity page reads the full record with readOpportunity().
 */
export function workspaceOpportunity(item: WorkspaceOpportunity): WorkspaceOpportunity {
  const { rationale: _rationale, critique: _critique, falsification: _falsification, assumptions: _assumptions, ...summary } = item;
  return {
    ...summary,
    evidence: item.evidence?.map(({ excerpt: _excerpt, ...source }) => source),
  };
}

function parseOpportunity(row: { id: string; title: string; score: number; payload: unknown }) {
  const parsed = opportunitySchema.safeParse({
    ...(row.payload as Record<string, unknown>),
    id: row.id,
    title: row.title,
    score: row.score,
  });
  return parsed.success ? parsed.data : null;
}

/** One opportunity with every field, for the opportunity page. Row-level security limits it to the owner. */
export async function readOpportunity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  id: string,
): Promise<WorkspaceOpportunity | null> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("id,title,score,payload")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("We could not load this opportunity. Please try again.");
  return data ? parseOpportunity(data) : null;
}

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
  let [
    memoryResult,
    profileResult,
    projectsResult,
    runsResult,
    opportunitiesResult,
    savesResult,
    accessResult,
  ] = await Promise.all([
    // Read on its own, so a database without the WP-04 column only loses the "cleared on" date, never the workspace.
    supabase
      .from("founder_profiles")
      .select("history_reset_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("founder_profiles")
      .select(profileColumns)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("research_projects")
      .select("id,name,sectors,models,geography,context,discovery_mode,angles,explore_new,created_at")
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
      .select("opportunity_id,completed_tasks")
      .eq("user_id", user.id),
    supabase
      .from("research_dev_access")
      .select("max_runs,runs_used,expires_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  // A database without the WP-03 columns (the minute between a deploy and its migration) still loads the workspace:
  // briefs read without their run focus, as "none" and "off".
  if (projectsResult.error?.code === "42703") {
    const legacy = await supabase
      .from("research_projects")
      .select("id,name,sectors,models,geography,context,discovery_mode,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    projectsResult = { ...legacy, data: legacy.data?.map((project) => ({ ...project, angles: [], explore_new: false })) ?? null } as typeof projectsResult;
  }
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
        ...profileV2FromRow(row),
      }
    : { ...emptyProfile };
  const opportunities = (opportunitiesResult.data ?? []).flatMap((item) => {
    const parsed = parseOpportunity(item);
    return parsed ? [workspaceOpportunity(parsed)] : [];
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
    memoryResetAt: memoryResult.error ? null : (memoryResult.data?.history_reset_at ?? null),
    access,
    projects: projectsResult.data ?? [],
    runs: runsResult.data ?? [],
    opportunities,
    saved: (savesResult.data ?? []).map((s) => s.opportunity_id),
    completed: (savesResult.data ?? []).flatMap((s) => s.completed_tasks),
  };
}
export const loadWorkspace = cache(async () => {
  const { supabase, user } = await requireUser();
  return readWorkspace(supabase, user);
});
