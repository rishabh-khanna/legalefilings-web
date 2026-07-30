// Generic, verifiable facts about Indian business structures under the
// Companies Act 2013 / LLP Act 2008 / Indian Partnership Act 1932 — not
// pulled from any competitor site and not a claim about LegalEfilings itself.
export type StructureComparisonRow = {
  slug: string;
  name: string;
  liability: string;
  legalEntity: string;
  governingLaw: string;
  registration: string;
  bestFor: string;
};

export const STRUCTURE_COMPARISON: StructureComparisonRow[] = [
  {
    slug: "private-limited-company",
    name: "Private Limited Company",
    liability: "Limited to shares held",
    legalEntity: "Separate legal entity",
    governingLaw: "Companies Act, 2013",
    registration: "Mandatory (MCA)",
    bestFor: "Startups raising outside funding",
  },
  {
    slug: "one-person-company",
    name: "One Person Company",
    liability: "Limited to shares held",
    legalEntity: "Separate legal entity",
    governingLaw: "Companies Act, 2013",
    registration: "Mandatory (MCA)",
    bestFor: "Solo founders wanting limited liability",
  },
  {
    slug: "llp-registration-online",
    name: "LLP",
    liability: "Limited to contribution",
    legalEntity: "Separate legal entity",
    governingLaw: "LLP Act, 2008",
    registration: "Mandatory (MCA)",
    bestFor: "Professionals & service businesses",
  },
  {
    slug: "section-8-company",
    name: "Section 8 Company",
    liability: "Limited to shares held",
    legalEntity: "Separate legal entity",
    governingLaw: "Companies Act, 2013 (Sec. 8)",
    registration: "Mandatory (MCA + license)",
    bestFor: "Non-profits & NGOs",
  },
  {
    slug: "nidhi-company",
    name: "Nidhi Company",
    liability: "Limited to shares held",
    legalEntity: "Separate legal entity",
    governingLaw: "Companies Act, 2013 + Nidhi Rules",
    registration: "Mandatory (MCA)",
    bestFor: "Member-only savings & lending",
  },
  {
    slug: "public-limited-company",
    name: "Public Limited Company",
    liability: "Limited to shares held",
    legalEntity: "Separate legal entity",
    governingLaw: "Companies Act, 2013",
    registration: "Mandatory (MCA)",
    bestFor: "Larger businesses planning to raise public capital",
  },
  {
    slug: "partnership-firm",
    name: "Partnership Firm",
    liability: "Unlimited",
    legalEntity: "No separate legal entity",
    governingLaw: "Indian Partnership Act, 1932",
    registration: "Optional",
    bestFor: "Small, trust-based businesses",
  },
  {
    slug: "sole-properitorship",
    name: "Sole Proprietorship",
    liability: "Unlimited",
    legalEntity: "No separate legal entity",
    governingLaw: "No dedicated statute (GST/MSME registration)",
    registration: "Minimal / optional",
    bestFor: "Single-owner small businesses & freelancers",
  },
];
