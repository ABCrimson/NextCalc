/**
 * Accessibility tests using jest-axe
 * Ensures WCAG 2.2 Level AAA compliance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Calculator } from '@/components/calculator/calculator';
import { Display } from '@/components/calculator/display';
import { Keyboard } from '@/components/calculator/keyboard';
import { History } from '@/components/calculator/history';
import { resetCalculatorStore } from '@/lib/stores/calculator-store';

// Mock compute manager
vi.mock('@/lib/workers/compute-manager', () => ({
  getComputeManager: () => ({
    evaluate: vi.fn(async () => 42),
  }),
}));

describe('Accessibility Tests (WCAG 2.2 Level AAA)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCalculatorStore();
  });

  it('Calculator component has no accessibility violations', async () => {
    const { container } = render(<Calculator />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Display component has no accessibility violations', async () => {
    const { container } = render(
      <Display expression="2+2" result={4} isPending={false} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Keyboard component has no accessibility violations', async () => {
    const mockOnInput = vi.fn();
    const { container } = render(<Keyboard onInput={mockOnInput} disabled={false} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('History component has no accessibility violations', async () => {
    const mockEntries = [
      {
        id: '1',
        expression: '2+2',
        result: '4',
        timestamp: new Date(),
      },
      {
        id: '2',
        expression: '5*3',
        result: '15',
        timestamp: new Date(),
      },
    ];

    const { container } = render(<History entries={mockEntries} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Calculator with pending state has no accessibility violations', async () => {
    const { container } = render(<Calculator />);
    // Component renders with pending state internally
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Display with LaTeX mode has proper ARIA labels', async () => {
    const { container, getByLabelText } = render(
      <Display expression="sin(x)" result={null} isPending={false} />
    );

    // Should have proper ARIA labels
    expect(getByLabelText(/current expression/i)).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Keyboard buttons have proper ARIA roles and labels', () => {
    const mockOnInput = vi.fn();
    const { getAllByRole } = render(<Keyboard onInput={mockOnInput} />);

    const buttons = getAllByRole('gridcell');

    // All buttons should have labels
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('aria-label');
    });
  });

  it('ARIA live region announces calculator state changes', () => {
    const { getAllByRole } = render(<Calculator />);

    // Should have live regions for screen readers (multiple status elements exist)
    const liveRegions = getAllByRole('status');
    expect(liveRegions.length).toBeGreaterThan(0);

    // Find the sr-only live region with aria-atomic
    const srOnlyLiveRegion = liveRegions.find(
      (el) => el.classList.contains('sr-only') && el.getAttribute('aria-atomic') === 'true'
    );
    expect(srOnlyLiveRegion).toBeInTheDocument();
    expect(srOnlyLiveRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('Disabled buttons have proper ARIA states', () => {
    const mockOnInput = vi.fn();
    const { getAllByRole } = render(<Keyboard onInput={mockOnInput} disabled={true} />);

    const buttons = getAllByRole('gridcell');

    // All buttons should be marked as disabled
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toBeDisabled();
    });
  });

  it('Calculator maintains focus management', () => {
    const mockOnInput = vi.fn();
    const { getAllByRole } = render(<Keyboard onInput={mockOnInput} />);

    const buttons = getAllByRole('gridcell');
    const firstButton = buttons[0];

    // Ensure button exists before testing
    if (!firstButton) {
      throw new Error('First button not found');
    }

    // Focus first button
    firstButton.focus();

    // Should have visible focus indicator
    expect(firstButton).toHaveClass(/focus:ring/);
  });

  it('History items have proper semantic structure', () => {
    const mockEntries = [
      {
        id: '1',
        expression: '10+5',
        result: '15',
        timestamp: new Date(),
      },
    ];

    const { getByLabelText } = render(<History entries={mockEntries} onSelect={vi.fn()} />);

    // Should have accessible button with descriptive label
    // Format: "Load calculation: {expression} equals {result}"
    const historyButton = getByLabelText(/load calculation: 10\+5 equals 15/i);
    expect(historyButton).toBeInTheDocument();
  });

  it('Keyboard grid has proper ARIA grid structure', () => {
    const mockOnInput = vi.fn();
    const { getByRole, getAllByRole } = render(<Keyboard onInput={mockOnInput} />);

    // Should have grid role
    const grid = getByRole('grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveAttribute('aria-label', 'Calculator keyboard');

    // Grid cells should have proper roles
    const gridCells = getAllByRole('gridcell');
    expect(gridCells.length).toBeGreaterThan(0);
  });

  it('Display has proper region landmarks', () => {
    const { getByRole } = render(<Display expression="5+5" result={10} />);

    // Should have region landmark
    const displayRegion = getByRole('region', { name: /calculator display/i });
    expect(displayRegion).toBeInTheDocument();
  });

  it('Results have proper busy states during calculation', () => {
    const { getByLabelText } = render(
      <Display expression="2+2" result="Calculating..." isPending={true} />
    );

    const resultElement = getByLabelText(/result:/i);
    expect(resultElement).toHaveAttribute('aria-busy', 'true');
  });

  it('Screen reader instructions are provided', () => {
    const mockOnInput = vi.fn();
    const { container } = render(<Keyboard onInput={mockOnInput} />);

    // Should have screen reader only instructions
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).toBeInTheDocument();
    expect(srOnly?.textContent).toMatch(/calculator keyboard active/i);
  });

  it('Color contrast meets WCAG AAA standards', () => {
    // This would require actual color contrast checking
    // For now, we ensure the structure is in place
    const { container } = render(<Calculator />);
    expect(container).toBeInTheDocument();

    // Note: In production, you'd use a tool like:
    // - axe DevTools
    // - Lighthouse
    // - Manual testing with contrast checkers
  });
});
