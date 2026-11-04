import { getCopy } from "@/i18n/server";
import { Pricing } from "@/components/pricing";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Pricing") };
}
export default function Page() {
  return <Pricing />;
}
