"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { BookSwitcher } from "@/components/finance/BookSwitcher";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";
import { SearchButton } from "@/components/SearchButton";
import { useConfirm } from "@/lib/use-confirm";

type Member = {
  id: string;
  member_id: string;
  role: "owner" | "admin" | "accountant" | "employee" | "viewer";
  profiles: { full_name: string | null } | null;
};

const ROLE_OPTIONS: { value: Member["role"]; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "accountant", label: "Accountant" },
  { value: "employee", label: "Employee" },
  { value: "viewer", label: "Viewer" },
];

const ROLE_DESCRIPTIONS: Record<Member["role"], string> = {
  owner: "Full control — can't be changed or removed.",
  admin: "Full control, same as the owner.",
  accountant: "Can record entries and pull/download reports.",
  employee: "Can record entries and view reports.",
  viewer: "Read-only — can view and download reports.",
};

// Module 12 — Owner/Admin/Accountant/Employee/Viewer. Only reachable via
// the "Team" link on the finance page, which only shows for someone
// with manage_users on the active book — the API itself enforces this
// too, this is just keeping the UI honest about who should be here.
export default function FinanceTeamPage() {
  const [bookOwnerId, setBookOwnerId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Member["role"]>("accountant");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; password?: string } | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const loadMembers = useCallback(async (ownerId: string) => {
    const res = await fetch(`/api/expense-manager/members?bookOwnerId=${ownerId}`);
    const data = await res.json();
    if (res.ok) setMembers(data.members ?? []);
  }, []);

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
    const kickoff = setTimeout(() => loadMembers(bookOwnerId), 0);
    return () => clearTimeout(kickoff);
  }, [bookOwnerId, loadMembers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!bookOwnerId) return;
    setSubmitting(true);
    setResult(null);
    const res = await fetch("/api/expense-manager/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookOwnerId, email, fullName, role }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setResult({
        ok: true,
        text: data.tempPassword ? `${email} was added as ${role} — a new account was created for them.` : `${email} was added as ${role}.`,
        password: data.tempPassword ?? undefined,
      });
      setEmail("");
      setFullName("");
      loadMembers(bookOwnerId);
    } else {
      setResult({ ok: false, text: data.error ?? "Failed to add." });
    }
  }

  async function handleRoleChange(id: string, newRole: string) {
    if (!bookOwnerId) return;
    const res = await fetch(`/api/expense-manager/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) loadMembers(bookOwnerId);
  }

  async function handleRemove(id: string, name: string) {
    if (!bookOwnerId) return;
    if (!(await confirm(`Remove ${name} from this book's team? They'll lose access immediately.`, { confirmLabel: "Remove", danger: true }))) return;
    const res = await fetch(`/api/expense-manager/members/${id}`, { method: "DELETE" });
    if (res.ok) loadMembers(bookOwnerId);
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  const [draftRoleFilter, setDraftRoleFilter] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<Set<string>>(new Set());
  const roleFilterDirty = draftRoleFilter.size !== roleFilter.size || [...draftRoleFilter].some((v) => !roleFilter.has(v));
  const filteredMembers = useMemo(() => {
    return (members ?? []).filter((m) => roleFilter.size === 0 || roleFilter.has(m.role));
  }, [members, roleFilter]);

  const columns: DataTableColumn<Member>[] = [
    { key: "name", header: "Name", render: (m) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{m.profiles?.full_name ?? "Unknown"}</span>, exportValue: (m) => m.profiles?.full_name ?? "Unknown", sortValue: (m) => m.profiles?.full_name },
    {
      key: "role",
      header: "Role",
      render: (m) =>
        m.role === "owner" ? (
          <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: "var(--color-action-tint)", color: "var(--color-action-dark)" }}>Owner</span>
        ) : (
          <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--color-line)" }}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        ),
      exportValue: (m) => (m.role === "owner" ? "Owner" : ROLE_OPTIONS.find((r) => r.value === m.role)?.label ?? m.role),
      sortValue: (m) => m.role,
    },
    {
      key: "actions",
      header: "Action",
      className: "text-right",
      render: (m) =>
        m.role !== "owner" ? (
          <button type="button" onClick={() => handleRemove(m.id, m.profiles?.full_name ?? "this member")} className="text-xs font-medium" style={{ color: "var(--color-danger)" }}>Remove</button>
        ) : null,
    },
  ];

  return (
    <div>
      <DashboardPageHero title="Team" subtitle="Who has access to these books, and what they can do.">
        <Link href="/dashboard/finance" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Business Finance
        </Link>
      </DashboardPageHero>

      {confirmDialog}
      {bookOwnerId && <BookSwitcher bookOwnerId={bookOwnerId} onChange={setBookOwnerId} />}

      <form onSubmit={handleInvite} className="mb-6 grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
        <input placeholder="Full Name (if new)" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
        <select value={role} onChange={(e) => setRole(e.target.value as Member["role"])} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <button type="submit" disabled={submitting} className="rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
          {submitting ? "Adding…" : "Add to Team"}
        </button>
        <p className="sm:col-span-4 text-xs" style={{ color: "var(--color-ink-soft)" }}>{ROLE_DESCRIPTIONS[role]}</p>

        {result && (
          <div className="sm:col-span-4 rounded-lg px-4 py-3 text-sm" style={result.ok ? { backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" } : { backgroundColor: "var(--color-danger-tint)", color: "var(--color-danger)" }}>
            <p>{result.text}</p>
            {result.password && (
              <p className="mt-1">Temporary password (share securely, once): <span className="font-mono font-semibold">{result.password}</span></p>
            )}
          </div>
        )}
      </form>

      <DataTable
        columns={columns}
        rows={filteredMembers}
        getRowKey={(m) => m.id}
        itemLabel="team members"
        emptyMessage={(members ?? []).length === 0 ? "No team members yet." : "No team members match this filter."}
        filteredEmptyMessage="No team members match this filter."
        search={{ placeholder: "Search name…", filter: (m, q) => (m.profiles?.full_name ?? "").toLowerCase().includes(q) }}
        exportFilename="finance-team"
        minWidth={560}
        toolbar={
          <>
            <MultiSelect
              options={[{ value: "owner", label: "Owner" }, ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))]}
              selected={draftRoleFilter}
              onChange={setDraftRoleFilter}
              placeholder="All roles"
            />
            <SearchButton onClick={() => setRoleFilter(draftRoleFilter)} dirty={roleFilterDirty} />
          </>
        }
      />
    </div>
  );
}
