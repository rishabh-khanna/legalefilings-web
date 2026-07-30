import type { ContentBlock } from "@/lib/content";
import { makeUniqueSlug } from "@/lib/content";
import { FaqAccordion } from "@/components/FaqAccordion";
import { DocumentsGrid } from "@/components/DocumentsGrid";

function headingClass(level: number) {
  switch (level) {
    case 1:
      return "text-3xl font-semibold mt-10 mb-4";
    case 3:
      return "text-lg font-semibold mt-8 mb-2";
    default:
      return "text-base font-semibold mt-4 mb-2";
  }
}

type ImageBlock = Extract<ContentBlock, { type: "image" }>;
type TagItem = { label: string; image: ImageBlock | null };

type TestimonialItem = { photo: ImageBlock; name: string; title: string; quote?: string };
type StepItem = { image: ImageBlock | null; title: string; description?: string };

type RenderGroup =
  | { kind: "faq-group"; items: { question: string; answer: string }[] }
  | { kind: "image-row"; images: ImageBlock[] }
  | { kind: "tag-grid"; items: TagItem[] }
  | { kind: "list-group"; items: string[] }
  | { kind: "documents-grid"; items: string[] }
  | { kind: "testimonial-group"; items: TestimonialItem[] }
  | { kind: "step-group"; items: StepItem[] }
  | { kind: "single"; block: ContentBlock };

