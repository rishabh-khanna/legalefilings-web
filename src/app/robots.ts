import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /admin has no real auth yet (mock viewer switcher only) — keep it out
      // of search results regardless.
      disallow: ["/api/", "/thankyou-page", "/admin"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
