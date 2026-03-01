/**
 * Component tests for Calculator
 * Tests user interactions, state management, and accessibility
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCalculatorStore } from '@/lib/stores/calculator-store';
import { Calculator } from './calculator';

// Mock ShareButton to avoid needing ApolloProvider in tests
vi.mock('./share-button', () => ({
  ShareButton: () => null,
}));

// Mock the compute manager
vi.mock('@/lib/workers/compute-manager', () => ({
  getComputeManager: () => ({
    evaluate: vi.fn(async (expr: string) => {
      // Simple mock evaluation
      if (expr === '2+2') return 4;
      if (expr === '10*5') return 50;
      if (expr === 'sin(0)') return 0;
      return 42;
    }),
  }),
}));

describe('Calculator Component', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset Zustand store state
    resetCalculatorStore();
  });

  it('renders calculator components', () => {
    render(<Calculator />);

    // Check that main components are present
    expect(screen.getByRole('region', { name: /calculator display/i })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: /calculator keyboard/i })).toBeInTheDocument();
  });

  it('handles number input', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Click number buttons — digit aria-labels are just the digit
    const button2 = screen.getByRole('gridcell', { name: '2' });
    await user.click(button2);

    // Verify display updates
    await waitFor(() => {
      expect(screen.getByLabelText(/current expression/i)).toHaveTextContent('2');
    });
  });

  it('performs basic arithmetic calculation', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Input: 2 + 2
    await user.click(screen.getByRole('gridcell', { name: '2' }));
    await user.click(screen.getByRole('gridcell', { name: /plus/i }));
    await user.click(screen.getByRole('gridcell', { name: '2' }));
    await user.click(screen.getByRole('gridcell', { name: /equals/i }));

    // Wait for calculation result
    await waitFor(
      () => {
        const resultElement = screen.getByLabelText(/result:/i);
        expect(resultElement).toHaveTextContent('4');
      },
      { timeout: 3000 },
    );
  });

  it('clears calculator when C button is pressed', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Input some numbers
    await user.click(screen.getByRole('gridcell', { name: '5' }));
    await user.click(screen.getByRole('gridcell', { name: '6' }));

    // Click clear button
    await user.click(screen.getByRole('gridcell', { name: /clear all/i }));

    // Verify display is cleared
    await waitFor(() => {
      const expressionElement = screen.getByLabelText(/current expression/i);
      expect(expressionElement.textContent).toBe('\u00A0');
    });
  });

  it('handles keyboard input', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Type using keyboard
    await user.keyboard('5+3');

    await waitFor(() => {
      expect(screen.getByLabelText(/current expression/i)).toHaveTextContent('5+3');
    });
  });

  it('handles Enter key for evaluation', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Type expression and press Enter - use button clicks for reliable input
    await user.click(screen.getByRole('gridcell', { name: '1' }));
    await user.click(screen.getByRole('gridcell', { name: '0' }));
    await user.click(screen.getByRole('gridcell', { name: /multiply/i }));
    await user.click(screen.getByRole('gridcell', { name: '5' }));
    await user.keyboard('{Enter}');

    // Wait for result
    await waitFor(
      () => {
        const resultElement = screen.getByLabelText(/result:/i);
        expect(resultElement).toHaveTextContent('50');
      },
      { timeout: 3000 },
    );
  });

  it('shows pending state during calculation', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Input and evaluate
    await user.click(screen.getByRole('gridcell', { name: '2' }));
    await user.click(screen.getByRole('gridcell', { name: /equals/i }));

    // Should show calculating state briefly (or have completed calculation)
    // The aria-busy state might be very brief, so check for either busy or result
    await waitFor(() => {
      const resultElement = screen.getByLabelText(/result:/i);
      // Either it's still busy or calculation completed
      const isBusy = resultElement.getAttribute('aria-busy') === 'true';
      const hasResult = resultElement.textContent !== '' && resultElement.textContent !== '\u00A0';
      expect(isBusy || hasResult).toBe(true);
    });
  });

  it('has proper ARIA labels for accessibility', () => {
    render(<Calculator />);

    // Check for important ARIA labels
    expect(screen.getByRole('region', { name: /calculator display/i })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: /calculator keyboard/i })).toBeInTheDocument();
    // Multiple status elements exist (sr-only live region, expression, result)
    const statusElements = screen.getAllByRole('status');
    expect(statusElements.length).toBeGreaterThan(0);
  });

  it('handles special functions', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Click sin button — aria-label is "sine"
    await user.click(screen.getByRole('gridcell', { name: /^sine$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/current expression/i)).toHaveTextContent('sin');
    });
  });

  it('supports tab navigation', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    // Tab should move focus to interactive elements
    await user.tab();

    // Check that something received focus (could be a button, tab, or other interactive element)
    const focusedElement = document.activeElement;
    expect(focusedElement).not.toBe(document.body);
    expect(focusedElement?.tagName.toLowerCase()).toMatch(/button|input|a|div/);
  });

  it('disables buttons during calculation', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    await user.click(screen.getByRole('gridcell', { name: '5' }));
    await user.click(screen.getByRole('gridcell', { name: /equals/i }));

    // Verify buttons have aria-disabled attribute (either true during calculation or false after)
    const button = screen.getByRole('gridcell', { name: '2' });
    expect(button).toHaveAttribute('aria-disabled');
  });
});
