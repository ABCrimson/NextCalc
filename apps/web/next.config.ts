import { resolve } from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

/**
 * Next.js 16.2.0 Configuration
 *
 * Key Features:
 * - Turbopack is stable in Next.js 16.0
 * - Enhanced caching with React 19.3.0
 * - Improved Server Components
 * - Better TypeScript 6.0 integration
 * - New experimental features in 16.2.0
 *
 * @see https://nextjs.org/docs/app/api-reference/next-config-js
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Turbopack configuration - stable in Next.js 16.0
  turbopack: {
    root: resolve(import.meta.dirname, '../../'),
    resolveAlias: {
      '@nextcalc/types': '../../packages/types/src',
      '@nextcalc/math-engine': '../../packages/math-engine/dist',
      '@nextcalc/math-engine/stats': '../../packages/math-engine/dist/stats',
      '@nextcalc/math-engine/complex': '../../packages/math-engine/dist/complex',
      '@nextcalc/math-engine/matrix': '../../packages/math-engine/dist/matrix',
      '@nextcalc/math-engine/solver': '../../packages/math-engine/dist/solver',
      '@nextcalc/math-engine/symbolic': '../../packages/math-engine/dist/symbolic',
      '@nextcalc/math-engine/units': '../../packages/math-engine/dist/units',
      '@nextcalc/math-engine/parser': '../../packages/math-engine/dist/parser',
      '@nextcalc/math-engine/wasm': '../../packages/math-engine/dist/wasm',
      '@nextcalc/plot-engine': '../../packages/plot-engine/dist',
    },
  },

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false, // Enforce type safety in production
  },

  // Image optimization (required in Next.js 16)
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [50, 75, 90, 100],
    minimumCacheTTL: 14400, // 4 hours
  },

  // Transpile workspace packages
  transpilePackages: [
    '@nextcalc/types',
    '@nextcalc/math-engine',
    '@nextcalc/plot-engine',
  ],

  // Experimental features in Next.js 16.2.0
  experimental: {
    // 182x faster incremental builds without CSS changes
    turbopackFileSystemCacheForDev: true,

    // Use React 19's taint API for security
    taint: true,

    // Note: cacheComponents (PPR replacement) is disabled because it's incompatible
    // with 'export const dynamic' and 'export const runtime' in API routes.
    // Enable when migrating API routes to new caching model.
    // cacheComponents: true,

    // Optimize package imports (expanded for better bundle size)
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'radix-ui',
      'katex',
      'three',
      'mathjs',
    ],
  },

  // Security headers for routes not covered by middleware
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/api/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        source: '/wasm/:path*',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

export default withSerwist(withNextIntl(nextConfig));
