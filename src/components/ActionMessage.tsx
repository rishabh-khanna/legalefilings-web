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

  return createPortal(
    <div
      role="status"
      className="animate-toast-in fixed right-4 top-4 z-[200] flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg"
      style={
        isSuccess
          ? { backgroundColor: "#f0fdf4", borderColor: "#bbf0cd", color: "#116a2c" }
          : { backgroundColor: "#fef2f2", borderColor: "#f8caca", color: "#b42318" }
      }
    >
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" />
      <p className="min-w-0 flex-1 text-sm font-medium">{message.text}</p>
      <button
        type="button"
        onClick={() => setDismissedText(message.text)}
        aria-label="Dismiss"
        className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>,
    document.body
  );
}
