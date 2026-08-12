"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, X } from "lucide-react";
import type { ActionMessage as ActionMessageType } from "@/lib/use-action-message";

// Every page's save/update/submit/validate action reports through
// useActionMessage + this component — a real floating toast (top-right,
// portaled to document.body so it always sits above page content
// regardless of where it's mounted in the tree, same reasoning as the
// sidebar flyout's stacking-context fix) instead of an inline banner
// that only showed if the user happened to be looking at that part of
// the page. Self-dismissible without any call site needing to pass a
// handler — clicking the × just hides this specific message's text
// locally, so nothing needs to change across the ~40 pages that already
// call `<ActionMessage message={message} />`.
//
// Deliberately does NOT auto-dismiss: about half the messages routed
// through here are validation failures the user has to read and act on,
// and a timer would race them.
export function ActionMessage({ message }: { message: ActionMessageType }) {
  const [mounted, setMounted] = useState(false);
  const [dismissedText, setDismissedText] = useState<string | null>(null);

  useEffect(() => {
    const kickoff = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(kickoff);
  }, []);

  if (!mounted || !message || message.text === dismissedText) return null;

  const isSuccess = message.kind === "success";
  const Icon = isSuccess ? CheckCircle2 : XCircle;
  const accent = isSuccess ? "var(--color-success)" : "var(--color-danger)";
  const accentTint = isSuccess ? "var(--color-success-tint)" : "var(--color-danger-tint)";

  return createPortal(
    <div
      role="status"
      // A white card with one colored element, not a fully tinted panel.
      // A solid green or red block is a shout; the eye only needs the
      // status *encoded* somewhere, and an icon plus a 3px rail does
      // that while the message itself stays plain readable text at full
      // contrast on white instead of colored-on-colored.
      className="animate-toast-in fixed right-4 top-4 z-[200] flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-[14px] border pl-0 pr-3.5 py-3.5"
      style={{
        backgroundColor: "var(--color-paper-raised)",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} />
      <span
        className="ml-3.5 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: accentTint, color: accent }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium leading-snug" style={{ color: "var(--color-ink)" }}>
        {message.text}
      </p>
      <button
        type="button"
        onClick={() => setDismissedText(message.text)}
        aria-label="Dismiss"
        className="-mr-1 shrink-0 rounded-md p-1 transition-colors hover:bg-[var(--color-paper-sunken)]"
        style={{ color: "var(--color-ink-soft)" }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>,
    document.body
  );
}
