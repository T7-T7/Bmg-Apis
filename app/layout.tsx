import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NEXUS OF XPERIENCE (Nox)", template: "%s | Nox" },
  description: "Nox — NEXUS OF XPERIENCE، منصة Bmg, Inc. للمطورين لإدارة مفاتيح API واستكشاف الخدمات واختبارها.",
  applicationName: "Nox",
  metadataBase: new URL("https://nox.bmg-inc.web.id"),
  openGraph: {
    title: "NEXUS OF XPERIENCE (Nox)",
    description: "Developer API platform by Bmg, Inc.",
    type: "website",
  },
};
export const viewport: Viewport = {
  themeColor: "#111315",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`(()=>{document.documentElement.dataset.theme="dark";document.documentElement.style.colorScheme="dark";try{localStorage.setItem("nox-theme","dark")}catch{}})()`}} /></head><body>{children}</body></html>;
}
