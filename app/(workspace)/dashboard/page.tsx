import { getCopy } from "@/i18n/server";
import { Dashboard } from "@/components/dashboard";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Overview") };
}
export default function Page() {
  return <Dashboard />;
}
