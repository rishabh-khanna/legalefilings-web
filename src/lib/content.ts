import siteContent from "@/content/site-content.json";
import { NAV_CATEGORIES, UTILITY_SLUGS } from "@/content/nav-taxonomy";

export type ContentBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "image"; src: string; alt: string; width?: number; height?: number }
  | { type: "faq"; question: string; answer: string }
  | { type: "table"; headers: string[]; rows: string[][] };

export type Page = {
  title: string;
  slug: string;
  link: string;
  post_type: "page" | "post";
  blocks: ContentBlock[];
};

type SiteContent = {
  pages: Record<string, Page>;
  posts: Page[];
};

const content = siteContent as SiteContent;

export function getPage(slug: string): Page | undefined {
  return content.pages[slug];
}

export function getAllPosts(): Page[] {
  return content.posts;
}

export function getPost(slug: string): Page | undefined {
  return content.posts.find((p) => p.slug === slug);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Elementor repeats some headings (e.g. a "Get Instant Quote Now" CTA) at multiple
// non-consecutive points in a page, so a plain slugify() collides. Number repeats
// deterministically so the same heading always gets the same id, whether it's
// requested from blocksToHeadings() (for the section nav) or from ContentBlocks
// (for the anchor).
export function makeUniqueSlug(text: string, seen: Map<string, number>): string {
  const base = slugify(text);
  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

// Leftover Elementor CTA-widget fragments that read as article sections when
// rendered flat (they were styled buttons/banners on the old site, not copy).
// "Loved by thousands of businesses" was a testimonial carousel widget — on
// 26 of 27 pages it has zero extractable text after it (the one exception
// has just a stray name with no actual review), so it's not worth keeping.
const JUNK_HEADINGS = new Set(["get instant quote now", "loved by thousands of businesses"]);
const JUNK_PARAGRAPHS = new Set([
  "easy payment options available no spam. no sharing. 100% confidentially",
]);
// Every page has its own "10,000+ Businesses Incorporated" / "5,000+ FSSAI
// Registrations" / "10,000+ Trademark Registered" stat-banner variant — these
// were graphic CTA banners, not copy, so match the shape rather than each string.
const JUNK_HEADING_PATTERN = /^[\d,]+\+\s/;
// Leftover WordPress media-library images with no business reason to be on
// any of our pages:
// - imresizer-1710239258201(-2).jpg / Xpert_logo_blue_transparent.png: two
//   unrelated companies' logos ("XpertTutor," a tutoring service, and
//   "PediaXone," a children's/pediatric brand) rendered as a large
//   stand-alone illustration on 24 of 28 service pages — leftover "client
//   logos" marquee assets mis-parsed into page body content.
// - did-you-know.png.webp / feasibility-meeting-*.webp /
//   istockphoto-1277296624-*.png: generic flat stock-illustration clip art
//   (people at a table, a question-mark duo) with zero real information,
//   same category as the ones already removed from the Career page.
// - Sed-21-512-removebg-preview-*: a "MOST POPULAR" sticker graphic that
//   duplicates the real "Most Popular" pill PricingPlans already renders
//   from real data — this one was an orphaned image floating in the body
//   content, not attached to any actual plan.
// - imresizer-1709061617029.jpg: a real, identifiable private photo of a
//   person unconnected to this business (not a stock photo or a team
//   member) — should never have been pulled into page content at all.
// - imresizer-1710239019088-*: a third unrelated company's logo ("ANILLO,"
//   a jewelry brand), same story as XpertTutor/PediaXone above.
// Several of these also have a WordPress-generated resized variant (e.g.
// "-1024x576") with a different filename for the same underlying image —
// listed explicitly rather than pattern-matched, so this only ever removes
// images actually confirmed by hand, never something new by coincidence.
const JUNK_IMAGE_SRCS = new Set([
  "/images/wp/imresizer-1710239258201-2.jpg",
  "/images/wp/imresizer-1710239258201.jpg",
  "/images/wp/Xpert_logo_blue_transparent.png",
  "/images/wp/Xpert_logo_blue_transparent-1024x576.png",
  "/images/wp/imresizer-1710239019088-removebg-preview.png",
  "/images/wp/imresizer-1710239019088-removebg-preview-2.png",
  "/images/wp/did-you-know.png.webp",
  "/images/wp/feasibility-meeting-work-feasibility-meeting.png.webp",
  "/images/wp/istockphoto-1277296624-612x612-removebg-preview.png",
  "/images/wp/Sed-21-512-removebg-preview-e1712782837206-1-1.png",
  "/images/wp/Sed-21-512-removebg-preview-e1712782837206-qmit1mwm2flmz46ap4w1eyfiamiun04ntk1eezowv0.png",
  "/images/wp/imresizer-1709061617029.jpg",
]);

function isJunkBlock(block: ContentBlock): boolean {
  if (block.type === "heading") {
    const text = block.text.trim();
    return JUNK_HEADINGS.has(text.toLowerCase()) || JUNK_HEADING_PATTERN.test(text);
  }
  if (block.type === "paragraph") return JUNK_PARAGRAPHS.has(block.text.trim().toLowerCase());
  if (block.type === "image") return JUNK_IMAGE_SRCS.has(block.src);
  return false;
}

export function getCleanBlocks(page: Page): ContentBlock[] {
  // Some pages tag a full run-on sentence as an H2 instead of a <p> — e.g.
  // trademark-registration's "Product"/"Service"/"Shape"/... sections each
  // have their real description marked up this way. Rendered as a heading
  // that reads as a giant bold sentence with a section-nav-sized accent bar,
  // which is exactly the kind of thing that looked broken/oversized on the
  // page. Demote those back to plain paragraphs before anything renders.
  const blocks: ContentBlock[] = page.blocks.map((b) =>
    b.type === "heading" && b.level === 2 && isLongText(b.text) ? { type: "paragraph", text: b.text } : b,
  );

  // Elementor pages often contain desktop+mobile copies of the same widgets,
  // so identical paragraphs/FAQs can appear twice — keep the first only.
  // (Lists are NOT deduped here: pricing plans legitimately repeat features.)
  // A single-item list immediately followed by a paragraph repeating that same
  // item verbatim is the same desktop/mobile duplicate, just in list+paragraph
  // form — drop the redundant paragraph and keep the bulleted version.
  const skipIndices = new Set<number>();
  blocks.forEach((b, i) => {
    const next = blocks[i + 1];
    if (b.type === "list" && b.items.length === 1 && next?.type === "paragraph" && next.text === b.items[0]) {
      skipIndices.add(i + 1);
    }
  });

  const seen = new Set<string>();
  return blocks.filter((b, i) => {
    if (skipIndices.has(i)) return false;
    if (isJunkBlock(b)) return false;
    if (b.type === "paragraph" && b.text.length > 30) {
      const key = `p:${b.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
    if (b.type === "faq") {
      const key = `faq:${b.question}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  });
}

// A handful of old pages mark plain body copy as an H2 for styling purposes —
// a bare price ("₹1999") or a full run-on sentence, not an actual section
// title. Those make useless (and in the sentence case, absurdly long) section
// nav entries, so keep only headings that look like a real short title.
function isNavigableHeadingText(text: string): boolean {
  const t = text.trim();
  if (t.startsWith("₹")) return false;
  if (t.length > 70) return false;
  return true;
}

export function blocksToHeadings(blocks: ContentBlock[], level = 2): { id: string; text: string }[] {
  // IDs must line up with ContentBlocks' own independent makeUniqueSlug pass,
  // which assigns one to every H2 regardless of nav-worthiness — so run the
  // same counter over the same full sequence here too, and only filter the
  // *returned* list, rather than skipping junk headings mid-count (that would
  // desync the two passes' counters wherever a real title happens to share a
  // slug with an excluded one earlier on the page).
  const seen = new Map<string, number>();
  const result: { id: string; text: string }[] = [];
  for (const b of blocks) {
    if (b.type !== "heading" || b.level !== level) continue;
    const id = makeUniqueSlug(b.text, seen);
    if (isNavigableHeadingText(b.text)) result.push({ id, text: b.text });
  }
  return result;
}

export type PricingPlan = {
  name: string;
  description: string;
  originalPrice?: string;
  discount?: string;
  price: string;
  features: string[];
};

const isPrice = (t: string) => t.trim().startsWith("₹");
const isDiscount = (t: string) => /%\s*off/i.test(t);
const isIncludesLabel = (t: string) => /what you.?ll get/i.test(t);
// Some pages split the govt-fee note into its own heading ("+Govt. Fee") instead
// of combining it into the price heading ("₹1999 +Govt. Fee") — it's a label,
// not a plan name, or the parser mistakes it for a new plan and truncates
// the previous one's feature list.
const isFeeLabel = (t: string) => /^\+?\s*govt\.?\s*fee/i.test(t.trim());

// A real plan name is always short ("Basic Registration", "Mandatary"). Some
// pages tag their per-plan description as an H2 too instead of a <p> — that
// reads as a full sentence, not a label, and treating it as a new plan name
// makes the parser think a name-less, price-less "plan" just started, which
// breaks the whole extraction right there.
const isLongText = (t: string) => t.trim().length > 60;

function isPlanNameHeading(b: ContentBlock): boolean {
  return (
    b.type === "heading" &&
    b.level === 2 &&
    !isPrice(b.text) &&
    !isDiscount(b.text) &&
    !isIncludesLabel(b.text) &&
    !isFeeLabel(b.text) &&
    !isLongText(b.text)
  );
}

export type ServiceIntro = {
  tagline?: string;
  features: string[];
};

// The first H2 group on old service pages is a hero fragment ("Setup a Pvt Ltd
// Company" + tagline + deliverables list) that near-duplicates the page title
// and the pricing cards' features. Lift it out so it can render as a compact
// page header instead of repeating as body content.
function extractIntro(blocks: ContentBlock[]): { intro: ServiceIntro | null; rest: ContentBlock[] } {
  const first = blocks[0];
  if (!first || first.type !== "heading" || first.level !== 2) {
    return { intro: null, rest: blocks };
  }
  let i = 1;
  let tagline: string | undefined;
  const features: string[] = [];
  while (i < blocks.length && blocks[i].type !== "heading") {
    const b = blocks[i];
    if (b.type === "paragraph" && !tagline) tagline = b.text;
    if (b.type === "list") {
      for (const item of b.items) {
        // stray CTA leftovers like "View Sample Certificate" aren't deliverables
        if (!/view sample/i.test(item)) features.push(item);
      }
    }
    i++;
  }
  if (!tagline && features.length === 0) return { intro: null, rest: blocks };
  return { intro: { tagline, features: features.slice(0, 6) }, rest: blocks.slice(i) };
}

// Every page that has a Trustpilot badge has it as the literal first content
// block — rendered inline it's a large, disconnected image sitting above
// everything else, and worse, it also blocks extractIntro() below (which
// only looks for a lead-in tagline when the *first* block is a heading).
// Pull it out so it can render as a small badge near the H1 instead, and so
// intro extraction can see past it to the real opening heading.
function extractTrustBadge(blocks: ContentBlock[]): { badge: { src: string; alt: string } | null; rest: ContentBlock[] } {
  const first = blocks[0];
  if (first?.type === "image" && /trustpilot/i.test(first.src)) {
    return { badge: { src: first.src, alt: first.alt || "Trustpilot rating" }, rest: blocks.slice(1) };
  }
  return { badge: null, rest: blocks };
}

// The old Elementor pages embed a 3-tier pricing table as a flat run of blocks
// after a "Right Plan for your Business" heading: plan name → description →
// ₹original → "X% off" → ₹final → "What You'll Get" → feature list(s).
// Split the page around it so the pricing can render as real cards.
export function getServiceContent(page: Page): {
  intro: ServiceIntro | null;
  trustBadge: { src: string; alt: string } | null;
  before: ContentBlock[];
  plans: PricingPlan[];
  after: ContentBlock[];
} {
  const { badge: trustBadge, rest: withoutBadge } = extractTrustBadge(getCleanBlocks(page));
  const { intro, rest: blocks } = extractIntro(withoutBadge);
  let start = blocks.findIndex(
    (b) => b.type === "heading" && /right plan|pricing options/i.test(b.text)
  );
  let requireMultiple = false;
  if (start === -1) {
    // Some pages (e.g. a "Trademark Fees" heading) skip the "Right Plan for your
    // Business" label entirely and go straight into plan cards. Detect that
    // structurally: a plan-name heading followed (before the next plan name) by
    // both a price AND a discount/"what you'll get" — that combination is what
    // distinguishes a real tiered plan card from an unrelated "type of X,
    // ₹price each" listing (e.g. FSSAI's Basic/State/Central license
    // breakdown), which just has a name + price + one-line description.
    const findPlanStart = (requireEvidence: boolean) =>
      blocks.findIndex((b, idx) => {
        if (!isPlanNameHeading(b)) return false;
        let sawPrice = false;
        let sawPlanEvidence = false;
        for (let k = idx + 1; k < Math.min(idx + 8, blocks.length); k++) {
          const nb = blocks[k];
          if (nb.type === "heading" && isPlanNameHeading(nb)) break;
          if (nb.type === "heading" && isPrice(nb.text)) sawPrice = true;
          if (nb.type === "heading" && (isDiscount(nb.text) || isIncludesLabel(nb.text))) sawPlanEvidence = true;
        }
        return sawPrice && (requireEvidence || sawPlanEvidence);
      });

    let planIdx = findPlanStart(true);
    if (planIdx === -1) {
      // Fall back to the looser "name + price, no discount/checklist" shape —
      // still worth real cards instead of flat headings, but since a single
      // stray heading-then-price mention elsewhere in the copy could also
      // match, require this to repeat at least twice before trusting it.
      planIdx = findPlanStart(false);
      requireMultiple = true;
    }
    if (planIdx === -1) return { intro, trustBadge, before: blocks, plans: [], after: [] };
    start = planIdx - 1;
  }

  // Collects consecutive plan-name → price → discount → features groups
  // starting at `from`, stopping at the first heading that doesn't resolve
  // to a real plan (no price found in its group). Pulled out as its own
  // function because some pages (a WordPress revision artifact — the same
  // 3 price points re-entered under a renamed set of tiers) repeat the
  // *entire* "Right Plan for your Business" table a second time further
  // down the page, and that second table needs the exact same extraction
  // run again to know where it ends.
  function collectPlanGroup(from: number): { plans: PricingPlan[]; end: number } {
    const collected: PricingPlan[] = [];
    let i = from;
    while (i < blocks.length) {
      const b = blocks[i];
      if (b.type !== "heading" || !isPlanNameHeading(b)) {
        // stray price/discount/label/description/image block between or after
        // groups — consume it. (Any heading here is by definition not a valid
        // plan name, isPlanNameHeading already ruled that out above.)
        if (b.type === "heading" || b.type === "list" || b.type === "paragraph" || b.type === "image") {
          i++;
          continue;
        }
        break;
      }

      // candidate plan: collect its group up to the next plan-name heading
      let j = i + 1;
      while (j < blocks.length && !isPlanNameHeading(blocks[j])) j++;
      const group = blocks.slice(i + 1, j);

      const prices = group.filter(
        (g): g is { type: "heading"; level: number; text: string } => g.type === "heading" && isPrice(g.text)
      );
      if (prices.length === 0) break; // not a plan — pricing section is over

      const discount = group.find(
        (g): g is { type: "heading"; level: number; text: string } => g.type === "heading" && isDiscount(g.text)
      );
      // A description usually sits right after the plan name, before pricing
      // starts (name → description → ₹price → ...) — and can be tagged as
      // either a <p> or (on some pages) a heading that's really a full
      // sentence. A paragraph appearing after the feature list is more likely
      // a trailing disclaimer ("* Govt fees vary by state") than a real
      // per-plan description, so prefer the before-price slot; only fall back
      // to scanning after price (name → price → description, no checklist —
      // e.g. FSSAI's license tiers) if nothing was found there, and skip
      // anything disclaimer-shaped either way.
      const isDisclaimerLike = (t: string) => /^\*|^note[:.]/i.test(t.trim());
      const isDescriptionBlock = (
        g: ContentBlock
      ): g is { type: "paragraph"; text: string } | { type: "heading"; level: number; text: string } =>
        (g.type === "paragraph" || (g.type === "heading" && isLongText(g.text))) && !isDisclaimerLike(g.text);
      const firstPriceIdx = group.findIndex((g) => g.type === "heading" && isPrice(g.text));
      const before = group.slice(0, firstPriceIdx === -1 ? group.length : firstPriceIdx);
      const after = firstPriceIdx === -1 ? [] : group.slice(firstPriceIdx + 1);
      const description = before.find(isDescriptionBlock) ?? after.find(isDescriptionBlock);
      const features = group
        .filter((g): g is { type: "list"; items: string[] } => g.type === "list")
        .flatMap((g) => g.items);

      // Elementor desktop+mobile copies can repeat whole plans — keep the first
      // occurrence of each plan name only.
      if (!collected.some((p) => p.name === b.text)) {
        collected.push({
          name: b.text,
          description: description?.text ?? "",
          originalPrice: prices.length > 1 ? prices[0].text : undefined,
          discount: discount?.text,
          price: prices[prices.length - 1].text,
          features,
        });
      }
      i = j;
    }
    return { plans: collected, end: i };
  }

  let { plans, end: i } = collectPlanGroup(start + 1);

  // The block that stopped the loop above might itself be another "Right
  // Plan for your Business" heading — the whole table repeated. Try
  // extracting a second time right after it; if most of what comes back is
  // the same prices we already have, it's the duplicate, so drop it instead
  // of leaving it to spill out as raw headings in `after`.
  if (plans.length > 0 && blocks[i]?.type === "heading" && /right plan|pricing options/i.test((blocks[i] as { text: string }).text)) {
    let dupStart = i + 1;
    if (blocks[dupStart]?.type === "paragraph") dupStart++; // skip the repeated intro line too
    const dup = collectPlanGroup(dupStart);
    if (dup.plans.length > 0) {
      // Compare on just the ₹ figure — one table can write the same price as
      // "₹6999" and the other as "₹6999 +Govt. Fee" (the label folded into
      // the same heading instead of split out), which are the same price.
      const priceFigure = (t: string) => t.match(/₹[\d,]+/)?.[0] ?? t;
      const knownPrices = new Set(plans.map((p) => priceFigure(p.price)));
      const overlap = dup.plans.filter((p) => knownPrices.has(priceFigure(p.price))).length;
      if (overlap / dup.plans.length >= 0.5) {
        i = dup.end; // duplicate table — same prices, different names; discard it
      } else {
        plans = [...plans, ...dup.plans]; // genuinely different tiers — keep both
        i = dup.end;
      }
    }
  }

  if (requireMultiple && plans.length < 2) return { intro, trustBadge, before: blocks, plans: [], after: [] };
  return { intro, trustBadge, before: blocks.slice(0, start), plans, after: blocks.slice(i) };
}

export type ProcessStep = { label: string; description: string };

// Old service pages have a "X Process" H2 followed by a run of steps, in one of
// two shapes: (a) H3 "Day N - M" + a one-line paragraph, or (b) H3 holding the
// full step description on its own with an icon image instead of a paragraph
// (no short label available). Both can have decorative images anywhere in
// between — those are always dropped, never rendered at full size inline.
export function extractProcessSteps(blocks: ContentBlock[]): {
  title: string | null;
  steps: ProcessStep[];
  before: ContentBlock[];
  after: ContentBlock[];
} {
  const idx = blocks.findIndex((b) => b.type === "heading" && b.level === 2 && /process/i.test(b.text));
  if (idx === -1) return { title: null, steps: [], before: blocks, after: [] };

  const title = (blocks[idx] as { text: string }).text;
  const steps: ProcessStep[] = [];
  let i = idx + 1;
  while (i < blocks.length) {
    while (blocks[i]?.type === "image") i++;
    const heading = blocks[i];
    if (!heading || heading.type !== "heading" || heading.level !== 3) break;
    let j = i + 1;
    while (blocks[j]?.type === "image") j++;
    const para = blocks[j];
    if (para && para.type === "paragraph") {
      steps.push({ label: heading.text, description: para.text });
      i = j + 1;
    } else {
      steps.push({ label: `Step ${steps.length + 1}`, description: heading.text });
      i = j;
    }
  }
  if (steps.length === 0) return { title: null, steps: [], before: blocks, after: [] };
  return { title, steps, before: blocks.slice(0, idx), after: blocks.slice(i) };
}

export function excerptFor(page: Page, maxLen = 155): string {
  const paragraph = page.blocks.find(
    (b): b is { type: "paragraph"; text: string } => b.type === "paragraph" && b.text.length > 40
  );
  const text = paragraph?.text ?? "";
  return text.length > maxLen ? text.slice(0, maxLen - 1).trimEnd() + "…" : text;
}

export function getServiceSlugs(): string[] {
  return NAV_CATEGORIES.flatMap((c) => c.slugs);
}

export function getCategoryForSlug(slug: string) {
  return NAV_CATEGORIES.find((c) => c.slugs.includes(slug));
}

export type SearchEntry = { title: string; href: string; category?: string };

export function getSearchIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const cat of NAV_CATEGORIES) {
    for (const slug of cat.slugs) {
      const page = getPage(slug);
      if (page) entries.push({ title: page.title, href: `/services/${slug}`, category: cat.label });
    }
  }
  for (const slug of UTILITY_SLUGS) {
    const page = getPage(slug);
    if (page) entries.push({ title: page.title, href: `/${slug}` });
  }
  for (const p of getAllPosts()) {
    entries.push({ title: p.title, href: `/blog/${p.slug}` });
  }
  return entries;
}

export { NAV_CATEGORIES };
