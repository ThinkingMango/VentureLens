import { getCopy } from "@/i18n/server";
import { ResearchLibrary } from "@/components/research-library";
export async function generateMetadata() {
  const copy = await getCopy();
  return { title: copy("My research") };
}
export default function Page() {
  return <ResearchLibrary />;
}
