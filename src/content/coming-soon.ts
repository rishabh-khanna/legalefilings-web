// The source doc listed these as bare section headers with no content
// under them (CRM SOFTWARE / INVOICE SOFTWARE / etc.) — placeholders per
// explicit instruction, not a guess at what they should contain.
export type ComingSoonProduct = {
  slug: string;
  name: string;
  tagline: string;
};

export const COMING_SOON_PRODUCTS: ComingSoonProduct[] = [
  { slug: "crm-software", name: "CRM Software", tagline: "Manage leads, clients, and follow-ups in one place." },
  { slug: "invoice-software", name: "Invoice Software", tagline: "Generate and send professional invoices in seconds." },
  { slug: "billing-software", name: "Billing Software", tagline: "Recurring billing and payment tracking for your business." },
  { slug: "daily-business-operations", name: "Daily Business Operations", tagline: "Run your day-to-day operations from a single dashboard." },
  { slug: "payment-software", name: "Payment Software", tagline: "Collect payments online with real-time reconciliation." },
];

export function getComingSoonProduct(slug: string): ComingSoonProduct | undefined {
  return COMING_SOON_PRODUCTS.find((p) => p.slug === slug);
}
