"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SearchEntry } from "@/lib/content";
import { getAssistantReply, type AssistantReply } from "@/lib/assistant-engine";
import { BrandFaceAlt } from "@/components/BrandFace";

const SUGGESTED_PROMPTS = [
  "Which structure is right for me?",
  "How much does GST registration cost?",
  "Documents required for Private Limited Company",
  "Talk to a CA/CS expert",
];

type Message = { role: "user" | "assistant"; text: string; links?: AssistantReply["links"] };

export function AiAssistant({ searchIndex }: { searchIndex: SearchEntry[] }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Cmd/Ctrl+K opens the assistant from anywhere — the same entry point as
  // the floating button, not a second competing widget.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function ask(text: string) {
    const question = text.trim();
    if (!question) return;
    const reply = getAssistantReply(question, searchIndex);
    setMessages((prev) => [...prev, { role: "user", text: question }, { role: "assistant", ...reply }]);
    setInput("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant (Cmd+K)"}
        aria-expanded={open}
        className="fixed bottom-24 right-6 z-30 hidden h-13 w-13 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 sm:flex"
        style={{ backgroundColor: "var(--color-ink-fixed)", height: 52, width: 52 }}
      >
        {open ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#ffffff" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        ) : (
          <BrandFaceAlt className="h-8 w-8" />
        )}
      </button>

      {open && (
        <div
          className="fixed bottom-40 right-6 z-30 hidden w-96 overflow-hidden rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)] shadow-2xl sm:block"
          style={{ borderColor: "var(--color-line)" }}
        >
          <div className="flex items-center gap-3 p-4" style={{ backgroundColor: "var(--color-ink-fixed)" }}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
              <BrandFaceAlt className="h-9 w-9" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Legal Efilings Assistant</p>
              <p className="text-xs text-white/60">Ask about a service, pricing, or eligibility</p>
            </div>
          </div>

          <div ref={scrollRef} className="max-h-96 space-y-3 overflow-y-auto p-4">
            <div
              className="rounded-lg rounded-tl-none p-3 text-sm leading-relaxed"
              style={{ backgroundColor: "var(--color-paper)", color: "var(--color-ink)" }}
            >
              👋 Hi! I can help you find the right registration or filing service. What would you like to know?
            </div>

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-lg rounded-tr-none px-3 py-2 text-sm text-white"
                    style={{ backgroundColor: "var(--color-action)" }}
                  >
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="space-y-2">
                  <div
                    className="whitespace-pre-line rounded-lg rounded-tl-none p-3 text-sm leading-relaxed"
                    style={{ backgroundColor: "var(--color-paper)", color: "var(--color-ink)" }}
                  >
                    {m.text}
                  </div>
                  {m.links && (
                    <div className="flex flex-col gap-1.5">
                      {m.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className="rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-[var(--color-accent-tint)]"
                          style={{ borderColor: "var(--color-line)", color: "var(--color-action)" }}
                        >
                          {link.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}

            {messages.length === 0 && (
              <div className="flex flex-col gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => ask(prompt)}
                    className="rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-[var(--color-accent-tint)]"
                    style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2 border-t p-3"
            style={{ borderColor: "var(--color-line)" }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
            />
            <button
              type="submit"
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: "var(--color-action)" }}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
