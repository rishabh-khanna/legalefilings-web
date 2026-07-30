import type { Metadata } from "next";
import Link from "next/link";
import { NAV_CATEGORIES } from "@/content/nav-taxonomy";
import { getPage, getServiceContent } from "@/lib/content";
import { PricingPlans } from "@/components/PricingPlans";
import { MoneyBackBanner } from "@/components/MoneyBackBanner";
import { SectionHeading } from "@/components/SectionHeading";
import { CtaBand } from "@/components/CtaBand";
import { QuoteModal } from "@/components/QuoteModal";
import { CATEGORY_ICONS, GlowBadge } from "@/components/CategoryIcons";
import { SITE_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: `Plans & Pricing — ${SITE_NAME}`,
  description: `Every ${SITE_NAME} plan, in one place — company registration, GST, trademark, and compliance filings, grouped by category.`,
};

// One page listing every service's real pricing cards (same cards each
// service page already renders), grouped the same way the nav groups them —
// referenced from doola.com's own dedicated pricing page, which is where
// their homepage "See Plans & Pricing" button sends you.
export default function PricingPage() {
  const categories = NAV_CATEGORIES.map((cat) => ({
    label: cat.label,
    services: cat.slugs
      .map((slug) => {
        const page = getPage(slug);
        if (!page) return null;
        const { plans } = getServiceContent(page);
        if (plans.length === 0) return null;
        return { slug, title: page.title, plans };
      })
      .filter((s): s is { slug: string; title: string; plans: ReturnType<typeof getServiceContent>["plans"] } => s !== null),
  })).filter((cat) => cat.services.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <p
        className="text-center text-xs font-semibold uppercase tracking-[0.15em]"
        style={{ color: "var(--color-muted-dark)" }}
      >
        Plans &amp; Pricing
      </p>
      <SectionHeading align="center" wrapperClassName="mt-2">
        Every plan, <span className="text-gradient">one place</span>.
      </SectionHeading>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
        Transparent, government-fee-inclusive pricing across every registration and filing we handle.
      </p>

      <nav aria-label="Jump to category" className="mt-8 flex flex-wrap justify-center gap-2">
        {categories.map((cat) => (
          <a
            key={cat.label}
            href={`#${slugifyLabel(cat.label)}`}
            className="rounded-full border px-4 py-1.5 text-sm font-medium transition-colors hover:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
          >
            {cat.label}
          </a>
        ))}
      </nav>

      <div className="mt-14">
        <MoneyBackBanner />
      </div>

      {categories.map((cat) => {
        const CategoryIcon = CATEGORY_ICONS[cat.label];
        return (
        <section key={cat.label} id={slugifyLabel(cat.label)} className="mt-16 scroll-mt-nav">
          <div className="flex items-center gap-3">
            {CategoryIcon && <GlowBadge size={44} icon={<CategoryIcon className="h-[18px] w-[18px]" />} />}
            <h2
              className="text-2xl font-extrabold"
              style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
            >
              {cat.label}
            </h2>
          </div>
          <div className="mt-3 h-1 w-14 rounded-full" style={{ backgroundColor: "var(--color-accent)" }} />

          {cat.services.map((service) => (
            <div key={service.slug} className="mt-10">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-lg font-bold" style={{ color: "var(--color-ink)" }}>
                  {service.title}
                </h3>
                <Link
                  href={`/services/${service.slug}`}
                  className="shrink-0 text-sm font-medium"
                  style={{ color: "var(--color-action-dark)" }}
                >
                  Full details →
                </Link>
              </div>
              <PricingPlans
                plans={service.plans}
                showHeading={false}
                sectionId={`pricing-${service.slug}`}
                serviceTitle={service.title}
              />
            </div>
          ))}
        </section>
        );
      })}

      <div className="mt-16">
        <CtaBand />
      </div>

      <QuoteModal />
    </div>
  );
}

function slugifyLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
