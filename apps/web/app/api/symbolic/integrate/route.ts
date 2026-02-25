import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { expression, variable = 'x' } = await request.json();

    if (!expression) {
      return NextResponse.json({ error: 'Expression required' }, { status: 400 });
    }

    const { integrate, astToString } = await import('@nextcalc/math-engine/symbolic');

    const result = integrate(expression, variable);
    const integralString = astToString(result);

    return NextResponse.json({
      integral: integralString + ' + C',
      original: expression,
      variable,
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Integration failed' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
