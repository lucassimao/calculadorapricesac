import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The shared loan engine lives in ../shared/loan-engine (single source of truth).
  // Turbopack cannot resolve imports outside the project root, so scripts/sync-loan-engine.mjs
  // copies it into ./loan-engine-shim (gitignored) on prebuild/predev, and the alias below
  // points the @loan-engine import specifiers at that generated in-root copy.
  experimental: { externalDir: true },
  turbopack: {
    resolveAlias: {
      '@loan-engine/calculations': './loan-engine-shim/calculations',
      '@loan-engine/loan': './loan-engine-shim/loan',
    },
  },
};

export default nextConfig;
