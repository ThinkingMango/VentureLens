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
    "Compare buyer problems, evidence limitations, business economics, and validation plans for GenAI-enabled opportunities. Explore clearly labeled synthetic demonstration reports.",
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
