import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPage, getCategoryForSlug, getServiceSlugs, excerptFor, getServiceContent, extractProcessSteps } from "@/lib/content";
import { ContentBlocks } from "@/components/ContentBlocks";
import { PricingPlans } from "@/components/PricingPlans";
import { ProcessTimeline } from "@/components/ProcessTimeline";
import { QuoteModal } from "@/components/QuoteModal";
import { PaymentModal } from "@/components/PaymentModal";
import { QuoteWidget } from "@/components/QuoteWidget";
import { ConsultationForm } from "@/components/ConsultationForm";
import { StructureComparisonTable } from "@/components/StructureComparisonTable";
import { CtaBand } from "@/components/CtaBand";
import { CATEGORY_ICONS, GlowBadge } from "@/components/CategoryIcons";
import { STRUCTURE_COMPARISON } from "@/content/structure-comparison";
import { PRICING_OVERRIDES } from "@/content/pricing-overrides";
import { SITE_URL, SITE_NAME, BUSINESS_STATS } from "@/config/site";

export async function generateStaticParams() {
  return getServiceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getPage(slug);
  if (!page) return {};
  return {
    title: `${page.title} — ${SITE_NAME}`,
    description: excerptFor(page),
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getPage(slug);
  if (!page) notFound();

  const category = getCategoryForSlug(slug);
  const CategoryIcon = category ? CATEGORY_ICONS[category.label] : undefined;
  const { intro, trustBadge, before, plans: parsedPlans, after } = getServiceContent(page);
  const plans = PRICING_OVERRIDES[slug] ?? parsedPlans;
  const {
    title: processTitle,
    steps: processSteps,
    before: beforeProcess,
    after: afterProcess,
  } = extractProcessSteps(before);
  const showComparison = STRUCTURE_COMPARISON.some((r) => r.slug === slug);
  const faqs = page.blocks.filter((b): b is { type: "faq"; question: string; answer: string } => b.type === "faq");

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      ...(category
        ? [{ "@type": "ListItem", position: 2, name: category.label }]
        : []),
      {
        "@type": "ListItem",
        position: category ? 3 : 2,
        name: page.title,
        item: `${SITE_URL}/services/${slug}`,
      },
    ],
  };

  const faqJsonLd =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      {/* Full-width hero (headline + trust badge + checklist + real lead-
          capture form beside it) — same soft-yellow gradient + composition
          as the homepage hero, applied consistently on every page rather
          than white-only on inner pages. Uses a float (not a grid row) for
          the form: a CSS grid/flex row is always exactly as tall as its
          tallest item, and the form is reliably taller than a short intro
          (breadcrumb + H1 + a couple of checklist lines) — that equal-height
          forcing is what was showing up as a large empty block, first above
          the intro (when centered) and then below it (when top-aligned);
          neither alignment actually changes the total leftover height. A
          right float lets the section's own height track the intro's real
          height, while the form sits beside it and can overflow past the
          section's bottom into plain background if it runs longer — the
          `clear-both` on the very next block (below) guarantees whatever
          comes after the hero always starts clear of the form, however
          tall it turns out to be on a given page. */}
      <section style={{ background: "linear-gradient(180deg, var(--color-accent-tint) 0%, var(--color-paper) 65%)" }}>
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="lg:float-right lg:ml-10 lg:w-[27rem]">
            <ConsultationForm serviceTitle={page.title} variant="dark" />
          </div>
          <div className="lg:mr-[29.5rem]">
            {category && CategoryIcon && <GlowBadge className="mb-4" size={48} icon={<CategoryIcon className="h-5 w-5" />} />}
            {category && (
              <div className="text-sm mb-4" style={{ color: "var(--color-ink-soft)" }}>
                <Link href="/" className="hover:text-[var(--color-action)]">
                  Home
                </Link>{" "}
                / {category.label} / <span style={{ color: "var(--color-ink)" }}>{page.title}</span>
              </div>
            )}
            <h1
              className="text-4xl md:text-5xl font-extrabold leading-[1.1] tracking-tight"
              style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
            >
              {page.title}
            </h1>
            {trustBadge && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trustBadge.src}
                alt={trustBadge.alt}
                loading="lazy"
                decoding="async"
                className="mt-4 h-7 w-auto max-w-[210px] object-contain object-left"
              />
            )}
            {intro?.tagline && (
              <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
                {intro.tagline}
              </p>
            )}
            {intro && intro.features.length > 0 && (
              <ul className="mt-6 grid sm:grid-cols-2 gap-x-5 gap-y-3 max-w-xl">
                {intro.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--color-ink)" }}>
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
                    {f}
                  </li>
                ))}
              </ul>
            )}
            {/* Real trust stats (same figures used on the homepage/login
                page) — not page-specific copy, so this is one thing every
                service page's intro column can lean on to close some of the
                height gap against the taller quote form beside it, instead
                of leaving that space empty. */}
            <div className="mt-8 flex items-center gap-8 border-t pt-6" style={{ borderColor: "var(--color-line)" }}>
              <div>
                <p className="text-2xl font-extrabold" style={{ color: "var(--color-ink)" }}>
                  {BUSINESS_STATS.businessesServed}
                </p>
                <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Businesses registered</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold" style={{ color: "var(--color-ink)" }}>
                  {BUSINESS_STATS.caCsProfessionals}
                </p>
                <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>CA &amp; CS professionals</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 clear-both">
        <ContentBlocks blocks={beforeProcess} />
        <ProcessTimeline title={processTitle} steps={processSteps} />
        <ContentBlocks blocks={afterProcess} />

        {showComparison && <StructureComparisonTable currentSlug={slug} />}
        <PricingPlans plans={plans} serviceTitle={page.title} />

        <ContentBlocks blocks={after} />
      </div>

      <CtaBand />

      <QuoteWidget serviceTitle={page.title} />
      <QuoteModal serviceTitle={page.title} />
      <PaymentModal />
    </div>
  );
}
