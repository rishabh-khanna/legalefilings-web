import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { NAV_CATEGORIES, getPage, getSearchIndex } from "@/lib/content";
import { type NavCategoryData } from "@/components/SiteHeader";
import { SiteChrome } from "@/components/SiteChrome";
import { SITE_NAME } from "@/config/site";
import { SocialLinks } from "@/components/SocialLinks";

// A single font family for both display and body text — referenced from
// doola.com's own site, whose entire typographic identity is one font
// (Inter) at varying weights, not a separate serif/display face.
const inter = Inter({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: `${SITE_NAME} — Business Registration & Tax Filing`,
  description:
    "India's platform for company registration, GST, tax filing, and compliance services.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const navCategories: NavCategoryData[] = NAV_CATEGORIES.map((cat) => ({
    label: cat.label,
    items: cat.slugs
      .map((slug) => {
        const page = getPage(slug);
        return page ? { slug, title: page.title } : null;
      })
      .filter((x): x is { slug: string; title: string } => x !== null),
  }));
  const searchIndex = getSearchIndex();

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      {/* Defensive: clips any horizontal scrollable overflow so a stray
          off-viewport element can never shift/clip visible page content. */}
      <body className="min-h-full flex flex-col overflow-x-hidden pb-12 sm:pb-0" style={{ color: "var(--color-ink)" }}>
        <SiteChrome
          navCategories={navCategories}
          searchIndex={searchIndex}
          footer={
            <footer key="site-footer" className="border-t mt-16" style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-paper-raised)" }}>
              <div className="mx-auto max-w-6xl px-4 py-10 grid grid-cols-2 md:grid-cols-5 gap-8 text-sm">
                {NAV_CATEGORIES.map((cat) => (
                  <div key={cat.label}>
                    <div
                      className="font-semibold mb-2 text-xs uppercase tracking-wide"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {cat.label}
                    </div>
                    <ul className="space-y-1" style={{ color: "var(--color-ink-soft)" }}>
                      {cat.slugs.slice(0, 6).map((slug) => {
                        const page = getPage(slug);
                        if (!page) return null;
                        return (
                          <li key={slug}>
                            <Link href={`/services/${slug}`} className="hover:text-[var(--color-action)]">
                              {page.title}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                <div key="company">
                  <div
                    className="font-semibold mb-2 text-xs uppercase tracking-wide"
                    style={{ color: "var(--color-muted)" }}
                  >
                    Company
                  </div>
                  <ul className="space-y-1" style={{ color: "var(--color-ink-soft)" }}>
                    <li><Link href="/about-us" className="hover:text-[var(--color-action)]">About Us</Link></li>
                    <li><Link href="/blog" className="hover:text-[var(--color-action)]">Blog</Link></li>
                    <li><Link href="/contact" className="hover:text-[var(--color-action)]">Contact</Link></li>
                    <li><Link href="/career" className="hover:text-[var(--color-action)]">Career</Link></li>
                    <li><Link href="/privacy-policy" className="hover:text-[var(--color-action)]">Privacy Policy</Link></li>
                    <li><Link href="/terms-conditions" className="hover:text-[var(--color-action)]">Terms &amp; Conditions</Link></li>
                    <li><Link href="/refund-policy" className="hover:text-[var(--color-action)]">Refund Policy</Link></li>
                  </ul>
                </div>
              </div>
              <div
                className="border-t mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4"
                style={{ borderColor: "var(--color-line)" }}
              >
                <div
                  className="font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--color-muted)" }}
                >
                  Connect with us
                </div>
                <SocialLinks />
              </div>
              <div
                className="border-t py-4 text-center text-xs"
                style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
              >
                © {new Date().getFullYear()} {SITE_NAME}. Not a law firm; facilitates access to independent professionals.
              </div>
            </footer>
          }
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}
