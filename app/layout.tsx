import type { Metadata } from "next";
import { Noto_Sans_Bengali, Merriweather, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const notoSansBengali = Noto_Sans_Bengali({
  variable: "--font-noto-sans-bengali",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
});

const sourceCodePro = Source_Code_Pro({
  variable: "--font-source-code-pro",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://flood-sentinel.vercel.app";

export const metadata: Metadata = {
  title: "Flood Sentinel — National Flood Early Warning System, Bangladesh",
  description:
    "AI-powered national flood early warning system for Bangladesh. Real-time BWDB river data, Gemini AI predictions, and hyperlocal risk assessments.",
  keywords: [
    "flood warning", "Bangladesh", "Gemini AI", "real-time flood prediction",
    "BWDB", "disaster management", "Sylhet", "Jamuna", "water resources",
  ],
  authors: [{ name: "Minhaz Uddin", url: "https://devixus.com" }],
  openGraph: {
    title: "Flood Sentinel — National Flood Early Warning System, Bangladesh",
    description: "AI-powered national flood early warning system using real-time BWDB data and Gemini AI.",
    url: APP_URL,
    siteName: "Flood Sentinel",
    images: [{ url: `${APP_URL}/og-image.png`, width: 1200, height: 630, alt: "Flood Sentinel" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Flood Sentinel — National Flood Early Warning System",
    description: "Real-time AI flood risk predictions for Bangladesh",
    images: [`${APP_URL}/og-image.png`],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${notoSansBengali.variable} ${merriweather.variable} ${sourceCodePro.variable}`}
    >
      <body style={{ margin: 0, padding: 0, background: "var(--bg-primary)", overflow: "hidden" }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
