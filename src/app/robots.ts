import type { MetadataRoute } from "next";
import { TITULAR } from "../lib/legal/titular";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${TITULAR.url}/sitemap.xml`,
  };
}
