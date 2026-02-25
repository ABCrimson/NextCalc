/**
 * Next.js 16 Proxy (formerly Middleware)
 *
 * Handles:
 * 1. Security headers (CSP with nonce, HSTS, X-Content-Type-Options, etc.)
 *    via Nosecone
 * 2. Authentication and authorization for protected routes via NextAuth
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

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Generate security headers for this request
  const securityHeaders = nosecone(noseconeConfig);
  // Nosecone 1.1.0 doesn't support Permissions-Policy natively — add it manually
  securityHeaders.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/worksheets', '/settings', '/forum/new', '/profile'];

  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Redirect to sign-in if accessing protected route without auth
  if (isProtectedRoute && !isLoggedIn) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    const redirectResponse = Response.redirect(signInUrl);
    // Attach security headers to redirect response
    securityHeaders.forEach((value, key) => {
      redirectResponse.headers.set(key, value);
    });
    return redirectResponse;
  }

  // Redirect to dashboard if authenticated user tries to access auth pages
  if (isLoggedIn && pathname.startsWith('/auth/')) {
    const redirectResponse = Response.redirect(new URL('/dashboard', req.url));
    // Attach security headers to redirect response
    securityHeaders.forEach((value, key) => {
      redirectResponse.headers.set(key, value);
    });
    return redirectResponse;
  }

  // Continue with security headers applied via x-middleware-next
  securityHeaders.set('x-middleware-next', '1');
  return new Response(null, { headers: securityHeaders });
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sw.js, manifest.json, icons (static assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|sw.js.map|swe-worker|manifest.json|icon).*)',
  ],
};