function groupBlocks(blocks: ContentBlock[]): RenderGroup[] {
  const groups: RenderGroup[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];

    // "Documents Required" sections vary in shape across pages — sometimes a
    // flat run of lists, sometimes sub-headings each followed by their own
    // list (e.g. "Identity Proof" / "Registered Office Proof") — but on
    // every page it's real checklist content that reads much better as an
    // icon grid than a plain bulleted list. Keep the heading itself (still
    // rendered normally below, with its own anchor) and swap only what
    // follows it.
    if (block.type === "heading" && block.level === 2 && /^documents required\b/i.test(block.text.trim())) {
      groups.push({ kind: "single", block });
      i++;
      const items: string[] = [];
      while (i < blocks.length) {
        const next = blocks[i];
        if (next.type === "list") {
          items.push(...next.items);
          i++;
          continue;
        }
        const after = blocks[i + 1];
        if (next.type === "heading" && after?.type === "list") {
          items.push(...after.items);
          i += 2;
          continue;
        }
        break;
      }
      if (items.length > 0) {
        groups.push({ kind: "documents-grid", items });
      }
      continue;
    }

    // A real Google-review testimonial (photo + name + job title, sometimes
    // a quote) came through as a full-size body image followed by plain
    // headings — rendered at full size it reads as a giant, out-of-place
    // photo of a stranger. Render it as a small, consistent testimonial
    // card instead, same treatment on every page it shows up on.
    const isTestimonialStart = (idx: number): boolean => {
      const img = blocks[idx];
      const name = blocks[idx + 1];
      const title = blocks[idx + 2];
      return (
        img?.type === "image" &&
        name?.type === "heading" && name.level === 3 &&
        title?.type === "heading" && title.level === 4
      );
    };
    if (isTestimonialStart(i)) {
      const items: TestimonialItem[] = [];
      let j = i;
      while (isTestimonialStart(j)) {
        const photo = blocks[j] as ImageBlock;
        const name = (blocks[j + 1] as Extract<ContentBlock, { type: "heading" }>).text;
        const title = (blocks[j + 2] as Extract<ContentBlock, { type: "heading" }>).text;
        let cursor = j + 3;
        let quote: string | undefined;
        if (blocks[cursor]?.type === "paragraph") {
          quote = (blocks[cursor] as Extract<ContentBlock, { type: "paragraph" }>).text;
          cursor++;
        }
        items.push({ photo, name, title, quote });
        j = cursor;
      }
      groups.push({ kind: "testimonial-group", items });
      i = j;
      continue;
    }

    if (block.type === "faq") {
      const last = groups[groups.length - 1];
      if (last && last.kind === "faq-group") {
        last.items.push({ question: block.question, answer: block.answer });
      } else {
        groups.push({ kind: "faq-group", items: [{ question: block.question, answer: block.answer }] });
      }
      i++;
      continue;
    }

    // A page can have a second "...Process" section that extractProcessSteps
    // (which only grabs the first match) never pulls out — e.g. a leftover
    // icon+step run further down the page. Left alone, each icon renders as
    // its own full-size body image with a disconnected heading/paragraph
    // after it. Catch any (image?, H3, paragraph?) run with 2+ items where
    // at least one has real body text and render it as a small, uniform
    // icon-card list instead — the same fallback wherever this shape recurs.
    const isStepStart = (idx: number): boolean => {
      const cursor = blocks[idx]?.type === "image" ? idx + 1 : idx;
      const heading = blocks[cursor];
      return !!heading && heading.type === "heading" && heading.level === 3;
    };
    if (isStepStart(i)) {
      const items: { image: ImageBlock | null; title: string; description?: string }[] = [];
      let j = i;
      while (isStepStart(j)) {
        let cursor = j;
        let image: ImageBlock | null = null;
        if (blocks[cursor]?.type === "image") {
          image = blocks[cursor] as ImageBlock;
          cursor++;
        }
        const heading = blocks[cursor] as Extract<ContentBlock, { type: "heading" }>;
        cursor++;
        let description: string | undefined;
        if (blocks[cursor]?.type === "paragraph") {
          description = (blocks[cursor] as Extract<ContentBlock, { type: "paragraph" }>).text;
          cursor++;
        }
        items.push({ image, title: heading.text, description });
        j = cursor;
      }
      if (items.length >= 2 && items.some((it) => it.description)) {
        groups.push({ kind: "step-group", items });
        i = j;
        continue;
      }
      // No item had a description — that's the bare-label tag-grid case below.
    }

    // A run of "who needs this / applies to" H3s with no description (just an
    // optional icon) — e.g. Canteen / Club / Dhaba / Distributor — was taking
    // a full heading-sized block each, for a one-word label. Collapse 3+ of
    // these bare H3s into a compact tag grid instead. The run can start
    // either right at the heading or at a leading image before it.
    const isH3 = (b: ContentBlock | undefined) => b?.type === "heading" && b.level === 3;
    if (isH3(block) || (block.type === "image" && isH3(blocks[i + 1]))) {
      const items: TagItem[] = [];
      let j = i;
      while (j < blocks.length) {
        let cursor = j;
        let leadingImg: ImageBlock | null = null;
        if (blocks[cursor]?.type === "image") {
          leadingImg = blocks[cursor] as ImageBlock;
          cursor++;
        }
        const heading = blocks[cursor];
        if (!heading || heading.type !== "heading" || heading.level !== 3) break;
        cursor++;
        // Only look for a trailing image when there was no leading one —
        // otherwise a "before" image on this item and the NEXT item's
        // leading image both sit right after this heading, and grabbing
        // one as "trailing" here steals it from the next item, shifting
        // every image-label pairing after it by one.
        let img = leadingImg;
        if (!img && blocks[cursor]?.type === "image") {
          img = blocks[cursor] as ImageBlock;
          cursor++;
        }
        if (blocks[cursor]?.type === "paragraph") break; // has a real description — not a bare tag, stop before it
        items.push({ label: heading.text, image: img });
        j = cursor;
      }
      if (items.length >= 3) {
        groups.push({ kind: "tag-grid", items });
        i = j;
        continue;
      }
      // fewer than 3 — not worth a special layout, fall through to normal heading handling
    }

    // Elementor sometimes splits one bullet list into two adjacent <ul>
    // blocks (a desktop/mobile artifact, e.g. a 2-item list then a separate
    // 1-item list right after) — each block got its own bottom margin, so
    // the split point read as an odd, inconsistent gap mid-list. They're
    // really one list; merge consecutive list blocks before rendering.
    if (block.type === "list") {
      const last = groups[groups.length - 1];
      if (last && last.kind === "list-group") {
        last.items.push(...block.items);
      } else {
        groups.push({ kind: "list-group", items: [...block.items] });
      }
      i++;
      continue;
    }

    // A run of 2+ images back-to-back is usually a logo/trust bar (e.g.
    // "Trusted by these companies") and lays out as a small row — but a
    // *portrait* image back-to-back with another one is a different shape
    // entirely (the Career page's two tall waving-character illustrations
    // got squashed to a 40px sliver here before this check existed), so
    // only landscape/square images join the row; a portrait one always
    // renders through the single-image path at real size.
    const isLandscapeOrSquare = (b: ImageBlock) => !b.width || !b.height || b.width / b.height >= 1;
    if (block.type === "image" && isLandscapeOrSquare(block)) {
      const last = groups[groups.length - 1];
      if (last && last.kind === "image-row") {
        last.images.push(block);
      } else {
        groups.push({ kind: "image-row", images: [block] });
      }
      i++;
      continue;
    }

    groups.push({ kind: "single", block });
    i++;
  }
  return groups.map((g) => (g.kind === "image-row" && g.images.length === 1 ? { kind: "single", block: g.images[0] } : g));
}

