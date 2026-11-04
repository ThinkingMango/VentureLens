import { getCopy } from "@/i18n/server";
import { Onboarding } from "@/components/onboarding";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Founder profile") };
}
export default function Page() {
  return <Onboarding editing />;
}
