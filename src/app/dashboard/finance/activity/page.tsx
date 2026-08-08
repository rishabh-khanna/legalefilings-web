"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { BookSwitcher } from "@/components/finance/BookSwitcher";
import { LoadingBlock } from "@/components/Spinner";

type AuditEntry = {
  id: string;
  action: string;
  entity_type: string;
  detail: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
};

const ACTION_LABELS: Record<string, string> = {
  added_expense: "added an expense",
  added_income: "added income",
  updated_transaction: "updated a transaction",
  deleted_transaction: "deleted a transaction",
  added_account: "added a bank account",
  added_member: "added a team member",
  changed_member_role: "changed a team member's role",
  removed_member: "removed a team member",
};

// Module 15 — every action, who did it, when. Same book-switcher +
// manage_users gate as the Team page.
export default function FinanceActivityPage() {
  const [bookOwnerId, setBookOwnerId] = useState<string | null>(null);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/expense-manager/my-books");
      const data = await res.json();
      if (res.ok) {
        const books = data.books ?? [];
        const own = books.find((b: { isOwn: boolean }) => b.isOwn) ?? books[0];
        if (own) setBookOwnerId(own.bookOwnerId);
      }
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  useEffect(() => {
    if (!bookOwnerId) return;
    const kickoff = setTimeout(async () => {
      setEntries(null);
      const res = await fetch(`/api/expense-manager/audit-log?bookOwnerId=${bookOwnerId}`);
      const data = await res.json();
      if (res.ok) setEntries(data.entries ?? []);
    }, 0);
    return () => clearTimeout(kickoff);
  }, [bookOwnerId]);

  return (
    <div>
      <DashboardPageHero title="Activity" subtitle="Every action recorded — who did what, when.">
        <Link href="/dashboard/finance" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Business Finance
        </Link>
      </DashboardPageHero>

      {bookOwnerId && <BookSwitcher bookOwnerId={bookOwnerId} onChange={setBookOwnerId} />}

      <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        {entries === null ? (
          <LoadingBlock />
        ) : entries.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No activity recorded yet.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {entries.map((e) => (
              <li key={e.id} className="py-3 text-sm">
                <p style={{ color: "var(--color-ink)" }}>
                  <span className="font-semibold">{e.profiles?.full_name ?? "Someone"}</span>{" "}
                  {ACTION_LABELS[e.action] ?? e.action}
                  {e.detail ? <span style={{ color: "var(--color-ink-soft)" }}> — {e.detail}</span> : null}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--color-ink-soft)" }}>
                  {new Date(e.created_at).toLocaleString("en-IN")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
