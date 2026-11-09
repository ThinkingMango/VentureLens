import { getCopy } from "@/i18n/server";
import { Support } from "@/components/support";
export async function generateMetadata() {
  const copy = await getCopy();
  return {
    title: copy("Support"),
    description: copy(
      "Get help with your VentureLens AI account, research runs, and data requests.",
    ),
  };
}
export default function Page() {
  return <Support />;
}
