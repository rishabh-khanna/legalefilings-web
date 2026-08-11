"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DELEGABLE_TOOLS, isGrantActive, type ToolKey } from "@/lib/tool-grants";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";

type StaffRow = { id: string; full_name: string | null; account_type: string; staff_level: string | null };
type GrantRow = { id: string; staff_id: string; tool_key: ToolKey; granted_by: string | null; expires_at: string | null; created_at: string };

// Admin-only. Lets an org admin hand a specific staff member (not a
// whole role tier) access to one normally admin-only section — e.g.
// "let this rater help with Payroll this month" — without promoting
// them and picking up every other admin section along with it. See
// src/lib/tool-grants.ts for the DELEGABLE_TOOLS list and how proxy.ts
// / DashboardShell honor a live grant.
export default function ToolAccessPage() {
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [grants, setGrants] = useState<GrantRow[] | null>(null);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedTool, setSelectedTool] = useState<ToolKey | "">("");
  const [expiresAt, setExpiresAt] = useState("");
  const [granting, setGranting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const { message, showSuccess, showError } = useActionMessage();

  async function load() {
    const res = await fetch("/api/admin/tool-grants");
    const data = await res.json();
    if (res.ok) {
      setStaff(data.staff);
      setGrants(data.grants);
    }
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const staffOnly = useMemo(() => (staff ?? []).filter((s) => s.account_type === "staff"), [staff]);
  const staffById = useMemo(() => new Map((staff ?? []).map((s) => [s.id, s])), [staff]);
  const activeGrants = useMemo(() => (grants ?? []).filter(isGrantActive), [grants]);

  const [toolFilter, setToolFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const filteredGrants = useMemo(() => {
    return (grants ?? []).filter((g) => {
      if (toolFilter.size > 0 && !toolFilter.has(g.tool_key)) return false;
      if (statusFilter.size > 0) {
        const active = isGrantActive(g);
        if (!statusFilter.has(active ? "active" : "expired")) return false;
      }
      return true;
    });
  }, [grants, toolFilter, statusFilter]);

  async function handleGrant() {
    if (!selectedStaff || !selectedTool) return;
    setGranting(true);
    const res = await fetch("/api/admin/tool-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: selectedStaff, toolKey: selectedTool, expiresAt: expiresAt || null }),
    });
    setGranting(false);
    if (res.ok) {
      showSuccess("Access granted.");
      setSelectedStaff("");
      setSelectedTool("");
      setExpiresAt("");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to grant access.");
    }
  }

  async function handleRevoke(grant: GrantRow) {
    if (!confirm("Revoke this delegated access?")) return;
    setRevokingId(grant.id);
    const res = await fetch(`/api/admin/tool-grants/${grant.id}`, { method: "DELETE" });
    setRevokingId(null);
    if (res.ok) {
      showSuccess("Access revoked.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to revoke access.");
    }
  }

  const inputClass = "w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-action)]";

  const columns: DataTableColumn<GrantRow>[] = [
    { key: "staff", header: "Staff Member", render: (g) => staffById.get(g.staff_id)?.full_name ?? "Unknown", exportValue: (g) => staffById.get(g.staff_id)?.full_name ?? "Unknown", sortValue: (g) => staffById.get(g.staff_id)?.full_name },
    { key: "tool", header: "Tool", render: (g) => DELEGABLE_TOOLS.find((t) => t.key === g.tool_key)?.label ?? g.tool_key, exportValue: (g) => DELEGABLE_TOOLS.find((t) => t.key === g.tool_key)?.label ?? g.tool_key, sortValue: (g) => DELEGABLE_TOOLS.find((t) => t.key === g.tool_key)?.label ?? g.tool_key },
    { key: "expires", header: "Expires", className: "w-[14%] whitespace-nowrap", render: (g) => (g.expires_at ? new Date(g.expires_at).toLocaleDateString("en-IN") : "No expiry"), exportValue: (g) => (g.expires_at ? new Date(g.expires_at).toLocaleDateString("en-IN") : "No expiry"), sortValue: (g) => g.expires_at },
    {
      key: "status",
      header: "Status",
      className: "w-[12%] whitespace-nowrap",
      render: (g) => {
        const active = isGrantActive(g);
        return (
          <span
            className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
            style={active ? { backgroundColor: "var(--color-accent-tint)", color: "#116a2c" } : { backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}
          >
            {active ? "Active" : "Expired"}
          </span>
        );
      },
      exportValue: (g) => (isGrantActive(g) ? "Active" : "Expired"),
      sortValue: (g) => (isGrantActive(g) ? "Active" : "Expired"),
    },
    {
      key: "actions",
      header: "Action",
      className: "text-right",
      render: (g) => (
        <button
          type="button"
          onClick={() => handleRevoke(g)}
          disabled={revokingId === g.id}
          aria-label="Revoke access"
          className="rounded-lg p-1.5 transition-colors hover:bg-red-50 disabled:opacity-60"
          style={{ color: "#b42318" }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <DashboardPageHero
        title="Delegated Access"
        subtitle="Grant a specific staff member access to one admin-only tool, without promoting them to admin."
      >
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:max-w-xs">
          <HeroKpi icon={KeyRound} label="Active Grants" value={activeGrants.length} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      <div className="mt-3 rounded-2xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Grant Access</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
            <option value="">Select staff member…</option>
            {staffOnly.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name ?? "Unnamed"}</option>
            ))}
          </select>
          <select value={selectedTool} onChange={(e) => setSelectedTool(e.target.value as ToolKey)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
            <option value="">Select tool…</option>
            {DELEGABLE_TOOLS.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={inputClass}
            style={{ borderColor: "var(--color-line)" }}
            title="Optional — leave blank for access that lasts until revoked"
          />
          <button
            type="button"
            onClick={handleGrant}
            disabled={granting || !selectedStaff || !selectedTool}
            className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            Grant
          </button>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>Leave the date blank for access that lasts until you revoke it.</p>
      </div>

      {staff === null || grants === null ? (
        <LoadingBlock className="mt-6" />
      ) : (
        <DataTable
          columns={columns}
          fixedLayout
          rows={filteredGrants}
          getRowKey={(g) => g.id}
          itemLabel="grants"
          emptyMessage={grants.length === 0 ? "No delegated access granted yet." : "No grants match this filter."}
          filteredEmptyMessage="No grants match this filter."
          search={{ placeholder: "Search staff member…", filter: (g, q) => (staffById.get(g.staff_id)?.full_name ?? "").toLowerCase().includes(q) }}
          exportFilename="delegated-access"
          toolbar={
            <>
              <MultiSelect
                options={DELEGABLE_TOOLS.map((t) => ({ value: t.key, label: t.label }))}
                selected={toolFilter}
                onChange={setToolFilter}
                placeholder="All tools"
              />
              <MultiSelect
                options={[
                  { value: "active", label: "Active" },
                  { value: "expired", label: "Expired" },
                ]}
                selected={statusFilter}
                onChange={setStatusFilter}
                placeholder="All statuses"
              />
              {(toolFilter.size > 0 || statusFilter.size > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setToolFilter(new Set());
                    setStatusFilter(new Set());
                  }}
                  className="text-xs font-semibold"
                  style={{ color: "var(--color-action-dark)" }}
                >
                  Clear filters
                </button>
              )}
            </>
          }
        />
      )}
    </div>
  );
}
