import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildAccountExport, ownTables, serviceTables, stageColumns, type AccountExport, type ExportTable } from "@/lib/account-core";

// Self-serve data export and account deletion (enhancement plan WP-25).

type UserClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = ReturnType<typeof createAdminClient>;
type Page = PromiseLike<{ data: unknown[] | null; error: unknown }>;
const PAGE = 1000;

/** The stable order each table is read in, so paging never skips or repeats a row. */
const orderBy: Record<ExportTable, string[]> = {
  founder_profiles: ["user_id"], research_projects: ["id"], research_runs: ["id"], research_evidence: ["id"],
  opportunities: ["id"], saved_opportunities: ["opportunity_id"], validation_sprints: ["id"], validation_tasks: ["id"],
  report_feedback: ["id"], research_dev_access: ["user_id"], research_usage: ["id"], product_events: ["id"],
  weekly_emails: ["week"], research_stages: ["run_id", "stage_key"],
};
/** All rows of one query, page by page: PostgREST returns at most 1,000 rows per request. */
async function readAll(page: (from: number, to: number) => Page): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error("EXPORT_UNAVAILABLE");
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}
function ordered<Q extends { order(column: string): Q }>(query: Q, table: ExportTable): Q {
  return orderBy[table].reduce((q, column) => q.order(column), query);
}

/**
 * Everything stored for the founder. Their own tables are read with their own session, so row-level security keeps
 * every read to their rows (the user_id filter is a second guard). The two service-only tables are read with the
 * service role, filtered to their id.
 */
export async function exportAccount(supabase: UserClient, user: User, now = new Date(), admin: AdminClient = createAdminClient()): Promise<AccountExport> {
  const tables: Partial<Record<ExportTable, unknown[]>> = {};
  for (const table of ownTables) {
    tables[table] = await readAll((from, to) => ordered(supabase.from(table).select("*").eq("user_id", user.id), table).range(from, to));
  }
  tables.research_stages = await readAll((from, to) => ordered(supabase.from("research_stages").select(stageColumns).eq("user_id", user.id), "research_stages").range(from, to));
  for (const table of serviceTables) {
    tables[table] = await readAll((from, to) => ordered(admin.from(table).select("*").eq("user_id", user.id), table).range(from, to));
  }
  return buildAccountExport({ user, tables, now });
}

export type DeleteResult = { ok: true } | { ok: false; code: "RUN_ACTIVE" | "DELETE_FAILED" };

/**
 * Deletes the founder's account. prepare_account_deletion (as the founder) refuses while research is running, detaches
 * usage rows and records the hashed address against a second sign-up grant; deleting the auth user then removes every
 * founder table through its cascades. If the auth deletion fails, the account and its data are left as they were,
 * apart from the detached usage rows and the hash, and the founder can try again.
 */
export async function deleteAccount(supabase: UserClient, userId: string, admin: AdminClient = createAdminClient()): Promise<DeleteResult> {
  const { error } = await supabase.rpc("prepare_account_deletion");
  if (error?.code === "55000") return { ok: false, code: "RUN_ACTIVE" };
  if (error) return { ok: false, code: "DELETE_FAILED" };
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return { ok: false, code: "DELETE_FAILED" };
  return { ok: true };
}
