import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_SC } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { LocalizedToaster } from "@/components/localized-toaster";
import "./globals.css";
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const cjk = Noto_Sans_SC({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-cjk",
});
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: { default: t("title"), template: "%s · VentureLens AI" },
    description: t("description"),
  };
}
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1426" },
  ],
  width: "device-width",
  initialScale: 1,
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`bg-background ${geist.variable} ${cjk.variable}`}
    >
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          {children}
          <LocalizedToaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
