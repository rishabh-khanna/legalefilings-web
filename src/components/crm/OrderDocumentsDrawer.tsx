"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Upload, FileText, Trash2, CheckCircle2, XCircle, ArrowRight, Ban } from "lucide-react";
import { LoadingBlock } from "@/components/Spinner";
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, ORDER_STATUS_FLOW, type OrderStatus } from "@/lib/order-status";

export type OrderDocumentStatus = "awaiting" | "submitted" | "verified" | "not_required";

type DocumentRow = {
  id: string;
  file_name: string;
  file_size: number | null;
  status: "pending" | "verified" | "rejected";
  review_note: string | null;
  created_at: string;
  uploaded_by: string | null;
  profiles: { full_name: string | null } | null;
};

export const DOCUMENT_STATUS_LABEL: Record<OrderDocumentStatus, string> = {
  awaiting: "Documents Needed",
  submitted: "Under Review",
  verified: "Documents Verified",
  not_required: "No Documents Needed",
};

export const DOCUMENT_STATUS_STYLE: Record<OrderDocumentStatus, { bg: string; fg: string }> = {
  awaiting: { bg: "#fde2e2", fg: "#b42318" },
  submitted: { bg: "#fff6d9", fg: "#8a6700" },
  verified: { bg: "#d0f4db", fg: "#116a2c" },
  not_required: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
};

