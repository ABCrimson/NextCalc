import { describe, expect, it } from 'vitest';
import {
  filterGalleryWorksheets,
  isSimulationCellData,
  simKindsOf,
} from '@/lib/simulation/gallery';

interface Worksheet {
  id: string;
  content: unknown;
}

describe('isSimulationCellData', () => {
  it('accepts a simulation cell shape', () => {
    expect(isSimulationCellData({ kind: 'simulation', sim: 'lorenz' })).toBe(true);
  });

  it('rejects non-simulation cell kinds', () => {
    expect(isSimulationCellData({ kind: 'math', input: '2+2' })).toBe(false);
    expect(isSimulationCellData({ kind: 'text', content: 'hi' })).toBe(false);
  });

  it('rejects malformed / non-object values', () => {
    expect(isSimulationCellData(null)).toBe(false);
    expect(isSimulationCellData(undefined)).toBe(false);
    expect(isSimulationCellData('simulation')).toBe(false);
    expect(isSimulationCellData(42)).toBe(false);
    expect(isSimulationCellData({ kind: 'simulation' })).toBe(false); // missing sim
    expect(isSimulationCellData({ sim: 'lorenz' })).toBe(false); // missing kind
    expect(isSimulationCellData({ kind: 'simulation', sim: 5 })).toBe(false); // sim not a string
  });
});

describe('simKindsOf', () => {
  it('collects unique simulation kinds from a cell array', () => {
    const content = [
      { kind: 'math', input: 'x=1' },
      { kind: 'simulation', sim: 'pde-heat' },
      { kind: 'simulation', sim: 'lorenz' },
      { kind: 'simulation', sim: 'pde-heat' }, // duplicate
    ];
    expect(simKindsOf(content).sort()).toEqual(['lorenz', 'pde-heat']);
  });

  it('returns an empty array for a worksheet with no simulation cells', () => {
    const content = [
      { kind: 'math', input: 'x=1' },
      { kind: 'text', content: 'notes' },
    ];
    expect(simKindsOf(content)).toEqual([]);
  });

  it('returns an empty array for malformed content (not an array)', () => {
    expect(simKindsOf(null)).toEqual([]);
    expect(simKindsOf(undefined)).toEqual([]);
    expect(simKindsOf('not-an-array')).toEqual([]);
    expect(simKindsOf({ kind: 'simulation', sim: 'lorenz' })).toEqual([]);
  });

  it('skips malformed cells within an otherwise valid array', () => {
    const content = [null, 42, { kind: 'simulation', sim: 'lorenz' }, { notACell: true }];
    expect(simKindsOf(content)).toEqual(['lorenz']);
  });
});

describe('filterGalleryWorksheets', () => {
  it('keeps only worksheets containing at least one simulation cell', () => {
    const worksheets: Worksheet[] = [
      { id: 'text-only', content: [{ kind: 'text', content: 'hi' }] },
      { id: 'has-sim', content: [{ kind: 'simulation', sim: 'lorenz' }] },
      { id: 'empty', content: [] },
      {
        id: 'multi-sim',
        content: [
          { kind: 'simulation', sim: 'pde-wave' },
          { kind: 'simulation', sim: 'direction-field' },
        ],
      },
    ];

    const result = filterGalleryWorksheets(worksheets);

    expect(result.map((item) => item.worksheet.id)).toEqual(['has-sim', 'multi-sim']);
  });

  it('attaches the distinct simKinds alongside each surviving worksheet', () => {
    const worksheets: Worksheet[] = [
      {
        id: 'multi-sim',
        content: [
          { kind: 'simulation', sim: 'pde-wave' },
          { kind: 'simulation', sim: 'direction-field' },
        ],
      },
    ];

    const result = filterGalleryWorksheets(worksheets);

    expect(result).toHaveLength(1);
    expect(result[0]?.simKinds.sort()).toEqual(['direction-field', 'pde-wave']);
  });

  it('returns an empty array when nothing qualifies', () => {
    const worksheets: Worksheet[] = [
      { id: 'a', content: [{ kind: 'text', content: 'hi' }] },
      { id: 'b', content: [] },
    ];
    expect(filterGalleryWorksheets(worksheets)).toEqual([]);
  });

  it('returns an empty array for an empty worksheet list', () => {
    expect(filterGalleryWorksheets([])).toEqual([]);
  });
});
