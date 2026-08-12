"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Mail, Phone, MapPin, Briefcase, IndianRupee, Clock, MessageCircle, CheckCircle2 } from "lucide-react";
import type { Lead, LeadStage } from "@/lib/leads";
import { LEAD_STAGE_LABELS } from "@/lib/leads";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { SITE_NAME } from "@/config/site";
import { Spinner } from "@/components/Spinner";

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
  onConverted,
}: {
  lead: Lead | null;
  onClose: () => void;
  onSaveNotes: (id: string, notes: string) => Promise<boolean> | boolean;
  onConverted: (id: string, customerId: string) => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [notes, setNotes] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [noteStatus, setNoteStatus] = useState<"saving" | "saved" | "error" | null>(null);

  useEffect(() => {
    if (!lead) return;
    // Deferred (not called synchronously in the effect body) — same
    // pattern used elsewhere in this codebase to avoid the
    // cascading-render lint rule.
    const kickoff = setTimeout(() => {
      setNotes(lead.notes);
      setHistory(null);
      setConvertError(null);
      setNoteStatus(null);
      fetch(`/api/leads/${lead.id}/history`)
        .then((res) => res.json())
        .then((data) => setHistory(data.history ?? []))
        .catch(() => setHistory([]));
    }, 0);
    return () => clearTimeout(kickoff);
  }, [lead]);

  async function handleConvert() {
    if (!lead) return;
    setConverting(true);
    setConvertError(null);
    const res = await fetch(`/api/leads/${lead.id}/convert`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setConverting(false);
    if (res.ok) {
      onConverted(lead.id, data.customerId);
    } else {
      setConvertError(data.error ?? "Failed to convert this lead.");
    }
  }

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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
                >
                  Close
                </button>
                <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-accent-tint)]">
                  <X className="h-4 w-4" style={{ color: "var(--color-ink-soft)" }} />
                </button>
              </div>
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
                style={{ backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" }}
              >
                <MessageCircle className="h-4 w-4" />
                Message on WhatsApp
              </a>

              {lead.convertedToProfileId ? (
                <p className="mt-3 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold" style={{ backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" }}>
                  <CheckCircle2 className="h-4 w-4" />
                  Converted to a customer + order
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleConvert}
                    disabled={converting}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
                    style={{ backgroundColor: "var(--color-action)" }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {converting ? "Converting…" : "Convert to Order"}
                  </button>
                  <p className="mt-1.5 text-center text-xs" style={{ color: "var(--color-ink-soft)" }}>
                    Creates their customer account (or reuses one if they already have one), a real order, and emails them a payment link.
                  </p>
                  {convertError && <p className="mt-1.5 text-center text-xs" style={{ color: "var(--color-danger)" }}>{convertError}</p>}
                </>
              )}

              <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--color-line)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>Notes</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add a note…"
                  className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
                  style={{ borderColor: "var(--color-line)" }}
                />
                <div className="mt-2 flex items-center gap-2">
                  {notes !== (lead.notes ?? "") && (
                    <>
                      <button
                        type="button"
                        disabled={noteStatus === "saving"}
                        onClick={async () => {
                          setNoteStatus("saving");
                          const ok = await onSaveNotes(lead.id, notes);
                          setNoteStatus(ok ? "saved" : "error");
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: "var(--color-success)" }}
                      >
                        <Check className="h-3.5 w-3.5" /> Save
                      </button>
                      <button
                        type="button"
                        disabled={noteStatus === "saving"}
                        onClick={() => setNotes(lead.notes)}
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                        style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
                      >
                        <X className="h-3.5 w-3.5" /> Discard
                      </button>
                    </>
                  )}
                  {noteStatus === "saving" && (
                    <span className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Saving…</span>
                  )}
                  {notes === (lead.notes ?? "") && noteStatus === "saved" && (
                    <span className="text-xs font-medium" style={{ color: "var(--color-success)" }}>Saved ✓</span>
                  )}
                  {noteStatus === "error" && (
                    <span className="text-xs font-medium" style={{ color: "var(--color-danger)" }}>Failed to save — try again</span>
                  )}
                </div>
              </div>

              <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--color-line)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>Activity</p>
                <div className="mt-3 space-y-3">
                  {history === null && (
                    <Spinner size={14} label="Loading…" />
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
