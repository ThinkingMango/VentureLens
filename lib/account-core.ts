// Self-serve data export and account deletion (enhancement plan WP-25, spec backlog #40). Pure rules shared by the API
// routes and the tests: which tables an export holds and how the file is shaped.

export const EXPORT_FORMAT_VERSION = 1;

/**
 * Every table that holds a founder's own rows, read through the founder's own session so row-level security limits
 * each read to them. Keep this list in step with the migrations: the account-deletion SQL test checks that deleting
 * an account empties each of these tables for that founder.
 */
export const ownTables = [
  "founder_profiles",
  "research_projects",
  "research_runs",
  "research_evidence",
  "opportunities",
  "saved_opportunities",
  "validation_sprints",
  "validation_tasks",
  "report_feedback",
  "research_dev_access",
  "research_usage",
  "report_shares",
] as const;
/** Founder rows only the service role can read; the export reads them filtered to the founder's id. */
export const serviceTables = ["product_events", "weekly_emails"] as const;
/**
 * research_stages holds the run's intermediate checkpoints: working copies of the brief and profile, raw model output
 * and retrieval notes, often several megabytes per run. The export lists each stage and when it ran; the brief, the
 * evidence and the report themselves are exported from their own tables.
 */
export const stageColumns = "run_id,stage_key,created_at";

export type ExportTable = (typeof ownTables)[number] | (typeof serviceTables)[number] | "research_stages";
export type AccountExport = {
  format: "venturelens-account-export";
  version: number;
  exported_at: string;
  account: { id: string; email: string | null; created_at: string | null; email_confirmed_at: string | null; last_sign_in_at: string | null };
  notes: string[];
  tables: Partial<Record<ExportTable, unknown[]>>;
};

/** The export file's contents. `account` is the founder's own auth record, without tokens or provider metadata. */
export function buildAccountExport(input: {
  user: { id: string; email?: string | null; created_at?: string | null; email_confirmed_at?: string | null; last_sign_in_at?: string | null };
  tables: Partial<Record<ExportTable, unknown[]>>;
  now: Date;
}): AccountExport {
  return {
    format: "venturelens-account-export",
    version: EXPORT_FORMAT_VERSION,
    exported_at: input.now.toISOString(),
    account: {
      id: input.user.id,
      email: input.user.email ?? null,
      created_at: input.user.created_at ?? null,
      email_confirmed_at: input.user.email_confirmed_at ?? null,
      last_sign_in_at: input.user.last_sign_in_at ?? null,
    },
    notes: [
      "Each table lists your own rows as stored, in JSON. Source excerpts keep their original language.",
      "research_stages lists each research stage and when it ran; its working data is left out because the brief, evidence and report are included in their own tables.",
      "product_events are the anonymous usage events recorded for your account: codes and counts only.",
    ],
    tables: Object.fromEntries(Object.entries(input.tables).map(([name, rows]) => [name, rows ?? []])),
  };
}

/** The download's file name, e.g. venturelens-export-2026-11-12.json. */
export function exportFileName(now: Date): string {
  return `venturelens-export-${now.toISOString().slice(0, 10)}.json`;
}