// Prose (headings, paragraphs, plain lists, FAQs) stays at a readable
// ~672px column width — a full 1152px line length is uncomfortable to
// read. But the card-grid sections below (documents, testimonials, steps,
// tags) and tables are visual, not text, and were getting squeezed into
// that same narrow column purely because they shared one blanket wrapper
// with the prose — leaving a huge empty margin next to every grid on every
// page. Those render at the full container width instead; only the
// text-flow elements get the max-w-2xl cap now, applied per-element.
const PROSE_WIDTH = "max-w-2xl";

export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  const groups = groupBlocks(blocks);
  const seenH2Slugs = new Map<string, number>();

  return (
    <div>
      {groups.map((group, i) => {
        if (group.kind === "faq-group") {
          return (
            <div key={i} className={PROSE_WIDTH}>
              <FaqAccordion items={group.items} />
            </div>
          );
        }

        if (group.kind === "tag-grid") {
          return (
            <div key={i} className="my-6 flex flex-wrap gap-2.5">
              {group.items.map((item, j) => (
                <span
                  key={j}
                  className="inline-flex items-center gap-2 rounded-full border bg-white dark:bg-[var(--color-paper-raised)] py-1.5 pl-1.5 pr-4 text-sm font-medium"
                  style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                >
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image.src} alt="" loading="lazy" decoding="async" className="h-6 w-6 rounded-full object-contain" />
                  )}
                  {item.label}
                </span>
              ))}
            </div>
          );
        }

        if (group.kind === "documents-grid") {
          return <DocumentsGrid key={i} items={group.items} />;
        }

        if (group.kind === "testimonial-group") {
          return (
            <div key={i} className="my-6 grid gap-4 sm:grid-cols-2">
              {group.items.map((t, j) => (
                <div
                  key={j}
                  className="rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)] p-4"
                  style={{ borderColor: "var(--color-line)" }}
                >
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.photo.src}
                      alt={t.name}
                      loading="lazy"
                      decoding="async"
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{t.name}</p>
                      <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>{t.title}</p>
                    </div>
                  </div>
                  {t.quote && (
                    <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
                      &ldquo;{t.quote}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          );
        }

        if (group.kind === "step-group") {
          return (
            <div key={i} className="my-6 grid gap-4 sm:grid-cols-2">
              {group.items.map((s, j) => (
                <div
                  key={j}
                  className="rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)] p-4"
                  style={{ borderColor: "var(--color-line)" }}
                >
                  <div className="flex items-center gap-3">
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.image.src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-10 w-10 shrink-0 object-contain"
                      />
                    ) : (
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                        style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-accent-dark)" }}
                      >
                        {j + 1}
                      </span>
                    )}
                    <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{s.title}</p>
                  </div>
                  {s.description && (
                    <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
                      {s.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          );
        }

        if (group.kind === "list-group") {
          return (
            <ul key={i} className={`${PROSE_WIDTH} list-disc pl-5 mb-4 space-y-1 text-slate-700 dark:text-[var(--color-ink-soft)]`}>
              {group.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }

        if (group.kind === "image-row") {
          return (
            <div key={i} className="my-6 flex flex-wrap items-center gap-x-8 gap-y-5">
              {group.images.map((img, j) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={j}
                  src={img.src}
                  alt={img.alt}
                  width={img.width}
                  height={img.height}
                  loading="lazy"
                  decoding="async"
                  className="h-10 w-auto max-w-[160px] object-contain"
                />
              ))}
            </div>
          );
        }

        const block = group.block;

        if (block.type === "heading") {
          const Tag = `h${Math.min(block.level, 6)}` as keyof React.JSX.IntrinsicElements;
          // H2s get a bolder treatment with a short accent bar instead of a
          // thin full-width rule — meant to actually grab the eye scanning
          // down the page, and they're the section-nav anchor targets, so
          // the id/scroll-mt live on the wrapper rather than the text itself.
          if (block.level === 2) {
            const id = makeUniqueSlug(block.text, seenH2Slugs);
            return (
              <div key={i} id={id} className={`${PROSE_WIDTH} mt-14 mb-4 scroll-mt-nav`}>
                <Tag className="text-2xl md:text-3xl font-extrabold" style={{ color: "var(--color-ink)" }}>
                  {block.text}
                </Tag>
                <span
                  aria-hidden="true"
                  className="mt-2 block h-1 w-12 rounded-full"
                  style={{ backgroundColor: "var(--color-accent)" }}
                />
              </div>
            );
          }
          return (
            <Tag key={i} className={`${PROSE_WIDTH} ${headingClass(block.level)} scroll-mt-nav`}>
              {block.text}
            </Tag>
          );
        }
        if (block.type === "paragraph") {
          return (
            <p key={i} className={`${PROSE_WIDTH} text-slate-700 dark:text-[var(--color-ink-soft)] leading-relaxed mb-3`}>
              {block.text}
            </p>
          );
        }
        if (block.type === "table") {
          return (
            <div
              key={i}
              className="my-6 overflow-x-auto rounded-2xl border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.05)]"
              style={{ borderColor: "var(--color-line)" }}
            >
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
                    {block.headers.map((h, hi) => (
                      <th key={hi} className="px-4 py-3.5 font-semibold whitespace-nowrap" style={{ color: "var(--color-ink)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, ri) => (
                    <tr
                      key={ri}
                      className="border-t"
                      style={{ borderColor: "var(--color-line)", backgroundColor: ri % 2 === 1 ? "var(--color-paper)" : undefined }}
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className="px-4 py-3.5"
                          style={{ color: ci === 0 ? "var(--color-ink)" : "var(--color-ink-soft)", fontWeight: ci === 0 ? 500 : 400 }}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === "image") {
          // A handful of source images are really wide, flat partner/
          // certification badges (a ~9600×1250px "Zoho Authorized Partner"
          // banner, in one case) — full column width makes them read as a
          // giant stray logo. Render anything that shape as a small badge,
          // same as the Trustpilot badge elsewhere on the site.
          const ratio = block.width && block.height ? block.width / block.height : 1;
          if (ratio >= 3) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={block.src}
                alt={block.alt}
                loading="lazy"
                decoding="async"
                className="my-4 h-8 w-auto max-w-[220px] object-contain"
              />
            );
          }
          // Large stand-alone illustrations (e.g. a decorative "did you
          // know" graphic) read as an orphaned floating image dropped mid-
          // page — small inline icons don't have this problem, so only give
          // the card treatment to genuinely large visuals.
          if ((block.height ?? 0) >= 250) {
            return (
              <div key={i} className="my-6 flex justify-center">
                <div
                  className="rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)] p-6"
                  style={{ borderColor: "var(--color-line)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={block.src}
                    alt={block.alt}
                    loading="lazy"
                    decoding="async"
                    className="mx-auto max-h-72 w-auto object-contain"
                  />
                </div>
              </div>
            );
          }
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={block.src}
              alt={block.alt}
              width={block.width}
              height={block.height}
              loading="lazy"
              decoding="async"
              className="max-h-96 max-w-full w-auto h-auto my-4 rounded object-contain"
            />
          );
        }
        return null;
      })}
    </div>
  );
}
