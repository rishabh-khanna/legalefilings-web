import Link from "next/link";
import { RefundIllustration } from "@/components/RefundIllustration";

// Referenced from doola.com's own pricing-page banner: a hand-drawn
// illustration, a bold promise, and one line of explanation on a soft
// tinted panel — including their choice of a blue panel specifically,
// which reads calmer/more "trust" than our usual brand yellow and suits a
// guarantee callout well as a deliberate one-off accent. Copy reflects our
// actual refund-policy terms (refund after internal review if we're at
// fault) rather than doola's "no questions asked" wording, which isn't
// true of our policy.
export function MoneyBackBanner() {
  return (
    <div
      className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-2xl p-7 text-center sm:flex-row sm:text-left"
      style={{ backgroundColor: "#dde5fb" }}
    >
      <RefundIllustration className="h-28 w-36 shrink-0" />
      <div>
        <h3 className="text-lg font-extrabold" style={{ color: "#1c2b6b", fontFamily: "var(--font-display)" }}>
          Backed by Our Refund Policy.
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "#33437f" }}>
          If we fail to deliver a service from our end, we&apos;ll refund it after a quick internal review.{" "}
          <Link href="/refund-policy" className="font-medium underline underline-offset-2">
            Read our refund policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
