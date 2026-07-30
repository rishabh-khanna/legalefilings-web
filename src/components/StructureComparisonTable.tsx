import Link from "next/link";
import { STRUCTURE_COMPARISON } from "@/content/structure-comparison";
import { SectionHeading } from "@/components/SectionHeading";

const COLUMNS = [
  { key: "liability", label: "Liability" },
  { key: "legalEntity", label: "Legal Entity" },
  { key: "governingLaw", label: "Governing Law" },
  { key: "registration", label: "Registration" },
  { key: "bestFor", label: "Best For" },
] as const;

export function StructureComparisonTable({ currentSlug }: { currentSlug: string }) {
  const current = STRUCTURE_COMPARISON.find((r) => r.slug === currentSlug);
  if (!current) return null;

  return (
    <section id="compare-structures" className="my-14 scroll-mt-nav">
      <p
        className="text-xs font-semibold uppercase tracking-[0.15em]"
        style={{ color: "var(--color-muted-dark)" }}
      >
        Compare
      </p>
      <SectionHeading wrapperClassName="mt-2">Compare Business Structures</SectionHeading>
      <p className="mt-1.5 text-sm" style={{ color: "var(--color-ink-soft)" }}>
        See how {current.name} compares to other ways to register a business in India.
      </p>
      <div
        className="mt-6 overflow-x-auto rounded-2xl border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.05)]"
        style={{ borderColor: "var(--color-line)" }}
      >
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3.5 font-semibold" style={{ color: "var(--color-ink)" }}>
                Structure
              </th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-4 py-3.5 font-semibold whitespace-nowrap" style={{ color: "var(--color-ink)" }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STRUCTURE_COMPARISON.map((row, idx) => {
              const active = row.slug === currentSlug;
              const zebra = idx % 2 === 1;
              return (
                <tr
                  key={row.slug}
                  className="border-t"
                  style={{
                    borderColor: "var(--color-line)",
                    backgroundColor: active ? "var(--color-action-tint)" : zebra ? "var(--color-paper)" : undefined,
                  }}
                >
                  <td className="px-4 py-3.5 font-medium whitespace-nowrap" style={{ color: "var(--color-ink)" }}>
                    {active ? (
                      row.name
                    ) : (
                      <Link href={`/services/${row.slug}`} className="hover:text-[var(--color-action)]">
                        {row.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3.5" style={{ color: "var(--color-ink-soft)" }}>
                    {row.liability}
                  </td>
                  <td className="px-4 py-3.5" style={{ color: "var(--color-ink-soft)" }}>
                    {row.legalEntity}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap" style={{ color: "var(--color-ink-soft)" }}>
                    {row.governingLaw}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap" style={{ color: "var(--color-ink-soft)" }}>
                    {row.registration}
                  </td>
                  <td className="px-4 py-3.5" style={{ color: "var(--color-ink-soft)" }}>
                    {row.bestFor}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
