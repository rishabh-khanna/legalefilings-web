"use client";

import { useState } from "react";
import Link from "next/link";

type ExistingRequest = { id: string; status: "pending" | "approved" | "rejected"; organization_name: string; review_note: string | null } | null;

// Shown on a customer's dashboard overview — the self-service entry
// point into becoming their own org's admin. Kept as its own client
// component since the parent (dashboard/page.tsx) is a server component
// and this needs local form state; the eligibility/existing-request data
// is fetched server-side and passed in as props instead of re-fetching
// on the client.
export function CrmAccessRequestCard({ hasPaidPurchase, initialRequest }: { hasPaidPurchase: boolean; initialRequest: ExistingRequest }) {
  const [request, setRequest] = useState(initialRequest);
  const [organizationName, setOrganizationName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/crm-access-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationName }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setRequest(data.request);
    } else {
      setError(data.error ?? "Failed to submit request.");
    }
  }

  if (!hasPaidPurchase && !request) {
    return (
      <div className="mt-8 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Want your own CRM?</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
          Every plan comes with a free year of your own CRM workspace — your own admin login, your own team, your own leads and invoicing.{" "}
          <Link href="/pricing" className="font-medium" style={{ color: "var(--color-action-dark)" }}>Browse plans →</Link>
        </p>
      </div>
    );
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  return (
    <div className="mt-8 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
      <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Your CRM Workspace</h2>

      {!request && (
        <>
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
            Your plan includes a free year of your own CRM — your own admin login, your own team, your own leads and invoicing, fully separate from ours.
          </p>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              required
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Your company name"
              className={inputClass}
              style={{ borderColor: "var(--color-line)" }}
            />
            <button
              type="submit"
              disabled={submitting}
              className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--color-action)" }}
            >
              {submitting ? "Submitting…" : "Set Up My CRM"}
            </button>
          </form>
          {error && <p className="mt-2 text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
        </>
      )}

      {request?.status === "pending" && (
        <p className="mt-2 text-sm" style={{ color: "var(--color-ink-soft)" }}>
          Your request for <strong>{request.organization_name}</strong> is under review — we&apos;ll set you up shortly.
        </p>
      )}

      {request?.status === "rejected" && (
        <div className="mt-2">
          <p className="text-sm" style={{ color: "var(--color-danger)" }}>
            Your request for {request.organization_name} wasn&apos;t approved{request.review_note ? `: ${request.review_note}` : "."}
          </p>
          <button
            type="button"
            onClick={() => setRequest(null)}
            className="mt-2 text-sm font-medium"
            style={{ color: "var(--color-action-dark)" }}
          >
            Try again →
          </button>
        </div>
      )}
    </div>
  );
}
