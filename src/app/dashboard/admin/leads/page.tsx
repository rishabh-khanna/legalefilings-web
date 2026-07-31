"use client";

import { useEffect, useMemo, useState } from "react";
import { LEAD_STAGES, LEAD_STAGE_LABELS, type Lead, type LeadStage } from "@/lib/leads";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { SITE_NAME } from "@/config/site";

function leadWhatsAppMessage(lead: Lead) {
  const firstName = lead.name.split(" ")[0];
  const serviceLine = lead.service ? ` about ${lead.service}` : "";
  return `Hi ${firstName}, this is ${SITE_NAME} following up on your enquiry${serviceLine}. How can we help you get started?`;
}

const STAGE_COLORS: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

export default function AdminDashboard() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [staffNames, setStaffNames] = useState<string[]>(["Unassigned"]);
  const [viewer, setViewer] = useState("Everyone");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leads")
      .then((res) => res.json())
      .then((data) => setLeads(data.leads))
      .catch(() => setError("Could not load leads"));

    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/team-members");
      const data = await res.json();
      const names = ((data.members ?? []) as { full_name: string | null }[]).map((p) => p.full_name).filter((n): n is string => Boolean(n));
      setStaffNames(["Unassigned", ...names]);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const visibleLeads = useMemo(() => {
    if (!leads) return [];
    const sorted = [...leads].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (viewer === "Everyone") return sorted;
    return sorted.filter((l) => l.assignedTo === viewer);
  }, [leads, viewer]);

  async function updateLead(id: string, patch: Partial<Lead>) {
    setLeads((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, ...patch } : l)) : prev));
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    }).catch(() => setError("Failed to save change"));
  }

  async function reload() {
    const res = await fetch("/api/leads");
    const data = await res.json();
    setLeads(data.leads);
  }

  async function claimLead(id: string) {
    setError(null);
    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, claim: true }),
    });
    if (!res.ok) {
      setError("Someone else already claimed this lead — refreshed the list.");
      await reload();
      return;
    }
    const data = await res.json();
    setLeads((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, assignedTo: data.lead.assignedTo } : l)) : prev));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>
            Leads
          </h2>
          <p className="text-sm text-slate-500">
            {leads === null ? "Loading…" : `${visibleLeads.length} lead${visibleLeads.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="viewer" className="text-slate-500">
            Viewing as
          </label>
          <select
            id="viewer"
            value={viewer}
            onChange={(e) => setViewer(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5"
          >
            <option value="Everyone">Everyone</option>
            {staffNames.filter((s) => s !== "Unassigned").map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {viewer !== "Everyone" && (
        <p className="mb-4 text-xs text-slate-500 rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
          Showing only leads assigned to {viewer}.
        </p>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Lead</th>
              <th className="px-4 py-2.5">Service</th>
              <th className="px-4 py-2.5">Plan</th>
              <th className="px-4 py-2.5">Stage</th>
              <th className="px-4 py-2.5">Assigned to</th>
              <th className="px-4 py-2.5">Notes</th>
              <th className="px-4 py-2.5">Received</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleLeads.map((lead) => (
              <tr key={lead.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{lead.name}</div>
                  <div className="text-slate-500">{lead.email}</div>
                  <div className="text-slate-500">{lead.phone}</div>
                  {(lead.city || lead.state) && (
                    <div className="text-slate-400 text-xs">
                      {[lead.city, lead.state].filter(Boolean).join(", ")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{lead.service ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {lead.plan ? (
                    <>
                      {lead.plan}
                      {lead.planPrice && <div className="text-slate-400 text-xs">{lead.planPrice}</div>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={lead.stage}
                    onChange={(e) => updateLead(lead.id, { stage: e.target.value as LeadStage })}
                    className={`rounded-full px-2 py-1 text-xs font-medium ${STAGE_COLORS[lead.stage] ?? "bg-slate-100"}`}
                  >
                    {LEAD_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {LEAD_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {lead.assignedTo === "Unassigned" ? (
                    <button
                      type="button"
                      onClick={() => claimLead(lead.id)}
                      className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                    >
                      Claim
                    </button>
                  ) : (
                    <select
                      value={lead.assignedTo}
                      onChange={(e) => updateLead(lead.id, { assignedTo: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      {staffNames.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 min-w-[180px]">
                  <textarea
                    defaultValue={lead.notes}
                    onBlur={(e) => updateLead(lead.id, { notes: e.target.value })}
                    placeholder="Add a note…"
                    rows={2}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <a
                    href={buildWhatsAppLink(lead.phone, leadWhatsAppMessage(lead))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-200"
                  >
                    WhatsApp
                  </a>
                </td>
              </tr>
            ))}
            {leads !== null && visibleLeads.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No leads {viewer !== "Everyone" ? `assigned to ${viewer}` : "yet"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