const DOC_STATUS_STYLE: Record<DocumentRow["status"], { bg: string; fg: string }> = {
  pending: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  verified: { bg: "#d0f4db", fg: "#116a2c" },
  rejected: { bg: "#fde2e2", fg: "#b42318" },
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// A slide-over rather than a separate route (same pattern as
// LeadDetailDrawer) — an order's documents aren't a full page's worth of
// content, and this way it works identically whether opened from the
// customer's "Order History" or staff's "Orders" view.
export function OrderDocumentsDrawer({
  orderId,
  orderLabel,
  isStaff,
  orderStatus,
  onClose,
  onStatusChange,
  onOrderStatusChange,
}: {
  orderId: string | null;
  orderLabel: string;
  isStaff: boolean;
  orderStatus: OrderStatus | null;
  onClose: () => void;
  onStatusChange: (orderId: string, status: OrderDocumentStatus) => void;
  onOrderStatusChange: (orderId: string, status: OrderStatus) => void;
}) {
  const [changingStatus, setChangingStatus] = useState(false);

  async function handleProcessStatusChange(status: OrderStatus) {
    if (!orderId) return;
    setChangingStatus(true);
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setChangingStatus(false);
    if (res.ok) onOrderStatusChange(orderId, status);
  }
  const [documentStatus, setDocumentStatus] = useState<OrderDocumentStatus>("awaiting");
  const [documents, setDocuments] = useState<DocumentRow[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  async function load() {
    if (!orderId) return;
    const res = await fetch(`/api/orders/${orderId}/documents`);
    const data = await res.json();
    if (res.ok) {
      setDocumentStatus(data.documentStatus);
      setDocuments(data.documents ?? []);
    } else {
      setError(data.error ?? "Failed to load documents.");
    }
  }

  useEffect(() => {
    // Deferred — same pattern used elsewhere in this codebase to avoid
    // the cascading-render lint rule.
    const kickoff = setTimeout(() => {
      setDocuments(null);
      setError(null);
      load();
    }, 0);
    return () => clearTimeout(kickoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !orderId) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/orders/${orderId}/documents`, { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error ?? "Upload failed.");
      return;
    }
    await load();
    if (documentStatus === "awaiting") onStatusChange(orderId, "submitted");
  }

  async function handleDelete(docId: string, fileName: string) {
    if (!orderId) return;
    if (!window.confirm(`Delete "${fileName}"? This can't be undone.`)) return;
    await fetch(`/api/orders/${orderId}/documents/${docId}`, { method: "DELETE" });
    await load();
  }

  async function handleReview(docId: string, status: "verified" | "rejected", reviewNote?: string) {
    if (!orderId) return;
    await fetch(`/api/orders/${orderId}/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNote }),
    });
    setRejectingId(null);
    setRejectNote("");
    await load();
  }

  async function handleOrderStatusChange(status: OrderDocumentStatus) {
    if (!orderId) return;
    const res = await fetch(`/api/orders/${orderId}/documents`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentStatus: status }),
    });
    if (res.ok) {
      setDocumentStatus(status);
      onStatusChange(orderId, status);
      // "Mark all verified" (status === "verified") bulk-updates every
      // pending document server-side (see the PATCH route), but this
      // only ever updated the order-level badge locally — the
      // individual document rows kept showing stale "pending" state
      // until the drawer was closed and reopened, even though the
      // database was already correct. Refetch, same as handleDelete/
      // handleReview already do after their own writes.
      await load();
    }
  }

  return (
    <AnimatePresence>
      {orderId && (
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
              <div>
                <p className="font-bold" style={{ color: "var(--color-ink)" }}>Documents</p>
                <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>{orderLabel}</p>
              </div>
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
              {orderStatus && (
                <div className="mb-5 border-b pb-5" style={{ borderColor: "var(--color-line)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>Process Status</p>
                  <span
                    className="mt-1.5 inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: ORDER_STATUS_STYLE[orderStatus].bg, color: ORDER_STATUS_STYLE[orderStatus].fg }}
                  >
                    {ORDER_STATUS_LABEL[orderStatus]}
                  </span>

                  {isStaff && orderStatus !== "completed" && orderStatus !== "cancelled" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(() => {
                        const idx = ORDER_STATUS_FLOW.indexOf(orderStatus);
                        const next = idx >= 0 ? ORDER_STATUS_FLOW[idx + 1] : undefined;
                        return (
                          next && (
                            <button
                              type="button"
                              disabled={changingStatus}
                              onClick={() => handleProcessStatusChange(next)}
                              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                              style={{ backgroundColor: "var(--color-action)" }}
                            >
                              Move to {ORDER_STATUS_LABEL[next]} <ArrowRight className="h-3 w-3" />
                            </button>
                          )
                        );
                      })()}
                      <button
                        type="button"
                        disabled={changingStatus}
                        onClick={() => {
                          if (confirm("Cancel this order? The customer will see it as cancelled.")) handleProcessStatusChange("cancelled");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                        style={{ borderColor: "var(--color-line)", color: "#b42318" }}
                      >
                        <Ban className="h-3 w-3" /> Cancel Order
                      </button>
                    </div>
                  )}
                </div>
              )}

              <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: DOCUMENT_STATUS_STYLE[documentStatus].bg, color: DOCUMENT_STATUS_STYLE[documentStatus].fg }}>
                {DOCUMENT_STATUS_LABEL[documentStatus]}
              </span>

              {isStaff && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {documentStatus !== "not_required" && (
                    <button type="button" onClick={() => handleOrderStatusChange("not_required")} className="rounded-full border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}>
                      Mark not required
                    </button>
                  )}
                  {documentStatus !== "awaiting" && (
                    <button type="button" onClick={() => handleOrderStatusChange("awaiting")} className="rounded-full border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}>
                      Ask for more documents
                    </button>
                  )}
                  {documentStatus !== "verified" && (documents?.length ?? 0) > 0 && (
                    <button type="button" onClick={() => handleOrderStatusChange("verified")} className="rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: "var(--color-action)" }}>
                      Mark all verified
                    </button>
                  )}
                </div>
              )}

              {documentStatus !== "not_required" && (
                <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm font-medium transition-colors hover:bg-[var(--color-accent-tint)]" style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}>
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading…" : "Upload a document"}
                  <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              )}

              {error && <p className="mt-3 text-sm" style={{ color: "#b42318" }}>{error}</p>}

              <div className="mt-5 space-y-3">
                {documents === null ? (
                  <LoadingBlock />
                ) : documents.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No documents uploaded yet.</p>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="rounded-xl border p-3" style={{ borderColor: "var(--color-line)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <FileText className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
                          <div className="min-w-0">
                            <a
                              href={`/api/orders/${orderId}/documents/${doc.id}/download`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-sm font-medium hover:underline"
                              style={{ color: "var(--color-ink)" }}
                            >
                              {doc.file_name}
                            </a>
                            <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                              {formatSize(doc.file_size)} · {doc.profiles?.full_name ?? "Unknown"} · {new Date(doc.created_at).toLocaleDateString("en-IN")}
                            </p>
                          </div>
                        </div>
                        <button type="button" onClick={() => handleDelete(doc.id, doc.file_name)} aria-label="Delete" className="shrink-0 rounded-full p-1 transition-colors hover:bg-[var(--color-accent-tint)]">
                          <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--color-ink-soft)" }} />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: DOC_STATUS_STYLE[doc.status].bg, color: DOC_STATUS_STYLE[doc.status].fg }}>
                          {doc.status}
                        </span>
                        {isStaff && doc.status === "pending" && rejectingId !== doc.id && (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleReview(doc.id, "verified")} className="flex items-center gap-1 text-xs font-medium" style={{ color: "#116a2c" }}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                            </button>
                            <button type="button" onClick={() => setRejectingId(doc.id)} className="flex items-center gap-1 text-xs font-medium" style={{ color: "#b42318" }}>
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                      {doc.review_note && (
                        <p className="mt-2 text-xs italic" style={{ color: "var(--color-ink-soft)" }}>&ldquo;{doc.review_note}&rdquo;</p>
                      )}
                      {rejectingId === doc.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            autoFocus
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Why? (e.g. blurry photo)"
                            className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
                            style={{ borderColor: "var(--color-line)" }}
                          />
                          <button type="button" onClick={() => handleReview(doc.id, "rejected", rejectNote)} className="shrink-0 text-xs font-semibold" style={{ color: "#b42318" }}>Confirm</button>
                          <button type="button" onClick={() => { setRejectingId(null); setRejectNote(""); }} className="shrink-0 text-xs" style={{ color: "var(--color-ink-soft)" }}>Cancel</button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
