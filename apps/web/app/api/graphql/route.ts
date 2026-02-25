/**
 * GraphQL API Route
 *
 * Next.js route handler that serves the GraphQL API via Apollo Server 5.4.0.
 * Injects the real NextAuth auth() function so the API can authenticate requests.
 *
 * Endpoint: /api/graphql
 */

import type { NextRequest } from 'next/server';
import { createHandler } from '@nextcalc/api';
import { auth } from '@/auth';

const handler = createHandler({ auth });

export const GET = (
  req: Request | NextRequest,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> => handler.GET(req as NextRequest, ctx);
export const POST = (
  req: Request | NextRequest,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> => handler.POST(req as NextRequest, ctx);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
