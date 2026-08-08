"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { STAFF_LEVEL_LABELS, roleLabel, type Profile, type StaffLevel, type Department, type DepartmentRole } from "@/lib/roles";
import { RequiredMark } from "@/components/RequiredMark";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { ExportButton } from "@/components/ExportButton";

type DepartmentWithRoles = Department & { department_roles: DepartmentRole[] };
type EmployeeRow = Profile & { department_roles: { title: string; is_manager_level: boolean } | null; organizations?: { name: string | null } | null };

type EditForm = {
  employeeId: string;
  department: string;
  designation: string;
  dateOfJoining: string;
  uanNumber: string;
  esicNumber: string;
  aadhaarNumber: string;
  panNumber: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  staffLevel: StaffLevel | "";
  departmentId: string;
  departmentRoleId: string;
  reportsTo: string;
};

const EMPTY_FORM: EditForm = {
  employeeId: "",
  department: "",
  designation: "",
  dateOfJoining: "",
  uanNumber: "",
  esicNumber: "",
  aadhaarNumber: "",
  panNumber: "",
  bankName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  staffLevel: "",
  departmentId: "",
  departmentRoleId: "",
  reportsTo: "",
};

// Admin-only employee master editor (Module 2: Edit Employee). Fields here
// — department, designation, UAN, ESIC in particular — are org-assigned,
// not self-declared, so they're deliberately absent from the employee's
// own /dashboard/profile edit form and only settable here.
export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[] | null>(null);
  const [departments, setDepartments] = useState<DepartmentWithRoles[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { message, showSuccess, showError } = useActionMessage();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function load() {
    const res = await fetch("/api/admin/employees");
    const data = await res.json();
    if (res.ok) setEmployees(data.employees);
  }

  async function loadDepartments() {
    const res = await fetch("/api/admin/departments");
    const data = await res.json();
    if (res.ok) setDepartments(data.departments);
  }

  useEffect(() => {
    const kickoff = setTimeout(() => {
      load();
      loadDepartments();
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  function startEdit(emp: EmployeeRow) {
    setEditingId(emp.id);
    setForm({
      employeeId: emp.employee_id ?? "",
      department: emp.department ?? "",
      designation: emp.designation ?? "",
      dateOfJoining: emp.date_of_joining ?? "",
      uanNumber: emp.uan_number ?? "",
      esicNumber: emp.esic_number ?? "",
      aadhaarNumber: emp.aadhaar_number ?? "",
      panNumber: emp.pan_number ?? "",
      bankName: emp.bank_name ?? "",
      bankAccountNumber: emp.bank_account_number ?? "",
      bankIfsc: emp.bank_ifsc ?? "",
      staffLevel: emp.staff_level ?? "",
      departmentId: emp.department_id ?? "",
      departmentRoleId: emp.department_role_id ?? "",
      reportsTo: emp.reports_to ?? "",
    });
  }

  async function handleSave(id: string) {
    const emp = (employees ?? []).find((e) => e.id === id);
    // Everything except Bank Details is mandatory. The staff-only fields
    // (Staff Level, Team/Department, Reports To) only apply — and are
    // only required — when this employee is account_type "staff"; a
    // customer/admin record never shows those inputs, so they can't be
    // required for one. Role in Team is additionally gated on a
    // Department already being chosen, same as its own visibility.
    const missing: string[] = [];
    if (!form.employeeId.trim()) missing.push("Employee ID");
    if (!form.department.trim()) missing.push("Department");
    if (!form.designation.trim()) missing.push("Designation");
    if (!form.dateOfJoining.trim()) missing.push("Date of Joining");
    if (!form.uanNumber.trim()) missing.push("UAN Number");
    if (!form.esicNumber.trim()) missing.push("ESIC Number");
    if (!form.aadhaarNumber.trim()) missing.push("Aadhaar Number");
    if (!form.panNumber.trim()) missing.push("PAN Number");
    if (emp?.account_type === "staff") {
      if (!form.staffLevel) missing.push("Staff Level");
      if (!form.departmentId) missing.push("Team / Department");
      if (form.departmentId && !form.departmentRoleId) missing.push("Role in Team");
      if (!form.reportsTo) missing.push("Reports To");
    }
    if (missing.length > 0) {
      showError(`Required: ${missing.join(", ")}.`);
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      showSuccess("Employee updated.");
      setEditingId(null);
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to update employee.");
    }
  }

  async function handleDelete(emp: EmployeeRow) {
    // The API decides for itself whether this ends up a hard delete or a
    // deactivate (anyone with attendance/leave/payroll/document history
    // gets deactivated instead — their records have to survive them
    // leaving) — the confirm dialog can't promise one or the other.
    if (!confirm(`Remove ${emp.full_name ?? "this employee"}'s account? If they have any attendance, leave, payroll, or document history, they'll be deactivated (login blocked, history kept) instead of deleted outright.`)) return;
    setDeletingId(emp.id);
    const res = await fetch(`/api/admin/employees/${emp.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      showSuccess(data.deactivated ? "Employee deactivated — history kept, login blocked." : "Employee deleted.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to remove employee.");
    }
  }

  async function handleReactivate(emp: EmployeeRow) {
    setDeletingId(emp.id);
    const res = await fetch(`/api/admin/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    setDeletingId(null);
    if (res.ok) {
      showSuccess("Employee reactivated.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to reactivate employee.");
    }
  }

  const inputClass = "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-action)] dark:bg-[var(--color-paper)]";
  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide";

  function FieldGroupTitle({ children }: { children: React.ReactNode }) {
    return (
      <p className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-action-dark)" }}>
        {children}
      </p>
    );
  }

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) =>
      [emp.full_name, emp.employee_id, emp.department, emp.designation].some((f) => f?.toLowerCase().includes(q))
    );
  }, [employees, debouncedSearch]);
  const { page, setPage, pageSize, setPageSize, pageItems: pagedEmployees, totalPages, total, start, end } = usePagination(filteredEmployees);

  // Only a platform_admin's request ever returns more than one org's
  // employees pooled together — the column is only worth showing once
  // it's actually ambiguous which org a row belongs to.
  const spansMultipleOrgs = new Set((employees ?? []).map((e) => e.organization_id)).size > 1;

  return (
    <div>
      <DashboardPageHero title="Employees" subtitle="Department, designation, UAN, and ESIC are set here, not by the employee.">
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:max-w-xs">
          <HeroKpi icon={Users} label="Employees" value={employees?.length ?? 0} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {employees !== null && employees.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, employee ID, department, designation…"
            className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <ExportButton
            filename="employees"
            headers={[
              "Name",
              "Employee ID",
              "Role",
              "Department",
              "Designation",
              ...(spansMultipleOrgs ? ["Organization"] : []),
            ]}
            rows={filteredEmployees.map((emp) => [
              emp.full_name ?? "Unnamed",
              emp.employee_id ?? "",
              roleLabel(emp, emp.department_roles?.title),
              emp.department ?? "",
              emp.designation ?? "",
              ...(spansMultipleOrgs ? [emp.organizations?.name ?? "Unknown organization"] : []),
            ])}
          />
        </div>
      )}

      {employees === null ? (
        <LoadingBlock className="mt-6" />
      ) : employees.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>No employees yet.</p>
      ) : filteredEmployees.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>No employees match this search.</p>
      ) : (
        <>
          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            start={start}
            end={end}
            total={total}
            itemLabel="employees"
          />
          <div className="mt-3 overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
            <table className="dt-table w-full min-w-[760px]">
              <thead>
                <tr className="text-left">
                  <th>#</th>
                  <th>Name</th>
                  <th>Employee ID</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Designation</th>
                  {spansMultipleOrgs && <th>Organization</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedEmployees.map((emp, i) => {
                  const isEditing = editingId === emp.id;
                  return (
                    <Fragment key={emp.id}>
                      <tr>
                        <td style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                        <td>
                          <span className="flex items-center gap-2 font-semibold" style={{ color: "var(--color-ink)" }}>
                            {emp.full_name ?? "Unnamed"}
                            {!emp.is_active && (
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
                                Deactivated
                              </span>
                            )}
                          </span>
                        </td>
                        <td style={{ color: "var(--color-ink-soft)" }}>{emp.employee_id ?? "—"}</td>
                        <td style={{ color: "var(--color-ink-soft)" }}>{roleLabel(emp, emp.department_roles?.title)}</td>
                        <td style={{ color: "var(--color-ink-soft)" }}>{emp.department ?? "—"}</td>
                        <td style={{ color: "var(--color-ink-soft)" }}>{emp.designation ?? "—"}</td>
                        {spansMultipleOrgs && <td style={{ color: "var(--color-ink-soft)" }}>{emp.organizations?.name ?? "—"}</td>}
                        <td>
                          {!isEditing && (
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(emp)}
                                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
                                style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                              >
                                Edit
                              </button>
                              {emp.is_active === false && (
                                <button
                                  type="button"
                                  onClick={() => handleReactivate(emp)}
                                  disabled={deletingId === emp.id}
                                  className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)] disabled:opacity-60"
                                  style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                                >
                                  {deletingId === emp.id ? "Reactivating…" : "Reactivate"}
                                </button>
                              )}
                              {emp.account_type !== "admin" && emp.is_active !== false && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(emp)}
                                  disabled={deletingId === emp.id}
                                  className="rounded-full border px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                                  style={{ borderColor: "var(--color-line)" }}
                                >
                                  {deletingId === emp.id ? "Removing…" : "Delete"}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {isEditing && (
                        <tr>
                          <td colSpan={spansMultipleOrgs ? 8 : 7} className="p-0">
                            <div
                              className="m-3 rounded-2xl border p-5"
                              style={{ borderColor: "var(--color-accent)", backgroundColor: "var(--color-paper)" }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold" style={{ color: "var(--color-ink)" }}>
                                  Editing {emp.full_name ?? "employee"}
                                </p>
                                <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                                  <span style={{ color: "#b42318" }}>*</span> Required
                                </p>
                              </div>

                              <div className="mt-4 rounded-xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
                                <FieldGroupTitle>Employment Details</FieldGroupTitle>
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <div>
                                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Employee ID<RequiredMark /></label>
                                    <input
                                      required
                                      value={form.employeeId}
                                      onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                                      className={inputClass}
                                      style={{ borderColor: form.employeeId.trim() ? "var(--color-line)" : "#f0b4ab" }}
                                      placeholder="EMP-202601-0002"
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Department<RequiredMark /></label>
                                    <input
                                      required
                                      value={form.department}
                                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                                      className={inputClass}
                                      style={{ borderColor: form.department.trim() ? "var(--color-line)" : "#f0b4ab" }}
                                      placeholder="e.g. Sales"
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Designation<RequiredMark /></label>
                                    <input
                                      required
                                      value={form.designation}
                                      onChange={(e) => setForm({ ...form, designation: e.target.value })}
                                      className={inputClass}
                                      style={{ borderColor: form.designation.trim() ? "var(--color-line)" : "#f0b4ab" }}
                                      placeholder="e.g. Sales Executive"
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Date of Joining<RequiredMark /></label>
                                    <input
                                      required
                                      type="date"
                                      value={form.dateOfJoining}
                                      onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
                                      className={inputClass}
                                      style={{ borderColor: form.dateOfJoining.trim() ? "var(--color-line)" : "#f0b4ab" }}
                                    />
                                  </div>
                                  {emp.account_type === "staff" && (
                                    <div>
                                      <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Staff Level (fallback)<RequiredMark /></label>
                                      <select
                                        required
                                        value={form.staffLevel}
                                        onChange={(e) => setForm({ ...form, staffLevel: e.target.value as StaffLevel })}
                                        className={inputClass}
                                        style={{ borderColor: form.staffLevel ? "var(--color-line)" : "#f0b4ab" }}
                                      >
                                        <option value="" disabled>— Select —</option>
                                        {Object.entries(STAFF_LEVEL_LABELS).map(([value, label]) => (
                                          <option key={value} value={value}>{label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  {emp.account_type === "staff" && (
                                    <div>
                                      <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Team / Department<RequiredMark /></label>
                                      <select
                                        required
                                        value={form.departmentId}
                                        onChange={(e) => setForm({ ...form, departmentId: e.target.value, departmentRoleId: "" })}
                                        className={inputClass}
                                        style={{ borderColor: form.departmentId ? "var(--color-line)" : "#f0b4ab" }}
                                      >
                                        <option value="" disabled>— Select —</option>
                                        {departments.map((d) => (
                                          <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  {emp.account_type === "staff" && form.departmentId && (
                                    <div>
                                      <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Role in Team<RequiredMark /></label>
                                      <select
                                        required
                                        value={form.departmentRoleId}
                                        onChange={(e) => setForm({ ...form, departmentRoleId: e.target.value })}
                                        className={inputClass}
                                        style={{ borderColor: form.departmentRoleId ? "var(--color-line)" : "#f0b4ab" }}
                                      >
                                        <option value="" disabled>— Select —</option>
                                        {(departments.find((d) => d.id === form.departmentId)?.department_roles ?? []).map((r) => (
                                          <option key={r.id} value={r.id}>{r.title}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  {emp.account_type === "staff" && (
                                    <div>
                                      <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Reports To<RequiredMark /></label>
                                      <select
                                        required
                                        value={form.reportsTo}
                                        onChange={(e) => setForm({ ...form, reportsTo: e.target.value })}
                                        className={inputClass}
                                        style={{ borderColor: form.reportsTo ? "var(--color-line)" : "#f0b4ab" }}
                                      >
                                        <option value="" disabled>— Select —</option>
                                        {(employees ?? [])
                                          .filter((e) => e.id !== emp.id && e.is_active !== false)
                                          .map((e) => (
                                            <option key={e.id} value={e.id}>{e.full_name ?? "Unnamed"}</option>
                                          ))}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3 rounded-xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
                                <FieldGroupTitle>Identity &amp; Statutory</FieldGroupTitle>
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <div>
                                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>UAN Number<RequiredMark /></label>
                                    <input
                                      required
                                      value={form.uanNumber}
                                      onChange={(e) => setForm({ ...form, uanNumber: e.target.value })}
                                      className={inputClass}
                                      style={{ borderColor: form.uanNumber.trim() ? "var(--color-line)" : "#f0b4ab" }}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>ESIC Number<RequiredMark /></label>
                                    <input
                                      required
                                      value={form.esicNumber}
                                      onChange={(e) => setForm({ ...form, esicNumber: e.target.value })}
                                      className={inputClass}
                                      style={{ borderColor: form.esicNumber.trim() ? "var(--color-line)" : "#f0b4ab" }}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Aadhaar Number<RequiredMark /></label>
                                    <input
                                      required
                                      value={form.aadhaarNumber}
                                      onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value })}
                                      className={inputClass}
                                      style={{ borderColor: form.aadhaarNumber.trim() ? "var(--color-line)" : "#f0b4ab" }}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>PAN Number<RequiredMark /></label>
                                    <input
                                      required
                                      value={form.panNumber}
                                      onChange={(e) => setForm({ ...form, panNumber: e.target.value })}
                                      className={inputClass}
                                      style={{ borderColor: form.panNumber.trim() ? "var(--color-line)" : "#f0b4ab" }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 rounded-xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
                                <FieldGroupTitle>Bank Details</FieldGroupTitle>
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <div>
                                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Bank Name</label>
                                    <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                                  </div>
                                  <div>
                                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Account Number</label>
                                    <input value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                                  </div>
                                  <div>
                                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>IFSC Code</label>
                                    <input value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSave(emp.id)}
                                  disabled={saving}
                                  className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
                                  style={{ backgroundColor: "var(--color-action)" }}
                                >
                                  {saving ? "Saving…" : "Save Changes"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="rounded-full border px-5 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
                                  style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
