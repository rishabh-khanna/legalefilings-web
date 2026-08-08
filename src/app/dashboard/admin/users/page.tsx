"use client";

import { useEffect, useState } from "react";
import { StateSelect } from "@/components/StateSelect";
import { CitySelect } from "@/components/CitySelect";
import { RequiredMark } from "@/components/RequiredMark";
import { STAFF_LEVEL_LABELS } from "@/lib/roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";

type UnassignedLead = { id: string; name: string; email: string; phone: string; service?: string };
type StaffOption = { id: string; full_name: string | null; designation: string | null };

export default function CreateUserPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [accountType, setAccountType] = useState<"customer" | "staff" | "admin">("customer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [message, setMessage] = useState("");
  const [customerTier, setCustomerTier] = useState<"free" | "paid">("free");
  const [staffLevel, setStaffLevel] = useState<"rater" | "leader" | "group_leader">("rater");
  const [unassignedLeads, setUnassignedLeads] = useState<UnassignedLead[]>([]);
  const [assignLeadId, setAssignLeadId] = useState("");
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [reportsTo, setReportsTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; password?: string } | null>(null);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
        const admin = profile?.account_type === "admin";
        setIsAdmin(admin);
        if (admin) {
          const [leadsRes, employeesRes] = await Promise.all([fetch("/api/leads"), fetch("/api/admin/employees")]);
          const leadsData = await leadsRes.json();
          if (leadsRes.ok) {
            setUnassignedLeads(
              (leadsData.leads ?? []).filter((l: { assignedTo: string }) => l.assignedTo === "Unassigned")
            );
          }
          const employeesData = await employeesRes.json();
          if (employeesRes.ok) setStaffOptions(employeesData.employees ?? []);
        }
      }
      setCheckingRole(false);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (accountType !== "customer" && (!department.trim() || !designation.trim())) {
      setResult({ ok: false, text: "Department and Designation are required for staff and admin accounts." });
      return;
    }
    setSubmitting(true);
    setResult(null);

    const endpoint = isAdmin ? "/api/admin/create-user" : "/api/account-requests/request-user";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        phone,
        accountType,
        customerTier: accountType === "customer" ? customerTier : undefined,
        staffLevel: accountType === "staff" ? staffLevel : undefined,
        reportsTo: isAdmin && accountType !== "customer" && reportsTo ? reportsTo : undefined,
        company,
        city,
        state,
        dateOfBirth: isAdmin ? dateOfBirth : undefined,
        department: accountType !== "customer" ? department : undefined,
        designation: accountType !== "customer" ? designation : undefined,
        message: isAdmin ? undefined : message,
        assignLeadId: isAdmin && accountType === "staff" && assignLeadId ? assignLeadId : undefined,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      const leadNote = assignLeadId ? (data.leadAssigned ? " Lead assigned." : " Lead was already claimed by someone else — left unassigned.") : "";
      setResult(
        isAdmin
          ? { ok: true, text: `Account created.${leadNote}`, password: data.tempPassword }
          : { ok: true, text: "Request submitted — an admin will review it." }
      );
      setFullName("");
      setEmail("");
      setPhone("");
      setCompany("");
      setCity("");
      setState("");
      setDateOfBirth("");
      setDepartment("");
      setDesignation("");
      setMessage("");
      setReportsTo("");
      if (assignLeadId) {
        setUnassignedLeads((prev) => prev.filter((l) => l.id !== assignLeadId));
      }
      setAssignLeadId("");
    } else {
      setResult({ ok: false, text: data.error ?? "Failed to submit." });
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-sm font-medium mb-1";

  if (checkingRole) {
    return <LoadingBlock />;
  }

  return (
    <div>
      <DashboardPageHero
        title={isAdmin ? "Create User" : "Request New User"}
        subtitle={
          isAdmin
            ? "Direct account creation — for a customer who called in, or to skip the request/approval flow for staff."
            : "Ask admin to create an account for a customer or new staff member — goes to the Account Requests queue for approval."
        }
      />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-white p-6 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Account Type</label>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value as typeof accountType)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
              <option value="customer">Customer</option>
              <option value="staff">Staff</option>
              {isAdmin && <option value="admin">Admin</option>}
            </select>
          </div>

          {accountType === "customer" && (
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink)" }}>Tier</label>
              <select value={customerTier} onChange={(e) => setCustomerTier(e.target.value as typeof customerTier)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          )}

          {accountType === "staff" && (
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink)" }}>Staff Level</label>
              <select value={staffLevel} onChange={(e) => setStaffLevel(e.target.value as typeof staffLevel)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                {Object.entries(STAFF_LEVEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}
          {accountType !== "customer" && (
            <>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>Department<RequiredMark /></label>
                <input required value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>Designation<RequiredMark /></label>
                <input required value={designation} onChange={(e) => setDesignation(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              {isAdmin && (
                <div>
                  <label className={labelClass} style={{ color: "var(--color-ink)" }}>Reports To</label>
                  <select value={reportsTo} onChange={(e) => setReportsTo(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                    <option value="">No manager set</option>
                    {staffOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name ?? "Unnamed"}{s.designation ? ` · ${s.designation}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Full Name</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          {isAdmin && (
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink)" }}>Date of Birth</label>
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
          )}
          {accountType === "customer" && (
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink)" }}>Company</label>
              <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
          )}
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>State</label>
            <StateSelect value={state} onChange={(e) => { setState(e.target.value); setCity(""); }} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>City</label>
            <CitySelect state={state} value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
        </div>

        {isAdmin && accountType === "staff" && (
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Assign a Lead (optional)</label>
            <select value={assignLeadId} onChange={(e) => setAssignLeadId(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
              <option value="">No lead — leave in the unassigned pool</option>
              {unassignedLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name} · {lead.phone}{lead.service ? ` · ${lead.service}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>
              {unassignedLeads.length === 0
                ? "No unassigned leads right now — you can hand one out later from Team Leads CRM."
                : "Hands this lead to the new staff member right away instead of leaving it in the shared pool. Leave blank and assign it later from Team Leads CRM."}
            </p>
          </div>
        )}

        {!isAdmin && (
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Note for admin (optional)</label>
            <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
        )}

        {result && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={result.ok ? { backgroundColor: "#d0f4db", color: "#116a2c" } : { backgroundColor: "#fde2e2", color: "#b42318" }}
          >
            <p>{result.text}</p>
            {result.password && (
              <p className="mt-1">
                Temporary password (share securely, once): <span className="font-mono font-semibold">{result.password}</span>
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          {submitting ? "Submitting…" : isAdmin ? "Create User" : "Submit Request"}
        </button>
      </form>
    </div>
  );
}
