/**
 * Tests for the Data & Regression tab.
 *
 * Uses the REAL @nextcalc/math-engine fit implementation (workspace source
 * exports); only Plot2D is mocked because jsdom cannot initialize WebGL.
 * The global vitest.setup next-intl mock returns raw message keys, so
 * assertions target keys (e.g. 'status.converged'), while useFormatter
 * numbers format normally ('1.0000').
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataRegressionTab } from './DataRegressionTab';

vi.mock('@/components/plots/Plot2D', () => ({
  Plot2D: () => <canvas data-testid="plot2d" />,
}));

/** Fires a spreadsheet-style paste event on the data table. */
function pasteIntoTable(payload: string) {
  const table = screen.getByRole('table', { name: 'dataTitle' });
  fireEvent.paste(table, {
    clipboardData: { getData: () => payload },
  });
}

describe('DataRegressionTab', () => {
  it('populates cells from a pasted TSV block', () => {
    render(<DataRegressionTab />);
    pasteIntoTable('1\t2\n2\t4\n3\t6');

    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('6')).toBeInTheDocument();
  });

  it('fills the model input from a canned chip', () => {
    render(<DataRegressionTab />);
    fireEvent.click(screen.getByRole('button', { name: 'canned.linear' }));

    expect(screen.getByLabelText('modelLabel')).toHaveValue('y1 ~ m*x1 + b');
  });

  it('shows R² 1.0000 and a converged badge for perfect linear data', async () => {
    render(<DataRegressionTab />);
    pasteIntoTable('1\t3\n2\t5\n3\t7\n4\t9');
    fireEvent.click(screen.getByRole('button', { name: 'canned.linear' }));

    // The fit trails by a deferred frame; findBy* flushes it inside act.
    expect(await screen.findByText('status.converged')).toBeInTheDocument();
    expect(await screen.findByText('1.0000')).toBeInTheDocument();
    expect(screen.getByText('stats.title')).toBeInTheDocument();
  });

  it('shows a translated failure and no stats for an invalid model', async () => {
    render(<DataRegressionTab />);
    pasteIntoTable('1\t3\n2\t5\n3\t7');
    fireEvent.change(screen.getByLabelText('modelLabel'), {
      target: { value: 'y1 a*x1' },
    });

    expect(await screen.findByText('status.invalidModel')).toBeInTheDocument();
    expect(screen.queryByText('stats.title')).not.toBeInTheDocument();
  });

  it('flags an invalid column identifier with aria-invalid', () => {
    render(<DataRegressionTab />);
    const headers = screen.getAllByLabelText('columnName');
    const first = headers[0];
    if (!first) throw new Error('column header input not found');

    fireEvent.change(first, { target: { value: '1abc' } });

    expect(screen.getAllByLabelText('columnName')[0]).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('invalidColumnName')).toBeInTheDocument();
  });

  it('gates the fit with an honest failure when two columns share a name', async () => {
    render(<DataRegressionTab />);
    pasteIntoTable('1\t10\n2\t20\n3\t30\n4\t40');

    // Rename the y column (index 1) to collide with the x column's name —
    // buildDataRecord would otherwise silently collapse both columns into a
    // single key, feeding a self-referential model a vacuous "perfect" fit.
    const headers = screen.getAllByLabelText('columnName');
    const second = headers[1];
    if (!second) throw new Error('column header input not found');
    fireEvent.change(second, { target: { value: 'x1' } });

    fireEvent.change(screen.getByLabelText('modelLabel'), {
      target: { value: 'x1 ~ m*x1 + b' },
    });

    expect(await screen.findByText('status.invalidModel')).toBeInTheDocument();
    expect(screen.queryByText('1.0000')).not.toBeInTheDocument();
  });

  it('parses a comma-decimal single-column paste instead of splitting the decimal comma', () => {
    render(<DataRegressionTab />);
    // de/fr/ru/uk locale spreadsheets render 1.5 as "1,5"; a single-column
    // copy is newline-separated with no tabs or semicolons.
    pasteIntoTable('1,5\n2,5\n3,5');

    expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3.5')).toBeInTheDocument();
    // Must NOT have been split into a bogus second column of "5"s.
    expect(screen.queryByDisplayValue('5')).not.toBeInTheDocument();
  });

  it('reports an honest failure for degenerate data (all x identical)', async () => {
    render(<DataRegressionTab />);
    pasteIntoTable('5\t1\n5\t2\n5\t3\n5\t4');
    fireEvent.click(screen.getByRole('button', { name: 'canned.linear' }));

    // Either an explicit failure alert or a converged-but-poor fit is
    // acceptable mathematically — but NEVER a silent perfect fit.
    const failure = await screen
      .findByText('status.singular')
      .catch(() => screen.findByText('stats.title'));
    expect(failure).toBeInTheDocument();
    expect(screen.queryByText('1.0000')).not.toBeInTheDocument();
  });
});
