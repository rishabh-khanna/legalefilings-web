"use client";

import { useEffect, useMemo, useState } from "react";
import { MailWarning, CheckCircle2 } from "lucide-react";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";

type EmailFailure = {
  id: string;
  email_type: string;
  recipient_email: string;
  related_entity: string | null;
  error_message: string | null;
  resolved: boolean;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  account_created: "Account Created (with password)",
  payment_confirmation: "Payment Confirmation",
  payment_request: "Payment Request",
  bill_reminder: "Bill Reminder",
};

// Admin-only. Every transactional email in the app used to just
// console.error on failure and move on — no visibility, no way to know
// a customer never got their password or payment confirmation short of
// digging through server logs. This is that visibility — not a retry
// queue, just a real place to see what failed and follow up by hand.
export default function EmailFailuresPage() {
  const [failures, setFailures] = useState<EmailFailure[] | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const { message, showSuccess, showError } = useActionMessage();

  async function load() {
    const res = await fetch("/api/admin/email-failures");
    const data = await res.json();
    if (res.ok) setFailures(data.failures);
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const filteredFailures = useMemo(() => {
    return (failures ?? []).filter((f) => {
      if (typeFilter !== "all" && f.email_type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${f.recipient_email} ${f.related_entity ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [failures, typeFilter, search]);

  async function handleResolve(id: string) {
    setResolvingId(id);
    const res = await fetch(`/api/admin/email-failures/${id}`, { method: "PATCH" });
    setResolvingId(null);
    if (res.ok) {
      showSuccess("Marked resolved.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to update.");
    }
  }

  return (
    <div>
      <DashboardPageHero
        title="Email Failures"
        subtitle="Transactional emails that didn't go out — account passwords, payment confirmations, reminders. Follow up manually, then mark resolved."
      >
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:max-w-xs">
          <HeroKpi icon={MailWarning} label="Unresolved" value={failures?.length ?? 0} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {failures !== null && failures.length !== 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipient, related to…"
            className="w-full max-w-xs rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border px-2.5 py-1.5 text-sm outline-none"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
          >
            <option value="all">All types</option>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {(search.trim() || typeFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter("all");
              }}
              className="text-xs font-semibold"
              style={{ color: "var(--color-action-dark)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {failures === null ? (
        <LoadingBlock className="mt-6" />
      ) : failures.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>No unresolved email failures — everything&apos;s gone out cleanly.</p>
      ) : filteredFailures.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>No failures match this filter.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <table className="dt-table w-full min-w-[720px]">
            <thead>
              <tr className="text-left">
                <th>#</th>
                <th>Type</th>
                <th>Recipient</th>
                <th>Related To</th>
                <th>Error</th>
                <th>Sent At</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredFailures.map((f, i) => (
                <tr key={f.id}>
                  <td style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                  <td className="font-semibold" style={{ color: "var(--color-ink)" }}>{TYPE_LABEL[f.email_type] ?? f.email_type}</td>
                  <td style={{ color: "var(--color-ink-soft)" }}>{f.recipient_email}</td>
                  <td style={{ color: "var(--color-ink-soft)" }}>{f.related_entity ?? "—"}</td>
                  <td className="max-w-xs" style={{ color: "#b42318" }}>{f.error_message ?? "—"}</td>
                  <td style={{ color: "var(--color-ink-soft)" }}>{new Date(f.created_at).toLocaleString("en-IN")}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleResolve(f.id)}
                      disabled={resolvingId === f.id}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)] disabled:opacity-60"
                      style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
