'use client';

/**
 * Editable columnar data table for the Data & Regression tab.
 *
 * - Native <table> semantics (caption + column headers) for accessibility.
 * - Spreadsheet clipboard paste: TSV (or ;-separated) payloads fill the grid
 *   starting at the focused cell, growing rows/columns as needed. `,` is
 *   reserved as a decimal separator (de/fr/ru/uk locales), never a field
 *   separator.
 * - Column headers are editable identifiers, validated live.
 * - Fully controlled and free of plot-specific imports so worksheets can host
 *   it later.
 *
 * @module components/plots/regression/DataTable
 */

import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ClipboardEvent, type KeyboardEvent, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';

/** Valid column identifier (mirrors the math-engine tilde-model rule). */
const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export interface DataTableValue {
  columns: string[];
  rows: (number | null)[][];
}

export interface DataTableProps {
  columns: string[];
  rows: (number | null)[][];
  onChange: (next: DataTableValue) => void;
  className?: string;
}

/** Generates a fresh column name (x2, y2, x3, …) not colliding with existing ones. */
function nextColumnName(existing: readonly string[], index: number): string {
  const prefix = index % 2 === 0 ? 'x' : 'y';
  for (let n = Math.floor(index / 2) + 1; ; n++) {
    const candidate = `${prefix}${n}`;
    if (!existing.includes(candidate)) return candidate;
  }
}

/** Matches a lone comma-decimal number, e.g. "1,5" or "-3,14" (de/fr/ru/uk locales). */
const COMMA_DECIMAL_PATTERN = /^-?\d+,\d+$/;

/**
 * Parses one clipboard cell to a number or null. A bare comma decimal
 * separator (no thousands grouping, no dot) is normalized to a dot first —
 * Excel/LibreOffice in comma-decimal locales render 1.5 as "1,5".
 */
