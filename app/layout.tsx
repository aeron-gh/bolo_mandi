import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

// Same faces as mandiplus.com: Bricolage for headings, Geist for text. Noto adds Hindi letters.
const display = Bricolage_Grotesque({ variable: "--font-display-face", subsets: ["latin"] });
const body = Geist({ variable: "--font-body", subsets: ["latin"] });
const hindi = Noto_Sans_Devanagari({ variable: "--font-hindi", subsets: ["devanagari"] });

export const metadata: Metadata = {
  title: { default: "Bolo · MandiPlus", template: "%s · MandiPlus" },
  description: "Bolo: make bills by speaking. Voice billing for the mandi counter.",
};

export const viewport: Viewport = { themeColor: "#f5f6fb" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${hindi.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
