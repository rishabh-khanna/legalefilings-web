"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { BookSwitcher } from "@/components/finance/BookSwitcher";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { ExportButton } from "@/components/ExportButton";

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
    if (!window.confirm(`Remove ${name} from this book's team? They'll lose access immediately.`)) return;
    const res = await fetch(`/api/expense-manager/members/${id}`, { method: "DELETE" });
    if (res.ok) loadMembers(bookOwnerId);
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  const [roleFilter, setRoleFilter] = useState<Member["role"] | "all">("all");
  const filteredMembers = useMemo(() => {
    return (members ?? []).filter((m) => roleFilter === "all" || m.role === roleFilter);
  }, [members, roleFilter]);

  const { page, setPage, pageSize, setPageSize, pageItems: pagedMembers, totalPages, total, start, end } = usePagination(filteredMembers);

  return (
    <div>
      <DashboardPageHero title="Team" subtitle="Who has access to these books, and what they can do.">
        <Link href="/dashboard/finance" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Business Finance
        </Link>
      </DashboardPageHero>

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
          <div className="sm:col-span-4 rounded-lg px-4 py-3 text-sm" style={result.ok ? { backgroundColor: "#d0f4db", color: "#116a2c" } : { backgroundColor: "#fde2e2", color: "#b42318" }}>
            <p>{result.text}</p>
            {result.password && (
              <p className="mt-1">Temporary password (share securely, once): <span className="font-mono font-semibold">{result.password}</span></p>
            )}
          </div>
        )}
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Member["role"] | "all")}
            className="rounded-lg border px-2.5 py-1.5 text-sm outline-none"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
          >
            <option value="all">All roles</option>
            <option value="owner">Owner</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {roleFilter !== "all" && (
            <button
              type="button"
              onClick={() => setRoleFilter("all")}
              className="text-xs font-semibold"
              style={{ color: "var(--color-action-dark)" }}
            >
              Clear filters
            </button>
          )}
        </div>
        <ExportButton
          filename="finance-team"
          headers={["Name", "Role"]}
          rows={filteredMembers.map((m) => [m.profiles?.full_name ?? "Unknown", m.role === "owner" ? "Owner" : ROLE_OPTIONS.find((r) => r.value === m.role)?.label ?? m.role])}
        />
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        start={start}
        end={end}
        total={total}
        itemLabel="team members"
      />

      <div className="mt-3 overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <table className="dt-table w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>#</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Name</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Role</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {pagedMembers.map((m, i) => (
              <tr key={m.id}>
                <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{m.profiles?.full_name ?? "Unknown"}</td>
                <td className="px-4 py-3">
                  {m.role === "owner" ? (
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: "#fff6d9", color: "#8a6700" }}>Owner</span>
                  ) : (
                    <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--color-line)" }}>
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {m.role !== "owner" && (
                    <button type="button" onClick={() => handleRemove(m.id, m.profiles?.full_name ?? "this member")} className="text-xs font-medium" style={{ color: "#b42318" }}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
            {members !== null && members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center" style={{ color: "var(--color-ink-soft)" }}>No team members yet.</td>
              </tr>
            )}
            {members !== null && members.length !== 0 && filteredMembers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center" style={{ color: "var(--color-ink-soft)" }}>No team members match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
