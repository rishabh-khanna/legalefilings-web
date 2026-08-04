"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sparkles, Clock, Trophy, AlertCircle, IndianRupee, MessageCircle } from "lucide-react";
import { LEAD_STAGES, LEAD_STAGE_LABELS, type Lead, type LeadStage } from "@/lib/leads";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { SITE_NAME } from "@/config/site";
import { useToast } from "@/components/crm/Toaster";
import { AnimatedCounter } from "@/components/crm/AnimatedCounter";
import { TrendBadge } from "@/components/crm/TrendBadge";
import { SkeletonKpiCard, SkeletonRow } from "@/components/crm/Skeleton";
import { LeadDetailDrawer } from "@/components/crm/LeadDetailDrawer";

function leadWhatsAppMessage(lead: Lead) {
  const firstName = lead.name.split(" ")[0];
  const serviceLine = lead.service ? ` about ${lead.service}` : "";
  return `Hi ${firstName}, this is ${SITE_NAME} following up on your enquiry${serviceLine}. How can we help you get started?`;
}

// A lead sitting in New/Contacted for more than 3 days without moving —
// a real, derived signal (from createdAt), not a fabricated AI score.
function needsAttention(lead: Lead, now: number) {
  if (lead.stage !== "new" && lead.stage !== "contacted") return false;
  const ageDays = (now - new Date(lead.createdAt).getTime()) / 86_400_000;
  return ageDays > 3;
}

const STAGE_STYLES: Record<LeadStage, { bg: string; text: string; grad: string }> = {
  new: { bg: "var(--color-muted-tint)", text: "var(--color-muted-dark)", grad: "linear-gradient(135deg,#fbf3e3,#f6f8fb)" },
  contacted: { bg: "#dbe7ff", text: "#1d4fb8", grad: "linear-gradient(135deg,#dbe7ff,#f6f8fb)" },
  in_progress: { bg: "var(--color-accent-tint)", text: "var(--color-action-dark)", grad: "linear-gradient(135deg,#fff8e6,#f6f8fb)" },
  won: { bg: "#d0f4db", text: "#116a2c", grad: "linear-gradient(135deg,#d0f4db,#f6f8fb)" },
  lost: { bg: "#fde2e2", text: "#b42318", grad: "linear-gradient(135deg,#fde2e2,#f6f8fb)" },
};

const AVATAR_PALETTE = [
  { bg: "#fff1cc", text: "#8a6700" },
  { bg: "#dbe7ff", text: "#1d4fb8" },
  { bg: "#dcfce3", text: "#116a2c" },
  { bg: "#fde2e2", text: "#b42318" },
  { bg: "#ede9fe", text: "#5b21b6" },
  { bg: "#fce7f3", text: "#9d174d" },
];

function avatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function AdminDashboard() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [staffNames, setStaffNames] = useState<string[]>(["Unassigned"]);
  const [viewer, setViewer] = useState("Everyone");
  const [view, setView] = useState<"table" | "board">("board");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    fetch("/api/leads")
      .then((res) => res.json())
      .then((data) => setLeads(data.leads))
      .catch(() => toast("error", "Could not load leads."));

    const kickoff = setTimeout(async () => {
      setNow(Date.now());
      const res = await fetch("/api/team-members");
      const data = await res.json();
      const names = ((data.members ?? []) as { full_name: string | null }[]).map((p) => p.full_name).filter((n): n is string => Boolean(n));
      setStaffNames(["Unassigned", ...names]);
    }, 0);
    return () => clearTimeout(kickoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleLeads = useMemo(() => {
    if (!leads) return [];
    const sorted = [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (viewer === "Everyone") return sorted;
    return sorted.filter((l) => l.assignedTo === viewer);
  }, [leads, viewer]);

  const stats = useMemo(() => {
    const all = leads ?? [];
    const newCount = all.filter((l) => l.stage === "new").length;
    const inProgress = all.filter((l) => l.stage === "contacted" || l.stage === "in_progress").length;
    const won = all.filter((l) => l.stage === "won").length;
    const closed = all.filter((l) => l.stage === "won" || l.stage === "lost").length;
    const conversion = closed > 0 ? Math.round((won / closed) * 100) : 0;

    const weekMs = 7 * 86_400_000;
    const nowMs = now ?? 0;
    const thisWeek = now === null ? 0 : all.filter((l) => nowMs - new Date(l.createdAt).getTime() <= weekMs).length;
    const lastWeek =
      now === null
        ? 0
        : all.filter((l) => {
            const age = nowMs - new Date(l.createdAt).getTime();
            return age > weekMs && age <= weekMs * 2;
          }).length;
    const weekTrend = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : thisWeek > 0 ? 100 : 0;

    return { total: all.length, newCount, inProgress, won, conversion, weekTrend };
  }, [leads, now]);

  async function updateLead(id: string, patch: Partial<Lead>, successText = "Saved.") {
    setLeads((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, ...patch } : l)) : prev));
    setActiveLead((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    }).catch(() => null);
    if (!res || !res.ok) {
      toast("error", "Failed to save change.");
      return;
    }
    toast("success", successText);
  }

  async function reload() {
    const res = await fetch("/api/leads");
    const data = await res.json();
    setLeads(data.leads);
  }

  async function claimLead(id: string) {
    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, claim: true }),
    });
    if (!res.ok) {
      toast("error", "Someone else already claimed this lead — refreshed the list.");
      await reload();
      return;
    }
    const data = await res.json();
    setLeads((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, assignedTo: data.lead.assignedTo } : l)) : prev));
    toast("success", "Lead claimed.");
  }

  const kpis = [
    { label: "Total Leads", value: stats.total, icon: Users, tone: "var(--color-action-dark)", trend: now === null ? undefined : stats.weekTrend },
    { label: "New", value: stats.newCount, icon: Sparkles, tone: "#1d4fb8" },
    { label: "In Progress", value: stats.inProgress, icon: Clock, tone: "var(--color-action-dark)" },
    { label: "Won · Conversion", value: stats.won, suffix: ` · ${stats.conversion}%`, icon: Trophy, tone: "#116a2c" },
  ];

  return (
    <div>
      {/* A warm gold-tinted gradient hero instead of a plain white header —
          this is the visual signal that makes a dashboard read as "premium
          SaaS" (Linear/Attio/Stripe all do this); glass cards on a flat
          white page just look like white cards, there's nothing behind
          them to blur. The KPI tiles float on top of this as real
          frosted-glass panels. */}
      <div
        className="relative mb-6 overflow-hidden rounded-[28px] border p-6"
        style={{
          background: "linear-gradient(135deg, #fffaf0 0%, #fef2d4 55%, #fce4ad 100%)",
          borderColor: "var(--color-accent-tint)",
        }}
      >
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
          style={{ backgroundColor: "var(--color-accent)", opacity: 0.25 }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-20 left-1/4 h-48 w-48 rounded-full blur-3xl"
          style={{ backgroundColor: "var(--color-action)", opacity: 0.12 }}
        />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
              Pipeline
            </h2>
            <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
              {leads === null ? "Loading…" : `${visibleLeads.length} lead${visibleLeads.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1 rounded-full border bg-white/70 p-1 backdrop-blur" style={{ borderColor: "var(--color-line)" }}>
              {(["board", "table"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
                  style={view === v ? { backgroundColor: "var(--color-accent)", color: "var(--color-ink)" } : { color: "var(--color-ink-soft)" }}
                >
                  {v}
                </button>
              ))}
            </div>
            <label htmlFor="viewer" style={{ color: "var(--color-ink-soft)" }}>
              Viewing as
            </label>
            <select
              id="viewer"
              value={viewer}
              onChange={(e) => setViewer(e.target.value)}
              className="rounded-lg border bg-white/70 px-2.5 py-1.5 text-sm outline-none backdrop-blur"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
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

        <div className="relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {leads === null
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonKpiCard key={i} />)
            : kpis.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
                  whileHover={{ y: -3 }}
                  className="rounded-2xl border bg-white/70 p-4 backdrop-blur-xl"
                  style={{ borderColor: "var(--color-line)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: "var(--color-accent)", color: "var(--color-ink)" }}>
                      <s.icon className="h-4 w-4" />
                    </span>
                    {s.trend !== undefined && <TrendBadge changePct={s.trend} />}
                  </div>
                  <p className="mt-3 text-2xl font-extrabold" style={{ color: "var(--color-ink)" }}>
                    <AnimatedCounter value={s.value} />
                    {s.suffix}
                  </p>
                  <p className="text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>{s.label}</p>
                </motion.div>
              ))}
        </div>
      </div>

      {viewer !== "Everyone" && (
        <p className="mb-4 text-xs rounded-lg px-3 py-2" style={{ color: "var(--color-ink-soft)", backgroundColor: "var(--color-paper)", border: "1px solid var(--color-line)" }}>
          Showing only leads assigned to {viewer}.
        </p>
      )}

      {view === "board" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {LEAD_STAGES.map((stage) => {
            const stageStyle = STAGE_STYLES[stage];
            const stageLeads = visibleLeads.filter((l) => l.stage === stage);
            const isDragOver = dragOverStage === stage;
            return (
              <div
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStage(stage);
                }}
                onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStage(null);
                  const id = e.dataTransfer.getData("text/lead-id");
                  if (id) updateLead(id, { stage }, "Stage updated.");
                  setDraggingId(null);
                }}
                className="min-w-0 rounded-2xl p-3 transition-colors"
                style={{ background: isDragOver ? stageStyle.bg : stageStyle.grad, border: `1px solid ${isDragOver ? stageStyle.text : "var(--color-line)"}` }}
              >
                <div className="flex items-center justify-between px-1 pb-3">
                  <span className="flex items-center gap-2 text-sm font-bold" style={{ color: stageStyle.text }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageStyle.text }} />
                    {LEAD_STAGE_LABELS[stage]}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: stageStyle.bg, color: stageStyle.text }}>
                    {stageLeads.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <AnimatePresence initial={false}>
                    {stageLeads.map((lead) => {
                      const avatar = avatarStyle(lead.name);
                      const attention = now !== null && needsAttention(lead, now);
                      return (
                        <motion.div
                          key={lead.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          whileHover={{ y: -2 }}
                          transition={{ duration: 0.18 }}
                          draggable
                          onDragStart={(e) => {
                            (e as unknown as React.DragEvent).dataTransfer.setData("text/lead-id", lead.id);
                            setDraggingId(lead.id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          onClick={() => setActiveLead(lead)}
                          className="cursor-grab space-y-2 rounded-xl border bg-white p-3 shadow-sm transition-shadow hover:shadow-lg active:cursor-grabbing dark:bg-[var(--color-paper-raised)]"
                          style={{ borderColor: "var(--color-line)", opacity: draggingId === lead.id ? 0.4 : 1 }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                                style={{ backgroundColor: avatar.bg, color: avatar.text }}
                                aria-hidden="true"
                              >
                                {initials(lead.name)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                                  {lead.name}
                                </p>
                                <p className="truncate text-xs" style={{ color: "var(--color-ink-soft)" }}>
                                  {lead.service ?? "—"}
                                </p>
                              </div>
                            </div>
                            {attention && (
                              <span title="No movement in 3+ days" className="shrink-0">
                                <AlertCircle className="h-3.5 w-3.5" style={{ color: "#dc2626" }} />
                              </span>
                            )}
                          </div>

                          {lead.planPrice && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                              style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }}
                            >
                              <IndianRupee className="h-3 w-3" />
                              {lead.planPrice}
                            </span>
                          )}

                          {lead.notes && (
                            <p className="line-clamp-2 rounded-lg px-2 py-1 text-xs" style={{ backgroundColor: "var(--color-paper)", color: "var(--color-ink-soft)" }}>
                              {lead.notes}
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-2">
                            {lead.assignedTo === "Unassigned" ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  claimLead(lead.id);
                                }}
                                className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition-transform hover:scale-[1.05]"
                                style={{ backgroundColor: "var(--color-action)" }}
                              >
                                Claim
                              </button>
                            ) : (
                              <span className="truncate text-[11px] font-medium" style={{ color: "var(--color-ink-soft)" }}>
                                {lead.assignedTo}
                              </span>
                            )}
                            <a
                              href={buildWhatsAppLink(lead.phone, leadWhatsAppMessage(lead))}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`WhatsApp ${lead.name}`}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110"
                              style={{ backgroundColor: "#dcfce3", color: "#116a2c" }}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {stageLeads.length === 0 && (
                    <p className="rounded-xl border border-dashed px-3 py-6 text-center text-xs" style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}>
                      Drop a lead here
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 text-left text-xs uppercase tracking-wide" style={{ backgroundColor: "var(--color-paper)", color: "var(--color-ink-soft)" }}>
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
            <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
              {leads === null &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8}>
                      <SkeletonRow />
                    </td>
                  </tr>
                ))}
              {visibleLeads.map((lead) => {
                const avatar = avatarStyle(lead.name);
                const stageStyle = STAGE_STYLES[lead.stage];
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setActiveLead(lead)}
                    className="cursor-pointer align-top transition-colors hover:bg-[var(--color-paper)]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{ backgroundColor: avatar.bg, color: avatar.text }}
                          aria-hidden="true"
                        >
                          {initials(lead.name)}
                        </span>
                        <div>
                          <div className="font-medium" style={{ color: "var(--color-ink)" }}>{lead.name}</div>
                          <div style={{ color: "var(--color-ink-soft)" }}>{lead.email}</div>
                          <div style={{ color: "var(--color-ink-soft)" }}>{lead.phone}</div>
                          {(lead.city || lead.state) && (
                            <div className="text-xs" style={{ color: "var(--color-ink-soft)", opacity: 0.8 }}>
                              {[lead.city, lead.state].filter(Boolean).join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{lead.service ?? "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                      {lead.plan ? (
                        <>
                          {lead.plan}
                          {lead.planPrice && <div className="text-xs" style={{ opacity: 0.8 }}>{lead.planPrice}</div>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.stage}
                        onChange={(e) => updateLead(lead.id, { stage: e.target.value as LeadStage }, "Stage updated.")}
                        className="rounded-full px-2.5 py-1 text-xs font-semibold outline-none"
                        style={{ backgroundColor: stageStyle.bg, color: stageStyle.text, border: "none" }}
                      >
                        {LEAD_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {LEAD_STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {lead.assignedTo === "Unassigned" ? (
                        <button
                          type="button"
                          onClick={() => claimLead(lead.id)}
                          className="rounded-full px-3 py-1 text-xs font-semibold text-white transition-transform hover:scale-[1.02]"
                          style={{ backgroundColor: "var(--color-action)" }}
                        >
                          Claim
                        </button>
                      ) : (
                        <select
                          value={lead.assignedTo}
                          onChange={(e) => updateLead(lead.id, { assignedTo: e.target.value }, "Reassigned.")}
                          className="rounded-lg border px-2 py-1 text-xs outline-none"
                          style={{ borderColor: "var(--color-line)" }}
                        >
                          {staffNames.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        defaultValue={lead.notes}
                        onBlur={(e) => updateLead(lead.id, { notes: e.target.value }, "Note saved.")}
                        placeholder="Add a note…"
                        rows={2}
                        className="w-full rounded-lg border px-2 py-1 text-xs outline-none focus:border-[var(--color-action)]"
                        style={{ borderColor: "var(--color-line)" }}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--color-ink-soft)" }}>
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={buildWhatsAppLink(lead.phone, leadWhatsAppMessage(lead))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-transform hover:scale-[1.02]"
                        style={{ backgroundColor: "#dcfce3", color: "#116a2c" }}
                      >
                        WhatsApp
                      </a>
                    </td>
                  </tr>
                );
              })}
              {leads !== null && visibleLeads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center" style={{ color: "var(--color-ink-soft)" }}>
                    No leads {viewer !== "Everyone" ? `assigned to ${viewer}` : "yet"}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <LeadDetailDrawer
        lead={activeLead}
        onClose={() => setActiveLead(null)}
        onSaveNotes={(id, notes) => updateLead(id, { notes }, "Note saved.")}
      />
    </div>
  );
}
