// Three large, blurred, low-opacity brand-colored circles that drift
// slowly in place (see the ambient-orb-* keyframes in globals.css) —
// fixed behind all page content so every page has a faint sense of life
// to it instead of feeling static, without turning into a distraction.
// Pure CSS animation (no JS/rAF), and disabled entirely under
// prefers-reduced-motion.
export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="ambient-orb-a absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{ backgroundColor: "var(--color-accent)", opacity: 0.16 }}
      />
      <div
        className="ambient-orb-b absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full blur-3xl"
        style={{ backgroundColor: "var(--color-action)", opacity: 0.12 }}
      />
      <div
        className="ambient-orb-c absolute bottom-[-10rem] left-1/3 h-[26rem] w-[26rem] rounded-full blur-3xl"
        style={{ backgroundColor: "var(--color-accent)", opacity: 0.1 }}
      />
    </div>
  );
}
