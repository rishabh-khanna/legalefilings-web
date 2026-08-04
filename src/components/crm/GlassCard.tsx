"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

// The shared "premium" card shell for the CRM redesign — soft blur, a
// hairline border, gentle rise on hover, fades/slides in on mount. Every
// dashboard/pipeline/table card in the redesign wraps this instead of a
// plain bordered div so the whole surface reads as one consistent system.
export function GlassCard({
  children,
  className = "",
  hover = true,
  delay = 0,
  ...props
}: HTMLMotionProps<"div"> & { hover?: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      whileHover={hover ? { y: -3 } : undefined}
      className={`rounded-2xl border backdrop-blur-xl dark:bg-[var(--color-paper-raised)]/80 ${className}`}
      style={{
        backgroundColor: "rgba(255,255,255,0.78)",
        borderColor: "var(--color-line)",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
