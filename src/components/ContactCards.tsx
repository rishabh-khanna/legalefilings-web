import { GlowBadge } from "@/components/CategoryIcons";
import { CONTACT_LINKS } from "@/config/site";

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
    <path
      d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.8 21 3 13.2 3 3.5a1 1 0 0 1 1-1H7.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
    <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Z" />
  </svg>
);

const EmailIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" strokeLinejoin="round" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);

type CardIcon = (props: { className?: string }) => React.JSX.Element;
type ContactCard = { label: string; value: string; href?: string; icon: CardIcon; external?: boolean };

// The same icon-card treatment built for the Contact page — pulled out so
// any page with real phone/email/address data (Contact, Career, ...) gets
// the identical modern look instead of a plain bullet list.
export function ContactCards({
  phoneNumbers,
  email,
  address,
  className = "",
}: {
  phoneNumbers: string[];
  email?: string;
  address?: string;
  className?: string;
}) {
  const cards: ContactCard[] = [];
  if (phoneNumbers[0]) {
    cards.push({ label: "Call Us", value: phoneNumbers[0], href: CONTACT_LINKS.tel, icon: PhoneIcon });
  }
  if (phoneNumbers[1]) {
    cards.push({ label: "WhatsApp", value: phoneNumbers[1], href: CONTACT_LINKS.whatsapp, icon: WhatsAppIcon, external: true });
  }
  if (email) {
    cards.push({ label: "Email", value: email, href: `mailto:${email}`, icon: EmailIcon });
  }
  if (address) {
    cards.push({ label: "Office", value: address.replace(/^Address:\s*/, ""), icon: PinIcon });
  }

  if (cards.length === 0) return null;

  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      {cards.map((card) => {
        const Icon = card.icon;
        const content = (
          <>
            <GlowBadge size={44} icon={<Icon className="h-[18px] w-[18px]" />} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
                {card.label}
              </p>
              <p className="mt-0.5 truncate text-sm font-medium" style={{ color: "var(--color-ink)" }}>
                {card.value}
              </p>
            </div>
          </>
        );
        const cardClass =
          "flex items-center gap-3 rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)] p-4 transition-[box-shadow,border-color]";
        const cardStyle = { borderColor: "var(--color-line)" };
        return card.href ? (
          <a
            key={card.label}
            href={card.href}
            target={card.external ? "_blank" : undefined}
            rel={card.external ? "noopener noreferrer" : undefined}
            className={`${cardClass} hover:shadow-md hover:border-[var(--color-accent)]`}
            style={cardStyle}
          >
            {content}
          </a>
        ) : (
          <div key={card.label} className={cardClass} style={cardStyle}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
