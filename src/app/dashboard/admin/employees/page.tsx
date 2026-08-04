"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { STAFF_LEVEL_LABELS, roleLabel, type Profile, type StaffLevel } from "@/lib/roles";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";

type EditForm = {
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
};

const EMPTY_FORM: EditForm = {
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
};

// Admin-only employee master editor (Module 2: Edit Employee). Fields here
// — department, designation, UAN, ESIC in particular — are org-assigned,
// not self-declared, so they're deliberately absent from the employee's
// own /dashboard/profile edit form and only settable here.
export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Profile[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { message, showSuccess, showError } = useActionMessage();

  async function load() {
    const res = await fetch("/api/admin/employees");
    const data = await res.json();
    if (res.ok) setEmployees(data.employees);
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  function startEdit(emp: Profile) {
    setEditingId(emp.id);
    setForm({
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
    });
  }

  async function handleSave(id: string) {
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

  async function handleDelete(emp: Profile) {
    if (!confirm(`Delete ${emp.full_name ?? "this employee"}'s account? This can't be undone.`)) return;
    setDeletingId(emp.id);
    const res = await fetch(`/api/admin/employees/${emp.id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) {
      showSuccess("Employee deleted.");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      showError(data.error ?? "Failed to delete employee.");
    }
  }

  const inputClass = "w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-xs font-medium mb-1";

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

      {employees === null ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>Loading…</p>
      ) : employees.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--color-ink-soft)" }}>No employees yet.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {employees.map((emp) => {
            const isEditing = editingId === emp.id;
            return (
              <div key={emp.id} className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{emp.full_name ?? "Unnamed"}</p>
                    <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                      {emp.employee_id ?? "No ID"} · {roleLabel(emp)}
                      {emp.department && ` · ${emp.department}`}
                      {emp.designation && ` · ${emp.designation}`}
                    </p>
                  </div>
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
                      {emp.account_type !== "admin" && (
                        <button
                          type="button"
                          onClick={() => handleDelete(emp)}
                          disabled={deletingId === emp.id}
                          className="rounded-full border px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                          style={{ borderColor: "var(--color-line)" }}
                        >
                          {deletingId === emp.id ? "Deleting…" : "Delete"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--color-line)" }}>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Department</label>
                        <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                      </div>
                      <div>
                        <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Designation</label>
                        <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                      </div>
                      <div>
                        <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Date of Joining</label>
                        <input type="date" value={form.dateOfJoining} onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                      </div>
                      {emp.account_type === "staff" && (
                        <div>
                          <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Staff Level</label>
                          <select value={form.staffLevel} onChange={(e) => setForm({ ...form, staffLevel: e.target.value as StaffLevel })} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                            {Object.entries(STAFF_LEVEL_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>UAN Number</label>
                        <input value={form.uanNumber} onChange={(e) => setForm({ ...form, uanNumber: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                      </div>
                      <div>
                        <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>ESIC Number</label>
                        <input value={form.esicNumber} onChange={(e) => setForm({ ...form, esicNumber: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                      </div>
                      <div>
                        <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Aadhaar Number</label>
                        <input value={form.aadhaarNumber} onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                      </div>
                      <div>
                        <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>PAN Number</label>
                        <input value={form.panNumber} onChange={(e) => setForm({ ...form, panNumber: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                      </div>
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
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSave(emp.id)}
                        disabled={saving}
                        className="rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: "var(--color-action)" }}
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-full border px-5 py-2 text-sm font-semibold"
                        style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
