import "./globals.css";
import AppShell from "@/components/app-shell";

export const metadata = {
  title: "BMG APIs — Developer Platform",
  description: "Discover, create and manage APIs with BMG APIs."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}