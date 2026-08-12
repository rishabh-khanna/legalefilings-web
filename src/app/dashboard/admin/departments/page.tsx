"use client";

import { useEffect, useState } from "react";
import { Building2, Layers, Plus, Trash2, Star, Info } from "lucide-react";
import type { Department, DepartmentRole } from "@/lib/roles";
import { useActionMessage } from "@/lib/use-action-message";
import { useConfirm } from "@/lib/use-confirm";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { RequiredMark } from "@/components/RequiredMark";

// Same rotating tint set used for the sidebar's nav icons and the leads
// board's avatars — reused here rather than inventing a new palette, so
// the page reads as part of the same app instead of a flatter, separately
// styled screen. Color is hashed from the name (same algorithm as those
// two), so a given org or department always lands on the same color
// across reloads rather than shuffling on every render.
const TINTS = [
  { bg: "var(--color-accent-tint)", fg: "var(--color-action-dark)" },
  { bg: "var(--color-info-tint)", fg: "var(--color-info)" },
  { bg: "var(--color-success-tint)", fg: "var(--color-success)" },
  { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" },
  { bg: "#ede9fe", fg: "#5b21b6" },
  { bg: "#fce7f3", fg: "#9d174d" },
  { bg: "#e0f2fe", fg: "#075985" },
];

function tintFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

type DepartmentRoleWithCreator = DepartmentRole & { creator?: { full_name: string | null } | null };
type DepartmentWithRoles = Department & {
  department_roles: DepartmentRoleWithCreator[];
  organizations?: { name: string | null } | null;
  creator?: { full_name: string | null } | null;
};

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
  const { confirm, confirmDialog } = useConfirm();

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
    if (!(await confirm(`Delete "${dept.name}"? Anyone assigned to it (or its roles) just loses the assignment — no accounts are affected.`, { confirmLabel: "Delete", danger: true }))) return;
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
    if (!(await confirm(`Delete the "${role.title}" role? Anyone assigned to it just loses the assignment.`, { confirmLabel: "Delete", danger: true }))) return;
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

  // Grouped by org so a platform_admin sees "which company's Operations
  // is this" as a section heading instead of ~40 identically-named cards
  // in one flat scroll with only a one-line org tag to tell them apart.
  const groups: { orgId: string; orgName: string; depts: DepartmentWithRoles[] }[] = [];
  for (const dept of departments ?? []) {
    const orgId = spansMultipleOrgs ? dept.organization_id : "__own__";
    let group = groups.find((g) => g.orgId === orgId);
    if (!group) {
      group = { orgId, orgName: dept.organizations?.name ?? "Unknown organization", depts: [] };
      groups.push(group);
    }
    group.depts.push(dept);
  }

  return (
    <div>
      <DashboardPageHero
        title="Departments"
        subtitle={
          spansMultipleOrgs
            ? "Every organization's team structure and role ladder, pooled here for platform-level support — each company still manages its own from its own Administration → Departments page."
            : "Build the team structure and role ladder that actually fits this company — assign people to it from the Employees page."
        }
      >
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:max-w-xs">
          <HeroKpi icon={Building2} label="Departments" value={departments?.length ?? 0} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>
      {confirmDialog}

      <div className="mt-3 flex gap-3 rounded-2xl border px-4 py-3.5 text-xs leading-relaxed" style={{ borderColor: "#f0dca0", backgroundColor: "#fdf6e3", color: "#6b5215" }}>
        <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#c8960c" }} />
        <p>
          <span className="font-semibold">&quot;Manager-level&quot; only controls what shows in the sidebar</span> — marking a
          role manager-level unlocks the Team Management nav links for anyone assigned to it, but it doesn&apos;t by
          itself give them any team to actually see. That comes from the <span className="font-semibold">Reports To</span> field
          on each employee&apos;s record in Employees — set their reports&apos; &quot;Reports To&quot; to this person, and it works
          the same as a built-in Leader/Group Leader would.
        </p>
      </div>

      {spansMultipleOrgs ? (
        <p className="mt-3 text-xs" style={{ color: "var(--color-ink-soft)" }}>
          Adding a new department here isn&apos;t available in this cross-org view — there&apos;s no single company to attach it to. Open a specific organization&apos;s own Departments page to add one for them.
        </p>
      ) : (
        <div className="mt-3 flex items-end gap-2 rounded-2xl border bg-white p-4 shadow-sm dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
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
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            <Plus className="h-3.5 w-3.5" /> Add Department
          </button>
        </div>
      )}

      {departments === null ? (
        <LoadingBlock className="mt-6" />
      ) : departments.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>No departments yet — add one above to get started.</p>
      ) : (
        <div className="mt-5 space-y-6">
          {groups.map((group) => {
            const orgTint = tintFor(group.orgName);
            return (
            <div key={group.orgId}>
              {spansMultipleOrgs && (
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: orgTint.bg }}>
                    <Building2 className="h-3.5 w-3.5" style={{ color: orgTint.fg }} />
                  </div>
                  <h2 className="text-sm font-bold" style={{ color: "var(--color-ink)" }}>{group.orgName}</h2>
                  <span className="text-xs" style={{ color: "var(--color-ink-soft)" }}>{group.depts.length} department{group.depts.length === 1 ? "" : "s"}</span>
                </div>
              )}
              <div className="space-y-3">
                {group.depts.map((dept) => {
                  const deptTint = tintFor(dept.name);
                  return (
                  <div
                    key={dept.id}
                    className="rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-[var(--color-paper-raised)]"
                    // The left accent carries the org's color (blank when
                    // there's only one org in view — nothing to tell apart),
                    // so in the platform-admin pooled view every card
                    // visually clusters with its own company's header chip
                    // above without needing to re-read the org name on each
                    // card individually.
                    style={{ borderColor: "var(--color-line)", borderLeft: spansMultipleOrgs ? `4px solid ${orgTint.fg}` : undefined }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: deptTint.bg }}>
                          <Layers className="h-4 w-4" style={{ color: deptTint.fg }} />
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{dept.name}</p>
                          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                            {dept.department_roles.length} role{dept.department_roles.length === 1 ? "" : "s"}
                            {dept.creator?.full_name && ` · Added by ${dept.creator.full_name}`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteDepartment(dept)}
                        aria-label="Delete department"
                        title="Delete department"
                        className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-red-50"
                        style={{ color: "var(--color-danger)" }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>Role Ladder</p>
                    {dept.department_roles.length === 0 ? (
                      <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>No roles yet — add the first one below.</p>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {dept.department_roles.map((role, i) => (
                          <div key={role.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 transition-colors" style={{ backgroundColor: "var(--color-paper)" }}>
                            <div className="flex items-center gap-2.5">
                              <span
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                                style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }}
                              >
                                {i + 1}
                              </span>
                              <span className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>{role.title}</span>
                              {role.creator?.full_name && (
                                <span className="text-xs" style={{ color: "var(--color-ink-soft)" }} title={`Added by ${role.creator.full_name}`}>
                                  · {role.creator.full_name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleManagerLevel(role)}
                                title={role.is_manager_level ? "Manager-level — shows Team Management in the sidebar. Click to turn off." : "Individual contributor — click to show Team Management in the sidebar for this role (still needs Reports To set in Employees to actually see a team)"}
                                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors"
                                style={
                                  role.is_manager_level
                                    ? { backgroundColor: "var(--color-accent-tint)", borderColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }
                                    : { backgroundColor: "transparent", borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }
                                }
                              >
                                <Star className="h-3 w-3" fill={role.is_manager_level ? "currentColor" : "none"} />
                                {role.is_manager_level ? "Manager-level" : "Individual"}
                              </button>
                              <button type="button" onClick={() => handleDeleteRole(role)} aria-label="Delete role" className="rounded-lg p-1.5 transition-colors hover:bg-red-50" style={{ color: "var(--color-danger)" }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex items-end gap-2 border-t pt-3" style={{ borderColor: "var(--color-line)" }}>
                      <div className="flex-1">
                        <input
                          placeholder="Add a role title, e.g. Lead, Manager, Senior Manager"
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
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        style={{ backgroundColor: "var(--color-action)" }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
