import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Source uploads are capped at 12 MiB; leave room for multipart fields and boundaries.
    proxyClientMaxBodySize: "14mb",
  },

  allowedDevOrigins: ['skilled-jacqulyn-flamier.ngrok-free.dev'],

};

export default nextConfig;
