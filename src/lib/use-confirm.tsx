"use client";

import { useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type ConfirmOptions = { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };

// Drop-in replacement for the browser's confirm(): call sites just add
// `await` — `if (!confirm("Remove this item?")) return;` becomes
// `if (!(await confirm("Remove this item?"))) return;` — and render
// {confirmDialog} once anywhere in the page's JSX. Resolves true/false
// the same way confirm() returns a boolean; the difference is the
// question is asked through the app's own themed ConfirmDialog instead
// of the OS's dialog box, and can carry a danger style + custom labels.
export function useConfirm() {
  const [state, setState] = useState<({ message: string } & ConfirmOptions) | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    setState({ message, ...options });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function settle(result: boolean) {
    setState(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }

  const confirmDialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      danger={state.danger}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return { confirm, confirmDialog };
}
