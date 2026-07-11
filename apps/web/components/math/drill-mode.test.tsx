import { registerAllTemplates, templateEngine } from '@nextcalc/math-engine/problems/templates';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DrillMode } from './drill-mode';

// Server actions touch auth/prisma — mock them (drill must work signed-out)
vi.mock('@/app/actions/practice', () => ({
  startPracticeSession: vi.fn(async () => ({
    success: false,
    error: 'Sign in to save practice progress',
  })),
  completePracticeSession: vi.fn(async () => ({
    success: false,
    error: 'Sign in to save practice results',
  })),
}));

// KaTeX renders async in happy-dom — render raw expressions instead
vi.mock('@/components/ui/math-renderer', () => ({
  MathRenderer: ({ expression }: { expression: string }) => <span>{expression}</span>,
}));

const TEMPLATE_ID = 'linear-equation-basic';
const SEED = 'abc123';

function narrowParams(instance: { parameters: Record<string, unknown> }) {
  const { a, b, c } = instance.parameters as { a: number; b: number; c: number };
  return { a, b, c };
}

beforeAll(() => {
  registerAllTemplates();
});

describe('DrillMode', () => {
  it('renders the same statement for the same template+seed (deterministic)', () => {
    const noop = () => {};
    const expected = templateEngine.generate(TEMPLATE_ID, SEED);

    const first = render(
      <DrillMode templateId={TEMPLATE_ID} seed={SEED} onSeedChange={noop} onExit={noop} />,
    );
    const statementA = first.container.textContent;
    expect(statementA).toContain(`${narrowParams(expected).a}x + ${narrowParams(expected).b}`);
    first.unmount();

    const second = render(
      <DrillMode templateId={TEMPLATE_ID} seed={SEED} onSeedChange={noop} onExit={noop} />,
    );
    expect(second.container.textContent).toBe(statementA);
  });

  it('accepts an equivalent (unreduced) expression form of the answer', async () => {
    const user = userEvent.setup();
    const noop = () => {};
    const instance = templateEngine.generate(TEMPLATE_ID, SEED);
    const { a, b, c } = narrowParams(instance);

    render(<DrillMode templateId={TEMPLATE_ID} seed={SEED} onSeedChange={noop} onExit={noop} />);

    // Answer with the raw expression (c - b)/a instead of the reduced value
    await user.type(screen.getByLabelText('drill.answerLabel'), `(${c} - ${b})/${a}`);
    await user.click(screen.getByRole('button', { name: /drill\.checkAnswer/ }));

    expect(await screen.findByText('drill.correct')).toBeInTheDocument();
    expect(screen.queryByText('drill.incorrect')).not.toBeInTheDocument();
  });

  it('rejects a wrong answer and surfaces the matching common-mistake explanation', async () => {
    const user = userEvent.setup();
    const noop = () => {};
    const instance = templateEngine.generate(TEMPLATE_ID, SEED);
    const { a, b, c } = narrowParams(instance);
    // The classic sign mistake the template's detector looks for: (c + b)/a
    const wrongAnswer = String((c + b) / a);

    render(<DrillMode templateId={TEMPLATE_ID} seed={SEED} onSeedChange={noop} onExit={noop} />);

    await user.type(screen.getByLabelText('drill.answerLabel'), wrongAnswer);
    await user.click(screen.getByRole('button', { name: /drill\.checkAnswer/ }));

    expect(await screen.findByText('drill.incorrect')).toBeInTheDocument();
    expect(screen.getByText(/added instead of subtracted/i)).toBeInTheDocument();
  });

  it('rejects an off-by-sign answer without a matching detector', async () => {
    const user = userEvent.setup();
    const noop = () => {};
    const instance = templateEngine.generate(TEMPLATE_ID, SEED);
    const { a, b, c } = narrowParams(instance);
    const negated = String(-((c - b) / a));

    render(<DrillMode templateId={TEMPLATE_ID} seed={SEED} onSeedChange={noop} onExit={noop} />);

    await user.type(screen.getByLabelText('drill.answerLabel'), negated);
    await user.click(screen.getByRole('button', { name: /drill\.checkAnswer/ }));

    expect(await screen.findByText('drill.incorrect')).toBeInTheDocument();
  });

  it('Generate another mints a fresh crypto seed via onSeedChange', async () => {
    const user = userEvent.setup();
    const onSeedChange = vi.fn();

    render(
      <DrillMode
        templateId={TEMPLATE_ID}
        seed={SEED}
        onSeedChange={onSeedChange}
        onExit={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: /drill\.generateAnother/ }));

    expect(onSeedChange).toHaveBeenCalledTimes(1);
    const next = onSeedChange.mock.calls[0]?.[0] as { templateId: string; seed: string };
    expect(next.templateId).toBe(TEMPLATE_ID);
    expect(next.seed).not.toBe(SEED);
    expect(next.seed).toMatch(/^[a-z2-9]{8}$/);
  });

  it('reveals hints progressively and counts them', async () => {
    const user = userEvent.setup();
    const noop = () => {};
    const instance = templateEngine.generate(TEMPLATE_ID, SEED);

    render(<DrillMode templateId={TEMPLATE_ID} seed={SEED} onSeedChange={noop} onExit={noop} />);

    const hintButton = screen.getByRole('button', { name: /drill\.showHint/ });
    await user.click(hintButton);
    expect(screen.getByText('drill.hintCost:{"count":1}')).toBeInTheDocument();
    expect(screen.getByText(instance.hints[0] ?? '')).toBeInTheDocument();

    await user.click(hintButton);
    expect(screen.getByText('drill.hintCost:{"count":2}')).toBeInTheDocument();
  });
});
