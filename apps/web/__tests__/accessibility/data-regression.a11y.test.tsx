/**
 * Accessibility tests for the Data & Regression tab (jest-axe).
 *
 * Guard: native <table> semantics with caption/headers, labelled inputs and
 * an accessibly-named residual toggle — verified with axe, not just biome.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { DataRegressionTab } from '@/components/plots';

vi.mock('@/components/plots/Plot2D', () => ({
  Plot2D: () => <canvas data-testid="plot2d" aria-label="plot" role="img" />,
}));

describe('Data & Regression accessibility (WCAG 2.2)', () => {
  it('empty tab has no axe violations', async () => {
    const { container } = render(<DataRegressionTab />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('fitted state (stats panel + toggle) has no axe violations', async () => {
    const { container } = render(<DataRegressionTab />);

    const table = screen.getByRole('table', { name: 'dataTitle' });
    fireEvent.paste(table, {
      clipboardData: { getData: () => '1\t3\n2\t5\n3\t7\n4\t9' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'canned.linear' }));
    await screen.findByText('status.converged');

    // Residual toggle is a labelled switch.
    expect(screen.getByRole('switch', { name: 'residualsToggle' })).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('data table uses native semantics: caption and column headers', () => {
    render(<DataRegressionTab />);

    const table = screen.getByRole('table', { name: 'dataTitle' });
    expect(table.querySelector('caption')).not.toBeNull();
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThanOrEqual(2);
    // Every data cell input is labelled.
    for (const input of screen.getAllByRole('textbox')) {
      expect(input).toHaveAccessibleName();
    }
  });
});
