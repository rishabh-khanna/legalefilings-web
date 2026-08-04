import { TESTIMONIALS } from "@/content/testimonials";
import { SectionHeading } from "@/components/SectionHeading";

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill={filled ? "#f5b400" : "none"} stroke={filled ? "#f5b400" : "var(--color-line)"} strokeWidth="1.5">
      <path d="M12 2.5l2.9 6.6 7.1.7-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.8l7.1-.7L12 2.5Z" strokeLinejoin="round" />
    </svg>
  );
}

// Two real, verifiable customer quotes (see src/content/testimonials.ts
// for provenance) — deliberately just two rather than padded out with
// invented ones to look fuller.
export function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <SectionHeading align="center" wrapperClassName="mb-10">
        What our <span className="text-gradient">clients say</span>
      </SectionHeading>
      <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
        {TESTIMONIALS.map((t) => (
          <div
            key={t.name}
            className="rounded-2xl border bg-white p-6 dark:bg-[var(--color-paper-raised)]"
            style={{ borderColor: "var(--color-line)" }}
          >
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} filled={i < t.rating} />
              ))}
            </div>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-ink)" }}>
              &ldquo;{t.quote}&rdquo;
            </p>
            <p className="mt-4 text-sm font-bold" style={{ color: "var(--color-ink)" }}>
              {t.name}
            </p>
            <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
              {t.role}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
