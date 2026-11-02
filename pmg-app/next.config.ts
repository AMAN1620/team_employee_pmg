import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@slack/bolt"],
  // The dev badge sits bottom-left by default, on top of the sidebar's Sign out button.
  devIndicators: { position: "bottom-right" },
  // Comments can carry up to five 10 MB files.
  experimental: { serverActions: { bodySizeLimit: "55mb" } },
};
export default nextConfig;
