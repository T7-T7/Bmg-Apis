import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard/", "/login", "/auth/"] }],
    sitemap: "https://bmg-apis.vercel.app/sitemap.xml",
    host: "https://bmg-apis.vercel.app",
  };
}
