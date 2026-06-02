import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Import the shared loan engine from ../shared (outside the marketing app dir)
  experimental: {
    externalDir: true,
  },
  turbopack: {
    resolveAlias: {
      '@loan-engine/calculations': './loan-engine-shim/calculations',
      '@loan-engine/loan': './loan-engine-shim/loan',
    },
  },
};

export default nextConfig;
