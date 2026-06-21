import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Neon serverless driver works over HTTP/WebSocket and is bundle-safe,
  // so no special server externals are required here.
};

export default nextConfig;
