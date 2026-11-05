import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminProviders } from "@/components/admin-providers";
import { requireUser } from "@/lib/workspace";
import { isAdministrator } from "@/lib/admin-access";
import { administratorSettings } from "@/lib/provider-settings";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("title"), description: t("description"), robots: { index: false, follow: false } };
}

export default async function Page() {
  const { user } = await requireUser();
  if (!isAdministrator(user)) notFound();
  return <AdminProviders initialData={administratorSettings(user)} />;
}
