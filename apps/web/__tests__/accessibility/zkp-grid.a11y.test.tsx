/**
 * Accessibility regression test for the ZKP commitment-cell grid.
 *
 * Guards the WAI-ARIA grid pattern in ZKPComputeVisualizer:
 *   role="grid"  →  role="row" (display:contents)  →  role="gridcell"
 *
 * A previous flatter structure (gridcells directly under role="grid", no row
 * layer) satisfied the Biome a11y lint rules but FAILED axe-core's
 * `aria-required-children` / `aria-required-parent` checks. This test renders
 * the real component and asserts both the DOM containment and a clean axe run,
 * so the row layer can never silently regress.
 */

import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { ZKPComputeVisualizer } from '@/components/algorithms/ZKPComputeVisualizer';

describe('ZKPComputeVisualizer grid accessibility (WAI-ARIA grid pattern)', () => {
  it('renders a grid → row → gridcell hierarchy with no axe violations', async () => {
    // 16 rounds × 8 cols = 2 rows; injectFailures off keeps the run deterministic.
    const { container } = render(<ZKPComputeVisualizer roundCount={16} injectFailures={false} />);

    // The auto-build effect seeds the cells asynchronously — wait for them.
    const cells = await screen.findAllByRole('gridcell');
    expect(cells).toHaveLength(16);

    // Exactly one grid, owning the expected number of rows.
    const grids = screen.getAllByRole('grid');
    expect(grids).toHaveLength(1);
    const grid = grids[0];

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(Math.ceil(16 / 8));

    // Containment: every row's parent is the grid; every gridcell's parent is a row.
    for (const row of rows) {
      expect(row.parentElement).toBe(grid);
    }
    for (const cell of cells) {
      expect(cell.parentElement?.getAttribute('role')).toBe('row');
    }

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
