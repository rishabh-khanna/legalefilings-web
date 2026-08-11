"use client";

import type { CSSProperties } from "react";
import { Tooltip } from "@/components/Tooltip";

// Drop-in for any table cell whose value can run long — a free-text
// reason, a rejection note, an error message. Single line, ellipsis, full
// text on hover instead of the cell wrapping onto 2–3 lines, which blows
// out every row's height around it whether that row needed the room or
// not — a table of mostly-short reasons with one long one used to have
// every single row stretched to match the tallest.
export function TruncatedText({
  text,
  italic,
  className = "",
  style,
}: {
  text: string;
  italic?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Tooltip content={text} className="block w-full">
      <span className={`block truncate ${italic ? "italic" : ""} ${className}`.trim()} style={style}>
        {text}
      </span>
    </Tooltip>
  );
}
