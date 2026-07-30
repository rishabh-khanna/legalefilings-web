import Link from "next/link";
import { NAV_CATEGORIES, getPage, getServiceContent } from "@/lib/content";
import { ConsultationForm } from "@/components/ConsultationForm";
import { WhyChooseUs } from "@/components/WhyChooseUs";
import { PartnerMarquee } from "@/components/PartnerMarquee";
import { CtaBand } from "@/components/CtaBand";
import { SectionHeading } from "@/components/SectionHeading";
import { HeroMockup } from "@/components/HeroMockup";
import { PricingPlans } from "@/components/PricingPlans";
import { MoneyBackBanner } from "@/components/MoneyBackBanner";
import { QuoteWidget } from "@/components/QuoteWidget";
import { QuoteModal } from "@/components/QuoteModal";
import { TrustBadge } from "@/components/TrustBadge";
import { BUSINESS_STATS } from "@/config/site";

export default function HomePage() {
  // Hero copy is static: the headline mirrors the original site's H2, and the
  // raw homepage content has no usable intro paragraph (its first long <p> is
  // a service-card blurb), so we don't extract either from the block stream.
  const heroSubtitle = `India's platform for company registration, GST filing, and tax compliance — trusted by ${BUSINESS_STATS.businessesServed} businesses and backed by ${BUSINESS_STATS.caCsProfessionals} CA & CS professionals.`;

  // Homepage teaser shows one flagship service's real plans (referenced from
  // doola.com's own homepage, which shows its one product's 3 tiers) — the
  // full catalog of every other service's pricing lives on /pricing.
  const flagshipSlug = "private-limited-company";
  const flagshipPage = getPage(flagshipSlug);
  const flagshipPlans = flagshipPage ? getServiceContent(flagshipPage).plans : [];

  return (
    <div>
      {/* Hero — referenced from doola.com's own homepage: an eyebrow line,
          a split black/accent headline, a short subheadline, a black pill
          primary CTA + a plain-text secondary link, a real Trustpilot
          rating, and a product-style mockup on the right (their real hero
          shows a compliance-checklist screenshot with a founder's photo
          overlaid — ours shows our own real process steps with our own
          real team photo, not a screenshot of software we don't have).
          Nav + hero share one continuous soft-yellow surface, same as
          doola's homepage specifically (their inner pages use a plain
          white nav instead — see SiteHeader). */}
      <section style={{ background: "linear-gradient(180deg, var(--color-accent-tint) 0%, var(--color-paper) 65%)" }}>
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20 grid lg:grid-cols-5 gap-10 items-center">
          <div className="lg:col-span-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-action-dark)" }}>
              How Businesses Stay Compliant
            </p>
            <h1
              className="mt-3 text-5xl md:text-6xl font-extrabold max-w-xl leading-[1.05] tracking-tight"
              style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
            >
              Fastest &amp; Easiest Way To Start Your{" "}
              <span style={{ color: "var(--color-action)" }}>Business</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
              {heroSubtitle}
            </p>

            <div className="mt-8">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: "var(--color-ink-fixed)" }}
              >
                Start Your Business
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <p className="mt-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>
                No payment required to see your quote
              </p>
            </div>

            <TrustBadge className="mt-6" />
          </div>
          <div className="lg:col-span-2">
            <HeroMockup />
          </div>
        </div>
      </section>

      <PartnerMarquee />

      {/* The real lead-capture form — no longer squeezed into the hero
          (doola's hero right side is the product mockup, not a form; their
          own signup form lives on its own page). Kept front-and-center as
          its own section instead, right under the hero + trust logos. */}
      <section className="border-y" style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-paper)" }}>
        <div className="mx-auto max-w-6xl px-4 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <SectionHeading wrapperClassName="mb-4">
              Get your free <span className="text-gradient">consultation</span>
            </SectionHeading>
            <p className="max-w-md text-lg leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
              Tell us what you&apos;re trying to start or file — a dedicated CA/CS gets back to you with a clear plan and transparent pricing, usually within minutes.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Government fees included",
                "Dedicated CA/CS support",
                "Real-time application tracking",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--color-ink)" }}>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="mt-0.5 h-[18px] w-[18px] shrink-0"
                    fill="none"
                    stroke="var(--color-action)"
                    strokeWidth="2"
                  >
                    <circle cx="10" cy="10" r="8.5" />
                    <path d="m6.5 10.5 2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <ConsultationForm variant="dark" />
        </div>
      </section>

      <WhyChooseUs />

      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading align="center" wrapperClassName="mb-8">
          Our <span className="text-gradient">Services</span>
        </SectionHeading>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {NAV_CATEGORIES.map((cat) => (
            <div
              key={cat.label}
              className="rounded-lg border-t-2 border bg-white dark:bg-[var(--color-paper-raised)] p-5 transition-colors hover:bg-[var(--color-accent-tint)]"
              style={{ borderColor: "var(--color-line)", borderTopColor: "var(--color-accent)" }}
            >
              <h3 className="font-semibold mb-3" style={{ color: "var(--color-ink)" }}>
                {cat.label}
              </h3>
              <ul className="space-y-2 text-sm" style={{ color: "var(--color-ink-soft)" }}>
                {cat.slugs.map((slug) => {
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
        </div>
      </section>

      {flagshipPlans.length > 0 && (
        <section className="border-t" style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-paper)" }}>
          <div className="mx-auto max-w-6xl px-4 py-16">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--color-muted-dark)" }}>
              Pricing
            </p>
            <SectionHeading align="center" wrapperClassName="mt-2">
              Start with <span className="text-gradient">Private Limited Company</span>
            </SectionHeading>
            <p className="mt-2 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
              Our most-registered structure — see every service&apos;s pricing on the full plans page.
            </p>

            <PricingPlans
              plans={flagshipPlans}
              showHeading={false}
              sectionId="home-pricing"
              serviceTitle={flagshipPage?.title}
            />

            <div className="mt-2 text-center">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: "var(--color-ink-fixed)" }}
              >
                See All Plans &amp; Pricing
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

            <div className="mt-12">
              <MoneyBackBanner />
            </div>
          </div>
        </section>
      )}

      <CtaBand />

      <QuoteWidget />
      <QuoteModal />
    </div>
  );
}
