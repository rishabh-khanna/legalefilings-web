"use client";

import { Modal } from "@/components/Modal";

// The styled popup every destructive action (Remove, Delete, Reject…)
// should confirm through instead of the browser's own confirm() — same
// question, but themed, and dismissible the same way every other modal
// in the app is (Esc, backdrop click, the "x"). Pair with useConfirm()
// rather than rendering this directly — that hook turns the old
// `if (!confirm("...")) return;` one-liner into an `await`-able
// equivalent with almost no call-site change.
export function ConfirmDialog({
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red confirm button for a destructive action (delete, remove, reject)
  // — the default gold is for a confirm that isn't itself dangerous
  // (e.g. "discard unsaved changes and continue").
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel} maxWidth="max-w-sm">
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
        {message}
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border px-4 py-2 text-xs font-semibold transition-colors hover:bg-[var(--color-muted-tint)]"
          style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          className="rounded-full px-4 py-2 text-xs font-semibold text-white"
          style={{ backgroundColor: danger ? "var(--color-danger)" : "var(--color-action)" }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
