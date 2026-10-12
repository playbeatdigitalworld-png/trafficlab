import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* allow the sandbox preview origin for HMR / fast refresh */
  allowedDevOrigins: ["*.space-z.ai"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
