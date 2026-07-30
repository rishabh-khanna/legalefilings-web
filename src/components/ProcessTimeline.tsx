import type { ProcessStep } from "@/lib/content";
import { SectionHeading } from "@/components/SectionHeading";

// A row of numbered step cards — referenced from doola.com's own process
// section (each stage gets its own card with a number badge, a short label,
// and a description), rather than a vertical timeline sitting inside a
// single bordered box.
export function ProcessTimeline({ title, steps }: { title: string | null; steps: ProcessStep[] }) {
  if (steps.length === 0) return null;

  return (
    <section id="process" className="my-14 scroll-mt-nav">
      <SectionHeading align="center" wrapperClassName="mb-10">
        {title ?? "How It Works"}
      </SectionHeading>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <div
            key={i}
            className="rounded-[24px] border bg-white dark:bg-[var(--color-paper-raised)] p-6"
            style={{ borderColor: "var(--color-line)" }}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold"
              style={{ backgroundColor: "var(--color-accent)", color: "var(--color-ink)" }}
            >
              {i + 1}
            </span>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-action-dark)" }}>
              {step.label}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--color-ink)" }}>
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
