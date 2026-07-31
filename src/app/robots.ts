import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /dashboard is the account area (customer/staff/admin) — auth-gated,
      // but keep it out of search results regardless.
      disallow: ["/api/", "/thankyou-page", "/dashboard"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
