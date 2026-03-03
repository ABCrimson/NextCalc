/**
 * TEMPORARY debug endpoint — delete after diagnosing auth issue.
 * Tests: DATABASE_URL set, Prisma connection, Account/User table access, adapter instantiation.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Check env vars
  results.hasDbUrl = !!process.env['DATABASE_URL'];
  results.dbUrlPrefix = process.env['DATABASE_URL']?.substring(0, 25) + '...';
  results.hasAuthSecret = !!(process.env['AUTH_SECRET'] || process.env['NEXTAUTH_SECRET']);
  results.nodeEnv = process.env['NODE_ENV'];

  // 2. Test Prisma connection
  try {
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    results.prismaConnection = 'OK';
    results.prismaResult = result;
  } catch (e) {
    results.prismaConnection = 'FAILED';
    results.prismaError = e instanceof Error ? e.message : String(e);
  }

  // 3. Test User table
  try {
    const { prisma } = await import('@/lib/prisma');
    const userCount = await prisma.user.count();
    results.userTable = 'OK';
    results.userCount = userCount;
  } catch (e) {
    results.userTable = 'FAILED';
    results.userError = e instanceof Error ? e.message : String(e);
  }

  // 4. Test Account table
  try {
    const { prisma } = await import('@/lib/prisma');
    const accountCount = await prisma.account.count();
    results.accountTable = 'OK';
    results.accountCount = accountCount;
  } catch (e) {
    results.accountTable = 'FAILED';
    results.accountError = e instanceof Error ? e.message : String(e);
  }

  // 5. Test PrismaAdapter instantiation
  try {
    const { PrismaAdapter } = await import('@auth/prisma-adapter');
    const { prisma } = await import('@/lib/prisma');
    const adapter = PrismaAdapter(prisma as any);
    results.adapterCreated = 'OK';
    results.adapterMethods = Object.keys(adapter);
  } catch (e) {
    results.adapterCreated = 'FAILED';
    results.adapterError = e instanceof Error ? e.message : String(e);
  }

  // 6. Test adapter.getUserByEmail (simulates what happens on OAuth callback)
  try {
    const { PrismaAdapter } = await import('@auth/prisma-adapter');
    const { prisma } = await import('@/lib/prisma');
    const adapter = PrismaAdapter(prisma as any);
    if (adapter.getUserByEmail) {
      const user = await adapter.getUserByEmail('test-nonexistent@example.com');
      results.getUserByEmail = 'OK (returned null as expected)';
      results.getUserResult = user;
    }
  } catch (e) {
    results.getUserByEmail = 'FAILED';
    results.getUserByEmailError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
