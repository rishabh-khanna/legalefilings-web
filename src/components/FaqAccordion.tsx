"use client";

import { useState } from "react";

export function FaqAccordion({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  // No heading here — the real content already has its own "Frequently Asked
  // Questions" H2 right before these blocks (that's also what the section
  // nav anchors to), so a second, component-owned heading was showing up as
  // a visible duplicate right underneath it.
  return (
    <div className="my-8">
      <div className="divide-y rounded-lg border" style={{ borderColor: "var(--color-line)" }}>
        {items.map((item, i) => {
          const isOpen = open[i] ?? false;
          return (
            <div key={i} style={{ borderColor: "var(--color-line)" }}>
              <button
                type="button"
                onClick={() => setOpen((prev) => ({ ...prev, [i]: !isOpen }))}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${i}`}
                className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-[var(--color-accent-tint)]"
                style={{ color: "var(--color-ink)" }}
              >
                {item.question}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 transition-transform duration-300"
                  fill="none"
                  stroke="var(--color-action)"
                  strokeWidth="2"
                  style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div
                id={`faq-answer-${i}`}
                role="region"
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 text-sm leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
