import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BMG APIs — Developer Platform", template: "%s | BMG APIs" },
  description: "منصة BMG APIs للمطورين — استكشف واجهات API واختبرها وأدر مفاتيح الوصول من مكان واحد.",
  applicationName: "BMG APIs",
  metadataBase: new URL("https://bmg-apis-b2-902b.vercel.app"),
  openGraph: { title: "BMG APIs", description: "Developer API platform", type: "website" },
};
export const viewport: Viewport = { themeColor: "#080b12", colorScheme: "dark", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
