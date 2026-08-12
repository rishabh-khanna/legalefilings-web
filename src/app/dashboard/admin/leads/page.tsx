"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useDateRangeFilter } from "@/lib/use-date-range-filter";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExportButton } from "@/components/ExportButton";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";

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

// Each column keeps its own tinted wash. A pass that flattened all five
// to the same grey made the board read as dead — on a kanban the column
// IS the state, so colour-coding it is information, not decoration, and
// it's what lets you find "Won" without reading a word. The gradients
// previously ended on the old cool canvas (#f6f8fb), which would now
// fight the warm page; they fade to the new canvas instead so each
// column settles into the page rather than sitting on it as a slab.
const STAGE_STYLES: Record<LeadStage, { bg: string; text: string; grad: string }> = {
  new: { bg: "var(--color-muted-tint)", text: "var(--color-muted-dark)", grad: "linear-gradient(160deg, var(--color-muted-tint), var(--color-paper))" },
  contacted: { bg: "var(--color-info-tint)", text: "var(--color-info)", grad: "linear-gradient(160deg, var(--color-info-tint), var(--color-paper))" },
  in_progress: { bg: "var(--color-accent-tint)", text: "var(--color-action-dark)", grad: "linear-gradient(160deg, var(--color-accent-tint), var(--color-paper))" },
  won: { bg: "var(--color-success-tint)", text: "var(--color-success)", grad: "linear-gradient(160deg, var(--color-success-tint), var(--color-paper))" },
  lost: { bg: "var(--color-danger-tint)", text: "var(--color-danger)", grad: "linear-gradient(160deg, var(--color-danger-tint), var(--color-paper))" },
};

