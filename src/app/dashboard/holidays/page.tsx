"use client";

import { useEffect, useMemo, useState } from "react";
import { PartyPopper, Landmark, Building2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";

type Holiday = { id: string; name: string; date: string; type: "national" | "festival" | "company" };

const TYPE_STYLE: Record<Holiday["type"], { bg: string; fg: string }> = {
  national: { bg: "#fde2e2", fg: "#b42318" },
  festival: { bg: "#fff6d9", fg: "#8a6700" },
  company: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
};

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<Holiday["type"]>("company");
  const [submitting, setSubmitting] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();

  async function load() {
    const res = await fetch("/api/holidays");
    if (res.ok) setHolidays((await res.json()).holidays ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
        setIsAdmin(profile?.account_type === "admin");
      }
      await load();
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, date, type }),
    });
    setSubmitting(false);
    if (res.ok) {
      setName("");
      setDate("");
      setShowForm(false);
      await load();
      showSuccess("Holiday added.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to add holiday.");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      showSuccess("Holiday removed.");
    } else {
      showError("Failed to remove holiday.");
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  const holidayStats = useMemo(() => {
    const national = holidays.filter((h) => h.type === "national").length;
    const festival = holidays.filter((h) => h.type === "festival").length;
    const company = holidays.filter((h) => h.type === "company").length;
    return { national, festival, company };
  }, [holidays]);

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>Loading…</p>;
  }

  return (
    <div>
      <DashboardPageHero title="Holiday Calendar" subtitle="National, festival, and company holidays for the year.">
        <div className="relative mt-6 grid grid-cols-3 gap-4">
          <HeroKpi icon={Landmark} label="National" value={holidayStats.national} />
          <HeroKpi icon={PartyPopper} label="Festival" value={holidayStats.festival} />
          <HeroKpi icon={Building2} label="Company" value={holidayStats.company} />
        </div>
      </DashboardPageHero>

      {isAdmin && (
        <div className="flex flex-wrap items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {showForm ? "Cancel" : "+ Add Holiday"}
          </button>
        </div>
      )}

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {showForm && isAdmin && (
        <form onSubmit={handleAdd} className="mt-3 grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-3 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <input required placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <select value={type} onChange={(e) => setType(e.target.value as Holiday["type"])} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
            <option value="company">Company Holiday</option>
            <option value="national">National Holiday</option>
            <option value="festival">Festival Holiday</option>
          </select>
          <button type="submit" disabled={submitting} className="sm:col-span-3 rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
            {submitting ? "Saving…" : "Add Holiday"}
          </button>
        </form>
      )}

      <div className="mt-5 space-y-2">
        {holidays.map((h) => {
          const style = TYPE_STYLE[h.type];
          return (
            <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
              <div>
                <p className="font-medium" style={{ color: "var(--color-ink)" }}>{h.name}</p>
                <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                  {new Date(h.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>{h.type}</span>
                {isAdmin && (
                  <button type="button" onClick={() => handleDelete(h.id)} className="text-xs font-semibold" style={{ color: "#b42318" }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {holidays.length === 0 && <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No holidays added yet.</p>}
      </div>
    </div>
  );
}
