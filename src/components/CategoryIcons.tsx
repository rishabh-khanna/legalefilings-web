// A small shared icon set — purely decorative wayfinding glyphs, reused
// across the mobile nav, service page headers, and the homepage feature
// grid so the same visual language (simple, rounded, single-stroke line
// icons) shows up consistently instead of each spot inventing its own.
type IconProps = { className?: string };

export const CATEGORY_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  "Start Business": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 21V7l6-3v17M4 21h16M10 4l6 3v14M14 21V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Registrations: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5Z" strokeLinejoin="round" />
      <path d="m9 12.5 2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "Company Compliances": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3.5 5 6v6c0 4.2 3 7.4 7 8.5 4-1.1 7-4.3 7-8.5V6l-7-2.5Z" strokeLinejoin="round" />
      <path d="m9.3 12 1.9 1.9 3.5-3.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "GST & Income Tax Returns": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 3.5h12v17l-2.5-1.5L13 20.5 10.5 19 8 20.5 5.5 19 6 20.5V3.5Z" strokeLinejoin="round" />
      <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" strokeLinecap="round" />
    </svg>
  ),
};

export const FEATURE_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  expertise: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 2.5 4.5 6.2v5.8c0 5 3.2 8.8 7.5 10 4.3-1.2 7.5-5 7.5-10V6.2L12 2.5Z" strokeLinejoin="round" />
      <path d="M12 8v4.2M9.6 10.6h4.8" strokeLinecap="round" />
    </svg>
  ),
  support: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 13c1 4 7 4 8 0" strokeLinecap="round" />
      <path d="M8.5 10h.01M15.5 10h.01" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  ),
  speed: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M13 2 4.5 13.5H11l-1 8.5L19 10h-6.5L13 2Z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
  businesses: ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 21V9l5-3.5V21M8 21V5.5L14 3v18M14 21v-9h5.5V21" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 21h18" strokeLinecap="round" />
    </svg>
  ),
};

// A soft glowing circular badge behind a line icon — referenced from
// ContactGraphic.tsx's own "delivered" badge treatment (white disc + blur
// glow + a currentColor icon), pulled out as a reusable wrapper so the same
// polished look can sit anywhere a bare icon would otherwise look plain.
export function GlowBadge({
  icon,
  size = 56,
  className = "",
  tone = "var(--color-action-dark)",
}: {
  icon: React.ReactNode;
  size?: number;
  className?: string;
  tone?: string;
}) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: "var(--color-accent)", opacity: 0.25, filter: "blur(10px)" }}
      />
      <span
        className="relative flex h-full w-full items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--color-accent-tint)", color: tone }}
      >
        {icon}
      </span>
    </span>
  );
}
