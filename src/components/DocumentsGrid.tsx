import type { SVGProps } from "react";

type IconComponent = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

function iconBase(children: React.ReactNode) {
  return function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    );
  };
}

const IdIcon = iconBase(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2" />
    <path d="M6 16c.5-2 2-3 3-3s2.5 1 3 3M14 9.5h4M14 13h4" />
  </>,
);

const CardIcon = iconBase(
  <>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <rect x="6" y="9" width="4" height="4" rx="0.5" />
    <path d="M13 9.5h5M13 12h5M6 15.5h3" />
  </>,
);

const CameraIcon = iconBase(
  <>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.3" />
  </>,
);

const PinIcon = iconBase(
  <>
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.3" />
  </>,
);

const BankIcon = iconBase(
  <>
    <path d="M3 10 12 4l9 6" />
    <path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9" />
    <path d="M3 19h18" />
  </>,
);

const CertificateIcon = iconBase(
  <>
    <rect x="4" y="3" width="16" height="13" rx="1.5" />
    <path d="M7.5 7h9M7.5 10h6" />
    <path d="M9.5 16v5l2.5-1.5 2.5 1.5v-5" />
  </>,
);

const PhoneIcon = iconBase(
  <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11.4 21 3 12.6 3 3.7c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8Z" />,
);

const TagIcon = iconBase(
  <>
    <path d="M12.6 3H20a1 1 0 0 1 1 1v7.4a1 1 0 0 1-.3.7l-8.6 8.6a1 1 0 0 1-1.4 0l-7.4-7.4a1 1 0 0 1 0-1.4l8.6-8.6a1 1 0 0 1 .7-.3Z" />
    <circle cx="16.5" cy="7.5" r="1.4" />
  </>,
);

const PenIcon = iconBase(
  <>
    <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M14 6.5 17.5 10" />
  </>,
);

const StackIcon = iconBase(
  <>
    <rect x="6.5" y="3" width="11.5" height="15" rx="1.5" />
    <path d="M3 6.5v13.5h11.5" />
    <path d="M9.5 8h5M9.5 11h3.5" />
  </>,
);

const DocIcon = iconBase(
  <>
    <path d="M7 3h7l4 4v14H7Z" />
    <path d="M14 3v4h4" />
    <path d="M9.5 9h2M9.5 12h5M9.5 15h5" />
  </>,
);

function pickIcon(text: string): IconComponent {
  const hasPan = /\bpan\b/i.test(text);
  const hasAadhaar = /aadha?ar/i.test(text);
  if (hasPan && hasAadhaar) return IdIcon;
  if (hasAadhaar) return IdIcon;
  if (hasPan) return CardIcon;
  if (/photograph|passport size|photo\b/i.test(text)) return CameraIcon;
  if (/passport\b/i.test(text)) return CardIcon;
  if (/noc|rent|electricity|gas bill|telephone|utility|address|registered office|business address/i.test(text)) return PinIcon;
  if (/bank|cheque/i.test(text)) return BankIcon;
  if (/certificate|incorporation|registration\b/i.test(text)) return CertificateIcon;
  if (/resolution/i.test(text)) return StackIcon;
  if (/contact/i.test(text)) return PhoneIcon;
  if (/brand name|logo/i.test(text)) return TagIcon;
  if (/signature|dsc\b/i.test(text)) return PenIcon;
  if (/moa|aoa|memorandum|articles/i.test(text)) return StackIcon;
  return DocIcon;
}

// WordPress copy is written as instructions ("Scanned copy of the latest
// bank statement..."), not the short shouty labels a card grid needs.
// Strip the boilerplate lead-in so the real document name is what's left —
// this reformats existing text, it never invents new content.
const LABEL_PREFIX_RE = /^(scanned copy of( the)?( latest)?|self[- ]attested copy of|copy of( the)?)\s+/i;

function shortLabel(raw: string): string {
  const stripped = raw.trim().replace(LABEL_PREFIX_RE, "");
  return stripped ? stripped[0].toUpperCase() + stripped.slice(1) : stripped;
}

// "Scanned copy of the latest bank statement/telephone or mobile bill/
// electricity or gas bill" is really 3 acceptable documents run together
// with slashes, not one long document name — split those into their own
// cards. A single slash (e.g. "Promoters/Director's Identity proof") is
// usually a compound word, not a list, so only split when there are 2+.
function splitAlternatives(text: string): string[] {
  const slashCount = (text.match(/\//g) ?? []).length;
  if (slashCount < 2) return [text];
  return text.split("/").map((s) => s.trim()).filter(Boolean);
}

export function DocumentsGrid({ items }: { items: string[] }) {
  const seen = new Set<string>();
  const cards: { label: string; Icon: IconComponent }[] = [];
  for (const raw of items) {
    for (const segment of splitAlternatives(raw)) {
      const label = shortLabel(segment);
      const key = label.toLowerCase();
      if (!label || seen.has(key)) continue;
      seen.add(key);
      cards.push({ label, Icon: pickIcon(segment) });
    }
  }

  if (cards.length === 0) return null;

  return (
    <div className="my-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className="flex flex-col items-center gap-3 rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)] p-5 text-center transition-[box-shadow,border-color] hover:shadow-md hover:border-[var(--color-accent)]"
          style={{ borderColor: "var(--color-line)" }}
        >
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-accent-tint)" }}
          >
            <card.Icon className="h-7 w-7" style={{ color: "var(--color-accent-dark)" }} />
          </span>
          <p className="text-sm font-semibold leading-snug line-clamp-3" style={{ color: "var(--color-ink)" }}>
            {card.label}
          </p>
        </div>
      ))}
    </div>
  );
}
