import { BUSINESS_STATS, SITE_NAME } from "@/config/site";
import { SectionHeading } from "@/components/SectionHeading";
import { FEATURE_ICONS, GlowBadge } from "@/components/CategoryIcons";

const ITEMS = [
  {
    title: "Trusted Expertise",
    detail: `${BUSINESS_STATS.caCsProfessionals} in-house CAs and CS handle every filing, not a call-center reading a script.`,
    icon: "expertise" as const,
  },
  {
    title: "Personal Support",
    detail: "One point of contact from the first quote through to your registration certificate.",
    icon: "support" as const,
  },
  {
    title: "Fast Turnaround",
    detail: "Most registrations move in days, not weeks — we chase the paperwork, not you.",
    icon: "speed" as const,
  },
  {
    title: `${BUSINESS_STATS.businessesServed} Businesses`,
    detail: "Registered and supported across India since we started.",
    icon: "businesses" as const,
  },
];

export function WhyChooseUs() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <SectionHeading align="center" wrapperClassName="mb-10">
        Why Choose {SITE_NAME}?
      </SectionHeading>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {ITEMS.map((item) => {
          const Icon = FEATURE_ICONS[item.icon];
          return (
            <div
              key={item.title}
              className="rounded-lg border bg-white dark:bg-[var(--color-paper-raised)] p-5 transition-[box-shadow,border-color] hover:shadow-md hover:border-[var(--color-accent)]"
              style={{ borderColor: "var(--color-line)" }}
            >
              <GlowBadge className="mb-4" icon={<Icon className="h-5 w-5" />} />
              <h3 className="font-semibold text-base mb-1.5" style={{ color: "var(--color-ink)" }}>
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
                {item.detail}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
