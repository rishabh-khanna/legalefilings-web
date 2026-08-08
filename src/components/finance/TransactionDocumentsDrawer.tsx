"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Upload, FileText } from "lucide-react";
import { LoadingBlock } from "@/components/Spinner";

type DocumentRow = { id: string; file_name: string; file_size: number | null; created_at: string };

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Module 7 — attachments per expense/income entry. Same slide-over
// pattern as LeadDetailDrawer/OrderDocumentsDrawer elsewhere in this app.
export function TransactionDocumentsDrawer({ transactionId, transactionLabel, onClose }: { transactionId: string | null; transactionLabel: string; onClose: () => void }) {
  const [documents, setDocuments] = useState<DocumentRow[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!transactionId) return;
    const res = await fetch(`/api/expense-manager/transactions/${transactionId}/documents`);
    const data = await res.json();
    if (res.ok) setDocuments(data.documents ?? []);
  }

  useEffect(() => {
    // Deferred — same pattern used elsewhere in this codebase to avoid
    // the cascading-render lint rule.
    const kickoff = setTimeout(() => {
      setDocuments(null);
      load();
    }, 0);
    return () => clearTimeout(kickoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !transactionId) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/expense-manager/transactions/${transactionId}/documents`, { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Upload failed.");
      return;
    }
    await load();
  }

  return (
    <AnimatePresence>
      {transactionId && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90]" style={{ backgroundColor: "rgba(15,23,42,0.35)" }} onClick={onClose} />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 z-[95] h-full w-full max-w-sm overflow-y-auto border-l shadow-2xl dark:bg-[var(--color-paper-raised)]"
            style={{ backgroundColor: "#fff", borderColor: "var(--color-line)" }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 backdrop-blur-xl" style={{ borderColor: "var(--color-line)", backgroundColor: "rgba(255,255,255,0.9)" }}>
              <div>
                <p className="font-bold" style={{ color: "var(--color-ink)" }}>Documents</p>
                <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>{transactionLabel}</p>
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
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm font-medium transition-colors hover:bg-[var(--color-accent-tint)]" style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}>
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload a document"}
                <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>

              {error && <p className="mt-3 text-sm" style={{ color: "#b42318" }}>{error}</p>}

              <div className="mt-5 space-y-2">
                {documents === null ? (
                  <LoadingBlock />
                ) : documents.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No documents uploaded yet.</p>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 rounded-xl border p-3" style={{ borderColor: "var(--color-line)" }}>
                      <div className="flex min-w-0 items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
                        <div className="min-w-0">
                          <a
                            href={`/api/expense-manager/transactions/${transactionId}/documents/${doc.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-sm font-medium hover:underline"
                            style={{ color: "var(--color-ink)" }}
                          >
                            {doc.file_name}
                          </a>
                          <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                            {formatSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                      </div>
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
