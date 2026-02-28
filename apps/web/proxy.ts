/**
 * Next.js 16 Proxy (formerly Middleware)
 *
 * Handles:
 * 1. Locale detection and URL rewriting via next-intl
 * 2. Security headers (CSP with nonce, HSTS, X-Content-Type-Options, etc.)
 *    via Nosecone
 * 3. Authentication and authorization for protected routes via NextAuth
 *
 * NOTE: Next.js 16 Beta Change
 * This file was renamed from 'middleware.ts' to 'proxy.ts' as required by Next.js 16 beta.
 * The 'middleware' convention is deprecated in favor of 'proxy' in Next.js 16+.
 *
 * IMPORTANT: This file runs in Edge Runtime and CANNOT import Prisma.
 * Use NextAuth with config-only (no database adapter) for middleware.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 * @see https://authjs.dev/getting-started/session-management/protecting
 */

import NextAuth from 'next-auth';
import { nosecone } from '@nosecone/next';
import type { Options } from 'nosecone';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { authConfig } from './auth.config';

/**
 * Generate a CSP nonce for each request.
 * This mirrors the nonce() function from @nosecone/next internals.
 */
function cspNonce(): `'nonce-${string}'` {
  return `'nonce-${btoa(crypto.randomUUID())}'`;
}

const noseconeConfig: Options = {
  contentSecurityPolicy: {
    directives: {
      scriptSrc: [
        "'self'",
        cspNonce,
        // @nosecone/next adds 'unsafe-eval' in development automatically;
        // we replicate that here for hot reloading support
        ...(process.env.NODE_ENV === 'development'
          ? (["'unsafe-eval'"] as const)
          : []),
      ],
      workerSrc: ["'self'", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "https://exports.nextcalc.pro",
        "https://*.upstash.io",
      ],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  },
  xContentTypeOptions: true,
  referrerPolicy: {
    policy: ["strict-origin-when-cross-origin"],
  },
};

/** next-intl locale middleware — resolves locale from Accept-Language, cookie, or default */
const handleI18nRouting = createIntlMiddleware(routing);

/** Protected routes that require authentication (without locale prefix) */
const protectedRoutes = ['/dashboard', '/worksheets', '/settings', '/forum/new', '/profile'];

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // ---- Step 1: Run locale middleware ----
  // next-intl handles locale detection from Accept-Language header, NEXT_LOCALE
  // cookie, or URL prefix. It returns a response with rewrite/redirect headers.
  const intlResponse = handleI18nRouting(req);

  // ---- Step 2: Generate security headers ----
  const securityHeaders = nosecone(noseconeConfig);
  securityHeaders.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');

  // ---- Step 3: Strip locale prefix for route matching ----
  // Paths may be locale-prefixed (e.g., /en/dashboard, /es/settings).
  // Strip the locale prefix to match against our protected routes list.
  const localePattern = /^\/(?:en|ru|es|uk|de|fr|ja|zh)(\/|$)/;
  const pathnameWithoutLocale = pathname.replace(localePattern, '/');

  // ---- Step 4: Auth checks ----
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathnameWithoutLocale.startsWith(route)
  );

  if (isProtectedRoute && !isLoggedIn) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    const redirectResponse = Response.redirect(signInUrl);
    // Attach both intl and security headers to redirect response
    intlResponse.headers.forEach((value, key) => {
      redirectResponse.headers.set(key, value);
    });
    securityHeaders.forEach((value, key) => {
      redirectResponse.headers.set(key, value);
    });
    return redirectResponse;
  }

  if (isLoggedIn && pathnameWithoutLocale.startsWith('/auth/')) {
    const redirectResponse = Response.redirect(new URL('/dashboard', req.url));
    intlResponse.headers.forEach((value, key) => {
      redirectResponse.headers.set(key, value);
    });
    securityHeaders.forEach((value, key) => {
      redirectResponse.headers.set(key, value);
    });
    return redirectResponse;
  }

  // ---- Step 5: Merge security headers into the intl response ----
  // The intl response already contains rewrite/redirect headers from next-intl.
  // Layer the CSP and other security headers on top.
  securityHeaders.forEach((value, key) => {
    intlResponse.headers.set(key, value);
  });

  return intlResponse;
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sw.js, manifest.json, icons (static assets)
     * - wasm (WebAssembly binaries)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|sw.js.map|swe-worker|manifest.json|icon|wasm).*)',
  ],
};
