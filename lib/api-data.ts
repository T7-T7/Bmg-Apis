export type ApiCategory = "AI" | "Media" | "Text" | "Utilities" | "Entertainment";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ApiDefinition = {
  slug: string;
  name: string;
  symbol: string;
  category: ApiCategory;
  method: HttpMethod;
  endpoint: string;
  description: string;
  status: "Preview";
  latency: "—";
  updated: string;
};

export const apiCatalog: ApiDefinition[] = [
  { slug: "echo", name: "Echo API", symbol: "E", category: "Utilities", method: "GET", endpoint: "/api/v1/echo", description: "Echo back a message and inspect request parameters for integration testing.", status: "Preview", latency: "—", updated: "Sample" },
  { slug: "text-tools", name: "Text Tools", symbol: "T", category: "Text", method: "POST", endpoint: "/api/v1/text", description: "Text transformation utilities including case conversion, cleanup and formatting.", status: "Preview", latency: "—", updated: "Sample" },
  { slug: "random", name: "Random Data", symbol: "R", category: "Utilities", method: "GET", endpoint: "/api/v1/random", description: "Generate random values and sample data for development and prototyping.", status: "Preview", latency: "—", updated: "Sample" },
  { slug: "image-info", name: "Image Info", symbol: "I", category: "Media", method: "POST", endpoint: "/api/v1/image/info", description: "Read image metadata and basic properties from a supplied image file.", status: "Preview", latency: "—", updated: "Sample" },
  { slug: "anime", name: "Anime Data", symbol: "A", category: "Entertainment", method: "GET", endpoint: "/api/v1/anime", description: "Entertainment data endpoint with structured anime information.", status: "Preview", latency: "—", updated: "Sample" },
  { slug: "ai-assistant", name: "AI Assistant", symbol: "AI", category: "AI", method: "POST", endpoint: "/api/v1/ai", description: "A future AI endpoint for prompt-based responses and assisted tasks.", status: "Preview", latency: "—", updated: "Preview" },
];

export const categories = ["All", "AI", "Media", "Text", "Utilities", "Entertainment"] as const;
export type CatalogFilter = (typeof categories)[number];