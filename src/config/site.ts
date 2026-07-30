// Central place for values that change independently of the code — contact
// details, business metrics, site metadata. Update here; nothing else in the
// codebase should hardcode a phone number, WhatsApp link, or business stat.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://legalefilings.com";

export const SITE_NAME = "Legal Efilings";

export const BUSINESS_PHONE = {
  /** E.164, for tel: links */
  e164: "+918887723385",
  /** Human-readable, for on-screen display */
  display: "+91 88877 23385",
} as const;

export const BUSINESS_WHATSAPP = {
  /** Digits only (country code + number), as wa.me expects */
  number: "916394483965",
} as const;

export const CONTACT_LINKS = {
  tel: `tel:${BUSINESS_PHONE.e164}`,
  whatsapp: `https://wa.me/${BUSINESS_WHATSAPP.number}`,
} as const;

// Placeholder until real profile URLs are provided — swap the "#" values
// out, nothing else needs to change.
export const SOCIAL_LINKS = {
  facebook: "#",
  instagram: "#",
  linkedin: "#",
  x: "#",
  youtube: "#",
} as const;

// Real, current business metrics shown on the homepage hero, "Why Choose
// Us," etc. — update as the business grows, not by hunting through
// components. Keep these honest: only real figures, never invented ones.
export const BUSINESS_STATS = {
  businessesServed: "10,000+",
  caCsProfessionals: "100+",
} as const;
