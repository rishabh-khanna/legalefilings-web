// Clean professional icons (not photos, not cartoon avatars) for the two
// floating widgets — a small cropped photo reads badly at 36-40px, and a
// drawn cartoon face felt off-brand for a compliance/filing service. Each
// icon is meaningful for what its widget actually does: a quote/document
// mark for "Get a Free Quote," a headset for the AI assistant/support chat.
export function BrandFace({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center justify-center rounded-full ${className}`} style={{ backgroundColor: "var(--color-accent)" }}>
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="none" stroke="var(--color-ink)" strokeWidth="1.75">
        <path d="M6 4.5h9l3 3V19a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 19V5a.5.5 0 0 1 .5-.5Z" strokeLinejoin="round" />
        <path d="M9 10h6M9 13h6M9 16h3.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function BrandFaceAlt({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center justify-center rounded-full ${className}`} style={{ backgroundColor: "var(--color-accent)" }}>
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="none" stroke="var(--color-ink)" strokeWidth="1.75">
        <path d="M4 13v-1a8 8 0 0 1 16 0v1" strokeLinecap="round" />
        <rect x="3" y="13" width="4" height="5.5" rx="1.5" />
        <rect x="17" y="13" width="4" height="5.5" rx="1.5" />
        <path d="M19 18.5v.5a3 3 0 0 1-3 3h-3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
