import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CheckWorkPanel } from './check-work-panel';

// Query by placeholder: happy-dom cannot resolve label[for] against React 19
// useId identifiers (guillemet characters), so label-text queries miss.
async function typeAndCheck(input: string) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('inputPlaceholder'), input);
  await user.click(screen.getByRole('button', { name: 'check' }));
}

describe('CheckWorkPanel', () => {
  it('reports equivalence for an equivalent factored form (numeric caption)', async () => {
    render(<CheckWorkPanel canonical="x^2 - 5*x + 6" />);
    await typeAndCheck('(x - 2)*(x - 3)');

    expect(await screen.findByText('equivalent')).toBeInTheDocument();
    expect(screen.getByText('verifiedNumerically')).toBeInTheDocument();
  });

  it('reports symbolic verification when the difference cancels exactly', async () => {
    render(<CheckWorkPanel canonical="0" />);
    await typeAndCheck('x - x');

    expect(await screen.findByText('equivalent')).toBeInTheDocument();
    expect(screen.getByText('verifiedSymbolically')).toBeInTheDocument();
  });

  it('reports non-equivalence for a wrong form', async () => {
    render(<CheckWorkPanel canonical="x^2 - 5*x + 6" />);
    await typeAndCheck('(x - 2)*(x - 4)');

    expect(await screen.findByText('notEquivalent')).toBeInTheDocument();
    expect(screen.queryByText('equivalent')).not.toBeInTheDocument();
  });

  it('reports a parse error for garbage input', async () => {
    render(<CheckWorkPanel canonical="x + 1" />);
    await typeAndCheck('(x +');

    expect(await screen.findByText('parseError')).toBeInTheDocument();
  });

  it('clears the previous verdict when the input changes', async () => {
    render(<CheckWorkPanel canonical="x + 1" />);
    await typeAndCheck('x + 1');
    expect(await screen.findByText('equivalent')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('inputPlaceholder'), '9');
    expect(screen.queryByText('equivalent')).not.toBeInTheDocument();
  });
});
