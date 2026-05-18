import type { Metadata } from "next";
import { Bebas_Neue, JetBrains_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://flood-sentinel.vercel.app";

export const metadata: Metadata = {
  title: "Flood Sentinel — AI Flood Warning System Bangladesh",
  description:
    "Hyperlocal flood risk predictions for Bangladesh using Gemini AI, real-time BWDB river data, and self-improving accuracy. Built for the Google Cloud Rapid Agent Hackathon 2026.",
  keywords: [
    "flood warning", "Bangladesh", "Gemini AI", "real-time flood prediction",
    "BWDB", "disaster management", "Sylhet", "Jamuna",
  ],
  authors: [{ name: "Minhaz Uddin", url: "https://devixus.com" }],
  openGraph: {
    title: "Flood Sentinel — AI Flood Warning System Bangladesh",
    description:
      "Hyperlocal flood risk predictions for Bangladesh using Gemini AI, real-time river data, and self-improving accuracy.",
    url: APP_URL,
    siteName: "Flood Sentinel",
    images: [{ url: `${APP_URL}/og-image.png`, width: 1200, height: 630, alt: "Flood Sentinel" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Flood Sentinel — AI Flood Warning System Bangladesh",
    description: "Real-time AI flood risk predictions for Bangladesh",
    images: [`${APP_URL}/og-image.png`],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${jetbrainsMono.variable} ${dmSans.variable} h-full`}
    >
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg-void)" }}>
        {children}
      </body>
    </html>
  );
}
