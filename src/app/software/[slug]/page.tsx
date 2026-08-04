import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { COMING_SOON_PRODUCTS, getComingSoonProduct } from "@/content/coming-soon";
import { GlowBadge } from "@/components/CategoryIcons";
import { SITE_NAME } from "@/config/site";

export async function generateStaticParams() {
  return COMING_SOON_PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getComingSoonProduct(slug);
  if (!product) return {};
  return { title: `${product.name} — Coming Soon — ${SITE_NAME}` };
}

// Shared placeholder for products mentioned in planning docs but with no
// real content yet — a plain "coming soon" page rather than a broken link
// or a page pretending the product already exists.
export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getComingSoonProduct(slug);
  if (!product) notFound();

  return (
    <div style={{ background: "linear-gradient(180deg, var(--color-accent-tint) 0%, var(--color-paper) 65%)" }}>
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
        <GlowBadge
          size={56}
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <span
          className="mt-5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: "var(--color-accent)", color: "var(--color-ink-fixed)" }}
        >
          Coming Soon
        </span>
        <h1
          className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl"
          style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
        >
          {product.name}
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
          {product.tagline}
        </p>
        <p className="mt-2 max-w-md text-sm" style={{ color: "var(--color-ink-soft)" }}>
          We&apos;re still building this — check back soon, or get in touch and we&apos;ll let you know the moment it&apos;s ready.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/contact"
            className="rounded-full px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: "var(--color-ink-fixed)" }}
          >
            Notify me when it&apos;s ready
          </Link>
          <Link
            href="/"
            className="rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:bg-white"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
          >
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
