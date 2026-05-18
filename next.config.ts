import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "basemaps.cartocdn.com" },
      { protocol: "https", hostname: "unpkg.com" },
    ],
  },
  // Allow Twilio and other external APIs in server actions
  serverExternalPackages: ["twilio"],
};

export default nextConfig;
