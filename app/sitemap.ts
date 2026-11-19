import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://bmg-apis.vercel.app";
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/docs`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/docs.md`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/apis`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/status`, changeFrequency: "hourly", priority: 0.5 },
  ];
}
