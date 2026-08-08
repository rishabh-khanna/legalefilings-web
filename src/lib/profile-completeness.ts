import type { Profile } from "@/lib/roles";

type RequiredProfileFields = Pick<Profile, "full_name" | "phone" | "date_of_birth" | "state" | "city">;

// Kept intentionally small — just what's needed for birthday emails,
// state-based GST logic, and basic contactability. Aadhaar/PAN/bank
// details stay optional; most customers have no reason to provide those
// unless they're staff on payroll (handled separately in Employees).
export const REQUIRED_PROFILE_FIELDS: { key: keyof RequiredProfileFields; label: string }[] = [
  { key: "full_name", label: "Full Name" },
  { key: "phone", label: "Phone" },
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
];

export function getMissingProfileFields(profile: RequiredProfileFields): string[] {
  return REQUIRED_PROFILE_FIELDS.filter((f) => {
    const value = profile[f.key];
    return !value || (typeof value === "string" && value.trim() === "");
  }).map((f) => f.label);
}
