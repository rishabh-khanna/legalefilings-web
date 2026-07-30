import { SOCIAL_LINKS } from "@/config/site";

const ICONS: Record<keyof typeof SOCIAL_LINKS, React.ReactNode> = {
  facebook: (
    <path d="M13.5 21v-7.5h2.5l.4-3H13.5V8.5c0-.87.24-1.46 1.49-1.46H16.5V4.35C16.22 4.31 15.26 4.23 14.14 4.23c-2.33 0-3.93 1.42-3.93 4.03V10.5H7.7v3h2.51V21h3.29Z" />
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <line x1="7.5" y1="10" x2="7.5" y2="16.5" />
      <line x1="7.5" y1="7.2" x2="7.5" y2="7.2" />
      <path d="M11 16.5V10M11 12.7c0-1.5 1-2.7 2.5-2.7s2.5 1.1 2.5 2.7v3.8" />
    </>
  ),
  x: <path d="M5 4.5 18.7 19.5M18.7 4.5 5 19.5" />,
  youtube: (
    <>
      <rect x="3.5" y="6.5" width="17" height="11" rx="3" />
      <path d="M10.3 9.7v4.6l4-2.3-4-2.3Z" fill="currentColor" stroke="none" />
    </>
  ),
};

const LABELS: Record<keyof typeof SOCIAL_LINKS, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  youtube: "YouTube",
};

export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {(Object.keys(SOCIAL_LINKS) as (keyof typeof SOCIAL_LINKS)[]).map((key) => (
        <a
          key={key}
          href={SOCIAL_LINKS[key]}
          aria-label={LABELS[key]}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:text-[var(--color-action)] hover:border-[var(--color-action)]"
          style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {ICONS[key]}
          </svg>
        </a>
      ))}
    </div>
  );
}
