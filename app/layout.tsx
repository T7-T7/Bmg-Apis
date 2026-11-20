import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BMG APIs — واجهات برمجية للمطورين",
  description: "منصة BMG APIs لاستكشاف واجهات API واختبارها وإدارة مفاتيح الوصول.",
  applicationName: "BMG APIs",
  keywords: ["BMG APIs", "API", "Developer Platform", "Gemini", "Currency"],
};
export const viewport: Viewport = { themeColor: "#090b12", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
