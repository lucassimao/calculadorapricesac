import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@loan-engine/calculations', '@loan-engine/loan'],
};

export default nextConfig;
