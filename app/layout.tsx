import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NOX APIS — NEXUS OF XPERIENCE", template: "%s | NOX APIS" },
  description: "منصة NOX APIS — NEXUS OF XPERIENCE للمطورين — استكشف واجهات API واختبرها وأدر مفاتيح الوصول من مكان واحد.",
  applicationName: "NOX APIS",
  metadataBase: new URL("https://bmg-apis-b2-902b.vercel.app"),
  openGraph: { title: "NOX APIS — NEXUS OF XPERIENCE", description: "Developer API platform", type: "website" },
};
export const viewport: Viewport = { themeColor: "#111315", colorScheme: "dark light", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`(()=>{try{const saved=localStorage.getItem("nox-theme");const mode=saved==="dark"||saved==="light"||saved==="system"?saved:"dark";const resolved=mode==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):mode;document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved}catch{}})()`}} /></head><body>{children}</body></html>;
}
