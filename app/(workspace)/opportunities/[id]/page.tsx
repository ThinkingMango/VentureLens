import { getCopy } from "@/i18n/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { readOpportunity, requireUser } from "@/lib/workspace";
import { LiveOpportunityDetail } from "@/components/opportunity-detail";
export async function generateMetadata() {
  const copy = await getCopy();
  return {
    title: copy("Opportunity"),
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  // The workspace list omits excerpts and review text, so this page reads its own full record.
  const { supabase, user } = await requireUser();
  const opportunity = await readOpportunity(supabase, user.id, id);
  if (!opportunity) notFound();
  return <LiveOpportunityDetail opportunity={opportunity} initialTab={typeof tab === "string" ? tab : undefined} />;
}
