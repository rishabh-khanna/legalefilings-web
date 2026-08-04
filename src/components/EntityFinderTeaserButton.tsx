"use client";

import { openEntityFinderModal } from "@/lib/entity-finder-modal";

export function EntityFinderTeaserButton({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={() => openEntityFinderModal()} className={className} style={style}>
      {children}
    </button>
  );
}
