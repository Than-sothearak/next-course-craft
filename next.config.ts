import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    agentUpgrade: "security",
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
    // Source uploads are capped at 12 MiB; leave room for multipart fields and boundaries.
    proxyClientMaxBodySize: "14mb",
  },

  allowedDevOrigins: ['skilled-jacqulyn-flamier.ngrok-free.dev'],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
