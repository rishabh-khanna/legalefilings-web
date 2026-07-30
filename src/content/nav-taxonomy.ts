export type NavCategory = {
  label: string;
  slugs: string[];
};

// Mirrors the original site's nav grouping (verified against the WXR export).
export const NAV_CATEGORIES: NavCategory[] = [
  {
    label: "Start Business",
    slugs: [
      "private-limited-company",
      "one-person-company",
      "llp-registration-online",
      "section-8-company",
      "nidhi-company",
      "public-limited-company",
      "partnership-firm",
      "sole-properitorship",
    ],
  },
  {
    label: "Registrations",
    slugs: [
      "fssai-registration",
      "iec",
      "gst-registration",
      "ssi-msme",
      "12a-80g-registration",
      "trademark-registration",
      "iso-certification",
    ],
  },
  {
    label: "Company Compliances",
    slugs: [
      "annual-compliances-for-companies",
      "annual-filing-for-llp",
      "appointment-of-director",
      "change-company-name",
      "file-dir-3-kyc",
      "increased-authorized-capital",
      "pvt-ltd-winding-up",
      "register-office-change",
      "removal-of-director",
    ],
  },
  {
    label: "GST & Income Tax Returns",
    slugs: ["gst-filing", "gstr-9-annual-filing", "income-tax-return", "tds-return-filing"],
  },
];

export const UTILITY_SLUGS = [
  "contact",
  "career",
  "about-us",
  "privacy-policy",
  "thankyou-page",
  "terms-conditions",
  "refund-policy",
  "make-payment",
  "start-your-business",
  "blogs",
];
