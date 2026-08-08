"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sparkles, Clock, Trophy, AlertCircle, IndianRupee, MessageCircle, Check, X } from "lucide-react";
import { LEAD_STAGES, LEAD_STAGE_LABELS, type Lead, type LeadStage } from "@/lib/leads";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { SITE_NAME } from "@/config/site";
import { useToast } from "@/components/crm/Toaster";
import { AnimatedCounter } from "@/components/crm/AnimatedCounter";
import { TrendBadge } from "@/components/crm/TrendBadge";
import { SkeletonKpiCard, SkeletonRow } from "@/components/crm/Skeleton";
import { LeadDetailDrawer } from "@/components/crm/LeadDetailDrawer";
import { PageHelpButton } from "@/components/dashboard/PageHelpButton";
import { Spinner } from "@/components/Spinner";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useDateRangeFilter } from "@/lib/use-date-range-filter";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExportButton } from "@/components/ExportButton";

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
  // Notes are explicit-save (a ✓/✕ pair appears once the draft differs
  // from what's saved) rather than autosave-on-blur — clicking anywhere
  // else in the row used to silently commit the note with no visible
  // confirmation beyond a toast that's easy to miss in a long table.
  // noteDrafts holds the in-progress (uncommitted) text per lead id;
  // absent from the map means "showing the saved value."
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteStatus, setNoteStatus] = useState<Record<string, "saving" | "saved" | "error">>({});
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
      // Kept as plain names, not disambiguated with org (unlike the
      // payroll/attendance staff pickers) — assignedTo is a plain-text
      // name column on leads, not a profile id, so embedding an org
      // suffix into the option's value here would break matching
      // against the real full_name the API validates against. Leads
      // are already strictly org-scoped, so two different orgs' staff
      // sharing a display name is a cosmetic quirk in this one
      // cross-org (platform_admin-only) picker, not a functional bug.
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

  const dateFilter = useDateRangeFilter(visibleLeads, (l) => l.createdAt);
  const dateFilteredLeads = dateFilter.filtered;

  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [search, setSearch] = useState("");
  const filteredLeads = useMemo(() => {
    return dateFilteredLeads.filter((l) => {
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${l.name} ${l.email} ${l.phone} ${l.service ?? ""} ${l.plan ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dateFilteredLeads, stageFilter, search]);

  // Pagination only makes sense for the flat table view — the board
  // view is a drag-and-drop kanban grouped by stage, where "page 2"
  // has no sensible meaning.
  const { page, setPage, pageSize, setPageSize, pageItems: pagedLeads, totalPages, total, start, end } = usePagination(filteredLeads);

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
      return false;
    }
    toast("success", successText);
    return true;
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
            <div className="flex items-center gap-1.5">
              <h2 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
                Pipeline
              </h2>
              <PageHelpButton />
            </div>
            <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
              {leads === null ? <Spinner size={12} /> : `${filteredLeads.length} lead${filteredLeads.length === 1 ? "" : "s"}`}
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

        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, service…"
            className="w-full max-w-xs rounded-lg border bg-white/70 px-3 py-1.5 text-sm outline-none backdrop-blur focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as LeadStage | "all")}
            className="rounded-lg border bg-white/70 px-2.5 py-1.5 text-sm outline-none backdrop-blur"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
          >
            <option value="all">All stages</option>
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <DateRangeFilter
            from={dateFilter.from}
            to={dateFilter.to}
            onFromChange={dateFilter.setFrom}
            onToChange={dateFilter.setTo}
            onClear={dateFilter.clear}
            active={dateFilter.active}
          />
          {(search.trim() || stageFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStageFilter("all");
              }}
              className="text-xs font-semibold"
              style={{ color: "var(--color-action-dark)" }}
            >
              Clear filters
            </button>
          )}
          <div className="ml-auto">
            <ExportButton
              filename="leads"
              headers={["Lead", "Email", "Phone", "Service", "Plan", "Stage", "Assigned To", "Received"]}
              rows={filteredLeads.map((l) => [l.name, l.email, l.phone, l.service ?? "", l.plan ?? "", LEAD_STAGE_LABELS[l.stage], l.assignedTo, l.createdAt])}
            />
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
            const stageLeads = filteredLeads.filter((l) => l.stage === stage);
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
            itemLabel="leads"
          />
        <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <table className="dt-table w-full min-w-[860px] table-fixed text-sm">
            <thead>
              <tr className="sticky top-0 z-10 text-left text-xs uppercase tracking-wide" style={{ backgroundColor: "var(--color-paper)", color: "var(--color-ink-soft)" }}>
                <th className="w-[4%] px-3 py-2.5">#</th>
                <th className="w-[18%] px-3 py-2.5">Lead</th>
                <th className="w-[14%] px-3 py-2.5">Service / Plan</th>
                <th className="w-[11%] px-3 py-2.5">Stage</th>
                <th className="w-[12%] px-3 py-2.5">Assigned to</th>
                <th className="w-[21%] px-3 py-2.5">Notes</th>
                <th className="w-[8%] px-3 py-2.5">Received</th>
                <th className="w-[12%] px-3 py-2.5"></th>
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
              {pagedLeads.map((lead, i) => {
                const avatar = avatarStyle(lead.name);
                const stageStyle = STAGE_STYLES[lead.stage];
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setActiveLead(lead)}
                    className="cursor-pointer align-top transition-colors hover:bg-[var(--color-paper)]"
                  >
                    <td className="overflow-hidden px-3 py-3" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                    <td className="overflow-hidden px-3 py-3">
                      <div className="flex items-start gap-2">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{ backgroundColor: avatar.bg, color: avatar.text }}
                          aria-hidden="true"
                        >
                          {initials(lead.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium" style={{ color: "var(--color-ink)" }}>{lead.name}</div>
                          <div className="truncate" style={{ color: "var(--color-ink-soft)" }}>{lead.email}</div>
                          <div className="truncate" style={{ color: "var(--color-ink-soft)" }}>{lead.phone}</div>
                          {(lead.city || lead.state) && (
                            <div className="truncate text-xs" style={{ color: "var(--color-ink-soft)", opacity: 0.8 }}>
                              {[lead.city, lead.state].filter(Boolean).join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="overflow-hidden px-3 py-3" style={{ color: "var(--color-ink-soft)" }}>
                      <p className="truncate">{lead.service ?? "—"}</p>
                      {lead.plan && (
                        <p className="truncate text-xs" style={{ opacity: 0.8 }}>
                          {lead.plan}
                          {lead.planPrice && ` · ${lead.planPrice}`}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.stage}
                        onChange={(e) => updateLead(lead.id, { stage: e.target.value as LeadStage }, "Stage updated.")}
                        className="w-full max-w-[110px] truncate rounded-full px-2 py-1 text-xs font-semibold outline-none"
                        style={{ backgroundColor: stageStyle.bg, color: stageStyle.text, border: "none" }}
                      >
                        {LEAD_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {LEAD_STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="overflow-hidden px-3 py-3" onClick={(e) => e.stopPropagation()}>
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
                          className="w-full max-w-full rounded-lg border px-2 py-1 text-xs outline-none"
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
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const draft = noteDrafts[lead.id] ?? lead.notes ?? "";
                        const dirty = draft !== (lead.notes ?? "");
                        const status = noteStatus[lead.id];
                        return (
                          <>
                            <textarea
                              value={draft}
                              onChange={(e) => setNoteDrafts((d) => ({ ...d, [lead.id]: e.target.value }))}
                              placeholder="Add a note…"
                              rows={2}
                              className="w-full rounded-lg border px-2 py-1 text-xs outline-none focus:border-[var(--color-action)]"
                              style={{ borderColor: "var(--color-line)" }}
                            />
                            <div className="mt-1 flex items-center gap-2">
                              {dirty && (
                                <>
                                  <button
                                    type="button"
                                    disabled={status === "saving"}
                                    onClick={async () => {
                                      setNoteStatus((s) => ({ ...s, [lead.id]: "saving" }));
                                      const ok = await updateLead(lead.id, { notes: draft }, "Note saved.");
                                      setNoteStatus((s) => ({ ...s, [lead.id]: ok ? "saved" : "error" }));
                                      if (ok) {
                                        setNoteDrafts((d) => {
                                          const next = { ...d };
                                          delete next[lead.id];
                                          return next;
                                        });
                                      }
                                    }}
                                    aria-label="Save note"
                                    title="Save note"
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-white disabled:opacity-60"
                                    style={{ backgroundColor: "#116a2c" }}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={status === "saving"}
                                    onClick={() =>
                                      setNoteDrafts((d) => {
                                        const next = { ...d };
                                        delete next[lead.id];
                                        return next;
                                      })
                                    }
                                    aria-label="Discard changes"
                                    title="Discard changes"
                                    className="flex h-6 w-6 items-center justify-center rounded-full border disabled:opacity-60"
                                    style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              {status === "saving" && (
                                <span className="text-[10px]" style={{ color: "var(--color-ink-soft)" }}>Saving…</span>
                              )}
                              {!dirty && status === "saved" && (
                                <span className="text-[10px] font-medium" style={{ color: "#116a2c" }}>Saved ✓</span>
                              )}
                              {status === "error" && (
                                <span className="text-[10px] font-medium" style={{ color: "#b42318" }}>Failed to save — try again</span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="overflow-hidden px-3 py-3 whitespace-nowrap" style={{ color: "var(--color-ink-soft)" }}>
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="overflow-hidden px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={buildWhatsAppLink(lead.phone, leadWhatsAppMessage(lead))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold transition-transform hover:scale-[1.02]"
                        style={{ backgroundColor: "#dcfce3", color: "#116a2c" }}
                      >
                        WhatsApp
                      </a>
                    </td>
                  </tr>
                );
              })}
              {leads !== null && filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center" style={{ color: "var(--color-ink-soft)" }}>
                    No leads {viewer !== "Everyone" ? `assigned to ${viewer}` : "yet"}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}

      <LeadDetailDrawer
        lead={activeLead}
        onClose={() => setActiveLead(null)}
        onSaveNotes={(id, notes) => updateLead(id, { notes }, "Note saved.")}
        onConverted={async (id, customerId) => {
          // Closing the drawer here used to hide LeadDetailDrawer's own
          // "Converted to a customer + order" confirmation state before
          // it could ever render — the user only ever saw the toast, and
          // that success card in the drawer was dead code. Patch local
          // state directly (not via updateLead/PATCH — the convert route
          // already wrote stage/convertedToProfileId server-side; a
          // second PATCH here would be redundant and convertedToProfileId
          // isn't even a writable PATCH field) so the drawer stays open
          // and shows the confirmation.
          const patch = { stage: "won" as const, convertedToProfileId: customerId };
          setLeads((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, ...patch } : l)) : prev));
          setActiveLead((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
          toast("success", "Converted — customer account and order created.");
          await reload();
        }}
      />
    </div>
  );
}
