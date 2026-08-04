"use client";

import { Quiz, type QuizQuestion, type QuizResult } from "@/components/Quiz";

// The business-structure quiz's own config — question/option text and the
// answers→recommendation logic — all rendering is handled by the generic
// <Quiz> engine now, so a second quiz elsewhere just needs its own config
// like this one, not a copy of the whole component.
const RECOMMENDATIONS: Record<string, QuizResult> = {
  "private-limited-company": {
    title: "Private Limited Company",
    description:
      "The standard structure for Indian startups raising venture capital or angel investment — issues shares, and gives investors the entity type they expect.",
    highlights: [
      "Can issue equity shares to investors",
      "Highest credibility with VCs, banks, and enterprise clients",
      "Complete limited liability for every promoter",
    ],
    ctaLabel: "See Private Limited Company pricing →",
    ctaHref: "/services/private-limited-company",
  },
  "one-person-company": {
    title: "One Person Company (OPC)",
    description: "Corporate limited liability with a single promoter in full control — no need to bring on a partner just to incorporate.",
    highlights: [
      "100% ownership and control for one founder",
      "Same limited liability protection as a Pvt Ltd",
      "Simpler compliance than a multi-director company",
    ],
    ctaLabel: "See One Person Company pricing →",
    ctaHref: "/services/one-person-company",
  },
  "llp-registration-online": {
    title: "Limited Liability Partnership (LLP)",
    description: "Built for multi-partner businesses that want limited liability without a Pvt Ltd's heavier annual compliance load.",
    highlights: [
      "Limited liability for every partner",
      "Lower annual compliance burden than a company",
      "Flexible partner roles and profit-sharing terms",
    ],
    ctaLabel: "See LLP pricing →",
    ctaHref: "/services/llp-registration-online",
  },
  "partnership-firm": {
    title: "Partnership Firm",
    description: "The simplest, cheapest way for a small founding team to start operating together — fastest to set up, lightest ongoing paperwork.",
    highlights: [
      "Fastest and least expensive to register",
      "Minimal ongoing compliance",
      "Good fit if limited liability isn't a priority yet",
    ],
    ctaLabel: "See Partnership Firm pricing →",
    ctaHref: "/services/partnership-firm",
  },
  "sole-properitorship": {
    title: "Sole Proprietorship",
    description: "The lightest possible structure for a single founder testing an idea or running a small operation — you and the business are legally the same.",
    highlights: [
      "Lowest cost and fastest to start",
      "Minimal ongoing filings",
      "Easy to upgrade to an OPC or Pvt Ltd later as you grow",
    ],
    ctaLabel: "See Sole Proprietorship pricing →",
    ctaHref: "/services/sole-properitorship",
  },
  "public-limited-company": {
    title: "Public Limited Company",
    description: "For larger ventures planning to raise capital from the public or list shares eventually — needs at least 7 shareholders and 3 directors.",
    highlights: [
      "Can raise capital from the public",
      "Shares are freely transferable",
      "Highest credibility for large-scale fundraising",
    ],
    ctaLabel: "See Public Limited Company pricing →",
    ctaHref: "/services/public-limited-company",
  },
  "section-8-company": {
    title: "Section 8 Company",
    description: "The standard structure for a nonprofit, NGO, or charitable venture in India — a legal entity built for a social or charitable purpose, not profit distribution.",
    highlights: [
      "Purpose-built for nonprofit and charitable work",
      "Eligible for 12A/80G tax exemptions once registered",
      "Limited liability for every member",
    ],
    ctaLabel: "See Section 8 Company pricing →",
    ctaHref: "/services/section-8-company",
  },
  "nidhi-company": {
    title: "Nidhi Company",
    description: "A mutual-benefit structure for a members-only savings and lending group — built specifically for communities that pool deposits and lend among themselves.",
    highlights: [
      "Purpose-built for member deposits and lending",
      "Regulated structure investors and members recognize",
      "Requires a minimum of 7 members and 3 directors to start",
    ],
    ctaLabel: "See Nidhi Company pricing →",
    ctaHref: "/services/nidhi-company",
  },
};

const QUESTIONS: QuizQuestion[] = [
  {
    id: "purpose",
    title: "What's this venture for?",
    options: [
      { value: "for_profit", label: "A For-Profit Business", description: "Selling a product or service, keeping the profits." },
      { value: "nonprofit", label: "Nonprofit / NGO / Charitable", description: "A social or charitable cause, not profit distribution." },
      { value: "mutual_benefit", label: "Members-Only Savings & Lending", description: "A community group pooling deposits and lending among members." },
    ],
  },
  {
    id: "owners",
    title: "How many owners or promoters are starting this business?",
    skip: (a) => a.purpose === "nonprofit" || a.purpose === "mutual_benefit",
    options: [
      { value: "one", label: "1 Founder (Sole Promoter)", description: "I'm operating sole ownership and management." },
      { value: "few", label: "2–6 Partners", description: "We're a founding team with shared ownership." },
      { value: "many", label: "7 or More", description: "A large founding group, or planning to raise from the public." },
    ],
  },
  {
    id: "funding",
    title: "What are your plans for capital and funding?",
    skip: (a) => a.purpose === "nonprofit" || a.purpose === "mutual_benefit",
    options: [
      { value: "vc", label: "Raising Investment (VC / Angels)", description: "We plan to issue shares and raise equity capital." },
      { value: "public", label: "Raising From the Public / Eventually Listing", description: "Planning a larger raise beyond private investors." },
      { value: "bootstrapped", label: "Bootstrapped / Self-Funded", description: "Operating through internal revenue and partner capital." },
    ],
  },
  {
    id: "compliance",
    title: "What level of compliance fits your team right now?",
    skip: (a) => a.purpose === "nonprofit" || a.purpose === "mutual_benefit",
    options: [
      { value: "max_protection", label: "Maximum Corporate Protection", description: "Highest credibility, separate legal entity, complete limited liability." },
      { value: "low_compliance", label: "Lower Operational Overhead", description: "Simplicity and cost first, fewer mandatory annual filings." },
    ],
  },
];

function getResult(answers: Record<string, string>): QuizResult | null {
  const { purpose, owners, funding, compliance } = answers;
  if (purpose === "nonprofit") return RECOMMENDATIONS["section-8-company"];
  if (purpose === "mutual_benefit") return RECOMMENDATIONS["nidhi-company"];

  if (funding === "public" || owners === "many") return RECOMMENDATIONS["public-limited-company"];
  if (funding === "vc") return RECOMMENDATIONS["private-limited-company"];

  if (owners === "one") {
    return compliance === "low_compliance" ? RECOMMENDATIONS["sole-properitorship"] : RECOMMENDATIONS["one-person-company"];
  }

  if (owners === "few") {
    return compliance === "low_compliance" ? RECOMMENDATIONS["partnership-firm"] : RECOMMENDATIONS["llp-registration-online"];
  }

  return null;
}

export function EntityFinderCard({ compact = false }: { compact?: boolean }) {
  return (
    <Quiz
      eyebrow="Not sure where to start?"
      title={
        <>
          Find your right <span className="text-gradient">business structure</span>
        </>
      }
      description="A few quick questions — get a straight recommendation, not a wall of legal jargon."
      questions={QUESTIONS}
      getResult={getResult}
      compact={compact}
    />
  );
}
