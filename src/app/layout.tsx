import type { Metadata, Viewport } from "next";

import { fontVariables } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dutch Shared Learning Platform",
    template: "%s · Nederlands",
  },
  description:
    "A private collaborative workspace for a small group learning Dutch — capture vocabulary, grammar, readings and files, then practise and prepare for exams together.",
  applicationName: "Nederlands",
};

export const viewport: Viewport = {
  themeColor: "#faf8f5",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${fontVariables} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
