export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/** Print views (WP-11): the signed-in founder's own documents, without the workspace navigation. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <main className="print-doc mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">{children}</main>;
}
