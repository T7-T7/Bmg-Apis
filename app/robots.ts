import type {MetadataRoute} from "next";
export default function robots():MetadataRoute.Robots{
 const base="https://bmg-apis-b2-902b.vercel.app";
 return {rules:[{userAgent:"*",allow:"/",disallow:["/dashboard/","/login","/signup","/auth/"]}],sitemap:base+"/sitemap.xml",host:base};
}