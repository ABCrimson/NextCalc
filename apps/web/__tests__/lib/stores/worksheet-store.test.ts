import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useWorksheetStore } from '@/lib/stores/worksheet-store';

function getStore() {
  return useWorksheetStore.getState();
}

describe('worksheet-store', () => {
  beforeEach(() => {
    getStore().resetWorksheet();
  });

  afterEach(() => {
    getStore().resetWorksheet();
  });

  describe('initial state', () => {
    it('starts with a default worksheet', () => {
      const { worksheet } = getStore();
      expect(worksheet.title).toBe('Untitled Worksheet');
      expect(worksheet.cells).toHaveLength(1);
      expect(worksheet.cells[0].kind).toBe('math');
    });

    it('starts with isDirty false', () => {
      expect(getStore().isDirty).toBe(false);
    });

    it('starts with no worksheetId', () => {
      expect(getStore().worksheetId).toBeNull();
    });
  });

  describe('addCell', () => {
    it('adds a math cell at the end', () => {
      getStore().addCell('math');
      expect(getStore().worksheet.cells).toHaveLength(2);
      expect(getStore().worksheet.cells[1].kind).toBe('math');
    });

    it('adds a text cell', () => {
      getStore().addCell('text');
      const cells = getStore().worksheet.cells;
      expect(cells[cells.length - 1].kind).toBe('text');
    });

    it('adds a plot cell', () => {
      getStore().addCell('plot');
      const cells = getStore().worksheet.cells;
      const plotCell = cells[cells.length - 1];
      expect(plotCell.kind).toBe('plot');
      if (plotCell.kind === 'plot') {
        expect(plotCell.expressions).toBe('sin(x)');
        expect(plotCell.xMin).toBe(-10);
        expect(plotCell.xMax).toBe(10);
      }
    });

    it('inserts after a specific cell', () => {
      const firstCellId = getStore().worksheet.cells[0].id;
      getStore().addCell('text', firstCellId);
      const cells = getStore().worksheet.cells;
      expect(cells).toHaveLength(2);
      expect(cells[1].kind).toBe('text');
    });

    it('returns the new cell id', () => {
      const id = getStore().addCell('math');
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('marks the worksheet as dirty', () => {
      getStore().addCell('math');
      expect(getStore().isDirty).toBe(true);
    });
  });

  describe('deleteCell', () => {
    it('removes a cell by id', () => {
      const secondId = getStore().addCell('math');
      getStore().deleteCell(secondId);
      expect(getStore().worksheet.cells).toHaveLength(1);
    });

    it('keeps at least one cell', () => {
      const onlyCell = getStore().worksheet.cells[0].id;
      getStore().deleteCell(onlyCell);
      expect(getStore().worksheet.cells).toHaveLength(1);
    });

    it('does nothing for non-existent id', () => {
      getStore().addCell('math');
      getStore().deleteCell('nonexistent');
      expect(getStore().worksheet.cells).toHaveLength(2);
    });
  });

  describe('moveCellUp / moveCellDown', () => {
    it('moves a cell up', () => {
      const secondId = getStore().addCell('text');
      const firstId = getStore().worksheet.cells[0].id;

      getStore().moveCellUp(secondId);

      const cells = getStore().worksheet.cells;
      expect(cells[0].id).toBe(secondId);
      expect(cells[1].id).toBe(firstId);
    });

    it('does not move the first cell up', () => {
      getStore().addCell('text');
      const firstId = getStore().worksheet.cells[0].id;
      getStore().moveCellUp(firstId);
      expect(getStore().worksheet.cells[0].id).toBe(firstId);
    });

    it('moves a cell down', () => {
      const firstId = getStore().worksheet.cells[0].id;
      const secondId = getStore().addCell('text');

      getStore().moveCellDown(firstId);

      const cells = getStore().worksheet.cells;
      expect(cells[0].id).toBe(secondId);
      expect(cells[1].id).toBe(firstId);
    });

    it('does not move the last cell down', () => {
      const secondId = getStore().addCell('text');
      getStore().moveCellDown(secondId);
      const cells = getStore().worksheet.cells;
      expect(cells[cells.length - 1].id).toBe(secondId);
    });
  });

  describe('content mutations', () => {
    it('updates math cell input', () => {
      const cellId = getStore().worksheet.cells[0].id;
      getStore().updateMathInput(cellId, '2 + 3');

      const cell = getStore().worksheet.cells[0];
      expect(cell.kind === 'math' && cell.input).toBe('2 + 3');
    });

    it('resets math cell state when input changes', () => {
      const cellId = getStore().worksheet.cells[0].id;
      getStore().setMathResult(cellId, '5', '2+3', []);
      getStore().updateMathInput(cellId, 'new input');

      const cell = getStore().worksheet.cells[0];
      if (cell.kind === 'math') {
        expect(cell.status).toBe('idle');
        expect(cell.result).toBeNull();
        expect(cell.latex).toBeNull();
      }
    });

    it('updates text cell content', () => {
      const textId = getStore().addCell('text');
      getStore().updateTextContent(textId, '# Hello');
      const cell = getStore().worksheet.cells.find((c) => c.id === textId);
      expect(cell?.kind === 'text' && cell.content).toBe('# Hello');
    });

    it('updates plot expressions', () => {
      const plotId = getStore().addCell('plot');
      getStore().updatePlotExpressions(plotId, 'cos(x), tan(x)');
      const cell = getStore().worksheet.cells.find((c) => c.id === plotId);
      expect(cell?.kind === 'plot' && cell.expressions).toBe('cos(x), tan(x)');
    });

    it('updates plot viewport', () => {
      const plotId = getStore().addCell('plot');
      getStore().updatePlotViewport(plotId, { xMin: -5, xMax: 5, yMin: -2, yMax: 2 });
      const cell = getStore().worksheet.cells.find((c) => c.id === plotId);
      if (cell?.kind === 'plot') {
        expect(cell.xMin).toBe(-5);
        expect(cell.xMax).toBe(5);
        expect(cell.yMin).toBe(-2);
        expect(cell.yMax).toBe(2);
      }
    });
  });

  describe('evaluation state', () => {
    it('sets math cell to pending', () => {
      const cellId = getStore().worksheet.cells[0].id;
      getStore().setMathPending(cellId);

      const cell = getStore().worksheet.cells[0];
      expect(cell.kind === 'math' && cell.status).toBe('pending');
    });

    it('sets math result', () => {
      const cellId = getStore().worksheet.cells[0].id;
      getStore().setMathResult(cellId, '42', '42', [{ name: 'x', value: 42 }]);

      const cell = getStore().worksheet.cells[0];
      if (cell.kind === 'math') {
        expect(cell.result).toBe('42');
        expect(cell.latex).toBe('42');
        expect(cell.status).toBe('success');
        expect(cell.variables).toEqual([{ name: 'x', value: 42 }]);
      }
    });

    it('sets math error', () => {
      const cellId = getStore().worksheet.cells[0].id;
      getStore().setMathError(cellId, 'Division by zero');

      const cell = getStore().worksheet.cells[0];
      if (cell.kind === 'math') {
        expect(cell.status).toBe('error');
        expect(cell.errorMessage).toBe('Division by zero');
        expect(cell.result).toBeNull();
      }
    });

    it('sets plot status', () => {
      const plotId = getStore().addCell('plot');
      getStore().setPlotStatus(plotId, 'error', 'Invalid function');

      const cell = getStore().worksheet.cells.find((c) => c.id === plotId);
      if (cell?.kind === 'plot') {
        expect(cell.status).toBe('error');
        expect(cell.errorMessage).toBe('Invalid function');
      }
    });
  });

  describe('getVariablesUpTo', () => {
    it('collects variables from cells before the target', () => {
      const cell1Id = getStore().worksheet.cells[0].id;
      const cell2Id = getStore().addCell('math');
      const cell3Id = getStore().addCell('math');

      getStore().setMathResult(cell1Id, '5', 'x=5', [{ name: 'x', value: 5 }]);
      getStore().setMathResult(cell2Id, '10', 'y=10', [{ name: 'y', value: 10 }]);

      const scope = getStore().getVariablesUpTo(cell3Id);
      expect(scope).toEqual({ x: 5, y: 10 });
    });

    it('does not include variables from the target cell itself', () => {
      const cell1Id = getStore().worksheet.cells[0].id;
      getStore().setMathResult(cell1Id, '5', 'x=5', [{ name: 'x', value: 5 }]);

      const scope = getStore().getVariablesUpTo(cell1Id);
      expect(scope).toEqual({});
    });

    it('skips non-math and error cells', () => {
      const cell1Id = getStore().worksheet.cells[0].id;
      getStore().addCell('text');
      const cell3Id = getStore().addCell('math');

      getStore().setMathResult(cell1Id, '5', 'x=5', [{ name: 'x', value: 5 }]);

      const scope = getStore().getVariablesUpTo(cell3Id);
      expect(scope).toEqual({ x: 5 });
    });
  });

  describe('setTitle', () => {
    it('updates the worksheet title', () => {
      getStore().setTitle('My Worksheet');
      expect(getStore().worksheet.title).toBe('My Worksheet');
      expect(getStore().isDirty).toBe(true);
    });
  });

  describe('resetWorksheet', () => {
    it('resets to a fresh worksheet', () => {
      getStore().addCell('math');
      getStore().setTitle('Modified');

      getStore().resetWorksheet();

      expect(getStore().worksheet.title).toBe('Untitled Worksheet');
      expect(getStore().worksheet.cells).toHaveLength(1);
      expect(getStore().isDirty).toBe(false);
      expect(getStore().worksheetId).toBeNull();
    });
  });

  describe('hydrate', () => {
    it('replaces the worksheet with hydrated data', () => {
      getStore().hydrate({
        worksheetId: 'ws-123',
        title: 'Hydrated',
        cells: [],
        version: 5,
      });

      expect(getStore().worksheet.title).toBe('Hydrated');
      expect(getStore().worksheetId).toBe('ws-123');
      expect(getStore().version).toBe(5);
      expect(getStore().isDirty).toBe(false);
    });
  });

  describe('markClean', () => {
    it('updates version and clears dirty flag', () => {
      getStore().addCell('math');
      expect(getStore().isDirty).toBe(true);

      getStore().markClean(3, 'ws-456');

      expect(getStore().isDirty).toBe(false);
      expect(getStore().version).toBe(3);
      expect(getStore().worksheetId).toBe('ws-456');
    });
  });

  describe('exportAsJSON / importFromJSON', () => {
    it('round-trips a worksheet', () => {
      getStore().setTitle('Export Test');
      getStore().addCell('text');

      const json = getStore().exportAsJSON();
      getStore().resetWorksheet();
      getStore().importFromJSON(json);

      expect(getStore().worksheet.title).toBe('Export Test');
      expect(getStore().worksheet.cells).toHaveLength(2);
    });

    it('silently ignores invalid JSON', () => {
      const titleBefore = getStore().worksheet.title;
      getStore().importFromJSON('not valid json');
      expect(getStore().worksheet.title).toBe(titleBefore);
    });

    it('rejects invalid structure', () => {
      const titleBefore = getStore().worksheet.title;
      getStore().importFromJSON(JSON.stringify({ invalid: true }));
      expect(getStore().worksheet.title).toBe(titleBefore);
    });
  });
});
