import Link from "next/link";
import { NAV_CATEGORIES, getPage, getServiceContent } from "@/lib/content";
import { ConsultationForm } from "@/components/ConsultationForm";
import { WhyChooseUs } from "@/components/WhyChooseUs";
import { Testimonials } from "@/components/Testimonials";
import { PartnerMarquee } from "@/components/PartnerMarquee";
import { CtaBand } from "@/components/CtaBand";
import { SectionHeading } from "@/components/SectionHeading";
import { HeroMockup } from "@/components/HeroMockup";
import { HomePricingCarousel, type CarouselService } from "@/components/HomePricingCarousel";
import { MoneyBackBanner } from "@/components/MoneyBackBanner";
import { QuoteWidget } from "@/components/QuoteWidget";
import { QuoteModal } from "@/components/QuoteModal";
import { PaymentModal } from "@/components/PaymentModal";
import { TrustBadge } from "@/components/TrustBadge";
import { LiveStatsBento } from "@/components/LiveStatsBento";
import { EntityFinderModal } from "@/components/EntityFinderModal";
import { EntityFinderTeaserButton } from "@/components/EntityFinderTeaserButton";
import { COMING_SOON_PRODUCTS } from "@/content/coming-soon";
import { PRICING_OVERRIDES } from "@/content/pricing-overrides";
import { BUSINESS_STATS } from "@/config/site";

export default function HomePage() {
  // Hero copy is static: the headline mirrors the original site's H2, and the
  // raw homepage content has no usable intro paragraph (its first long <p> is
  // a service-card blurb), so we don't extract either from the block stream.
  const heroSubtitle = `India's platform for company registration, GST filing, and tax compliance — trusted by ${BUSINESS_STATS.businessesServed} businesses and backed by ${BUSINESS_STATS.caCsProfessionals} CA & CS professionals.`;

  // Homepage teaser shows real plans for a handful of bestseller services,
  // browsable with the carousel's prev/next arrows (referenced from
  // doola.com's own homepage, which shows its one product's 3 tiers — ours
  // extends that to a few real bestsellers instead of just one) — the full
  // catalog of every other service's pricing lives on /pricing. Annual
  // Compliance leads the list since it's the highest-selling service.
  const BESTSELLER_SLUGS = [
    "annual-compliances-for-companies",
    "private-limited-company",
    "llp-registration-online",
    "trademark-registration",
    "one-person-company",
  ];
  const bestsellerServices = BESTSELLER_SLUGS.map((slug): CarouselService | null => {
    const page = getPage(slug);
    if (!page) return null;
    const plans = PRICING_OVERRIDES[slug] ?? getServiceContent(page).plans;
    if (plans.length === 0) return null;
    return { slug, title: page.title, plans, bestseller: slug === "annual-compliances-for-companies" };
  }).filter((s): s is CarouselService => s !== null);

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
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: "var(--color-ink-fixed)" }}
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 21V7l6-3v17M4 21h16M10 4l6 3v14M14 21V10" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Start Your Business
                </Link>
                {/* Deliberately not another outlined pill matching "Start
                    Your Business" — this is an invitation to play a quiz,
                    not a second primary CTA, so it gets its own distinct
                    look: a round "?" badge, a dashed border, and a soft
                    accent-tinted fill instead of plain white/outline. */}
                <EntityFinderTeaserButton
                  className="inline-flex items-center gap-2.5 rounded-full py-2.5 pl-2.5 pr-5 text-sm font-semibold transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: "var(--color-accent-tint)", border: "2px dashed var(--color-action)", color: "var(--color-ink)" }}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                    style={{ backgroundColor: "var(--color-accent)", color: "var(--color-ink-fixed)" }}
                  >
                    ?
                  </span>
                  Take the Quiz
                </EntityFinderTeaserButton>
              </div>
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

      <LiveStatsBento />

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

      {/* The full quiz auto-pops up once per session (see EntityFinderModal)
          — the hero's own "Take the Quiz" button (right next to "Start
          Your Business") reopens it any time after that, so it doesn't
          need a second standalone section repeating the same pitch. */}
      <EntityFinderModal />

      <WhyChooseUs />

      <Testimonials />

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

      {bestsellerServices.length > 0 && (
        <section className="border-t" style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-paper)" }}>
          <div className="mx-auto max-w-6xl px-4 py-16">
            <HomePricingCarousel services={bestsellerServices} />

            <div className="mt-12">
              <MoneyBackBanner />
            </div>

            {/* Flat one-off fees (a single license, filing, or registration
                — not a 3-tier plan) used to only live at the very bottom of
                /pricing, past every tiered category above it. This teaser
                puts a fast path to it right on the homepage instead. */}
            <div
              className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6"
              style={{ backgroundColor: "var(--color-ink-fixed)" }}
            >
              <div>
                <p className="text-lg font-bold text-white">Just need one filing, not a full plan?</p>
                <p className="mt-1 text-sm text-white/70">See flat, all-inclusive prices for every one-off registration and compliance filing.</p>
              </div>
              <Link
                href="/pricing/rate-card"
                className="inline-flex shrink-0 items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: "var(--color-accent)", color: "var(--color-ink)" }}
              >
                View Flat-Fee Price List
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading align="center" wrapperClassName="mb-2">
          More from <span className="text-gradient">Legal Efilings</span>
        </SectionHeading>
        <p className="mx-auto max-w-md text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
          A full business software suite — launching soon.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {COMING_SOON_PRODUCTS.map((product) => (
            <Link
              key={product.slug}
              href={`/software/${product.slug}`}
              className="rounded-2xl border bg-white p-5 text-center transition-colors hover:border-[var(--color-accent)] dark:bg-[var(--color-paper-raised)]"
              style={{ borderColor: "var(--color-line)" }}
            >
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }}
              >
                Coming Soon
              </span>
              <p className="mt-3 text-sm font-bold" style={{ color: "var(--color-ink)" }}>
                {product.name}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <CtaBand />

      <QuoteWidget />
      <QuoteModal />
      <PaymentModal />
    </div>
  );
}
