import { Spinner } from "@/components/Spinner";

// Full-page wrapper around the shared Spinner — used for the very first
// session fetch (DashboardShell) and every route transition after that
// (dashboard/loading.tsx), just at a larger size than the inline usages
// elsewhere so it reads as a real "the whole page is loading" moment.
export function BrandSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-28">
      <Spinner size={64} />
      {label && (
        <p className="text-sm font-medium" style={{ color: "var(--color-ink-soft)" }}>
          {label}
        </p>
      )}
    </div>
  );
}
