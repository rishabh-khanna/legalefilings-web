"use client";

import { useState } from "react";
import Link from "next/link";

const STAFF_LEVELS = [
  { value: "rater", label: "Rater" },
  { value: "leader", label: "Leader" },
  { value: "group_leader", label: "Group Leader" },
];

type StatusResult = {
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
};

export default function RequestAccountPage() {
  const [mode, setMode] = useState<"request" | "status">("request");

  // Request form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staffLevel, setStaffLevel] = useState("rater");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Status-check state
  const [checkEmail, setCheckEmail] = useState("");
  const [checking, setChecking] = useState(false);
  const [statusResult, setStatusResult] = useState<StatusResult | null | "not_found">(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await fetch("/api/account-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, phone, staffLevel, message }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setResult({ ok: true, text: "Request submitted — an admin will review it. Check status any time with your email." });
      setFullName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } else {
      setResult({ ok: false, text: data.error ?? "Something went wrong." });
    }
  }

  async function handleCheckStatus(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setStatusResult(null);
    const res = await fetch(`/api/account-requests?email=${encodeURIComponent(checkEmail)}`);
    const data = await res.json();
    setChecking(false);
    setStatusResult(data.request ?? "not_found");
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-sm font-medium mb-1";

  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <h1 className="text-3xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
        Staff Account Request
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--color-ink-soft)" }}>
        Internal team accounts (rater / leader / group leader) go through admin approval — not open signup.
      </p>

      <div className="mt-6 flex gap-2 rounded-lg p-1.5" style={{ backgroundColor: "var(--color-paper)" }}>
        <button
          type="button"
          onClick={() => setMode("request")}
          className="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors"
          style={mode === "request" ? { backgroundColor: "var(--color-action)", color: "#fff" } : { color: "var(--color-ink-soft)" }}
        >
          New Request
        </button>
        <button
          type="button"
          onClick={() => setMode("status")}
          className="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors"
          style={mode === "status" ? { backgroundColor: "var(--color-action)", color: "#fff" } : { color: "var(--color-ink-soft)" }}
        >
          Check Status
        </button>
      </div>

      {mode === "request" ? (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Requested Role</label>
            <select value={staffLevel} onChange={(e) => setStaffLevel(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
              {STAFF_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Message (optional)</label>
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>

          {result && (
            <p
              className="rounded-lg px-4 py-3 text-sm"
              style={result.ok ? { backgroundColor: "#d0f4db", color: "#116a2c" } : { backgroundColor: "#fde2e2", color: "#b42318" }}
            >
              {result.text}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCheckStatus} className="mt-6 space-y-4">
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Email you requested with</label>
            <input required type="email" value={checkEmail} onChange={(e) => setCheckEmail(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <button
            type="submit"
            disabled={checking}
            className="w-full rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {checking ? "Checking…" : "Check Status"}
          </button>

          {statusResult === "not_found" && (
            <p className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
              No request found for that email.
            </p>
          )}
          {statusResult && statusResult !== "not_found" && (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "var(--color-paper)" }}>
              <p className="font-semibold" style={{ color: "var(--color-ink)" }}>
                Status: {statusResult.status === "pending" ? "Pending review" : statusResult.status === "approved" ? "Approved" : "Rejected"}
              </p>
              {statusResult.status === "rejected" && (
                <>
                  <p className="mt-1" style={{ color: "var(--color-ink-soft)" }}>Reason: {statusResult.review_note}</p>
                  <p className="mt-2" style={{ color: "var(--color-ink-soft)" }}>
                    Submit a new request above with corrections to try again.
                  </p>
                </>
              )}
              {statusResult.status === "approved" && (
                <p className="mt-1" style={{ color: "var(--color-ink-soft)" }}>
                  Your account is ready — check your email for login details, or{" "}
                  <Link href="/login" className="underline">sign in here</Link>.
                </p>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
