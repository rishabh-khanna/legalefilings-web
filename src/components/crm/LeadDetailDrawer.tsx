"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Mail, Phone, MapPin, Briefcase, IndianRupee, Clock, MessageCircle } from "lucide-react";
import type { Lead, LeadStage } from "@/lib/leads";
import { LEAD_STAGE_LABELS } from "@/lib/leads";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { SITE_NAME } from "@/config/site";

type HistoryEntry = {
  id: string;
  old_status: LeadStage | null;
  new_status: LeadStage;
  changed_at: string;
  profiles: { full_name: string | null } | null;
};

// The CRM's "contact page" — a slide-over rather than a separate route,
// since a lead isn't a full account with its own URL-worthy identity yet.
// Shows what we actually have (contact details, deal value, notes, a real
// stage-change timeline) — no fabricated "email history" or "AI summary"
// tabs for data this app doesn't capture.
export function LeadDetailDrawer({
  lead,
  onClose,
  onSaveNotes,
}: {
  lead: Lead | null;
  onClose: () => void;
  onSaveNotes: (id: string, notes: string) => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!lead) return;
    // Deferred (not called synchronously in the effect body) — same
    // pattern used elsewhere in this codebase to avoid the
    // cascading-render lint rule.
    const kickoff = setTimeout(() => {
      setNotes(lead.notes);
      setHistory(null);
      fetch(`/api/leads/${lead.id}/history`)
        .then((res) => res.json())
        .then((data) => setHistory(data.history ?? []))
        .catch(() => setHistory([]));
    }, 0);
    return () => clearTimeout(kickoff);
  }, [lead]);

  return (
    <AnimatePresence>
      {lead && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
            style={{ backgroundColor: "rgba(15,23,42,0.35)" }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 z-[95] h-full w-full max-w-md overflow-y-auto border-l shadow-2xl dark:bg-[var(--color-paper-raised)]"
            style={{ backgroundColor: "#fff", borderColor: "var(--color-line)" }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 backdrop-blur-xl" style={{ borderColor: "var(--color-line)", backgroundColor: "rgba(255,255,255,0.9)" }}>
              <p className="font-bold" style={{ color: "var(--color-ink)" }}>Lead details</p>
              <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-accent-tint)]">
                <X className="h-4 w-4" style={{ color: "var(--color-ink-soft)" }} />
              </button>
            </div>

            <div className="p-5">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold"
                style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }}
              >
                {lead.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?"}
              </div>
              <h2 className="mt-3 text-xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
                {lead.name}
              </h2>
              <span
                className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: "var(--color-paper)", color: "var(--color-ink-soft)" }}
              >
                {LEAD_STAGE_LABELS[lead.stage]}
              </span>

              <div className="mt-5 space-y-2.5 text-sm">
                <p className="flex items-center gap-2.5" style={{ color: "var(--color-ink)" }}>
                  <Mail className="h-4 w-4 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
                  {lead.email}
                </p>
                <p className="flex items-center gap-2.5" style={{ color: "var(--color-ink)" }}>
                  <Phone className="h-4 w-4 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
                  {lead.phone}
                </p>
                {(lead.city || lead.state) && (
                  <p className="flex items-center gap-2.5" style={{ color: "var(--color-ink)" }}>
                    <MapPin className="h-4 w-4 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
                    {[lead.city, lead.state].filter(Boolean).join(", ")}
                  </p>
                )}
                {lead.service && (
                  <p className="flex items-center gap-2.5" style={{ color: "var(--color-ink)" }}>
                    <Briefcase className="h-4 w-4 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
                    {lead.service}
                    {lead.plan ? ` — ${lead.plan}` : ""}
                  </p>
                )}
                {lead.planPrice && (
                  <p className="flex items-center gap-2.5 font-semibold" style={{ color: "var(--color-ink)" }}>
                    <IndianRupee className="h-4 w-4 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
                    {lead.planPrice}
                  </p>
                )}
                <p className="flex items-center gap-2.5" style={{ color: "var(--color-ink-soft)" }}>
                  <Clock className="h-4 w-4 shrink-0" />
                  Received {new Date(lead.createdAt).toLocaleString("en-IN")}
                </p>
              </div>

              <a
                href={buildWhatsAppLink(lead.phone, `Hi ${lead.name.split(" ")[0]}, this is ${SITE_NAME} following up on your enquiry${lead.service ? ` about ${lead.service}` : ""}. How can we help you get started?`)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: "#dcfce3", color: "#116a2c" }}
              >
                <MessageCircle className="h-4 w-4" />
                Message on WhatsApp
              </a>

              <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--color-line)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>Notes</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => onSaveNotes(lead.id, notes)}
                  rows={3}
                  placeholder="Add a note…"
                  className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
                  style={{ borderColor: "var(--color-line)" }}
                />
              </div>

              <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--color-line)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>Activity</p>
                <div className="mt-3 space-y-3">
                  {history === null && (
                    <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Loading…</p>
                  )}
                  {history?.length === 0 && (
                    <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>No stage changes recorded yet.</p>
                  )}
                  {history?.map((h) => (
                    <div key={h.id} className="flex items-start gap-2.5 text-xs">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--color-action)" }} />
                      <div>
                        <p style={{ color: "var(--color-ink)" }}>
                          {h.profiles?.full_name ?? "Someone"} moved this to{" "}
                          <span className="font-semibold">{LEAD_STAGE_LABELS[h.new_status]}</span>
                          {h.old_status ? ` from ${LEAD_STAGE_LABELS[h.old_status]}` : ""}
                        </p>
                        <p style={{ color: "var(--color-ink-soft)" }}>{new Date(h.changed_at).toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
