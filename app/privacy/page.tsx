import { getCopy } from "@/i18n/server";
import { Privacy } from "@/components/privacy";
export async function generateMetadata() {
  const copy = await getCopy();
  return {
    title: copy("Privacy Policy"),
    description: copy(
      "What personal information VentureLens AI collects, why, who processes it, and how to access, export, or delete it.",
    ),
  };
}
export default function Page() {
  return <Privacy />;
}
