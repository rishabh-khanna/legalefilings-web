// A rotated "price tag" badge — referenced from doola.com's own offer
// banner (a yellow price-tag graphic with a bold discount reading). Ours
// reads the real number (see the caller): the highest discount actually
// listed on any of our pricing pages, not a fabricated promo. Text is drawn
// as real SVG <text> inside the same rotated group as the tag shape (rather
// than an HTML overlay positioned on top), and "50% OFF" is split onto two
// short lines — as one line at a size big enough to read, it was wider than
// the tag shape itself and visually overlapped/overflowed it.
export function PriceTagBadge({ label, sub }: { label: string; sub: string }) {
  const [labelTop, labelBottom] = label.split(" ");

  return (
    <svg
      viewBox="0 0 124 92"
      className="hidden h-20 w-auto shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)] sm:block"
      aria-hidden="true"
    >
      <g transform="rotate(-6 62 46)">
        <path
          d="M10 46 L36 14 L112 14 L112 78 L36 78 Z"
          fill="var(--color-accent)"
          stroke="var(--color-ink-fixed)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="27" cy="46" r="6" fill="var(--color-ink-fixed)" fillOpacity="0.12" stroke="var(--color-ink-fixed)" strokeWidth="2" />
        <text x="74" y="30" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-ink-fixed)">
          {sub}
        </text>
        <text x="74" y="52" textAnchor="middle" fontSize="19" fontWeight="800" fill="var(--color-ink-fixed)">
          {labelTop}
        </text>
        {labelBottom && (
          <text x="74" y="70" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--color-ink-fixed)">
            {labelBottom}
          </text>
        )}
      </g>
    </svg>
  );
}
