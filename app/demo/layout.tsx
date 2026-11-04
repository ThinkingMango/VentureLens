import { getCopy } from "@/i18n/server";
import { DemoProvider } from "@/components/demo-provider";
export async function generateMetadata() {
  const copy = await getCopy();
  return {
    title: copy("Demonstration workspace"),
    robots: { index: false, follow: false },
  };
}
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DemoProvider>{children}</DemoProvider>;
}
