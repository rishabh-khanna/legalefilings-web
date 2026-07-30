import { BUSINESS_STATS } from "@/config/site";

// Real client logos as uploaded to legalefilings.com's own media library,
// shown under their real "Trusted by most innovative companies" heading.
// (The homepage also has a "Y Combinator / HubSpot / Harvard Management
// Company / Nexus / Hustle Fund" text strip right after the hero — that's
// unswapped demo content from the page-builder template, not a real client
// or backer list, so it's deliberately left out here.)
const PARTNER_LOGOS = [
  { src: "/images/wp/download-2.png", alt: "Patil Kaki" },
  { src: "/images/wp/imresizer-1710239019088-removebg-preview-2.png", alt: "Anillo" },
  { src: "/images/wp/imresizer-1710239258201-2.jpg", alt: "PediaXone" },
  { src: "/images/wp/logo-dark-2.png", alt: "Client logo" },
  { src: "/images/wp/Xpert_logo_blue_transparent.png", alt: "XpertTutor" },
];

export function PartnerMarquee() {
  const track = [...PARTNER_LOGOS, ...PARTNER_LOGOS];

  return (
    <section
      className="border-y py-8 overflow-hidden"
      style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-paper)" }}
    >
      <p
        className="text-center text-xs font-semibold uppercase tracking-[0.15em] mb-4"
        style={{ color: "var(--color-ink-soft)" }}
      >
        Trusted by {BUSINESS_STATS.businessesServed} businesses, including
      </p>
      <div className="relative w-full overflow-hidden">
        <div className="flex w-max items-center animate-[marquee_28s_linear_infinite] gap-14 motion-reduce:animate-none">
          {track.map((logo, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${logo.src}-${i}`}
              src={logo.src}
              alt={logo.alt}
              loading="lazy"
              decoding="async"
              className="h-9 w-auto max-w-[140px] shrink-0 object-contain grayscale opacity-70 transition-[filter,opacity] hover:grayscale-0 hover:opacity-100"
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
