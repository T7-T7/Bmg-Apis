import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  metadataBase: new URL("https://bmg-apis.vercel.app"),
  title: {
    default: "Nox Apis — Nexus Of Xperience",
    template: "%s | Nox Apis",
  },
  description: "منصة عربية للمطورين لاستكشاف واجهات البرمجة وتجهيز تعريفاتها وإدارة تكاملاتها.",
  applicationName: "Nox Apis",
  keywords: ["Nox Apis", "واجهات برمجة التطبيقات", "API", "REST API", "Developer Platform"],
  icons: { icon: "/bmg-apis-mark.svg" },
  openGraph: {
    title: "Nox Apis — Nexus Of Xperience",
    description: "اكتشف واجهات البرمجة وجهّز تكاملاتك من مساحة عمل واحدة.",
    siteName: "Nox Apis",
    locale: "ar_EG",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111111",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}