function parseCell(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const normalized = COMMA_DECIMAL_PATTERN.test(trimmed) ? trimmed.replace(',', '.') : trimmed;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parses a spreadsheet clipboard payload into a cell matrix.
 * Cells are tab-separated; when the payload has no tabs at all, `;` is
 * accepted as a fallback field separator. `,` is deliberately NOT treated as
 * a field separator: comma-decimal locale spreadsheets (de/fr/ru/uk) use `;`
 * as the field separator for exactly this reason, reserving `,` for decimal
 * numbers (see parseCell) — otherwise a single-column paste like "1,5\n2,5"
 * would be silently split into two bogus columns.
 */
function parseClipboardMatrix(text: string): (number | null)[][] {
  const lines = text.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') lines.pop();
  const hasTab = text.includes('\t');
  return lines.map((line) => (hasTab ? line.split('\t') : line.split(';')).map(parseCell));
}

export function DataTable({ columns, rows, onChange, className }: DataTableProps) {
  const t = useTranslations('plots.regression');
  const tableRef = useRef<HTMLTableElement>(null);
  // Local text for the cell currently being edited, so intermediate states
  // like "3." or "-" don't get normalized away mid-keystroke.
  const [editing, setEditing] = useState<{ row: number; col: number; text: string } | null>(null);

  const columnInvalid = (index: number): boolean => {
    const name = columns[index] ?? '';
    return !IDENTIFIER_PATTERN.test(name) || columns.indexOf(name) !== index;
  };

  const commitCell = (row: number, col: number, value: number | null) => {
    const nextRows = rows.map((r, ri) =>
      ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r,
    );
    onChange({ columns, rows: nextRows });
  };

  const renameColumn = (index: number, name: string) => {
    onChange({ columns: columns.map((c, i) => (i === index ? name : c)), rows });
  };

  const addRow = () => {
    onChange({ columns, rows: [...rows, columns.map(() => null)] });
  };

  const addColumn = () => {
    const name = nextColumnName(columns, columns.length);
    onChange({ columns: [...columns, name], rows: rows.map((r) => [...r, null]) });
  };

  const removeRow = (index: number) => {
    onChange({ columns, rows: rows.filter((_, i) => i !== index) });
  };

  const focusCell = (row: number, col: number) => {
    requestAnimationFrame(() => {
      tableRef.current
        ?.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="${col}"]`)
        ?.focus();
    });
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return; // single value: default input behavior
    event.preventDefault();

    const matrix = parseClipboardMatrix(text);
    if (matrix.length === 0) return;

    // Paste anchor: the focused cell, or the top-left corner.
    const active = document.activeElement;
    const startRow = active instanceof HTMLInputElement ? Number(active.dataset['row'] ?? 0) : 0;
    const startCol = active instanceof HTMLInputElement ? Number(active.dataset['col'] ?? 0) : 0;

    const neededCols = startCol + Math.max(...matrix.map((r) => r.length));
    const nextColumns = [...columns];
    while (nextColumns.length < neededCols) {
      nextColumns.push(nextColumnName(nextColumns, nextColumns.length));
    }

    const neededRows = startRow + matrix.length;
    const nextRows = rows.map((r) => {
      const padded = [...r];
      while (padded.length < nextColumns.length) padded.push(null);
      return padded;
    });
    while (nextRows.length < neededRows) {
      nextRows.push(nextColumns.map(() => null));
    }

    matrix.forEach((matrixRow, ri) => {
      matrixRow.forEach((value, ci) => {
        const targetRow = nextRows[startRow + ri];
        if (targetRow) targetRow[startCol + ci] = value;
      });
    });

    setEditing(null);
    onChange({ columns: nextColumns, rows: nextRows });
  };

  const handleCellKeyDown = (event: KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    setEditing(null);
    if (row === rows.length - 1) {
      onChange({ columns, rows: [...rows, columns.map(() => null)] });
    }
    focusCell(row + 1, col);
  };

  return (
    <div className={cn('space-y-3', className)} onPaste={handlePaste}>
      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full border-separate border-spacing-1">
          <caption className="sr-only">{t('dataTitle')}</caption>
          <thead>
            <tr>
              {columns.map((name, ci) => (
                <th key={`col-${ci}-${columns.length}`} scope="col" className="p-0">
                  <Input
                    value={name}
                    onChange={(e) => renameColumn(ci, e.target.value)}
                    aria-label={t('columnName')}
                    aria-invalid={columnInvalid(ci)}
                    required
                    pattern="[A-Za-z][A-Za-z0-9_]*"
                    className={cn(
                      'h-8 w-auto min-w-16 field-sizing-content text-sm font-semibold font-mono',
                      'user-invalid:border-red-500 aria-invalid:border-red-500',
                    )}
                  />
                </th>
              ))}
              <th scope="col" className="w-8 p-0">
                <span className="sr-only">{t('removeRow')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={`row-${ri}`}>
                {columns.map((_, ci) => {
                  const isEditing = editing?.row === ri && editing.col === ci;
                  const stored = row[ci];
                  const display = isEditing ? editing.text : stored == null ? '' : String(stored);
                  return (
                    <td key={`cell-${ci}`} className="p-0">
                      <Input
                        inputMode="decimal"
                        value={display}
                        data-row={ri}
                        data-col={ci}
                        aria-label={`${columns[ci]} ${ri + 1}`}
                        onChange={(e) => {
                          const text = e.target.value;
                          setEditing({ row: ri, col: ci, text });
                          commitCell(ri, ci, parseCell(text));
                        }}
                        onBlur={() => setEditing(null)}
                        onKeyDown={(e) => handleCellKeyDown(e, ri, ci)}
                        className="h-8 w-auto min-w-16 field-sizing-content text-sm font-mono tabular-nums"
                      />
                    </td>
                  );
                })}
                <td className="w-8 p-0 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => removeRow(ri)}
                    className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-label={`${t('removeRow')} ${ri + 1}`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={addRow} size="sm" variant="outline" className="text-xs">
          <Plus className="size-3 mr-1" aria-hidden="true" />
          {t('addRow')}
        </Button>
        <Button onClick={addColumn} size="sm" variant="outline" className="text-xs">
          <Plus className="size-3 mr-1" aria-hidden="true" />
          {t('addColumn')}
        </Button>
      </div>

      {columns.some((_, i) => columnInvalid(i)) && (
        <p className="text-xs text-red-400" role="alert">
          {t('invalidColumnName')}
        </p>
      )}

      <p className="text-xs text-muted-foreground">{t('pasteHint')}</p>
    </div>
  );
}
