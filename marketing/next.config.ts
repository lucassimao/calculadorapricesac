import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Import the shared loan engine from ../shared (outside the marketing app dir)
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