const AVATAR_PALETTE = [
  { bg: "var(--color-accent-tint)", text: "var(--color-action-dark)" },
  { bg: "var(--color-info-tint)", text: "var(--color-info)" },
  { bg: "var(--color-success-tint)", text: "var(--color-success)" },
  { bg: "var(--color-danger-tint)", text: "var(--color-danger)" },
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
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  // Empty means "Everyone" — same meaning the single-select's "Everyone"
  // option used to carry, just represented as "nothing picked" instead of
  // a sentinel string, so it composes with MultiSelect's own convention.
  const [viewerFilter, setViewerFilter] = useState<Set<string>>(new Set());
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
  // A finished drag can still surface as a click on the card it started
  // from, which would open the detail drawer right after someone moved a
  // lead. Timestamped on dragend so the click that follows can be ignored.
  const dragEndedAt = useRef(0);
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
      // Options carry the profile id as their value — assignment is by
      // id now (leads.assigned_to is a profiles FK), so a display name
      // is only ever a label. That also makes the org suffix safe to
      // show for a platform_admin seeing several orgs' staff at once,
      // which the old name-matching version couldn't risk.
      const members = (data.members ?? []) as { id: string; full_name: string | null; organizationName?: string | null }[];
      const orgCount = new Set(members.map((m) => m.organizationName)).size;
      setStaffOptions(
        members.map((m) => ({
          id: m.id,
          name: orgCount > 1 && m.organizationName ? `${m.full_name ?? "Unnamed"} — ${m.organizationName}` : (m.full_name ?? "Unnamed"),
        }))
      );
    }, 0);
    return () => clearTimeout(kickoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleLeads = useMemo(() => {
    if (!leads) return [];
    const sorted = [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (viewerFilter.size === 0) return sorted;
    return sorted.filter((l) => (l.assignedToId ? viewerFilter.has(l.assignedToId) : viewerFilter.has("__unassigned__")));
  }, [leads, viewerFilter]);

  const viewerFilterLabel = useMemo(() => {
    return [...viewerFilter]
      .map((id) => (id === "__unassigned__" ? "Unassigned (shared pool)" : staffOptions.find((s) => s.id === id)?.name ?? "this person"))
      .join(", ");
  }, [viewerFilter, staffOptions]);

  const dateFilter = useDateRangeFilter(visibleLeads, (l) => l.createdAt);
  const dateFilteredLeads = dateFilter.filtered;

  // Stage is a status filter, so it gets the same "pick, then Search"
  // treatment as the date range rather than filtering the instant a
  // stage is checked — draftStageFilter is what the MultiSelect is
  // bound to, stageFilter is what actually filters, and the two only
  // sync up when Search runs (shared with the date range's own Search,
  // via combinedSearch below, so one click applies both).
  const [draftStageFilter, setDraftStageFilter] = useState<Set<string>>(new Set());
  const [stageFilter, setStageFilter] = useState<Set<string>>(new Set());
  // Text search applies on the same shared Search click too now, not
  // live per keystroke — draftSearch is what the box is bound to,
  // search is what actually filters.
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const filteredLeads = useMemo(() => {
    return dateFilteredLeads.filter((l) => {
      if (stageFilter.size > 0 && !stageFilter.has(l.stage)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${l.name} ${l.email} ${l.phone} ${l.service ?? ""} ${l.plan ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dateFilteredLeads, stageFilter, search]);

  const stageFilterDirty = draftStageFilter.size !== stageFilter.size || [...draftStageFilter].some((v) => !stageFilter.has(v));
  const searchDirty = draftSearch !== search;
  function combinedSearch() {
    dateFilter.search();
    setStageFilter(draftStageFilter);
    setSearch(draftSearch);
  }

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

  // assignedToId is the wire field — a profile id, or null to send the
  // lead back to the shared pool. assignedTo on Lead is only ever the
  // resolved display name, which the server owns, so the optimistic
  // merge below fills it in locally and the server's response is what
  // ultimately settles it on the next load.
  type LeadPatch = Partial<Omit<Lead, "assignedToId">> & { assignedToId?: string | null };

  async function updateLead(id: string, patch: LeadPatch, successText = "Saved.") {
    // Fold assignedTo/assignedToId in only when the caller actually sent
    // one. This used to spread `assignedToId: patch.assignedToId ?? undefined`
    // unconditionally, and an object spread copies undefined values — so a
    // plain `{ stage }` patch wrote undefined over the lead's real
    // assignee. Every stage change silently un-owned the lead on screen:
    // the card swapped the assignee's name back to a "Claim" button, and
    // clicking it 409'd because the server still had it assigned.
    const { assignedToId, ...rest } = patch;
    const optimistic: Partial<Lead> = { ...rest };
    if ("assignedToId" in patch) {
      optimistic.assignedToId = assignedToId ?? undefined;
      optimistic.assignedTo = assignedToId
        ? (staffOptions.find((s) => s.id === assignedToId)?.name ?? "Unassigned")
        : "Unassigned";
    }

    const previous = leads?.find((l) => l.id === id) ?? null;
    setLeads((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, ...optimistic } : l)) : prev));
    setActiveLead((prev) => (prev && prev.id === id ? { ...prev, ...optimistic } : prev));

    const res = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    }).catch(() => null);

    if (!res || !res.ok) {
      // Undo the optimistic write. Without this the card stayed in
      // whichever column it was dropped into even though the server had
      // refused the change — the board showed a stage the database never
      // had, and only a reload revealed it. Only the fields this call
      // touched are rolled back, so a note saved a moment earlier from
      // the drawer isn't reverted along with the failed stage move.
      if (previous) {
        const revert: Partial<Lead> = {};
        for (const key of Object.keys(optimistic) as (keyof Lead)[]) {
          (revert as Record<string, unknown>)[key] = previous[key];
        }
        setLeads((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, ...revert } : l)) : prev));
        setActiveLead((prev) => (prev && prev.id === id ? { ...prev, ...revert } : prev));
      }
      toast("error", "Couldn't save that — put it back.");
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
    // Both fields — the card's "show Claim button" check reads
    // assignedToId, not the display-name assignedTo, so patching only
    // the name left the button showing even after a successful claim.
    setLeads((prev) =>
      prev ? prev.map((l) => (l.id === id ? { ...l, assignedTo: data.lead.assignedTo, assignedToId: data.lead.assignedToId } : l)) : prev
    );
    toast("success", "Lead claimed.");
  }

  const kpis = [
    { label: "Total Leads", value: stats.total, icon: Users, tone: "var(--color-action-dark)", trend: now === null ? undefined : stats.weekTrend },
    { label: "New", value: stats.newCount, icon: Sparkles, tone: "var(--color-info)" },
    { label: "In Progress", value: stats.inProgress, icon: Clock, tone: "var(--color-action-dark)" },
    { label: "Won · Conversion", value: stats.won, suffix: ` · ${stats.conversion}%`, icon: Trophy, tone: "var(--color-success)" },
  ];

  const leadColumns: DataTableColumn<Lead>[] = [
    {
      key: "lead",
      header: "Lead",
      className: "w-[18%]",
      render: (lead) => {
        const avatar = avatarStyle(lead.name);
        return (
          <div className="flex items-start gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: avatar.bg, color: avatar.text }} aria-hidden="true">
              {initials(lead.name)}
            </span>
            {/* break-words, not truncate — this table was missing
                fixedLayout (see below), so table-layout:auto let this
                column balloon to fit the longest unwrapped email on the
                page and starve Stage/Assigned/Notes down to a couple of
                clipped characters each. Now that the column has a real
                bounded width, wrapping the name/email/phone onto extra
                lines keeps the full value visible instead of cutting it
                with an ellipsis. */}
            <div className="min-w-0">
              <div className="break-words font-medium" style={{ color: "var(--color-ink)" }}>{lead.name}</div>
              <div className="break-words" style={{ color: "var(--color-ink-soft)" }}>{lead.email}</div>
              <div className="break-words" style={{ color: "var(--color-ink-soft)" }}>{lead.phone}</div>
              {(lead.city || lead.state) && (
                <div className="break-words text-xs" style={{ color: "var(--color-ink-soft)", opacity: 0.8 }}>
                  {[lead.city, lead.state].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
          </div>
        );
      },
      exportValue: (lead) => lead.name,
      sortValue: (lead) => lead.name,
    },
    {
      key: "service",
      header: "Service / Plan",
      className: "w-[13%]",
      render: (lead) => (
        <>
          <p className="break-words" style={{ color: "var(--color-ink-soft)" }}>{lead.service ?? "—"}</p>
          {lead.plan && (
            <p className="break-words text-xs" style={{ color: "var(--color-ink-soft)", opacity: 0.8 }}>
              {lead.plan}
              {lead.planPrice && ` · ${lead.planPrice}`}
            </p>
          )}
        </>
      ),
      exportValue: (lead) => lead.service ?? lead.plan ?? "",
      sortValue: (lead) => lead.service ?? lead.plan,
    },
    {
      key: "stage",
      header: "Stage",
      className: "w-[13%]",
      render: (lead) => {
        const stageStyle = STAGE_STYLES[lead.stage];
        return (
          // max-w-[110px] + truncate used to clip "In Progress" down to
          // "N.." — a native <select>'s own displayed value can't wrap
          // via CSS at all (it's rendered by the OS, not the page), so
          // the only real fix for a select is giving its column enough
          // width to show the label whole. w-full now fills whatever
          // width the fixed-layout column actually has.
          <select
            value={lead.stage}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateLead(lead.id, { stage: e.target.value as LeadStage }, "Stage updated.")}
            className="w-full rounded-full px-2 py-1 text-xs font-semibold outline-none"
            style={{ backgroundColor: stageStyle.bg, color: stageStyle.text, border: "none" }}
          >
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        );
      },
      exportValue: (lead) => LEAD_STAGE_LABELS[lead.stage],
      sortValue: (lead) => LEAD_STAGE_LABELS[lead.stage],
    },
    {
      key: "assignedTo",
      header: "Assigned to",
      className: "w-[13%]",
      render: (lead) =>
        !lead.assignedToId ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              claimLead(lead.id);
            }}
            className="rounded-full px-3 py-1 text-xs font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            Claim
          </button>
        ) : (
          <select
            value={lead.assignedToId}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateLead(lead.id, { assignedToId: e.target.value || null }, "Reassigned.")}
            className="w-full max-w-full rounded-lg border px-2 py-1 text-xs outline-none"
            style={{ borderColor: "var(--color-line)" }}
          >
            <option value="">Unassigned</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ),
      exportValue: (lead) => lead.assignedTo,
      sortValue: (lead) => lead.assignedTo,
    },
    {
      key: "notes",
      header: "Notes",
      className: "w-[18%]",
      render: (lead) => {
        const draft = noteDrafts[lead.id] ?? lead.notes ?? "";
        const dirty = draft !== (lead.notes ?? "");
        const status = noteStatus[lead.id];
        return (
          <div onClick={(e) => e.stopPropagation()}>
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
                    style={{ backgroundColor: "var(--color-success)" }}
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
                <span className="text-[10px] font-medium" style={{ color: "var(--color-success)" }}>Saved ✓</span>
              )}
              {status === "error" && (
                <span className="text-[10px] font-medium" style={{ color: "var(--color-danger)" }}>Failed to save — try again</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "received",
      header: "Received",
      className: "w-[8%] whitespace-nowrap",
      render: (lead) => new Date(lead.createdAt).toLocaleDateString(),
      exportValue: (lead) => new Date(lead.createdAt).toLocaleDateString(),
      sortValue: (lead) => lead.createdAt,
    },
    {
      key: "whatsapp",
      header: "",
      className: "w-[13%]",
      render: (lead) => (
        <a
          href={buildWhatsAppLink(lead.phone, leadWhatsAppMessage(lead))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" }}
        >
          WhatsApp
        </a>
      ),
    },
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

        <div className="relative">
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

        {/* Every control — view toggle, viewer filter, search, stage
            filter, date range, export — on one wrapping row, instead of
            splitting "who's viewing" from "what's filtered" across two
            separate rows that read as unrelated toolbars. */}
        {/* items-end, not items-center: DateRangeFilter stacks a "From"/"To"
            label above its input, so centering the row floated every other
            control up by half a label and left the date boxes sitting lower
            than the stage filter and Export beside them. Bottom-aligning is
            what DataTable's own toolbar already does. Every control here is
            px-3 py-2 text-sm to match the shared DateRangeFilter and
            ExportButton, so the row is one clean band. */}
        <div className="relative mt-4 flex flex-wrap items-end gap-2">
          <div className="flex items-center gap-1 rounded-full border bg-white/70 p-1 text-sm backdrop-blur" style={{ borderColor: "var(--color-line)" }}>
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
          <MultiSelect
            options={[{ value: "__unassigned__", label: "Unassigned (shared pool)" }, ...staffOptions.map((v) => ({ value: v.id, label: v.name }))]}
            selected={viewerFilter}
            onChange={setViewerFilter}
            placeholder="Everyone"
            searchable
          />
          <input
            type="search"
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") combinedSearch();
            }}
            placeholder="Search name, email, phone, service…"
            className="w-full max-w-xs rounded-lg border bg-white/70 px-3 py-2 text-sm outline-none backdrop-blur focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <MultiSelect
            options={LEAD_STAGES.map((s) => ({ value: s, label: LEAD_STAGE_LABELS[s] }))}
            selected={draftStageFilter}
            onChange={setDraftStageFilter}
            placeholder="All stages"
          />
          <DateRangeFilter
            from={dateFilter.from}
            to={dateFilter.to}
            onFromChange={dateFilter.setFrom}
            onToChange={dateFilter.setTo}
            onClear={() => {
              dateFilter.clear();
              setDraftStageFilter(new Set());
              setStageFilter(new Set());
              setDraftSearch("");
              setSearch("");
            }}
            onSearch={combinedSearch}
            dirty={dateFilter.dirty || stageFilterDirty || searchDirty}
            active={dateFilter.active || stageFilter.size > 0}
          />
          {(search.trim() || stageFilter.size > 0) && (
            <button
              type="button"
              onClick={() => {
                setDraftSearch("");
                setSearch("");
                setDraftStageFilter(new Set());
                setStageFilter(new Set());
              }}
              className="rounded-lg px-2 py-2 text-xs font-semibold"
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

      {viewerFilter.size > 0 && (
        <p className="mb-4 text-xs rounded-lg px-3 py-2" style={{ color: "var(--color-ink-soft)", backgroundColor: "var(--color-paper)", border: "1px solid var(--color-line)" }}>
          Showing only: {viewerFilterLabel}.
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
                  e.dataTransfer.dropEffect = "move";
                  setDragOverStage(stage);
                }}
                onDragLeave={(e) => {
                  // dragleave also fires every time the pointer crosses onto
                  // a card inside this column, so without the containment
                  // check the drop highlight strobes the whole way down.
                  if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                  setDragOverStage((s) => (s === stage ? null : s));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStage(null);
                  const id = e.dataTransfer.getData("text/lead-id") || draggingId;
                  setDraggingId(null);
                  if (!id) return;
                  const dropped = leads?.find((l) => l.id === id);
                  // Dropping a card back into the column it came from is not
                  // a stage change. This used to PATCH and toast "Stage
                  // updated." regardless, so the board announced a status
                  // change every time a drag was abandoned mid-air over its
                  // own column and nothing had actually moved.
                  if (!dropped || dropped.stage === stage) return;
                  const moved = `Moved to ${LEAD_STAGE_LABELS[stage]}.`;
                  updateLead(
                    id,
                    { stage },
                    // Dragging into Won only flips the stage — it doesn't
                    // create the customer account and order that "Convert to
                    // Order" does, so say so rather than let Won quietly mean
                    // two different things depending on how it was reached.
                    stage === "won" && !dropped.convertedToProfileId
                      ? `${moved} Open the lead to create their customer account and order.`
                      : moved
                  );
                }}
                // Border width stays constant between states so engaging a
                // drop zone never nudges the column's contents by a pixel.
                // The active zone switches to a dashed gold outline — dashed
                // reads as "provisional, drop here" in a way a solid colour
                // change doesn't.
                className="min-w-0 rounded-[14px] p-2.5 transition-colors duration-200"
                style={{
                  background: isDragOver ? "var(--gold-50)" : stageStyle.grad,
                  border: isDragOver ? "1.5px dashed var(--color-action)" : "1.5px solid var(--color-line)",
                }}
              >
                <div className="flex items-center justify-between px-1.5 pb-2.5 pt-0.5">
                  <span
                    className="flex items-center gap-1.5 text-[0.8125rem] font-bold"
                    style={{ color: stageStyle.text }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageStyle.text }} />
                    {LEAD_STAGE_LABELS[stage]}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                    style={{ backgroundColor: stageStyle.bg, color: stageStyle.text }}
                  >
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
                          // *Capture, not the plain handlers. framer-motion
                          // claims onDragStart/onDrag/onDragEnd as its own
                          // pan-gesture props (see isValidMotionProp) and
                          // strips them off the DOM element — and since this
                          // card doesn't set framer's `drag` prop, its drag
                          // feature never loads either, so those handlers
                          // fired nowhere at all. dataTransfer was therefore
                          // never populated, every drop read an empty lead id,
                          // and dragging a card across the board did nothing.
                          // isValidMotionProp doesn't match the *Capture
                          // variants (or the `draggable` attribute), so React
                          // attaches these to the element for real.
                          onDragStartCapture={(e) => {
                            e.dataTransfer.setData("text/lead-id", lead.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDraggingId(lead.id);
                          }}
                          onDragEndCapture={() => {
                            setDraggingId(null);
                            setDragOverStage(null);
                            dragEndedAt.current = Date.now();
                          }}
                          onClick={() => {
                            if (Date.now() - dragEndedAt.current < 250) return;
                            setActiveLead(lead);
                          }}
                          className="cursor-grab space-y-2 rounded-[12px] border p-2.5 active:cursor-grabbing"
                          style={{
                            borderColor: "var(--color-line)",
                            backgroundColor: "var(--color-paper-raised)",
                            // The card being dragged stays in place as a
                            // faded, flattened placeholder marking where it
                            // came from; the browser's own drag image is the
                            // thing that moves. Scaling it down slightly is
                            // what makes it read as "lifted out of here"
                            // rather than merely dimmed.
                            opacity: draggingId === lead.id ? 0.35 : 1,
                            transform: draggingId === lead.id ? "scale(0.97)" : undefined,
                            boxShadow: draggingId === lead.id ? "none" : "var(--shadow-xs)",
                            transition: "box-shadow 150ms var(--ease-out), opacity 150ms var(--ease-out), transform 150ms var(--ease-out)",
                          }}
                          onMouseEnter={(e) => {
                            if (draggingId === lead.id) return;
                            e.currentTarget.style.boxShadow = "var(--shadow-md)";
                            e.currentTarget.style.borderColor = "var(--color-line-strong)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = draggingId === lead.id ? "none" : "var(--shadow-xs)";
                            e.currentTarget.style.borderColor = "var(--color-line)";
                          }}
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
                            {!lead.assignedToId ? (
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
                              style={{ backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" }}
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
      ) : leads === null ? (
        <div className="space-y-2 rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={leadColumns}
          rows={filteredLeads}
          getRowKey={(lead) => lead.id}
          itemLabel="leads"
          emptyMessage={
            viewerFilter.size === 0
              ? "No leads yet."
              : `No leads matching: ${viewerFilterLabel}.`
          }
          onRowClick={(lead) => setActiveLead(lead)}
          // fixedLayout: this table defines w-[%] widths on every column
          // (see leadColumns above) but was never actually opted into
          // table-layout: fixed — under the default auto layout those
          // percentages are decorative only, and the browser sized the
          // Lead column to fit its longest unwrapped line (an email
          // address) while squeezing Stage/Assigned/Notes down to a
          // couple of visible characters each. minWidth bumped from 860
          // to give the two <select> columns (Stage, Assigned to) enough
          // real pixels to show a full label like "In Progress" rather
          // than just being technically un-clipped at a near-zero width.
          fixedLayout
          minWidth={980}
        />
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
