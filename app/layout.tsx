import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  title: {
    default: "BMG APIs — منصة واجهات البرمجة",
    template: "%s | BMG APIs",
  },
  description: "منصة عربية لاستكشاف واجهات البرمجة وإدارتها وتجهيزها للمطورين.",
  icons: { icon: "/bmg-apis-mark.svg" },
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