// Flat-fee items from the "Legal Efilings — Helping Startups" brochure —
// mostly one-off registrations, licenses, and ROC filings that don't have
// a dedicated service page with its own 3-tier pricing (unlike company
// incorporation). Rendered as a plain fee list on /pricing rather than
// forced into the PricingPlan card format, since these are single flat
// fees, not multi-tier plans.
export type FeeItem = {
  name: string;
  price: string;
  note?: string;
};

export type FeeCategory = {
  title: string;
  items: FeeItem[];
};

export const FEE_SCHEDULE: FeeCategory[] = [
  {
    title: "Business Registration & Incorporation",
    items: [
      { name: "Private Limited Company", price: "₹7,500", note: "Including Govt. fees for upto 1 Lakh Capital (Except Punjab & MP)" },
      { name: "Limited Company", price: "₹7,500", note: "Including Govt. fees for upto 1 Lakh Capital (Except Punjab & MP)" },
      { name: "One Person Company (OPC)", price: "₹7,500", note: "Including Govt. fees for upto 1 Lakh Capital (Except Punjab & MP)" },
      { name: "Limited Liability Partnership (LLP)", price: "₹6,000", note: "Including Govt. fees for upto 1 Lakh Capital (Except Punjab & MP)" },
      { name: "Partnership Firm", price: "₹2,000", note: "Including Stamp Duty as Actual" },
      { name: "Producer Company", price: "₹25,000", note: "Includes Professional & Digital Signature Fees, Government fees to be paid as actual" },
      { name: "Nidhi Company", price: "₹15,000", note: "Includes Professional & Digital Signature Fees, Government fees to be paid as actual" },
      { name: "Professional & Digital Signature Fees", price: "As actual" },
      { name: "Subsidiary Company", price: "₹8,000", note: "Including Govt. fees for upto 1 Lakh Capital (Except Punjab & MP)" },
      { name: "Foreign Company", price: "₹15,000", note: "Including Govt. fees for upto 1 Lakh Capital (Except Punjab & MP)" },
    ],
  },
  {
    title: "Section-8 Company / NGO / Society Registrations",
    items: [
      { name: "Section-8 Company", price: "₹7,500", note: "Including Govt. fees for upto 1 Lakh Capital (Except Punjab & MP)" },
      { name: "NGO Society Registration", price: "₹5,000", note: "Including Govt. & Stamp Duty" },
      { name: "Trust Registration", price: "₹6,000", note: "Including Govt. & Stamp Duty" },
    ],
  },
  {
    title: "RWA / Co-operative / Association Registrations",
    items: [
      { name: "RWA Registration", price: "₹5,000", note: "Including Govt. & Stamp Duty" },
      { name: "12A Registration", price: "₹3,000", note: "Including Govt. & Stamp Duty" },
      { name: "80G Registration", price: "₹3,000", note: "Including Govt. & Stamp Duty" },
      { name: "FCRA Registration", price: "₹14,000", note: "Including Govt. & Stamp Duty" },
      { name: "Niti Aayog Registration", price: "₹1,000", note: "Including Govt. & Stamp Duty" },
    ],
  },
  {
    title: "Additional Registrations",
    items: [
      { name: "CSR-1 Registration", price: "₹3,500", note: "Including Govt. & Stamp Duty" },
      { name: "Darsarpan Registration", price: "₹1,000", note: "Including Govt. & Stamp Duty" },
      { name: "Licenses NGO Services Fees", price: "As per requirement" },
      { name: "GST Registration", price: "₹1,000", note: "Including Govt. & Stamp Duty" },
      { name: "Tan Registration", price: "₹500", note: "Including Govt. & Stamp Duty" },
      { name: "Pan Registration", price: "₹500", note: "Including Govt. & Stamp Duty" },
      { name: "FSSAI Registration (Upto 5 Years)", price: "₹1,400", note: "Government fees to be paid as actual" },
      { name: "FSSAI State License — Trading", price: "₹2,000", note: "Government fees to be paid as actual" },
      { name: "FSSAI State License — Mfg/Repak", price: "₹2,000", note: "Government fees to be paid as actual" },
      { name: "FSSAI Central License", price: "₹4,000", note: "Government fees to be paid as actual" },
      { name: "PF Registration", price: "₹2,500", note: "Including Govt. & Stamp Duty" },
      { name: "ESI Registration", price: "₹2,500", note: "Including Govt. & Stamp Duty" },
      { name: "Import Export Code (IEC)", price: "₹1,500", note: "Including Govt. & Stamp Duty" },
      { name: "Udyam (MSME) Registration", price: "₹500", note: "Including Govt. & Stamp Duty" },
      { name: "GST Registration (Additional)", price: "₹1,000", note: "Including Govt. & Stamp Duty" },
      { name: "Tan Registration (Additional)", price: "₹500", note: "Including Govt. & Stamp Duty" },
      { name: "Pan Registration (Additional)", price: "₹500", note: "Including Govt. & Stamp Duty" },
      { name: "FSSAI Registration (Upto 5 Years) — Additional", price: "₹1,400", note: "Government fees to be paid as actual" },
    ],
  },
  {
    title: "ROC & Company Compliance Services",
    items: [
      { name: "Unlisted Private Limited Company ROC Compliance", price: "₹5,000", note: "AOC-4, MGT-7A, DIN Web KYC, MSME and DPT-3, ADT-1 — Govt. fees to be paid as actual" },
      { name: "Unlisted LLP Annual Filing", price: "₹4,000", note: "Form 8 & Form 11 — Govt. fees to be paid as actual" },
      { name: "OPC ROC Compliance", price: "₹5,000", note: "AOC-4, MGT-7A, DIN Web KYC, MSME and DPT-3, ADT-1 — Govt. fees to be paid as actual" },
      { name: "Section-8 Company ROC Compliance", price: "₹8,000", note: "AOC-4, MGT-7A, DIN Web KYC, MSME and DPT-3, ADT-1 — Govt. fees to be paid as actual" },
      { name: "Schedule-III Balance Sheet", price: "₹5,000", note: "Professional Fees" },
      { name: "Business Accounting — Online", price: "₹2,500", note: "Per Month" },
      { name: "Business Accounting — Offline (Delhi & NCR)", price: "₹2,500", note: "Per Month" },
      { name: "Business Accounting — Offline (Delhi & NCR Plus)", price: "₹3,000", note: "Per Month + ₹1,500/day for site visit" },
      { name: "NGO Accounting — Online", price: "₹1,000", note: "Per Month" },
      { name: "NGO Accounting — Offline (Delhi & NCR)", price: "₹5,000", note: "Per Month" },
      { name: "NGO Accounting — Offline (Delhi & NCR Plus)", price: "₹2,500", note: "Per Month + ₹1,500/day for site visit" },
      { name: "GST Audit (Turnover ₹5 Cr–10 Cr)", price: "₹15,000" },
      { name: "GST Audit (Turnover ₹10 Cr–15 Cr)", price: "₹20,000" },
      { name: "GST Audit (Turnover ₹15 Cr–25 Cr)", price: "₹20,000" },
      { name: "GST Audit (Turnover ₹25 Cr–50 Cr)", price: "₹25,000" },
      { name: "GST Audit (Turnover > ₹50 Cr)", price: "₹50,000" },
      { name: "Annual Return (FSSAI)", price: "₹3,000", note: "Government fees to be paid as actual" },
      { name: "FCRA Return", price: "₹5,000", note: "Government fees to be paid as actual" },
    ],
  },
  {
    title: "Director & Other Compliance Services",
    items: [
      { name: "INC-20A (Commencement of Business)", price: "₹1,000", note: "Govt. fees to be paid as actual" },
      { name: "Addition of Director", price: "₹1,000", note: "Govt. fees to be paid as actual" },
      { name: "Resignation of Director", price: "₹1,000", note: "Govt. fees to be paid as actual" },
      { name: "Auditor Appointment", price: "₹1,000", note: "Govt. fees to be paid as actual" },
      { name: "Auditor Resignation", price: "₹1,000", note: "Govt. fees to be paid as actual" },
    ],
  },
  {
    title: "Other Services",
    items: [
      { name: "Section-8 Annual Filing", price: "₹6,000", note: "+ Govt. fees as actual" },
      { name: "LLP Annual Filing", price: "₹4,000", note: "+ Govt. fees as actual" },
      { name: "Conversion of Partnership to LLP", price: "₹8,000", note: "+ Govt. fees as actual" },
      { name: "Share Transfer Certificate", price: "₹1,000", note: "+ Govt. fees as actual" },
      { name: "Share Certificate / Authorised Share Capital Increase", price: "₹4,000", note: "+ Govt. fees as actual" },
      { name: "Paid-up Share Capital Increase", price: "₹4,000", note: "+ Govt. fees as actual" },
      { name: "GST Refund Filing (upto 25 Lakhs)", price: "₹5,000", note: "+ Govt. fees as actual" },
      { name: "GST Refund Filing (> 25 Lakh)", price: "1% of refund amount", note: "All Inclusive" },
      { name: "Winding-up of Company", price: "₹15,000", note: "+ Govt. fees as actual" },
      { name: "DIN-KYC Form", price: "₹1,000", note: "+ Govt. fees as actual" },
      { name: "DPT-3", price: "₹2,500", note: "+ Govt. fees as actual" },
      { name: "MSME Form", price: "₹1,500", note: "+ Govt. fees as actual" },
      { name: "Shifting of Registered Office within State", price: "₹2,000", note: "+ Govt. fees as actual" },
      { name: "Shifting of Registered Office within State (Additional)", price: "₹1,000", note: "+ Govt. fees as actual" },
    ],
  },
];
