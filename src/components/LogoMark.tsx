// The square "LEGAL" badge cropped from the real logo (same art used for
// the browser-tab favicon) — used wherever a compact, square brand mark is
// needed, like a floating widget's avatar, where the full wide wordmark
// logo wouldn't fit.
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/logo-mark.png"
      alt="Legal Efilings"
      width={137}
      height={137}
      className={`rounded-full object-cover ${className}`}
    />
  );
}
