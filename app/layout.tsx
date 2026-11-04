import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import { DemoProvider } from "@/components/demo-provider";
import "./globals.css";
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
export const metadata: Metadata = {
  title: {
    default: "VentureLens AI — Find your next opportunity",
    template: "%s · VentureLens AI",
  },
  description:
    "Explore an evidence-driven approach to finding, comparing, and validating GenAI-enabled business opportunities. Frontend demonstration with synthetic data.",
};
export const viewport: Viewport = {
  themeColor: "#f6f8fb",
  width: "device-width",
  initialScale: 1,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`bg-background ${geist.variable}`}>
      <body className="font-sans antialiased">
        <DemoProvider>{children}</DemoProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
