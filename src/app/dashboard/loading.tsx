import { BrandSpinner } from "@/components/BrandSpinner";

// Next's route-segment Suspense boundary for everything under
// /dashboard — this is what shows on every sidebar click, not just the
// very first page load (that one's covered separately by DashboardShell,
// before a session even exists). The sidebar itself keeps rendering
// normally around this; only the content pane swaps to this fallback
// while the next page prepares.
export default function DashboardLoading() {
  return (
    <div>
      <div
        className="h-40 animate-pulse rounded-2xl"
        style={{ background: "linear-gradient(180deg, var(--color-accent-tint) 0%, var(--color-paper) 100%)" }}
      />
      <BrandSpinner label="Loading…" />
    </div>
  );
}
