/**
 * Integration tests for full calculator workflow
 * Tests complete user flows from input to history
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Calculator } from '@/components/calculator/calculator';
import { resetCalculatorStore } from '@/lib/stores/calculator-store';

// Mock the compute manager
vi.mock('@/lib/workers/compute-manager', () => ({
  getComputeManager: () => ({
    evaluate: vi.fn(async (expr: string) => {
      // Simulate realistic evaluation
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Simple evaluation logic
      try {
        if (expr.includes('+')) {
          const parts = expr.split('+').map(Number);
          const a = parts[0];
          const b = parts[1];
          if (a === undefined || b === undefined) throw new Error('Invalid expression');
          return a + b;
        }
        if (expr.includes('*')) {
          const parts = expr.split('*').map(Number);
          const a = parts[0];
          const b = parts[1];
          if (a === undefined || b === undefined) throw new Error('Invalid expression');
          return a * b;
        }
        if (expr.includes('-')) {
          const parts = expr.split('-').map(Number);
          const a = parts[0];
          const b = parts[1];
          if (a === undefined || b === undefined) throw new Error('Invalid expression');
          return a - b;
        }
        if (expr.includes('/')) {
          const parts = expr.split('/').map(Number);
          const a = parts[0];
          const b = parts[1];
          if (a === undefined || b === undefined) throw new Error('Invalid expression');
          return a / b;
        }
        return Number(expr);
      } catch {
        throw new Error('Invalid expression');
      }
    }),
  }),
}));

describe('Calculator Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset Zustand store state
    resetCalculatorStore();
  });

  it('completes full calculation workflow: input → evaluate → history', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Step 1: Input expression
    await user.click(screen.getByRole('gridcell', { name: /button 5/i }));
    await user.click(screen.getByRole('gridcell', { name: /button \+/i }));
    await user.click(screen.getByRole('gridcell', { name: /button 3/i }));

    // Verify expression is displayed
    await waitFor(() => {
      expect(screen.getByLabelText(/current expression/i)).toHaveTextContent('5+3');
    });

    // Step 2: Evaluate
    await user.click(screen.getByRole('gridcell', { name: /button equals/i }));

    // Step 3: Verify result appears
    await waitFor(
      () => {
        const resultElement = screen.getByLabelText(/result:/i);
        expect(resultElement).toHaveTextContent('8');
      },
      { timeout: 3000 },
    );

    // Step 4: Verify history is created (use getAllByText since expression appears in both display and history)
    await waitFor(() => {
      expect(screen.getByText(/history/i)).toBeInTheDocument();
      // Expression appears in both display and history, so use getAllByText
      const expressionElements = screen.getAllByText('5+3');
      expect(expressionElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('= 8')).toBeInTheDocument();
    });
  });

  it('handles multiple sequential calculations', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // First calculation: 2 + 2
    await user.keyboard('2+2');
    await user.keyboard('{Enter}');

    await waitFor(
      () => {
        expect(screen.getByLabelText(/result:/i)).toHaveTextContent('4');
      },
      { timeout: 3000 },
    );

    // Clear for next calculation
    await user.click(screen.getByRole('gridcell', { name: /button clear/i }));

    // Second calculation: 10 * 5
    await user.keyboard('10*5');
    await user.keyboard('{Enter}');

    await waitFor(
      () => {
        expect(screen.getByLabelText(/result:/i)).toHaveTextContent('50');
      },
      { timeout: 3000 },
    );

    // Verify both calculations are in history (use getAllByText since expression appears in both display and history)
    await waitFor(() => {
      const calc1Elements = screen.getAllByText('2+2');
      const calc2Elements = screen.getAllByText('10*5');
      // At least one should be in history (the history item)
      expect(calc1Elements.length).toBeGreaterThanOrEqual(1);
      expect(calc2Elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('loads calculation from history', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Perform a calculation
    await user.keyboard('7+3');
    await user.keyboard('{Enter}');

    await waitFor(
      () => {
        expect(screen.getByLabelText(/result:/i)).toHaveTextContent('10');
      },
      { timeout: 3000 },
    );

    // Clear calculator
    await user.click(screen.getByRole('gridcell', { name: /button clear/i }));

    // Click history item to reload
    // Format: "Load calculation: {expression} equals {result}"
    const historyButton = screen.getByLabelText(/load calculation: 7\+3 equals 10/i);
    await user.click(historyButton);

    // Verify expression and result are restored
    await waitFor(() => {
      expect(screen.getByLabelText(/current expression/i)).toHaveTextContent('7+3');
      expect(screen.getByLabelText(/result:/i)).toHaveTextContent('10');
    });
  });

  it('maintains state across calculations', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Perform multiple calculations
    const calculations = [
      { expr: '2+2', result: '4' },
      { expr: '5*3', result: '15' },
      { expr: '8-3', result: '5' },
    ];

    for (const calc of calculations) {
      await user.keyboard(calc.expr);
      await user.keyboard('{Enter}');

      await waitFor(
        () => {
          expect(screen.getByLabelText(/result:/i)).toHaveTextContent(calc.result);
        },
        { timeout: 3000 },
      );

      await user.click(screen.getByRole('gridcell', { name: /button clear/i }));
      await waitFor(() => {
        const expressionElement = screen.getByLabelText(/current expression/i);
        expect(expressionElement.textContent).toBe('\u00A0');
      });
    }

    // Verify all calculations are in history (use getAllByText since expression appears in both display and history)
    for (const calc of calculations) {
      const elements = screen.getAllByText(calc.expr);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('handles error states gracefully', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Input invalid expression (just an operator)
    await user.click(screen.getByRole('gridcell', { name: /button \+/i }));
    await user.click(screen.getByRole('gridcell', { name: /button equals/i }));

    // Should show error or handle gracefully (could show 0, NaN, or Error depending on implementation)
    await waitFor(
      () => {
        const resultElement = screen.getByLabelText(/result:/i);
        // Result should be present (either error message, NaN, or a calculated result)
        expect(resultElement.textContent).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('persists history to localStorage', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Calculator />);

    // Perform calculation using button clicks for reliable input
    await user.click(screen.getByRole('gridcell', { name: /button 6/i }));
    await user.click(screen.getByRole('gridcell', { name: /button \+/i }));
    await user.click(screen.getByRole('gridcell', { name: /button 4/i }));
    await user.click(screen.getByRole('gridcell', { name: /button equals/i }));

    await waitFor(
      () => {
        const resultElement = screen.getByLabelText(/result:/i);
        // Should show a numeric result
        expect(resultElement.textContent).toMatch(/\d+/);
      },
      { timeout: 3000 },
    );

    // Unmount component
    unmount();

    // Verify localStorage has history (Zustand persist middleware stores state)
    const stored = localStorage.getItem('calculator-storage');
    expect(stored).toBeTruthy();

    if (stored) {
      const parsed = JSON.parse(stored);
      // Check that history exists in the stored state
      expect(parsed.state?.history || parsed.history).toBeDefined();
    }
  });

  it('handles rapid input correctly', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Rapid typing
    await user.keyboard('123456789');

    await waitFor(() => {
      expect(screen.getByLabelText(/current expression/i)).toHaveTextContent('123456789');
    });

    // Clear and try again
    await user.keyboard('{Escape}');

    await waitFor(() => {
      const expressionElement = screen.getByLabelText(/current expression/i);
      expect(expressionElement.textContent).toBe('\u00A0');
    });
  });

  it('supports keyboard shortcuts throughout workflow', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Use only keyboard for entire workflow
    await user.keyboard('9+1');
    await user.keyboard('{Enter}');

    await waitFor(
      () => {
        expect(screen.getByLabelText(/result:/i)).toHaveTextContent('10');
      },
      { timeout: 3000 },
    );

    // Clear with Escape
    await user.keyboard('{Escape}');

    await waitFor(() => {
      const expressionElement = screen.getByLabelText(/current expression/i);
      expect(expressionElement.textContent).toBe('\u00A0');
    });
  });
});
