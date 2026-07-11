/**
 * Component tests for SolverPanel — focused on the Limit tab (roadmap #4,
 * StepTrace) added on top of the pre-existing equation/simplify/derivative/
 * integral tabs: tab wiring, approach-point parsing, ruleId localization
 * (translation vs. engine-English fallback), and category-badge fallback.
 *
 * The global `next-intl` mock in vitest.setup.ts stubs `t()` as an identity
 * function with no `.has()` method, which can't exercise `localizeStep`'s
 * translate-vs-fallback branch. This file overrides that mock with a real
 * lookup against the actual `solver` namespace in messages/en.json, so the
 * translated strings asserted against here are the genuine shipped copy
 * (not test-only fixtures) and `t.has()` behaves like next-intl's own
 * `resolvePath` (dot-segments walk nested objects).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SolverPanel } from './solver-panel';

vi.mock('next-intl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl')>();
  const messages = (await import('../../messages/en.json')).default as Record<string, unknown>;

  function resolveDotPath(root: unknown, dotted: string): unknown {
    return dotted.split('.').reduce<unknown>((node, segment) => {
      if (node && typeof node === 'object' && segment in (node as object)) {
        return (node as Record<string, unknown>)[segment];
      }
      return undefined;
    }, root);
  }

  function interpolate(template: string, values?: Record<string, string | number>): string {
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      name in values ? String(values[name]) : match,
    );
  }

  function makeTranslator(namespace: string) {
    const root = resolveDotPath(messages, namespace) ?? {};
    const t = (key: string, values?: Record<string, string | number>) => {
      const node = resolveDotPath(root, key);
      return typeof node === 'string' ? interpolate(node, values) : key;
    };
    t.has = (key: string) => typeof resolveDotPath(root, key) === 'string';
    return t;
  }

  return {
    ...actual,
    useTranslations: (namespace: string) => makeTranslator(namespace),
    useLocale: () => 'en',
    useFormatter: () => ({
      dateTime: (value: Date) => value.toISOString(),
      number: (value: number) => String(value),
      relativeTime: () => 'just now',
      list: (value: Iterable<string>) => [...value].join(', '),
    }),
    useMessages: () => messages,
    useTimeZone: () => 'UTC',
    useNow: () => new Date(),
  };
});

const mockSolveWithSteps = vi.fn();
const mockLimitWithSteps = vi.fn();

vi.mock('@nextcalc/math-engine/symbolic', () => ({
  ProblemType: {
    Simplification: 'Simplification',
    Equation: 'Equation',
    Derivative: 'Derivative',
    Integral: 'Integral',
    Limit: 'Limit',
    Expansion: 'Expansion',
    Factorization: 'Factorization',
  },
  solveWithSteps: (...args: unknown[]) => mockSolveWithSteps(...args),
  limitWithSteps: (...args: unknown[]) => mockLimitWithSteps(...args),
  integrate: vi.fn(),
  astToString: vi.fn(() => ''),
}));

describe('SolverPanel — Limit tab (StepTrace)', () => {
  beforeEach(() => {
    mockSolveWithSteps.mockReset();
    mockLimitWithSteps.mockReset();
  });

  it('selecting the Limit tab reveals approach-point and direction controls', async () => {
    const user = userEvent.setup();
    render(<SolverPanel />);

    const limitTab = screen.getByRole('tab', { name: /limit/i });
    await user.click(limitTab);

    expect(screen.getByLabelText('Approach point')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 0, inf, -inf')).toBeInTheDocument();
    // Two "Direction" accessible names exist (the <Label> and the select's
    // own aria-label) — assert at least one direction control is present.
    expect(screen.getAllByText('Direction').length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: 'Direction' })).toBeInTheDocument();
  });

  it('parses accepted approach-point formats and forwards them to limitWithSteps', async () => {
    const user = userEvent.setup();
    mockLimitWithSteps.mockReturnValue({
      problem: 'sin(x)/x',
      problemType: 'Limit',
      steps: [
        {
          stepNumber: 1,
          description: 'Final answer',
          explanation: 'The limit is 1.',
          operation: 'Final Answer',
          category: 'FinalAnswer',
          latex: '1',
          to: null,
        },
      ],
      answer: 1,
      timeMs: 1,
    });

    render(<SolverPanel />);
    await user.click(screen.getByRole('tab', { name: /limit/i }));

    const pointInput = screen.getByLabelText('Approach point');
    // The Solve button's aria-label is `${meta.label}: ${input}` (overrides
    // its visible "Show Steps" text) — in Limit mode meta.label is "Limit".
    const solveButton = screen.getByRole('button', { name: /^limit:/i });

    const cases: Array<[string, number | 'infinity' | '-infinity']> = [
      ['3', 3],
      ['inf', 'infinity'],
      ['∞', 'infinity'],
      ['-infinity', '-infinity'],
    ];

    for (const [raw, expectedPoint] of cases) {
      mockLimitWithSteps.mockClear();
      // fireEvent.change (not userEvent.clear+type): this input's `type`
      // resolves correctly in the happy-dom test environment, but the exact
      // per-keystroke edit simulation isn't the thing under test here —
      // only that whatever ends up in the field reaches parseLimitPoint().
      fireEvent.change(pointInput, { target: { value: raw } });
      await user.click(solveButton);

      await waitFor(() => expect(mockLimitWithSteps).toHaveBeenCalledTimes(1));
      const [, , config] = mockLimitWithSteps.mock.calls[0] as [
        string,
        string,
        { point: number | string },
      ];
      expect(config.point).toBe(expectedPoint);
    }
  });

  it('rejects an unparseable approach point with the invalidPoint alert, without calling limitWithSteps', async () => {
    const user = userEvent.setup();
    render(<SolverPanel />);
    await user.click(screen.getByRole('tab', { name: /limit/i }));

    const pointInput = screen.getByLabelText('Approach point');
    fireEvent.change(pointInput, { target: { value: 'banana' } });
    await user.click(screen.getByRole('button', { name: /^limit:/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Enter a valid approach point: a number, inf, or -inf.',
      );
    });
    expect(mockLimitWithSteps).not.toHaveBeenCalled();
  });
});

describe('SolverPanel — ruleId localization (localizeStep)', () => {
  beforeEach(() => {
    mockSolveWithSteps.mockReset();
    mockLimitWithSteps.mockReset();
  });

  it('resolves a ruleId-tagged step through solver.stepRules, not the engine English text', async () => {
    const user = userEvent.setup();
    mockSolveWithSteps.mockReturnValue({
      problem: '2*x + 3 = 7',
      problemType: 'Equation',
      steps: [
        {
          stepNumber: 1,
          description: 'ENGINE FALLBACK TITLE (should not render)',
          explanation: 'ENGINE FALLBACK DETAIL (should not render)',
          operation: 'Divide',
          category: 'Isolation',
          latex: 'x = 2',
          ruleId: 'linear.divide',
          params: { a: '2', variable: 'x', solution: '2' },
          to: null,
        },
      ],
      answer: [{ value: 2, multiplicity: 1 }],
      timeMs: 1,
    });

    render(<SolverPanel />);
    // Default mode is "equation"; the Solve button's aria-label is
    // `${meta.label}: ${input}` (overrides its visible "Show Steps" text).
    await user.click(screen.getByRole('button', { name: /^solve equation:/i }));

    // en.json solver.stepRules.linear.divide.title (no placeholders).
    await waitFor(() => {
      expect(screen.getByText('Divide by the coefficient')).toBeInTheDocument();
    });
    // ICU-interpolated detail is auto-expanded (single step = last step).
    expect(
      screen.getByText('Dividing both sides by 2 isolates x, giving x = 2.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ENGINE FALLBACK/)).not.toBeInTheDocument();
  });

  it('falls back to the engine English text when no translation exists for the ruleId', async () => {
    const user = userEvent.setup();
    mockSolveWithSteps.mockReturnValue({
      problem: '2*x + 3 = 7',
      problemType: 'Equation',
      steps: [
        {
          stepNumber: 1,
          description: 'Untranslated engine description',
          explanation: 'Untranslated engine explanation',
          operation: 'Mystery',
          category: 'TotallyUnknownCategory',
          latex: 'x = 2',
          ruleId: 'linear.totallyMadeUpRuleThatDoesNotExist',
          params: {},
          to: null,
        },
      ],
      answer: [{ value: 2, multiplicity: 1 }],
      timeMs: 1,
    });

    render(<SolverPanel />);
    await user.click(screen.getByRole('button', { name: /^solve equation:/i }));

    await waitFor(() => {
      expect(screen.getByText('Untranslated engine description')).toBeInTheDocument();
    });
    expect(screen.getByText('Untranslated engine explanation')).toBeInTheDocument();

    // Category badge gracefully falls back to the generic "Step" label when
    // neither CATEGORY_STYLES nor solver.stepCategories recognizes the id.
    expect(screen.getByText('Step')).toBeInTheDocument();
  });
});
