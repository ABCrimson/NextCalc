/**
 * Accessibility tests for the Data & Regression tab (jest-axe).
 *
 * Guard: native <table> semantics with caption/headers, labelled inputs and
 * an accessibly-named residual toggle — verified with axe, not just biome.
 *
 * The global vitest.setup ResizeObserver mock is a no-op, so DataPointsOverlay
 * (rendered directly inside this tab) never leaves its {width:0,height:0}
 * early-return branch under jsdom — the accessible, keyboard-operable
 * draggable points (`<g role="button" tabIndex={0} aria-label=...>`) would
 * never actually be mounted, so no test in this suite would ever notice a
 * regression to that markup. The "fitted state" test below stubs a firing
 * ResizeObserver so the points actually mount and asserts on them directly
 * (role/tabindex/accessible name); full axe coverage of that exact markup
 * lives in DataPointsOverlay.test.tsx (see the note on that test for why
 * axe() isn't also run here).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataRegressionTab } from '@/components/plots';

vi.mock('@/components/plots/Plot2D', () => ({
  Plot2D: () => <canvas data-testid="plot2d" aria-label="plot" role="img" />,
}));

/** A ResizeObserver stub that immediately fires its callback with a fixed,
 *  non-zero content rect — unlike the global no-op mock in vitest.setup.ts. */
class FiringResizeObserver {
  #callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element) {
    this.#callback(
      [{ target, contentRect: { width: 600, height: 400 } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  unobserve() {}
  disconnect() {}
}

describe('Data & Regression accessibility (WCAG 2.2)', () => {
  it('empty tab has no axe violations', async () => {
    const { container } = render(<DataRegressionTab />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  describe('with draggable data points mounted', () => {
    beforeEach(() => {
      vi.stubGlobal('ResizeObserver', FiringResizeObserver);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('fitted state mounts keyboard-operable draggable points with accessible names', async () => {
      render(<DataRegressionTab />);

      const table = screen.getByRole('table', { name: 'dataTitle' });
      fireEvent.paste(table, {
        clipboardData: { getData: () => '1\t3\n2\t5\n3\t7\n4\t9' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'canned.linear' }));
      await screen.findByText('status.converged');

      // Residual toggle is a labelled switch.
      expect(screen.getByRole('switch', { name: 'residualsToggle' })).toBeInTheDocument();

      // The draggable data points actually mounted (regression guard for the
      // ResizeObserver-mock blind spot described above) and are keyboard
      // operable. (The global next-intl mock returns raw `key:{"args":...}`
      // strings, not the formatted `pointLabel` sentence.)
      const points = screen.getAllByRole('button', { name: /^pointLabel:/ });
      expect(points.length).toBeGreaterThan(0);
      for (const point of points) {
        expect(point).toHaveAttribute('tabindex', '0');
        expect(point).toHaveAccessibleName();
      }

      // NOTE: axe() is intentionally not run in this scenario. The global
      // next-intl mock renders interpolated translations as literal
      // `key:{"x":"1",...}` strings, and axe-core's selector generator
      // crashes under happy-dom when an aria-label contains embedded double
      // quotes (a test-environment interaction bug, not a real accessibility
      // defect — real translated point labels never contain quote
      // characters). The interactive markup itself IS exercised by axe in
      // DataPointsOverlay.test.tsx, which supplies plain-text labels.
    });
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
