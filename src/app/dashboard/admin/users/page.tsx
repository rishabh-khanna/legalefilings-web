"use client";

import { useEffect, useState } from "react";
import { StateSelect } from "@/components/StateSelect";
import { CitySelect } from "@/components/CitySelect";
import { STAFF_LEVEL_LABELS } from "@/lib/roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";

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
        setIsAdmin(profile?.account_type === "admin");
      }
      setCheckingRole(false);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        company,
        city,
        state,
        dateOfBirth: isAdmin ? dateOfBirth : undefined,
        department: accountType !== "customer" ? department : undefined,
        designation: accountType !== "customer" ? designation : undefined,
        message: isAdmin ? undefined : message,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setResult(
        isAdmin
          ? { ok: true, text: "Account created.", password: data.tempPassword }
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
    } else {
      setResult({ ok: false, text: data.error ?? "Failed to submit." });
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-sm font-medium mb-1";

  if (checkingRole) {
    return <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Loading…</p>;
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
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>Department</label>
                <input value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>Designation</label>
                <input value={designation} onChange={(e) => setDesignation(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
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
