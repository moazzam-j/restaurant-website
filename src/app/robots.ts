import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Admin and API are operational surfaces, not content. /cart is NOT
        // listed here on purpose: it's handled with a noindex meta tag
        // instead, which crawlers can only see if crawling isn't blocked.
        disallow: ["/admin", "/api"],
      },
    ],
    sitemap: "https://delitechickenfood.com/sitemap.xml",
  };
}
