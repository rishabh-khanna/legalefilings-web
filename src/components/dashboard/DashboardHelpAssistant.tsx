"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HelpCircle, X, Send } from "lucide-react";
import { getDashboardAssistantReply, type DashboardAssistantReply } from "@/lib/dashboard-assistant-engine";

const SUGGESTED_PROMPTS = [
  "How do I approve leave?",
  "Where do I record an invoice payment?",
  "What's the difference between Order Invoices and Invoice CRM?",
  "How do I generate a payslip?",
];

type Message = { role: "user" | "assistant"; text: string; links?: DashboardAssistantReply["links"] };

// The dashboard's own help widget — separate from the public site's
// AiAssistant (which is deliberately excluded from /dashboard/* — see
// SiteChrome). Answers are matched against src/content/dashboard-manual.ts
// only (see dashboard-assistant-engine.ts): never a live model call, so
// it can never say something the manual doesn't actually say. Keeping the
// manual current is what keeps this current.
export function DashboardHelpAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const reply = getDashboardAssistantReply(question);
    setMessages((prev) => [...prev, { role: "user", text: question }, { role: "assistant", ...reply }]);
    setInput("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close help" : "Open help"}
        aria-expanded={open}
        className="fixed bottom-24 right-6 z-30 hidden h-13 w-13 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 sm:flex"
        style={{ backgroundColor: "var(--color-ink-fixed)", height: 52, width: 52 }}
      >
        {open ? <X className="h-5 w-5" style={{ color: "#fff" }} /> : <HelpCircle className="h-6 w-6" style={{ color: "#fff" }} />}
      </button>

      {open && (
        <div
          className="fixed bottom-40 right-6 z-30 hidden w-96 overflow-hidden rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)] shadow-2xl sm:block"
          style={{ borderColor: "var(--color-line)" }}
        >
          <div className="flex items-center gap-3 p-4" style={{ backgroundColor: "var(--color-ink-fixed)" }}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "var(--color-accent)" }}>
              <HelpCircle className="h-5 w-5" style={{ color: "var(--color-ink)" }} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Help</p>
              <p className="truncate text-xs text-white/60">Ask what a page is for, or how to do something</p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                Reset
              </button>
            )}
          </div>

          <div ref={scrollRef} className="max-h-96 space-y-3 overflow-y-auto p-4">
            <div
              className="rounded-lg rounded-tl-none p-3 text-sm leading-relaxed"
              style={{ backgroundColor: "var(--color-paper)", color: "var(--color-ink)" }}
            >
              👋 Ask me about any page or feature in the dashboard — I&apos;ll answer from the same manual as the &quot;?&quot; button on each page.
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
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
