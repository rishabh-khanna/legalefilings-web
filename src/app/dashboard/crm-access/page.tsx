import { redirect } from "next/navigation";
import { Users, FileSpreadsheet, Building2, CalendarClock, IndianRupee, Lock } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { CrmAccessRequestCard } from "@/components/crm/CrmAccessRequestCard";

// What a customer unlocks once approved — shown as a locked preview so
// "request my own CRM" isn't just an abstract offer, it's a concrete
// list of the same tools staff/admin actually use elsewhere in this app
// (Leads CRM, Invoice CRM, Team Management, Attendance/Leave, Payroll).
const CRM_FEATURES = [
  { icon: Users, label: "Leads CRM", description: "Track your own leads from first contact to close." },
  { icon: FileSpreadsheet, label: "Invoice CRM", description: "GST-compliant ad-hoc invoicing for your own customers." },
  { icon: Building2, label: "Team Management", description: "Add employees, set departments, and manage who reports to whom." },
  { icon: CalendarClock, label: "Attendance & Leave", description: "Clock-in tracking, leave balances, and approvals for your team." },
  { icon: IndianRupee, label: "Payroll", description: "Salary structures and monthly payslip generation." },
];

// Customer-only — a staff/admin account already has all of this (or is
// the CRM itself), so this page has nothing to offer them; redirect
// instead of rendering an empty/nonsensical page.
export default async function CrmAccessPage() {
  const profile = await getCurrentProfile();
  if (!profile || isStaffOrAdmin(profile)) redirect("/dashboard");

  const supabase = getSupabaseAdmin();
  const [{ data: paidInvoice }, { data: existingRequest }] = await Promise.all([
    supabase.from("invoices").select("id").eq("customer_id", profile.id).eq("status", "paid").limit(1).maybeSingle(),
    supabase
      .from("org_access_requests")
      .select("id, status, organization_name, review_note")
      .eq("requested_by", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div>
      <DashboardPageHero
        title="Request CRM Access"
        subtitle="Every plan comes with a free year of your own CRM workspace — a separate admin login with your own team, leads, and invoicing."
      />

      <div className="mt-3">
        <CrmAccessRequestCard hasPaidPurchase={Boolean(paidInvoice)} initialRequest={existingRequest} />
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>What you don&apos;t have access to yet</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
          These tools become available the moment your CRM workspace is set up — same features the Legal Efilings team uses internally.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CRM_FEATURES.map((f) => (
            <div key={f.label} className="relative rounded-xl border p-4" style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-paper)" }}>
              <Lock className="absolute right-3 top-3 h-3.5 w-3.5" style={{ color: "var(--color-ink-soft)" }} />
              <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }}>
                <f.icon className="h-4 w-4" />
              </span>
              <p className="mt-2.5 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{f.label}</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--color-ink-soft)" }}>{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
