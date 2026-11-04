import { getCopy } from "@/i18n/server";
import { Billing } from "@/components/billing";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Credits & billing") };
}
export default function Page() {
  return <Billing />;
}
