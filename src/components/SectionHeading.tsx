import { Reveal } from "@/components/Reveal";

// Shared section-title treatment: bold display type + a short accent bar,
// instead of a plain thin underline. Used everywhere a component owns its
// own heading (pricing, compare table, process timeline, "why choose us")
// so the style stays one definition, not copy-pasted per component — which
// also means the scroll-reveal here applies to every section on the site
// from this one place.
export function SectionHeading({
  children,
  align = "left",
  wrapperClassName = "",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
  /** Spacing (margins) for the whole heading+accent-bar unit — goes on the wrapper, not the text, so it can't get eaten by margin collapsing against the accent bar. */
  wrapperClassName?: string;
}) {
  const centered = align === "center";
  return (
    <Reveal className={`${centered ? "text-center " : ""}${wrapperClassName}`}>
      <h2
        className="text-3xl md:text-4xl font-extrabold tracking-tight"
        style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
      >
        {children}
      </h2>
      <span
        aria-hidden="true"
        className={`mt-2.5 block h-1 w-12 rounded-full ${centered ? "mx-auto" : ""}`}
        style={{ backgroundColor: "var(--color-accent)" }}
      />
    </Reveal>
  );
}
