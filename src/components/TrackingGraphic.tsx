// CTA-band illustration — a radial progress gauge, visualizing real-time
// application tracking (a feature actually listed on the homepage
// checklist). Deliberately a single circular focal composition, so it
// doesn't read as the hero's hub-and-spoke network repeated.
export function TrackingGraphic({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const progress = 0.72;

  return (
    <svg viewBox="0 0 480 340" preserveAspectRatio="xMidYMid slice" className={className} style={style} aria-hidden="true">
      <defs>
        <filter id="tg-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="20" />
        </filter>
      </defs>

      <circle cx="90" cy="70" r="80" fill="#ffffff" opacity="0.1" filter="url(#tg-glow)" />
      <circle cx="400" cy="270" r="90" fill="#ffffff" opacity="0.1" filter="url(#tg-glow)" />

      <g transform="translate(240,158)">
        <circle r={radius} fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="14" />
        <circle
          r={radius}
          fill="none"
          stroke="#ffffff"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${circumference * progress} ${circumference}`}
          transform="rotate(-90)"
        />
        <circle r="62" fill="#ffffff" fillOpacity="0.97" />
        <path d="M-14 -18h22l8 8v28h-30Z" fill="none" stroke="currentColor" strokeWidth="2.25" opacity="0.45" strokeLinejoin="round" />
        <path d="m-6 4 5 5 11-13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="translate(2,0)" />
        <text y="46" textAnchor="middle" fontSize="15" fontWeight="800" fill="currentColor" opacity="0.8">72%</text>
      </g>

      <text x="240" y="284" textAnchor="middle" fontSize="14" fontWeight="700" fill="#ffffff">Application in progress</text>
      <text x="240" y="306" textAnchor="middle" fontSize="12" fill="#ffffff" opacity="0.7">Real-time status, every step</text>

      <circle cx="70" cy="260" r="3.5" fill="#ffffff" opacity="0.4" />
      <circle cx="420" cy="80" r="3" fill="#ffffff" opacity="0.35" />
      <circle cx="390" cy="180" r="3" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}
