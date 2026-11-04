import { DemoProvider } from "@/components/demo-provider";
export const metadata = {
  title: "Demonstration workspace",
  robots: { index: false, follow: false },
};
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DemoProvider>{children}</DemoProvider>;
}
