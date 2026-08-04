"use client";

import { useState } from "react";
import Link from "next/link";
import { GlowBadge } from "@/components/CategoryIcons";

// A fully generic, config-driven multi-step quiz — the step tracker,
// question/option rendering, back button, and result card are all built
// once here; a caller just supplies its own questions + a function that
// turns answers into a result. EntityFinderCard (business-structure quiz)
// is the first consumer; a second quiz (e.g. "which software plan fits
// you") can reuse this without touching any of this file.
export type QuizOption = { value: string; label: string; description?: string };

export type QuizQuestion = {
  id: string;
  title: string;
  options: QuizOption[];
  /** Skip this question for the answers gathered so far — e.g. a "purpose" answer of "nonprofit" might skip funding/compliance questions that don't apply to it. */
  skip?: (answers: Record<string, string>) => boolean;
};

export type QuizResult = {
  title: string;
  description: string;
  highlights: string[];
  ctaLabel: string;
  ctaHref: string;
};

export function Quiz({
  eyebrow,
  title,
  description,
  questions,
  getResult,
  compact = false,
  resultEyebrow = "Our recommendation",
  resetLabel = "Start over",
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  questions: QuizQuestion[];
  getResult: (answers: Record<string, string>) => QuizResult | null;
  compact?: boolean;
  resultEyebrow?: string;
  resetLabel?: string;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);

  const activeQuestions = (currentAnswers: Record<string, string>) => questions.filter((q) => !q.skip?.(currentAnswers));

  function choose(questionId: string, value: string) {
    const nextAnswers = { ...answers, [questionId]: value };
    setAnswers(nextAnswers);
    const list = activeQuestions(nextAnswers);
    const currentPos = list.findIndex((q) => q.id === questionId);
    setTimeout(() => {
      if (currentPos < list.length - 1) {
        setStep(currentPos + 1);
      } else {
        setShowResult(true);
      }
    }, 220);
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function reset() {
    setAnswers({});
    setStep(0);
    setShowResult(false);
  }

  const visibleQuestions = activeQuestions(answers);
  const activeQuestion = visibleQuestions[step];
  const result = showResult ? getResult(answers) : null;

  return (
    <>
      <p className="text-center text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--color-muted-dark)" }}>
        {eyebrow}
      </p>
      <h2
        className={`mt-2 text-center font-extrabold tracking-tight ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`}
        style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
        {description}
      </p>

      <div
        className={`mt-8 rounded-[28px] border bg-white dark:bg-[var(--color-paper-raised)] ${compact ? "p-5 sm:p-7" : "p-6 sm:p-9"}`}
        style={{ borderColor: "var(--color-line)", boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 20px 40px rgba(15,23,42,0.06)" }}
      >
        {!showResult && activeQuestion ? (
          <>
            <div className="flex items-center justify-center gap-3">
              {visibleQuestions.map((q, i) => {
                const isDone = answers[q.id] !== undefined && step !== i;
                const isActive = step === i;
                return (
                  <div key={q.id} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors"
                      style={
                        isDone
                          ? { backgroundColor: "var(--color-ink-fixed)", color: "#fff" }
                          : isActive
                            ? { backgroundColor: "var(--color-accent)", color: "var(--color-ink-fixed)", boxShadow: "0 0 0 4px var(--color-accent-tint)" }
                            : { backgroundColor: "var(--color-paper)", color: "var(--color-ink-soft)", border: "2px solid var(--color-line)" }
                      }
                    >
                      {isDone ? (
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="m4 10.5 3.5 3.5L16 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    {i < visibleQuestions.length - 1 && <span className="h-0.5 w-8" style={{ backgroundColor: "var(--color-line)" }} />}
                  </div>
                );
              })}
            </div>

            <div className="mt-8">
              <p className="text-lg font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
                {activeQuestion.title}
              </p>
              <div className={`mt-5 grid gap-4 ${activeQuestion.options.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                {activeQuestion.options.map((opt) => {
                  const selected = answers[activeQuestion.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => choose(activeQuestion.id, opt.value)}
                      className="rounded-2xl border-2 p-5 text-left transition-all hover:-translate-y-0.5"
                      style={
                        selected
                          ? { borderColor: "var(--color-accent)", backgroundColor: "var(--color-accent)", boxShadow: "0 4px 12px rgba(253,197,0,0.25)" }
                          : { borderColor: "var(--color-line)", backgroundColor: "var(--color-paper)" }
                      }
                    >
                      <p className="font-bold leading-snug" style={{ color: "var(--color-ink)" }}>{opt.label}</p>
                      {opt.description && (
                        <p className="mt-1.5 text-sm leading-relaxed" style={{ color: selected ? "var(--color-ink)" : "var(--color-ink-soft)" }}>
                          {opt.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {step > 0 && (
              <button type="button" onClick={goBack} className="mt-6 text-sm font-medium" style={{ color: "var(--color-ink-soft)" }}>
                ← Back
              </button>
            )}
          </>
        ) : (
          result && (
            <div className="border-t pt-7" style={{ borderColor: "var(--color-accent)" }}>
              <div className="flex items-center gap-3">
                <GlowBadge
                  size={48}
                  icon={
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M4 20V10M11 20V4M18 20v-7" strokeLinecap="round" />
                    </svg>
                  }
                />
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }}
                >
                  {resultEyebrow}
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
                {result.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
                {result.description}
              </p>
              <ul className="mt-5 space-y-2.5">
                {result.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--color-ink)" }}>
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-[18px] w-[18px] shrink-0" fill="none" stroke="var(--color-action)" strokeWidth="2">
                      <circle cx="10" cy="10" r="8.5" />
                      <path d="m6.5 10.5 2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {h}
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={result.ctaHref}
                  className="flex-1 rounded-full py-3 text-center text-sm font-semibold text-white transition-transform hover:scale-[1.02] sm:flex-none sm:px-8"
                  style={{ backgroundColor: "var(--color-ink-fixed)" }}
                >
                  {result.ctaLabel}
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
                  style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                >
                  {resetLabel}
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </>
  );
}
