"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Trash2, Star } from "lucide-react";
import type { Department, DepartmentRole } from "@/lib/roles";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { RequiredMark } from "@/components/RequiredMark";

type DepartmentWithRoles = Department & { department_roles: DepartmentRole[]; organizations?: { name: string | null } | null };

// Admin-only. Builds the configurable staff hierarchy this org actually
// wants — a department (e.g. "Sales", "Support") with its own ladder of
// role titles ("Lead", "Manager", "Senior Manager", or whatever this
// company calls them), instead of being stuck with the generic
// rater/leader/group_leader fallback everyone starts on. Who actually
// manages whom is still decided by each employee's reports_to chain
// (set on the Employees page) — a role here is a label plus whether it
// unlocks Team Management-level visibility, not the reporting edge
// itself.
export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentWithRoles[] | null>(null);
  const [newDeptName, setNewDeptName] = useState("");
  const [creatingDept, setCreatingDept] = useState(false);
  const [newRoleDraft, setNewRoleDraft] = useState<Record<string, { title: string; isManagerLevel: boolean }>>({});
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const { message, showSuccess, showError } = useActionMessage();

  async function load() {
    const res = await fetch("/api/admin/departments");
    const data = await res.json();
    if (res.ok) setDepartments(data.departments);
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleCreateDepartment() {
    if (!newDeptName.trim()) return;
    setCreatingDept(true);
    const res = await fetch("/api/admin/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDeptName.trim() }),
    });
    setCreatingDept(false);
    if (res.ok) {
      setNewDeptName("");
      showSuccess("Department created.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to create department.");
    }
  }

  async function handleDeleteDepartment(dept: DepartmentWithRoles) {
    if (!confirm(`Delete "${dept.name}"? Anyone assigned to it (or its roles) just loses the assignment — no accounts are affected.`)) return;
    const res = await fetch(`/api/admin/departments/${dept.id}`, { method: "DELETE" });
    if (res.ok) {
      showSuccess("Department deleted.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to delete department.");
    }
  }

  async function handleAddRole(dept: DepartmentWithRoles) {
    const draft = newRoleDraft[dept.id];
    if (!draft?.title.trim()) return;
    setSavingRole(dept.id);
    const nextRank = (dept.department_roles.reduce((max, r) => Math.max(max, r.rank), 0) ?? 0) + 1;
    const res = await fetch(`/api/admin/departments/${dept.id}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: draft.title.trim(), rank: nextRank, isManagerLevel: draft.isManagerLevel }),
    });
    setSavingRole(null);
    if (res.ok) {
      setNewRoleDraft((prev) => ({ ...prev, [dept.id]: { title: "", isManagerLevel: false } }));
      showSuccess("Role added.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to add role.");
    }
  }

  async function handleToggleManagerLevel(role: DepartmentRole) {
    const res = await fetch(`/api/admin/department-roles/${role.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isManagerLevel: !role.is_manager_level }),
    });
    if (res.ok) await load();
    else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to update role.");
    }
  }

  async function handleDeleteRole(role: DepartmentRole) {
    if (!confirm(`Delete the "${role.title}" role? Anyone assigned to it just loses the assignment.`)) return;
    const res = await fetch(`/api/admin/department-roles/${role.id}`, { method: "DELETE" });
    if (res.ok) {
      showSuccess("Role deleted.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to delete role.");
    }
  }

  const inputClass = "w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-action)]";

  // Only a platform_admin's request ever returns more than one org's
  // departments pooled together — the label is only worth showing once
  // it's actually ambiguous which org a card belongs to.
  const spansMultipleOrgs = new Set((departments ?? []).map((d) => d.organization_id)).size > 1;

  return (
    <div>
      <DashboardPageHero
        title="Departments"
        subtitle="Build the team structure and role ladder that actually fits this company — assign people to it from the Employees page."
      >
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:max-w-xs">
          <HeroKpi icon={Building2} label="Departments" value={departments?.length ?? 0} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      <div className="mt-3 rounded-xl border px-4 py-3 text-xs leading-relaxed" style={{ borderColor: "#e8c46a", backgroundColor: "#fff6d9", color: "#6b5215" }}>
        <span className="font-semibold">&quot;Manager-level&quot; only controls what shows in the sidebar</span> — marking a
        role manager-level unlocks the Team Management nav links for anyone assigned to it, but it doesn&apos;t by
        itself give them any team to actually see. That comes from the <span className="font-semibold">Reports To</span> field
        on each employee&apos;s record in Employees — set their reports&apos; &quot;Reports To&quot; to this person, and it works
        the same as a built-in Leader/Group Leader would.
      </div>

      <div className="mt-3 flex items-end gap-2 rounded-2xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Department Name<RequiredMark /></label>
          <input
            placeholder="e.g. Sales, Support, Compliance"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateDepartment()}
            className={inputClass}
            style={{ borderColor: "var(--color-line)" }}
          />
        </div>
        <button
          type="button"
          onClick={handleCreateDepartment}
          disabled={creatingDept || !newDeptName.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          <Plus className="h-4 w-4" /> Add Department
        </button>
      </div>

      {departments === null ? (
        <LoadingBlock className="mt-6" />
      ) : departments.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>No departments yet — add one above to get started.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {departments.map((dept) => (
            <div key={dept.id} className="rounded-xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{dept.name}</p>
                  {spansMultipleOrgs && (
                    <p className="mt-0.5 text-xs" style={{ color: "var(--color-ink-soft)" }}>{dept.organizations?.name ?? "Unknown organization"}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteDepartment(dept)}
                  className="rounded-full border px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                  style={{ borderColor: "var(--color-line)" }}
                >
                  Delete Department
                </button>
              </div>

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>Role Ladder</p>
              {dept.department_roles.length === 0 ? (
                <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>No roles yet — add the first one below.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {dept.department_roles.map((role) => (
                    <div key={role.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--color-line)" }}>
                      <span className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>{role.title}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleManagerLevel(role)}
                          title={role.is_manager_level ? "Manager-level — shows Team Management in the sidebar. Click to turn off." : "Individual contributor — click to show Team Management in the sidebar for this role (still needs Reports To set in Employees to actually see a team)"}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
                          style={
                            role.is_manager_level
                              ? { backgroundColor: "var(--color-accent-tint)", color: "var(--color-ink)" }
                              : { backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }
                          }
                        >
                          <Star className="h-3 w-3" />
                          {role.is_manager_level ? "Manager-level" : "Individual"}
                        </button>
                        <button type="button" onClick={() => handleDeleteRole(role)} aria-label="Delete role" className="rounded-lg p-1.5 transition-colors hover:bg-red-50" style={{ color: "#b42318" }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>Role Title<RequiredMark /></label>
                  <input
                    placeholder="e.g. Lead, Manager, Senior Manager"
                    value={newRoleDraft[dept.id]?.title ?? ""}
                    onChange={(e) => setNewRoleDraft((prev) => ({ ...prev, [dept.id]: { title: e.target.value, isManagerLevel: prev[dept.id]?.isManagerLevel ?? false } }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddRole(dept)}
                    className={inputClass}
                    style={{ borderColor: "var(--color-line)" }}
                  />
                </div>
                <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>
                  <input
                    type="checkbox"
                    checked={newRoleDraft[dept.id]?.isManagerLevel ?? false}
                    onChange={(e) => setNewRoleDraft((prev) => ({ ...prev, [dept.id]: { title: prev[dept.id]?.title ?? "", isManagerLevel: e.target.checked } }))}
                  />
                  Manager-level
                </label>
                <button
                  type="button"
                  onClick={() => handleAddRole(dept)}
                  disabled={savingRole === dept.id || !newRoleDraft[dept.id]?.title.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)] disabled:opacity-60"
                  style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Role
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
