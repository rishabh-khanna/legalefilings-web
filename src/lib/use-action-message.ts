"use client";

import { useState, useCallback, useRef } from "react";

export type ActionMessage = { kind: "success" | "error"; text: string } | null;

// One small hook every page's save/update/submit/validate action reports
// through, instead of some actions showing feedback and others failing
// silently. Auto-dismisses success messages after a few seconds; errors
// stay until the next action (worth reading, not worth losing on a blink).
export function useActionMessage() {
  const [message, setMessage] = useState<ActionMessage>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccess = useCallback((text: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessage({ kind: "success", text });
    timeoutRef.current = setTimeout(() => setMessage(null), 4000);
  }, []);

  const showError = useCallback((text: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessage({ kind: "error", text });
  }, []);

  const clear = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessage(null);
  }, []);

  return { message, showSuccess, showError, clear };
}
