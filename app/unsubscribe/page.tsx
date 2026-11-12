import { getCopy } from "@/i18n/server";
import { Unsubscribe, type UnsubscribeState } from "@/components/unsubscribe";
import { linkSecret, verifyUnsubscribeToken, type WeeklyEnv } from "@/lib/weekly-core";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Weekly emails"), robots: { index: false, follow: false } };
}

/** Opened from the weekly email's opt-out link (WP-17). Checks the signed link; the button on the page does the rest. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
  const status = one(params.status);
  const userId = one(params.u);
  const token = one(params.t);
  const state: UnsubscribeState =
    status === "done" || status === "error" || status === "invalid" ? { kind: status }
      : verifyUnsubscribeToken(linkSecret(process.env as WeeklyEnv), userId, token) ? { kind: "confirm", userId: userId!, token: token! }
      : { kind: "invalid" };
  return <Unsubscribe state={state} />;
}
