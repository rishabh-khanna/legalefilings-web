import type { Metadata } from "next";
import { getPage } from "@/lib/content";
import { ConsultationForm } from "@/components/ConsultationForm";
import { SocialLinks } from "@/components/SocialLinks";
import { ContactCards } from "@/components/ContactCards";
import { GlowBadge } from "@/components/CategoryIcons";
import { SITE_NAME } from "@/config/site";

const ClockIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const metadata: Metadata = {
  title: `Contact — ${SITE_NAME}`,
};

export default function ContactPage() {
  const page = getPage("contact");
  const rawContacts = (page?.blocks.find((b) => b.type === "list" && b.items.some((i) => i.includes("+91"))) as
    | { type: "list"; items: string[] }
    | undefined)?.items ?? [];
  const phoneNumbers = rawContacts.filter((i) => !i.includes("@"));
  const email = rawContacts.find((i) => i.includes("@"));
  const address = (page?.blocks.find((b) => b.type === "list" && b.items.some((i) => i.startsWith("Address"))) as
    | { type: "list"; items: string[] }
    | undefined)?.items?.[0];

  return (
    <section style={{ background: "linear-gradient(180deg, var(--color-accent-tint) 0%, var(--color-paper) 65%)" }}>
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="md:float-right md:ml-10 md:w-[27rem]">
          <ConsultationForm variant="dark" />
        </div>
        <div className="md:mr-[29.5rem]">
          <h1
            className="text-4xl md:text-5xl font-extrabold leading-[1.1] tracking-tight"
            style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
          >
            Get In Touch
          </h1>
          <p className="mt-3 max-w-md text-base leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
            Reach us any of these ways — a real CA/CS expert gets back to you, not a queue.
          </p>

          <ContactCards className="mt-7" phoneNumbers={phoneNumbers} email={email} address={address} />

          <div
            className="mt-6 flex items-center gap-4 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]"
            style={{ borderColor: "var(--color-line)" }}
          >
            <GlowBadge size={48} tone="var(--color-action-dark)" icon={<ClockIcon className="h-5 w-5" />} />
            <div>
              <p className="font-semibold" style={{ color: "var(--color-ink)" }}>
                We reply fast.
              </p>
              <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
                A real CA/CS expert gets back to you directly — not a call-center queue.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
              Connect with us
            </p>
            <SocialLinks />
          </div>
        </div>
        {/* Clears the floated form so this section's own box (and the
            colored background) extends to cover it — without this, since
            neither <main> nor the footer below it starts a new formatting
            context, the float could visually escape past the page content
            and overlap the footer. */}
        <div className="clear-both" />
      </div>
    </section>
  );
}
