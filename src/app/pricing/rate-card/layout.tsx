import type { Metadata } from "next";
import { SITE_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: `Complete Price List — ${SITE_NAME}`,
  description: "Every registration, license, and compliance filing offered by Legal Efilings — flat fees, one page, nothing hidden.",
};

export default function RateCardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
