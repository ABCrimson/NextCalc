import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    turbo: {
      resolveAlias: {
        '@nextcalc/types': '../../packages/types/src',
        '@nextcalc/math-engine': '../../packages/math-engine/src',
        '@nextcalc/plot-engine': '../../packages/plot-engine/src',
        '@nextcalc/ui': '../../packages/ui/src',
      },
    },
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ['@nextcalc/types', '@nextcalc/math-engine', '@nextcalc/plot-engine', '@nextcalc/ui'],
};

export default nextConfig;
