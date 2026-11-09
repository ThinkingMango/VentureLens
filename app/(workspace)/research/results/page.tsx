import { getCopy } from "@/i18n/server";
import { ResearchResults } from "@/components/research-results";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("Research results") };
}
export default function Page() {
  return <ResearchResults />;
}
