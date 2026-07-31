"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { StateSelect } from "@/components/StateSelect";
import { CitySelect } from "@/components/CitySelect";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/leads";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { SITE_NAME } from "@/config/site";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";

type LeadRow = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string;
  city: string | null;
  state: string | null;
  status: LeadStage;
};

const STATUS_STYLE: Record<LeadStage, { bg: string; fg: string }> = {
  new: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  contacted: { bg: "#fff6d9", fg: "#8a6700" },
  in_progress: { bg: "#fff6d9", fg: "#8a6700" },
  won: { bg: "#d0f4db", fg: "#116a2c" },
  lost: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
};

export default function CrmPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();

  async function reload(supabase: ReturnType<typeof createSupabaseBrowserClient>, name: string) {
    const { data } = await supabase.from("leads").select("*").eq("assigned_to", name).order("created_at", { ascending: false });
    setLeads((data as LeadRow[] | null) ?? []);
  }

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      const name = profile?.full_name ?? user.email ?? "";
      setStaffName(name);
      await reload(supabase, name);
      setLoading(false);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("leads").insert({
      name: String(data.get("name") ?? ""),
      company: String(data.get("company") ?? "") || null,
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? ""),
      city: String(data.get("city") ?? "") || null,
      state: String(data.get("state") ?? "") || null,
      status: "new",
      assigned_to: staffName,
      source: "crm_manual",
    });
    setSubmitting(false);
    if (error) {
      showError("Failed to save lead — please try again.");
      return;
    }
    if (staffName) await reload(supabase, staffName);
    form.reset();
    setSelectedState("");
    setShowForm(false);
    showSuccess("Lead added.");
  }

  if (loading) {
    return (
      <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
        Loading…
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
            My Leads
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
            Leads assigned to you — {leads.length} total.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: "var(--color-ink-fixed)" }}
        >
          {showForm ? "Cancel" : "+ Add Lead"}
        </button>
      </div>

      <div className="mt-4">
        <ActionMessage message={message} />
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
            name="state"
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
          />
          <CitySelect
            key={selectedState}
            name="city"
            state={selectedState}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <button
            type="submit"
            disabled={submitting}
            className="sm:col-span-2 rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {submitting ? "Saving…" : "Save Lead"}
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
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {leads.map((l) => {
              const style = STATUS_STYLE[l.status];
              return (
                <tr key={l.id} className="align-top" style={{ borderColor: "var(--color-line)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{l.name}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{l.company || "—"}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    <div>{l.email}</div>
                    <div>{l.phone}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    {[l.city, l.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
                      {LEAD_STAGE_LABELS[l.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <a
                      href={buildWhatsAppLink(l.phone, `Hi ${l.name.split(" ")[0]}, this is ${SITE_NAME} following up on your enquiry. How can we help you get started?`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: "#d0f4db", color: "#116a2c" }}
                    >
                      WhatsApp
                    </a>
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
                  No leads assigned to you yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
