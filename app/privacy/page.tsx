import { getCopy } from "@/i18n/server";
import { Privacy } from "@/components/privacy";
import { loadProviderDisclosure } from "@/lib/provider-disclosure-server";

// Rendered per request: the AI-processing sections follow the current research policy in app_settings.
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const copy = await getCopy();
  return {
    title: copy("Privacy Policy"),
    description: copy(
      "What personal information VentureLens AI collects, why, who processes it, and how to access, export, or delete it.",
    ),
  };
}
export default async function Page() {
  return <Privacy disclosure={await loadProviderDisclosure()} />;
}
