/**
 * Root layout.
 *
 * The real <html>/<body> live in `[locale]/layout.tsx` so the `lang` attribute
 * matches the active locale. Next.js requires a root layout to exist, so this
 * one simply forwards children (the official next-intl App Router pattern).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
