/**
 * Component tests for RelationInput.
 * next-intl's useTranslations is globally mocked (vitest.setup.ts) to return
 * the message key itself (or "key:{...}" when interpolation values are
 * passed), so assertions match on those keys rather than rendered prose.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type RelationDefinition, RelationInput } from './RelationInput';

function makeRelation(overrides: Partial<RelationDefinition> = {}): RelationDefinition {
  return {
    id: 'r1',
    expression: '',
    label: 'R1',
    color: '#06b6d4',
    isValid: false,
    error: 'relation.errorEmpty',
    ...overrides,
  };
}

describe('RelationInput', () => {
  it('renders one row per relation with label and expression fields', () => {
    render(<RelationInput relations={[makeRelation()]} onChange={vi.fn()} />);

    expect(screen.getByLabelText('relation.labelField')).toBeInTheDocument();
    expect(screen.getByLabelText('relation.expressionField')).toBeInTheDocument();
  });

  it('shows the empty-state message when there are no relations', () => {
    render(<RelationInput relations={[]} onChange={vi.fn()} />);

    expect(screen.getByText('relation.emptyTitle')).toBeInTheDocument();
    expect(screen.getByText('relation.emptyHint')).toBeInTheDocument();
  });

  it('marks a valid single relation as valid and reports it via onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RelationInput relations={[makeRelation()]} onChange={onChange} />);

    const input = screen.getByLabelText('relation.expressionField');
    await user.type(input, 'x^2 + y^2 = 25');

    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)?.[0] as RelationDefinition[];
    expect(last[0]?.isValid).toBe(true);
    expect(last[0]?.relationCount).toBe(1);
    expect(screen.getByText('relation.validSingle')).toBeInTheDocument();
  });

  it('surfaces a localized parse error inline without crashing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RelationInput relations={[makeRelation()]} onChange={onChange} />);

    const input = screen.getByLabelText('relation.expressionField');
    await user.type(input, 'x^2 + = 5');

    const last = onChange.mock.calls.at(-1)?.[0] as RelationDefinition[];
    expect(last[0]?.isValid).toBe(false);
    expect(last[0]?.error).toBe('relation.errorInvalid');
    expect(screen.getByText('relation.errorInvalid')).toBeInTheDocument();
  });

  it('surfaces a "not a relation" error for a plain (non-relational) expression', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RelationInput relations={[makeRelation()]} onChange={onChange} />);

    const input = screen.getByLabelText('relation.expressionField');
    await user.type(input, 'x^2 + 1');

    const last = onChange.mock.calls.at(-1)?.[0] as RelationDefinition[];
    expect(last[0]?.isValid).toBe(false);
    expect(last[0]?.error).toBe('relation.errorNotRelation');
  });

  it('reports a chained comparison as a multi-relation band', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RelationInput relations={[makeRelation()]} onChange={onChange} />);

    const input = screen.getByLabelText('relation.expressionField');
    await user.type(input, '1 < x < 4');

    const last = onChange.mock.calls.at(-1)?.[0] as RelationDefinition[];
    expect(last[0]?.isValid).toBe(true);
    expect(last[0]?.relationCount).toBe(2);
    expect(screen.getByText('relation.validChained')).toBeInTheDocument();
  });

  it('adds a new relation entry up to maxRelations', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RelationInput
        relations={[makeRelation({ id: 'r1' })]}
        onChange={onChange}
        maxRelations={2}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'relation.addButton' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it('disables the add button once maxRelations is reached', () => {
    render(
      <RelationInput
        relations={[makeRelation({ id: 'r1' }), makeRelation({ id: 'r2' })]}
        onChange={vi.fn()}
        maxRelations={2}
      />,
    );

    expect(screen.getByRole('button', { name: 'relation.addButton' })).toBeDisabled();
  });

  it('removes a relation entry when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RelationInput
        relations={[
          makeRelation({ id: 'r1', label: 'R1' }),
          makeRelation({ id: 'r2', label: 'R2' }),
        ]}
        onChange={onChange}
      />,
    );

    const removeButtons = screen.getAllByRole('button', { name: /relation.removeLabel/ });
    expect(removeButtons[0]).toBeDefined();
    await user.click(removeButtons[0] as HTMLElement);

    const updated = onChange.mock.calls.at(-1)?.[0] as RelationDefinition[];
    expect(updated).toHaveLength(1);
  });
});
