import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  metadataBase: new URL("https://bmg-apis.vercel.app"),
  title: {
    default: "BMG APIs — بوابة المطورين",
    template: "%s | BMG APIs",
  },
  description: "منصة عربية للمطورين لاستكشاف واجهات البرمجة وتجهيز تعريفاتها وإدارة تكاملاتها.",
  applicationName: "BMG APIs",
  keywords: ["BMG APIs", "واجهات برمجة التطبيقات", "API", "REST API", "Developer Platform"],
  icons: { icon: "/bmg-apis-mark.svg" },
  openGraph: {
    title: "BMG APIs — بوابة المطورين",
    description: "اكتشف واجهات البرمجة وجهّز تكاملاتك من مساحة عمل واحدة.",
    siteName: "BMG APIs",
    locale: "ar_EG",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090b10",
  colorScheme: "dark",
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