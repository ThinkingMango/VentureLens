import type { Metadata, Viewport } from "next";
import { Geist, Newsreader, Noto_Sans_SC } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { LocalizedToaster } from "@/components/localized-toaster";
import { siteOrigin } from "@/lib/notify-core";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  // The optical-size axis gives large headlines the display cut and small text a sturdier one.
  axes: ["opsz"],
  variable: "--font-newsreader",
});
const cjk = Noto_Sans_SC({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-cjk",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  // Absolute URLs for the share image and links; the same origin the notification emails use.
  const origin = siteOrigin({
    SITE_URL: process.env.SITE_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  });
  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: { default: t("title"), template: "%s · VentureLens AI" },
    description: t("description"),
    // The share image itself is app/opengraph-image.png (Next.js file convention).
    openGraph: { type: "website", siteName: "VentureLens AI", title: t("title"), description: t("description") },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description") },
  };
}

export const viewport: Viewport = {
  themeColor: "#F5F3ED",
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
      className={`bg-background ${geist.variable} ${newsreader.variable} ${cjk.variable}`}
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
