import { getCopy } from "@/i18n/server";
import { Support } from "@/components/support";
import { loadProviderDisclosure } from "@/lib/provider-disclosure-server";

// Rendered per request: the answer about which AI model runs research follows the current policy in app_settings.
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const copy = await getCopy();
  return {
    title: copy("Support"),
    description: copy(
      "Get help with your VentureLens AI account, research runs, and data requests.",
    ),
  };
}
export default async function Page() {
  return <Support disclosure={await loadProviderDisclosure()} />;
}
