import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  title: {
    default: "BMG APIs — Developer Platform",
    template: "%s | BMG APIs",
  },
  description: "Discover, design and manage APIs in one developer workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}