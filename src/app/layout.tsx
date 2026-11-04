import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoDev = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-dev",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "जीवन Sahay — AI-Powered Healthcare Navigation Platform",
    template: "%s | जीवन Sahay",
  },
  description:
    "सही अस्पताल • सही समय • सही दिशा — Search hospital listings by medical need and distance. Bed, doctor, and service information is facility-reported and should be confirmed with the hospital."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoDev.variable}`}>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
