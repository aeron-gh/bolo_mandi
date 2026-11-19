import type { Metadata, Viewport } from "next";
import { Anek_Devanagari, Anek_Latin } from "next/font/google";
import "./globals.css";

// Anek covers English letters and Hindi script with the same feel.
const anekLatin = Anek_Latin({ variable: "--font-anek-latin", subsets: ["latin"] });
const anekDeva = Anek_Devanagari({ variable: "--font-anek-deva", subsets: ["devanagari"] });

export const metadata: Metadata = {
  title: "MandiPlus Bolo",
  description: "Voice billing for the mandi counter",
};

export const viewport: Viewport = { themeColor: "#f5f5fa" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anekLatin.variable} ${anekDeva.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
