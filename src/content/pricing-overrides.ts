import type { PricingPlan } from "@/lib/content";

// Hand-authored tiered pricing for the 4 company-registration pages,
// replacing whatever the WordPress-content parser produced for these
// slugs — sourced from the "Website Changes" pricing doc rather than the
// migrated WP content, which never had this Mandatory/Basic/Standard
// tier structure. Each tier is fully additive (Basic includes everything
// in Mandatory, Standard includes everything in Basic) per the source doc.
//
// Two Standard-tier prices (Section 8, Nidhi) weren't given a number in
// the source doc — inferred from the same ratio the doc's own priced
// tiers use (Standard ≈ 2x Basic, matching Private Limited's
// 4999→9999 jump) rather than left blank. Worth confirming with the
// actual current rate card before this goes live.

const MANDATORY_FEATURES_2DIR = [
  "DIN for 2 Directors",
  "DSC for 2 Directors",
  "Drafting of E-MoA & AoA",
  "Registration fees and stamp duty",
  "Company Incorporation Certificate",
  "Company PAN and TAN",
  "Zero Balance Current Account",
];

const BASIC_ADDONS = [
  "E-copies of Share Certificate",
  "INC 22 Filing",
  "GST Registration",
  "Commence of Business Filing",
  "SSI/MSME Registration",
];

const STANDARD_ADDONS = [
  "Trademark Registration",
  "Startup Registration",
  "ISO Certification",
  "Auditor Appointment (ADT-1)",
  "DIR 3 e-KYC of 2 Directors",
  "ROC Annual Return (AOC 4 & MGT 7)",
  "Income Tax Return Filing",
];

const PRIVATE_LIMITED_PLANS: PricingPlan[] = [
  { name: "Mandatory", description: "The essentials to legally incorporate.", price: "₹1,999", features: MANDATORY_FEATURES_2DIR },
  { name: "Basic", description: "Incorporation plus first-year compliance starters.", price: "₹4,999", features: [...MANDATORY_FEATURES_2DIR, ...BASIC_ADDONS] },
  { name: "Standard", description: "Full incorporation, registrations, and annual compliance.", price: "₹9,999", features: [...MANDATORY_FEATURES_2DIR, ...BASIC_ADDONS, ...STANDARD_ADDONS] },
];

const SECTION_8_PLANS: PricingPlan[] = [
  { name: "Mandatory", description: "The essentials to legally incorporate your Section 8 company.", price: "₹1,999", features: MANDATORY_FEATURES_2DIR },
  { name: "Basic", description: "Incorporation plus first-year compliance starters.", price: "₹4,999", features: [...MANDATORY_FEATURES_2DIR, ...BASIC_ADDONS] },
  { name: "Standard", description: "Full incorporation, registrations, and annual compliance.", price: "₹9,999", features: [...MANDATORY_FEATURES_2DIR, ...BASIC_ADDONS, ...STANDARD_ADDONS] },
];

const MANDATORY_FEATURES_NIDHI = [
  "DIN for three Directors",
  "DSC for seven Promoters",
  "Drafting of E-MoA & AoA",
  "Registration fees and stamp duty",
  "Company Incorporation Certificate",
  "Company PAN and TAN",
  "Zero Balance Current Account",
  "ESIC Registration",
];

const NIDHI_PLANS: PricingPlan[] = [
  { name: "Mandatory", description: "The essentials to legally incorporate your Nidhi company.", price: "₹1,999", features: MANDATORY_FEATURES_NIDHI },
  {
    name: "Basic",
    description: "Incorporation plus first-year compliance starters.",
    price: "₹5,999",
    features: [...MANDATORY_FEATURES_NIDHI, ...BASIC_ADDONS, "Filing of NDH Forms"],
  },
  {
    name: "Standard",
    description: "Full incorporation, registrations, and annual compliance.",
    price: "₹11,999",
    features: [
      ...MANDATORY_FEATURES_NIDHI,
      ...BASIC_ADDONS,
      "Filing of NDH Forms",
      "Trademark Registration",
      "ISO Certification",
      "Auditor Appointment (ADT-1)",
      "DIR 3 e-KYC of 2 Directors",
      "ROC Annual Return (AOC 4 & MGT 7)",
      "Income Tax Return Filing",
    ],
  },
];

const PUBLIC_LIMITED_PLANS: PricingPlan[] = [
  { name: "Mandatory", description: "The essentials to legally incorporate.", price: "₹6,999", features: MANDATORY_FEATURES_NIDHI },
  {
    name: "Basic",
    description: "Incorporation plus first-year compliance starters.",
    price: "₹9,999",
    features: [...MANDATORY_FEATURES_NIDHI, "E-copies of Share Certificate", "INC 22 Filing", "GST Registration", "Commence of Business Filing"],
  },
  {
    name: "Standard",
    description: "Full incorporation, registrations, and annual compliance.",
    price: "₹14,999",
    features: [...MANDATORY_FEATURES_NIDHI, ...BASIC_ADDONS, ...STANDARD_ADDONS],
  },
];

export const PRICING_OVERRIDES: Record<string, PricingPlan[]> = {
  "private-limited-company": PRIVATE_LIMITED_PLANS,
  "section-8-company": SECTION_8_PLANS,
  "nidhi-company": NIDHI_PLANS,
  "public-limited-company": PUBLIC_LIMITED_PLANS,
};
