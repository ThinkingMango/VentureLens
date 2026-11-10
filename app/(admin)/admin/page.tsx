import { getTranslations } from "next-intl/server";
import { AdminProviders } from "@/components/admin-providers";
import { requireAdministrator } from "@/lib/admin-guard";
import { AdminNav } from "@/components/admin-nav";
import { administratorSettings } from "@/lib/provider-settings";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("title"), description: t("description"), robots: { index: false, follow: false } };
}

export default async function Page() {
  const user = await requireAdministrator();
  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <AdminProviders initialData={await administratorSettings(user)} />
    </div>
  );
}
