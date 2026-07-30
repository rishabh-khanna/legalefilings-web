import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPage, getCleanBlocks, excerptFor, type ContentBlock } from "@/lib/content";
import { ContentBlocks } from "@/components/ContentBlocks";
import { ContactCards } from "@/components/ContactCards";
import { UTILITY_SLUGS } from "@/content/nav-taxonomy";
import { SITE_NAME } from "@/config/site";

export async function generateStaticParams() {
  return UTILITY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getPage(slug);
  if (!page) return {};
  return { title: `${page.title} — ${SITE_NAME}`, description: excerptFor(page) };
}

export default async function UtilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!UTILITY_SLUGS.includes(slug)) notFound();
  const page = getPage(slug);
  if (!page) notFound();

  // About Us / Career get the same soft-yellow hero band as every other
  // page on the site; legal pages (privacy/terms/refund) stay plain — a
  // bright yellow band on a Terms & Conditions page would read as trying
  // too hard on the one kind of page that's supposed to be dry and plain.
  const isHeroPage = slug === "about-us" || slug === "career";

  // The Career page's raw content leads with its own "Career" heading —
  // the same page-title-repeated-as-the-first-block pattern service pages
  // already strip out via extractIntro(), just not handled for this
  // generic utility-page template. Left in, it rendered as a second,
  // redundant heading directly under the real H1 above it. Terms &
  // Conditions has the same bug in a different disguise — its raw heading
  // is "TERMS & CONDITIONS:" (caps + trailing colon), which an exact
  // (case-insensitive) match against the title missed; stripping trailing
  // punctuation before comparing catches that variant too.
  const normalizeHeading = (s: string) => s.trim().toLowerCase().replace(/[:.\s]+$/, "");
  const cleanBlocks = getCleanBlocks(page);
  const withoutDuplicateTitle =
    cleanBlocks[0]?.type === "heading" && normalizeHeading(cleanBlocks[0].text) === normalizeHeading(page.title)
      ? cleanBlocks.slice(1)
      : cleanBlocks;

  // Right after that heading, the Career page's raw content also has two
  // generic WordPress clip-art illustrations (a "person waving at a
  // laptop" pair) — no real information, and inconsistent with the icon
  // system the rest of the site uses now. There's no real careers-page
  // copy (job openings, culture blurb) to replace them with, so they're
  // just dropped rather than invented. Its phone/email/address list is
  // real data, but reads much better as the same icon-card grid the
  // Contact page uses than as a plain bullet list — pulled out here and
  // rendered separately, filtered out of the block stream below so it
  // doesn't also render as a bullet list.
  const CAREER_CLIPART_SRCS = new Set([
    "/images/wp/d15cc81e-perf-wp-theme-group-8782.png",
    "/images/wp/afd9a249-perf-wp-theme-group-8796.png",
  ]);
  let careerPhones: string[] = [];
  let careerEmail: string | undefined;
  let careerAddress: string | undefined;
  let bodyBlocks: ContentBlock[] = withoutDuplicateTitle;
  if (slug === "career") {
    const withoutClipart = withoutDuplicateTitle.filter((b) => !(b.type === "image" && CAREER_CLIPART_SRCS.has(b.src)));
    const contactList = withoutClipart.find((b) => b.type === "list" && b.items.some((i) => i.includes("+91"))) as
      | { type: "list"; items: string[] }
      | undefined;
    const addressList = withoutClipart.find((b) => b.type === "list" && b.items.some((i) => i.startsWith("Address"))) as
      | { type: "list"; items: string[] }
      | undefined;
    careerPhones = contactList?.items.filter((i) => !i.includes("@")) ?? [];
    careerEmail = contactList?.items.find((i) => i.includes("@"));
    careerAddress = addressList?.items[0];
    bodyBlocks = withoutClipart.filter((b) => b !== contactList && b !== addressList);
  }

  return (
    <div>
      {isHeroPage ? (
        // A plain single-column heading for every hero page — no
        // companion image/box, since neither About Us nor Career has one
        // that actually represents the page (Career's old photo was
        // literally captioned "a consultation," not careers/hiring related;
        // a mismatched stock photo is worse than no photo).
        <section style={{ background: "linear-gradient(180deg, var(--color-accent-tint) 0%, var(--color-paper) 65%)" }}>
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h1
              className="text-4xl md:text-5xl font-extrabold leading-[1.1] tracking-tight"
              style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
            >
              {page.title}
            </h1>
            {slug === "career" && (careerPhones.length > 0 || careerEmail || careerAddress) && (
              <ContactCards className="mt-8 max-w-2xl" phoneNumbers={careerPhones} email={careerEmail} address={careerAddress} />
            )}
          </div>
        </section>
      ) : (
        <div className="mx-auto max-w-6xl px-4 pt-10">
          <div className="flex items-center gap-3 mb-6">
            {["privacy-policy", "terms-conditions", "refund-policy"].includes(slug) && (
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--color-accent-tint)" }}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="var(--color-action)" strokeWidth="2">
                  <path d="M7 3h7l4 4v14H7Z" strokeLinejoin="round" />
                  <path d="M14 3v4h4" strokeLinejoin="round" />
                  <path d="M9.5 12h5M9.5 15h5M9.5 9h2" strokeLinecap="round" />
                </svg>
              </span>
            )}
            <h1
              className="text-3xl md:text-4xl font-semibold"
              style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
            >
              {page.title}
            </h1>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-6xl px-4 py-10">
        <ContentBlocks blocks={bodyBlocks} />
      </div>
    </div>
  );
}
