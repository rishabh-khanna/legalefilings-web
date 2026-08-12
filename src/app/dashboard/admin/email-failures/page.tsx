"use client";

import { useEffect, useMemo, useState } from "react";
import { MailWarning, CheckCircle2 } from "lucide-react";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";
import { SearchButton } from "@/components/SearchButton";
import { TruncatedText } from "@/components/TruncatedText";

type EmailFailure = {
  id: string;
  email_type: string;
  recipient_email: string;
  related_entity: string | null;
  error_message: string | null;
  resolved: boolean;
  created_at: string;
  organization_id: string;
  organizations?: { name: string | null } | null;
  resolver?: { full_name: string | null } | null;
};

const TYPE_LABEL: Record<string, string> = {
  account_created: "Account Created (with password)",
  payment_confirmation: "Payment Confirmation",
  payment_request: "Payment Request",
  bill_reminder: "Bill Reminder",
  payment_reminder: "Payment Reminder (overdue invoice)",
  order_completed: "Order Completed",
  documents_requested: "Documents Requested",
  documents_submitted: "Documents Submitted (staff alert)",
  document_reviewed: "Document Verified / Returned",
};

// Admin-only. Every transactional email in the app used to just
// console.error on failure and move on — no visibility, no way to know
// a customer never got their password or payment confirmation short of
// digging through server logs. This is that visibility — not a retry
// queue, just a real place to see what failed and follow up by hand.
export default function EmailFailuresPage() {
  const [failures, setFailures] = useState<EmailFailure[] | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();

  async function load(includeResolved: boolean) {
    const res = await fetch(`/api/admin/email-failures${includeResolved ? "?includeResolved=true" : ""}`);
    const data = await res.json();
    if (res.ok) setFailures(data.failures);
  }

  useEffect(() => {
    const kickoff = setTimeout(() => load(showResolved), 0);
    return () => clearTimeout(kickoff);
  }, [showResolved]);

  const [draftTypeFilter, setDraftTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [draftRecipientFilter, setDraftRecipientFilter] = useState<Set<string>>(new Set());
  const [recipientFilter, setRecipientFilter] = useState<Set<string>>(new Set());
  const emailFiltersDirty =
    draftTypeFilter.size !== typeFilter.size || [...draftTypeFilter].some((v) => !typeFilter.has(v)) ||
    draftRecipientFilter.size !== recipientFilter.size || [...draftRecipientFilter].some((v) => !recipientFilter.has(v));
  const typeFilteredFailures = useMemo(() => {
    return (failures ?? []).filter((f) => typeFilter.size === 0 || typeFilter.has(f.email_type));
  }, [failures, typeFilter]);
  // Replaces the old group-by-recipient clustering — one dropdown to
  // narrow the list to a single address instead of the whole table
  // visually reorganized around it.
  const recipientOptions = useMemo(() => {
    return [...new Set((failures ?? []).map((f) => f.recipient_email))].sort();
  }, [failures]);
  const filteredFailures = useMemo(
    () => (recipientFilter.size === 0 ? typeFilteredFailures : typeFilteredFailures.filter((f) => recipientFilter.has(f.recipient_email))),
    [typeFilteredFailures, recipientFilter]
  );

  async function handleResolve(id: string) {
    setResolvingId(id);
    const res = await fetch(`/api/admin/email-failures/${id}`, { method: "PATCH" });
    setResolvingId(null);
    if (res.ok) {
      showSuccess("Marked resolved.");
      await load(showResolved);
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to update.");
    }
  }

  // Only a platform_admin's request ever returns more than one org's
  // failures pooled together — the column is only worth showing once
  // it's actually ambiguous which org a row belongs to.
  const spansMultipleOrgs = new Set((failures ?? []).map((f) => f.organization_id)).size > 1;

  const columns: DataTableColumn<EmailFailure>[] = [
    { key: "type", header: "Type", render: (f) => <span className="font-semibold" style={{ color: "var(--color-ink)" }}>{TYPE_LABEL[f.email_type] ?? f.email_type}</span>, exportValue: (f) => TYPE_LABEL[f.email_type] ?? f.email_type, sortValue: (f) => TYPE_LABEL[f.email_type] ?? f.email_type },
    { key: "recipient", header: "Recipient", render: (f) => f.recipient_email, exportValue: (f) => f.recipient_email, sortValue: (f) => f.recipient_email },
    { key: "related", header: "Related To", render: (f) => f.related_entity ?? "—", exportValue: (f) => f.related_entity ?? "" },
    {
      key: "error",
      header: "Error",
      className: "max-w-[200px]",
      render: (f) => (f.error_message ? <TruncatedText text={f.error_message} style={{ color: "var(--color-danger)" }} /> : "—"),
      exportValue: (f) => f.error_message ?? "",
    },
    { key: "sentAt", header: "Sent At", className: "w-[14%] whitespace-nowrap", render: (f) => new Date(f.created_at).toLocaleString("en-IN"), exportValue: (f) => new Date(f.created_at).toLocaleString("en-IN"), sortValue: (f) => f.created_at },
    ...(showResolved
      ? [{
          key: "resolvedBy",
          header: "Resolved By",
          className: "w-[12%] whitespace-nowrap",
          render: (f: EmailFailure) => f.resolver?.full_name ?? "—",
          exportValue: (f: EmailFailure) => f.resolver?.full_name ?? "",
          sortValue: (f: EmailFailure) => f.resolver?.full_name,
        } as DataTableColumn<EmailFailure>]
      : []),
    ...(spansMultipleOrgs
      ? [{ key: "org", header: "Organization", className: "w-[14%]", render: (f: EmailFailure) => f.organizations?.name ?? "—", exportValue: (f: EmailFailure) => f.organizations?.name ?? "Unknown organization" } as DataTableColumn<EmailFailure>]
      : []),
    {
      key: "actions",
      header: "",
      render: (f) =>
        f.resolved ? null : (
          <button
            type="button"
            onClick={() => handleResolve(f.id)}
            disabled={resolvingId === f.id}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)] disabled:opacity-60"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
          </button>
        ),
    },
  ];

  return (
    <div>
      <DashboardPageHero
        title="Email Failures"
        subtitle={
          spansMultipleOrgs
            ? "Transactional emails that didn't go out, pooled across every organization for platform-level support — account passwords, payment confirmations, reminders."
            : "Transactional emails that didn't go out — account passwords, payment confirmations, reminders. Follow up manually, then mark resolved."
        }
      >
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:max-w-xs">
          <HeroKpi icon={MailWarning} label="Unresolved" value={failures?.length ?? 0} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {failures === null ? (
        <LoadingBlock className="mt-6" />
      ) : (
        <DataTable
          columns={columns}
          fixedLayout
          rows={filteredFailures}
          getRowKey={(f) => f.id}
          itemLabel="failures"
          emptyMessage={failures.length === 0 ? "No unresolved email failures — everything's gone out cleanly." : "No failures match this filter."}
          filteredEmptyMessage="No failures match this filter."
          search={{ placeholder: "Search recipient, related to…", filter: (f, q) => `${f.recipient_email} ${f.related_entity ?? ""}`.toLowerCase().includes(q) }}
          exportFilename="email-failures"
          minWidth={720}
          toolbar={
            <>
              <MultiSelect
                options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
                selected={draftTypeFilter}
                onChange={setDraftTypeFilter}
                placeholder="All types"
              />
              <MultiSelect
                options={recipientOptions.map((email) => ({ value: email, label: email }))}
                selected={draftRecipientFilter}
                onChange={setDraftRecipientFilter}
                placeholder="All recipients"
                searchable
              />
              <SearchButton
                onClick={() => {
                  setTypeFilter(draftTypeFilter);
                  setRecipientFilter(draftRecipientFilter);
                }}
                dirty={emailFiltersDirty}
              />
              <button
                type="button"
                onClick={() => setShowResolved((v) => !v)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors"
                style={showResolved ? { backgroundColor: "var(--color-accent-tint)", borderColor: "var(--color-accent)", color: "var(--color-action-dark)" } : { borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
              >
                {showResolved ? "Showing resolved too" : "Show resolved"}
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
