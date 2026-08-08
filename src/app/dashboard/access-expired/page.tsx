import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { CONTACT_EMAIL, BUSINESS_PHONE } from "@/config/site";

export default function AccessExpiredPage() {
  return (
    <div>
      <DashboardPageHero
        title="Your CRM access has expired"
        subtitle="Your organization's CRM access was tied to a plan purchase and has now lapsed. Your data is safe and untouched — it just isn't reachable until access is renewed."
      />
      <div className="rounded-2xl border bg-white p-6 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
          To keep using your CRM workspace — leads, invoicing, HR, everything — reach out and we&apos;ll get it renewed.
        </p>
        <p className="mt-3 text-sm font-medium" style={{ color: "var(--color-ink)" }}>
          {CONTACT_EMAIL} · {BUSINESS_PHONE.display}
        </p>
      </div>
    </div>
  );
}
