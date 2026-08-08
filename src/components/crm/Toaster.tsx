"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; text: string };

const ToastContext = createContext<{ toast: (kind: ToastKind, text: string) => void } | null>(null);

let nextId = 1;

// A proper floating toast stack (bottom-right, stacked, auto-dismiss) —
// used by the redesigned CRM pages instead of the inline ActionMessage
// banner, which pushes layout around every time it appears/disappears.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((kind: ToastKind, text: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const ICONS: Record<ToastKind, typeof CheckCircle2> = { success: CheckCircle2, error: XCircle, info: Info };
  const COLORS: Record<ToastKind, { bg: string; text: string; icon: string }> = {
    success: { bg: "#ffffff", text: "#116a2c", icon: "#22c55e" },
    error: { bg: "#ffffff", text: "#b42318", icon: "#ef4444" },
    info: { bg: "#ffffff", text: "var(--color-ink)", icon: "var(--color-action)" },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* z-[110] — must stay above every modal in the app, including
          DetailPickerModal's z-[100] (itself already raised above
          ordinary modals since it can be nested inside one) — a toast
          firing while any picker/modal is open still needs to be seen,
          not rendered behind it. */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[110] flex flex-col gap-2 sm:bottom-6 sm:right-6">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.kind];
            const c = COLORS[t.kind];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-xl"
                style={{ backgroundColor: c.bg, color: c.text, borderColor: "var(--color-line)" }}
              >
                <Icon className="h-4 w-4 shrink-0" style={{ color: c.icon }} />
                <p className="text-sm font-medium">{t.text}</p>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="ml-1 shrink-0 opacity-50 hover:opacity-100">
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}
