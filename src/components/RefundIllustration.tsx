import { ShieldCheck } from "lucide-react";

// A clean, single well-tested icon rather than a hand-drawn illustration
// — the previous version (a multi-stroke sketched hand holding a money
// bag, with a separate looping return-arrow) packed too many overlapping
// curved strokes into a small area, so at the banner's actual display
// size the hand read as a big blobby mass while the money bag underneath
// looked like a separate, much smaller icon — two mismatched pieces
// instead of one balanced mark. A single icon in a tinted circle (same
// pattern already used for every sidebar nav icon) sidesteps that
// entirely — nothing here can render out of proportion with itself.
export function RefundIllustration({ className = "" }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full ${className}`} style={{ backgroundColor: "#dbe7ff" }}>
      <ShieldCheck className="h-[46%] w-[46%]" style={{ color: "#1b4ba4" }} strokeWidth={1.75} />
    </span>
  );
}
