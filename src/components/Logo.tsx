// The real Legal Efilings logo (yellow "LEGAL" badge + black "EFILINGS"
// wordmark), as provided by the client — used as an actual image asset
// rather than recreated in code, so it's pixel-identical to the real brand
// mark wherever it appears.
export function Logo({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/logo.png"
      alt="Legal Efilings"
      width={265}
      height={49}
      className={`h-8 w-auto ${className}`}
    />
  );
}
