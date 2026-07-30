"use client";

import { useState } from "react";
import { MOCK_CRM_CONTACTS, type CrmContact } from "@/lib/dashboard-data";
import { StateSelect } from "@/components/StateSelect";
import { CitySelect } from "@/components/CitySelect";

const STATUS_STYLE: Record<CrmContact["status"], { bg: string; fg: string }> = {
  Lead: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  Active: { bg: "#d0f4db", fg: "#116a2c" },
  "Past Client": { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
};

export default function CrmPage() {
  const [contacts, setContacts] = useState<CrmContact[]>(MOCK_CRM_CONTACTS);
  const [showForm, setShowForm] = useState(false);
  const [selectedState, setSelectedState] = useState("");

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const contact: CrmContact = {
      id: `c${Date.now()}`,
      name: String(data.get("name") ?? ""),
      company: String(data.get("company") ?? ""),
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? ""),
      city: String(data.get("city") ?? ""),
      state: String(data.get("state") ?? ""),
      status: "Lead",
    };
    setContacts((prev) => [contact, ...prev]);
    form.reset();
    setSelectedState("");
    setShowForm(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
            CRM
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
            Your own customer contacts — {contacts.length} total.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: "var(--color-ink-fixed)" }}
        >
          {showForm ? "Cancel" : "+ Add Contact"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="mt-5 grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 dark:bg-[var(--color-paper-raised)]"
          style={{ borderColor: "var(--color-line)" }}
        >
          <input name="name" required placeholder="Name" className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]" style={{ borderColor: "var(--color-line)" }} />
          <input name="company" placeholder="Company" className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]" style={{ borderColor: "var(--color-line)" }} />
          <input name="email" type="email" required placeholder="Email" className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]" style={{ borderColor: "var(--color-line)" }} />
          <input name="phone" placeholder="Phone" className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]" style={{ borderColor: "var(--color-line)" }} />
          <StateSelect
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
          />
          <CitySelect
            key={selectedState}
            state={selectedState}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded-full py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            Save Contact
          </button>
        </form>
      )}

      <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Name</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Company</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Contact</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Location</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {contacts.map((c) => {
              const style = STATUS_STYLE[c.status];
              return (
                <tr key={c.id} className="align-top" style={{ borderColor: "var(--color-line)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{c.name}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{c.company || "—"}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    <div>{c.email}</div>
                    <div>{c.phone}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
