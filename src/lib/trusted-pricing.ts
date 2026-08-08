import { getPage, getServiceContent, getServiceSlugs, type PricingPlan } from "@/lib/content";
import { PRICING_OVERRIDES } from "@/content/pricing-overrides";

// ₹1,999 / ₹4,999+ / ₹4,999 per month → 1999 / 4999 / 4999 — same parser
// PaymentModal.tsx uses to turn a displayed price string into a number;
// kept identical here so what the resolver computes always matches what
// the pricing card actually showed the customer.
function parsePrice(price: string): number {
  const digits = price.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

// The public checkout flow (src/app/api/payments/checkout/route.ts)
// receives a service name + plan name from the browser, but MUST NOT
// trust the price that comes along with them — a client-supplied price
// is trivially forgeable (POST any number you like). This looks the
// price up itself, server-side, from the exact same content the pricing
// pages render from, so the price a customer sees is always the price
// they're actually charged, with nothing duplicated to fall out of sync.
//
// Returns null if the service/plan pair can't be matched to a real
// pricing card — the caller should refuse checkout rather than guess.
export function resolveTrustedPrice(serviceTitle: string, planName: string): number | null {
  // Collapses the small, easy-to-introduce divergences between a service/
  // plan name as authored in content and the same name as hardcoded in a
  // caller (checkout, PaymentModal): curly vs straight quotes, en/em vs
  // hyphen, and irregular internal whitespace all used to make an
  // otherwise-identical name fail this exact match — silently blocking
  // checkout for that plan until the fragility was noticed and traced by
  // hand, rather than failing loudly at the point something changed.
  const normalize = (s: string) =>
    s
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-");
  const targetService = normalize(serviceTitle);
  const targetPlan = normalize(planName);

  for (const slug of getServiceSlugs()) {
    const page = getPage(slug);
    if (!page || normalize(page.title) !== targetService) continue;

    const { plans: parsedPlans } = getServiceContent(page);
    const plans: PricingPlan[] = PRICING_OVERRIDES[slug] ?? parsedPlans;
    const match = plans.find((p) => normalize(p.name) === targetPlan);
    if (match) return parsePrice(match.price);
  }

  return null;
}
