// Professional Tax is levied by the state, not centrally, and the slabs
// differ meaningfully — Karnataka charges a flat ₹200 above ₹25,000
// while Maharashtra runs ₹200/₹300 with a February top-up and West
// Bengal has five bands. Payroll previously applied one hardcoded
// ₹200-above-₹15,000 rule to everyone, which is wrong for most states
// and silently wrong (the payslip shows a confident number either way).
//
// A few states levy no professional tax at all — Delhi, Haryana, UP,
// Rajasthan, Punjab among them — where the old constant was deducting
// ₹200 a month from people who owe nothing.
//
// Slabs are monthly gross, ordered ascending; the first band whose
// upTo the gross falls within applies. Sources are the state commercial
// tax schedules; these are the common published slabs and should be
// reviewed with a CA before being relied on for statutory filing —
// same caveat the rest of this module carries.

export type PtSlab = { upTo: number; amount: number };

const NO_PT: PtSlab[] = [{ upTo: Infinity, amount: 0 }];

// Keyed by the state name the app already stores on company_settings.state.
const PT_BY_STATE: Record<string, PtSlab[]> = {
  Karnataka: [
    { upTo: 24999, amount: 0 },
    { upTo: Infinity, amount: 200 },
  ],
  Maharashtra: [
    { upTo: 7500, amount: 0 },
    { upTo: 10000, amount: 175 },
    // Maharashtra's ₹300 February adjustment is deliberately not modelled
    // — it needs a month-aware rule, and quietly applying ₹200 every
    // month is both simpler and closer than pretending otherwise.
    { upTo: Infinity, amount: 200 },
  ],
  "West Bengal": [
    { upTo: 10000, amount: 0 },
    { upTo: 15000, amount: 110 },
    { upTo: 25000, amount: 130 },
    { upTo: 40000, amount: 150 },
    { upTo: Infinity, amount: 200 },
  ],
  "Tamil Nadu": [
    { upTo: 21000, amount: 0 },
    { upTo: 30000, amount: 135 },
    { upTo: 45000, amount: 315 },
    { upTo: 60000, amount: 690 },
    { upTo: 75000, amount: 1025 },
    { upTo: Infinity, amount: 1250 },
  ],
  "Andhra Pradesh": [
    { upTo: 15000, amount: 0 },
    { upTo: 20000, amount: 150 },
    { upTo: Infinity, amount: 200 },
  ],
  Telangana: [
    { upTo: 15000, amount: 0 },
    { upTo: 20000, amount: 150 },
    { upTo: Infinity, amount: 200 },
  ],
  Gujarat: [
    { upTo: 12000, amount: 0 },
    { upTo: Infinity, amount: 200 },
  ],
  Kerala: [
    { upTo: 11999, amount: 0 },
    { upTo: 17999, amount: 120 },
    { upTo: 29999, amount: 180 },
    { upTo: 44999, amount: 300 },
    { upTo: Infinity, amount: 500 },
  ],
  "Madhya Pradesh": [
    { upTo: 18750, amount: 0 },
    { upTo: 25000, amount: 125 },
    { upTo: 33333, amount: 167 },
    { upTo: Infinity, amount: 208 },
  ],
  Odisha: [
    { upTo: 13304, amount: 0 },
    { upTo: 25000, amount: 125 },
    { upTo: Infinity, amount: 200 },
  ],
  Assam: [
    { upTo: 10000, amount: 0 },
    { upTo: 15000, amount: 150 },
    { upTo: 25000, amount: 180 },
    { upTo: Infinity, amount: 208 },
  ],
  Bihar: [
    { upTo: 25000, amount: 0 },
    { upTo: 41666, amount: 83 },
    { upTo: 83333, amount: 166 },
    { upTo: Infinity, amount: 208 },
  ],
  Jharkhand: [
    { upTo: 25000, amount: 0 },
    { upTo: 41666, amount: 100 },
    { upTo: 66666, amount: 150 },
    { upTo: 83333, amount: 175 },
    { upTo: Infinity, amount: 208 },
  ],
  // States with no professional tax levy at all.
  Delhi: NO_PT,
  Haryana: NO_PT,
  "Uttar Pradesh": NO_PT,
  Rajasthan: NO_PT,
  Punjab: NO_PT,
  "Himachal Pradesh": NO_PT,
  Uttarakhand: NO_PT,
  Chandigarh: NO_PT,
  Goa: NO_PT,
  "Jammu and Kashmir": NO_PT,
};

// The old hardcoded behaviour, kept as the fallback for a state that
// isn't in the table (or isn't set yet). Deliberately not zero: silently
// deducting nothing is a worse default than deducting the common amount,
// because it under-withholds without anyone noticing.
const FALLBACK: PtSlab[] = [
  { upTo: 15000, amount: 0 },
  { upTo: Infinity, amount: 200 },
];

export function professionalTaxFor(monthlyGross: number, state?: string | null): number {
  const slabs = (state && PT_BY_STATE[state.trim()]) || FALLBACK;
  for (const slab of slabs) {
    if (monthlyGross <= slab.upTo) return slab.amount;
  }
  return 0;
}

/** True when the state is explicitly known — lets the UI say so rather than implying precision it doesn't have. */
export function hasKnownPtSchedule(state?: string | null): boolean {
  return Boolean(state && PT_BY_STATE[state.trim()]);
}
