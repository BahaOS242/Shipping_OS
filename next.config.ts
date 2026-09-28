import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    // Short/legacy URLs → canonical pages (no duplicate content).
    return [
      ["/cost", "/shipping-calculator"],
      ["/account", "/profile"],
      ["/help/whatsapp", "/whatsapp-demo"],
      ["/shipping", "/shipping-to-bahamas"],
      ["/package-forwarding", "/us-address-bahamas"],
      ["/air-freight", "/air-freight-bahamas"],
      ["/ocean-freight", "/ocean-freight-bahamas"],
      ["/consolidation", "/package-consolidation-bahamas"],
      ["/family-islands", "/locations/family-islands"],
    ].map(([source, destination]) => ({ source, destination, permanent: false }));
  },
};

export default nextConfig;
