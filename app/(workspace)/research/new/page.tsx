import { getCopy } from "@/i18n/server";
import { ResearchConfig } from "@/components/research-config";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("New research") };
}
export default function Page() {
  return <ResearchConfig />;
}
