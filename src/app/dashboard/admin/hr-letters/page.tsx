"use client";

import { useState } from "react";
import { HR_LETTER_TEMPLATES, getLetterTemplate } from "@/content/hr-letter-templates";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";

export default function HrLettersPage() {
  const [templateSlug, setTemplateSlug] = useState(HR_LETTER_TEMPLATES[0].slug);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();

  const template = getLetterTemplate(templateSlug)!;

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    const res = await fetch("/api/hr-letters/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateSlug, fields }),
    });
    setGenerating(false);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.name.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("Letter generated and downloaded.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to generate letter.");
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-xs font-medium mb-1";

  return (
    <div>
      <DashboardPageHero title="HR Letter Generator" subtitle="Pick a template, fill in the employee details, generate a PDF instantly." />

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {HR_LETTER_TEMPLATES.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => {
              setTemplateSlug(t.slug);
              setFields({});
            }}
            className="rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors"
            style={
              templateSlug === t.slug
                ? { backgroundColor: "var(--color-action)", borderColor: "var(--color-action)", color: "#fff" }
                : { borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }
            }
          >
            {t.name}
          </button>
        ))}
      </div>

      <form onSubmit={handleGenerate} className="mt-5 rounded-2xl border bg-white p-6 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {template.fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : undefined}>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>{f.label}</label>
              {f.type === "textarea" ? (
                <textarea
                  required
                  rows={3}
                  value={fields[f.key] ?? ""}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "var(--color-line)" }}
                />
              ) : (
                <input
                  required
                  type={f.type}
                  value={fields[f.key] ?? ""}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  className={inputClass}
                  style={{ borderColor: "var(--color-line)" }}
                />
              )}
            </div>
          ))}
        </div>
        <button
          type="submit"
          disabled={generating}
          className="mt-4 rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          {generating ? "Generating…" : "Generate PDF"}
        </button>
      </form>
    </div>
  );
}
