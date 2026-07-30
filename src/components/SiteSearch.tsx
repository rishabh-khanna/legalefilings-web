"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SearchEntry } from "@/lib/content";

export function SiteSearch({ index }: { index: SearchEntry[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index.filter((e) => e.title.toLowerCase().includes(q)).slice(0, 8);
  }, [query, index]);

  return (
    <>
      <button
        type="button"
        aria-label="Search services"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-accent-tint)]"
        style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-xl bg-white dark:bg-[var(--color-paper-raised)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="var(--color-ink-soft)"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services — e.g. GST, LLP, Trademark"
                className="w-full py-1 text-sm outline-none"
                style={{ color: "var(--color-ink)" }}
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setOpen(false)}
                className="shrink-0 text-xl leading-none"
                style={{ color: "var(--color-ink-soft)" }}
              >
                &times;
              </button>
            </div>
            {query.trim() && (
              <ul className="max-h-80 overflow-y-auto p-2">
                {results.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
                    No services found for &quot;{query}&quot;.
                  </li>
                )}
                {results.map((r) => (
                  <li key={r.href}>
                    <Link
                      href={r.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-[var(--color-accent-tint)]"
                      style={{ color: "var(--color-ink)" }}
                    >
                      <span>{r.title}</span>
                      {r.category && (
                        <span className="shrink-0 text-xs" style={{ color: "var(--color-ink-soft)" }}>
                          {r.category}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
