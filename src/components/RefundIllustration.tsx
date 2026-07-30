// A hand-drawn-style doodle — referenced from doola.com's own money-back
// banner illustration (a hand releasing a money bag), redrawn from scratch
// in our own line style rather than reusing their artwork: a cuffed hand
// holds a money bag by a loop of string, with a looping "return" arrow
// suggesting the refund coming back. Single-color blue line art, deliberately
// a little uneven (varied stroke widths, a slight tilt) for a sketched feel
// rather than a slick vector-perfect icon.
export function RefundIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 140"
      className={className}
      fill="none"
      stroke="#2b4fd8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* cuffed hand, palm down, fingers loosely curled around the string */}
      <g strokeWidth="2.5">
        <path d="M18 28c-2 6-2 13 2 18 3 4 8 6 13 6h9" />
        <path d="M20 30c9-9 22-11 33-6" />
        <path d="M24 24c7-2 15-1 21 3" />
        <path d="M30 20c5-1 10 0 14 2" />
        <path d="M14 46c-3 3-4 8-2 12 2 5 7 8 12 8h6" />
      </g>

      {/* the string / ribbon the bag hangs from */}
      <path d="M64 52c6 6 6 14 0 20" strokeWidth="2" strokeDasharray="1 5" />

      {/* money bag */}
      <g strokeWidth="2.5">
        <path d="M50 74c-6 0-11 5-12 12l-3 18c-1 8 5 14 13 14h24c8 0 14-6 13-14l-3-18c-1-7-6-12-12-12Z" />
        <path d="M56 74c0-6 3-10 8-10s8 4 8 10" />
        <path d="M62 96v14" strokeWidth="2" />
        <path d="M58 100c1-2 3-3 6-3s5 1 6 3c1 2-1 4-6 4s-7 2-6 4c1 2 3 3 6 3s5-1 6-3" strokeWidth="2" />
      </g>

      {/* looping "return" arrow — the refund coming back around */}
      <g strokeWidth="2.25">
        <path d="M112 40c18-6 34 4 36 20 2 14-8 26-22 28" />
        <path d="M118 78l8 12 12-7" />
      </g>

      {/* a couple of loose sparkle marks for texture */}
      <g strokeWidth="2">
        <path d="M134 30v8M130 34h8" />
        <path d="M150 100v6M147 103h6" />
      </g>
    </svg>
  );
}
