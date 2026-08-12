"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { StateSelect } from "@/components/StateSelect";
import { CitySelect } from "@/components/CitySelect";
import { LoadingBlock } from "@/components/Spinner";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, type OrderStatus } from "@/lib/order-status";

type PastOrder = {
  id: string;
  service: string;
  plan: string;
  plan_price: number | null;
  status: OrderStatus;
  created_at: string;
  organization_id: string;
  organizations?: { name: string | null } | null;
};
type PastInvoice = {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  created_at: string;
  organization_id: string;
  organizations?: { name: string | null } | null;
};

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [isEmployee, setIsEmployee] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [uanNumber, setUanNumber] = useState("");
  const [esicNumber, setEsicNumber] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [pastOrders, setPastOrders] = useState<PastOrder[]>([]);
  const [pastInvoices, setPastInvoices] = useState<PastInvoice[]>([]);

  useEffect(() => {
    // Deferred (not called synchronously in the effect body) — same pattern
    // used elsewhere in this codebase (CountdownTimer, AiAssistant) to avoid
    // the cascading-render lint rule.
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setEmail(user.email ?? "");
      if (profile) {
        setName(profile.full_name ?? "");
        setPhone(profile.phone ?? "");
        setCompany(profile.company ?? "");
        setCity(profile.city ?? "");
        setState(profile.state ?? "");
        setDateOfBirth(profile.date_of_birth ?? "");
        setIsEmployee(profile.account_type === "staff" || profile.account_type === "admin");
        setEmployeeId(profile.employee_id ?? "");
        setDepartment(profile.department ?? "");
        setDesignation(profile.designation ?? "");
        setAadhaarNumber(profile.aadhaar_number ?? "");
        setPanNumber(profile.pan_number ?? "");
        setBankAccountNumber(profile.bank_account_number ?? "");
        setBankIfsc(profile.bank_ifsc ?? "");
        setBankName(profile.bank_name ?? "");
        setUanNumber(profile.uan_number ?? "");
        setEsicNumber(profile.esic_number ?? "");
        setEmergencyContactName(profile.emergency_contact_name ?? "");
        setEmergencyContactPhone(profile.emergency_contact_phone ?? "");
        setCurrentOrgId(profile.organization_id ?? null);
      }
      setLoading(false);

      // Best-effort, non-blocking — this section is a bonus, not core to
      // the page, so a failed fetch just leaves it empty rather than
      // failing the whole profile load.
      fetch("/api/profile/purchase-history")
        .then((res) => (res.ok ? res.json() : { orders: [], invoices: [] }))
        .then((data) => {
          setPastOrders(data.orders ?? []);
          setPastInvoices(data.invoices ?? []);
        })
        .catch(() => {});
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const patch: Record<string, unknown> = { full_name: name, phone, company, city, state, date_of_birth: dateOfBirth || null };
      if (isEmployee) {
        Object.assign(patch, {
          aadhaar_number: aadhaarNumber || null,
          pan_number: panNumber || null,
          bank_account_number: bankAccountNumber || null,
          bank_ifsc: bankIfsc || null,
          bank_name: bankName || null,
          emergency_contact_name: emergencyContactName || null,
          emergency_contact_phone: emergencyContactPhone || null,
        });
      }
      await supabase.from("profiles").update(patch).eq("id", user.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-sm font-medium mb-1";

  if (loading) {
    return <LoadingBlock />;
  }

  return (
    <div>
      <DashboardPageHero title="Edit Profile" subtitle="Keep your account details up to date." />

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border bg-white p-6 dark:bg-[var(--color-paper-raised)]"
        style={{ borderColor: "var(--color-line)" }}
      >
        {/* Wide grids instead of one field per row — the dashboard content
            column has plenty of horizontal room, and stacking every field
            vertically just made this a long scroll for no reason. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="profile-name" className={labelClass} style={{ color: "var(--color-ink)" }}>
              Full Name
            </label>
            <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          {!isEmployee && (
            <div>
              <label htmlFor="profile-company" className={labelClass} style={{ color: "var(--color-ink)" }}>
                Company
              </label>
              <input id="profile-company" value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
          )}
          <div>
            <label htmlFor="profile-email" className={labelClass} style={{ color: "var(--color-ink)" }}>
              Email
            </label>
            <input id="profile-email" type="email" value={email} disabled className={`${inputClass} opacity-60`} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label htmlFor="profile-phone" className={labelClass} style={{ color: "var(--color-ink)" }}>
              Phone
            </label>
            <input id="profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label htmlFor="profile-dob" className={labelClass} style={{ color: "var(--color-ink)" }}>
              Date of Birth
            </label>
            <input id="profile-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label htmlFor="profile-state" className={labelClass} style={{ color: "var(--color-ink)" }}>
              State
            </label>
            <StateSelect
              id="profile-state"
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setCity("");
              }}
              className={inputClass}
              style={{ borderColor: "var(--color-line)" }}
            />
          </div>
          <div>
            <label htmlFor="profile-city" className={labelClass} style={{ color: "var(--color-ink)" }}>
              City
            </label>
            <CitySelect
              id="profile-city"
              state={state}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
              style={{ borderColor: "var(--color-line)" }}
            />
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>We&apos;ll send you a birthday surprise on your Date of Birth 🎂</p>

        {isEmployee && (
          <>
            <div className="border-t pt-4" style={{ borderColor: "var(--color-line)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Employee Details</p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>Set by admin — contact HR to update.</p>
            </div>
            <div className="grid gap-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <p className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Employee ID</p>
                <p style={{ color: "var(--color-ink)" }}>{employeeId || "—"}</p>
              </div>
              <div>
                <p className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Department</p>
                <p style={{ color: "var(--color-ink)" }}>{department || "—"}</p>
              </div>
              <div>
                <p className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Designation</p>
                <p style={{ color: "var(--color-ink)" }}>{designation || "—"}</p>
              </div>
              <div>
                <p className={labelClass} style={{ color: "var(--color-ink-soft)" }}>UAN Number</p>
                <p style={{ color: "var(--color-ink)" }}>{uanNumber || "—"}</p>
              </div>
              <div>
                <p className={labelClass} style={{ color: "var(--color-ink-soft)" }}>ESIC Number</p>
                <p style={{ color: "var(--color-ink)" }}>{esicNumber || "—"}</p>
              </div>
            </div>

            <div className="border-t pt-4" style={{ borderColor: "var(--color-line)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Identity Documents</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>Aadhaar Number</label>
                <input value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>PAN Number</label>
                <input value={panNumber} onChange={(e) => setPanNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
            </div>

            <div className="border-t pt-4" style={{ borderColor: "var(--color-line)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Bank Details</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>Bank Name</label>
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>Account Number</label>
                <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>IFSC Code</label>
                <input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
            </div>

            <div className="border-t pt-4" style={{ borderColor: "var(--color-line)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Emergency Contact</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>Name</label>
                <input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>Phone</label>
                <input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
            </div>
          </>
        )}

        {saved && (
          <p className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" }}>
            Saved.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full px-4 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>

      {/* Only for the "CRM Access" promotion case: your account_type moved
          off "customer", so Order History / My Invoices — both scoped to
          your CURRENT organization — stop finding purchases you made
          before the promotion, under a different org. Nothing was
          deleted; this is the one place that looks them up by your
          identity instead of your current org, so they don't just
          disappear. Hidden entirely for the overwhelming majority of
          accounts that never went through that promotion and have
          nothing orphaned to show. */}
      {(() => {
        const orphanedOrders = pastOrders.filter((o) => o.organization_id !== currentOrgId);
        const orphanedInvoices = pastInvoices.filter((i) => i.organization_id !== currentOrgId);
        if (orphanedOrders.length === 0 && orphanedInvoices.length === 0) return null;
        return (
          <div
            className="mt-5 rounded-2xl border bg-white p-6 dark:bg-[var(--color-paper-raised)]"
            style={{ borderColor: "var(--color-line)" }}
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" style={{ color: "var(--color-ink-soft)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Purchases From Before</p>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>
              From a different workspace than the one you&apos;re in now — not part of your current Order History or Invoices, kept here so they&apos;re still reachable.
            </p>

            {orphanedOrders.length > 0 && (
              <div className="mt-4 space-y-2">
                {orphanedOrders.map((o) => {
                  const style = ORDER_STATUS_STYLE[o.status];
                  return (
                    <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: "var(--color-paper)" }}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" style={{ color: "var(--color-ink)" }}>{o.service} — {o.plan}</p>
                        <p className="truncate text-xs" style={{ color: "var(--color-ink-soft)" }}>
                          {o.organizations?.name ?? "Unknown workspace"} · {new Date(o.created_at).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {o.plan_price != null && (
                          <span className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>₹{Number(o.plan_price).toLocaleString("en-IN")}</span>
                        )}
                        <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
                          {ORDER_STATUS_LABEL[o.status]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {orphanedInvoices.length > 0 && (
              <div className="mt-4 space-y-2">
                {orphanedInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: "var(--color-paper)" }}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--color-ink)" }}>{inv.invoice_number}</p>
                      <p className="truncate text-xs" style={{ color: "var(--color-ink-soft)" }}>
                        {inv.organizations?.name ?? "Unknown workspace"} · {new Date(inv.created_at).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>₹{Number(inv.total).toLocaleString("en-IN")}</span>
                      <Link href={`/api/invoices/${inv.id}/download`} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>
                        PDF
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
