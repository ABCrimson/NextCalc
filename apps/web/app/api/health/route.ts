/**
 * Health check endpoint for monitoring
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.1.2',
      services: {
        calculator: 'operational',
        mathEngine: 'operational',
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
