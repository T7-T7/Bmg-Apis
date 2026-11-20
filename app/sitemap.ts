import type {MetadataRoute} from "next";
export default function sitemap():MetadataRoute.Sitemap{
 const base="https://bmg-apis-b2-902b.vercel.app";
 return [
  {url:base,changeFrequency:"weekly",priority:1},
  {url:base+"/apis",changeFrequency:"daily",priority:.9},
  {url:base+"/apis/ai-chat",changeFrequency:"weekly",priority:.8},
  {url:base+"/apis/currency-rate",changeFrequency:"daily",priority:.8},
  {url:base+"/docs",changeFrequency:"weekly",priority:.9},
  {url:base+"/docs.md",changeFrequency:"weekly",priority:.8},
  {url:base+"/playground",changeFrequency:"weekly",priority:.6},
  {url:base+"/status",changeFrequency:"hourly",priority:.5}
 ];
}