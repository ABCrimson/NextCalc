/**
 * GPU Lab gallery filtering.
 *
 * Extracted from app/[locale]/gpu-lab/page.tsx so the "only show worksheets
 * that actually contain a simulation cell" rule is a plain, unit-testable
 * function rather than logic inlined in the RSC page body.
 *
 * @module lib/simulation/gallery
 */

/** Narrow an unknown cell JSON blob to a simulation cell shape. */
export function isSimulationCellData(cell: unknown): cell is { kind: 'simulation'; sim: string } {
  return (
    typeof cell === 'object' &&
    cell !== null &&
    'kind' in cell &&
    cell.kind === 'simulation' &&
    'sim' in cell &&
    typeof cell.sim === 'string'
  );
}

/** Unique simulation kinds present in a worksheet's content JSON. */
export function simKindsOf(content: unknown): string[] {
  const cells: readonly unknown[] = Array.isArray(content) ? content : [];
  const kinds = new Set<string>();
  for (const cell of cells) {
    if (isSimulationCellData(cell)) {
      kinds.add(cell.sim);
    }
  }
  return [...kinds];
}

/** A worksheet paired with the distinct simulation kinds it contains. */
export interface GalleryItem<T> {
  worksheet: T;
  simKinds: string[];
}

/**
 * Only worksheets that contain at least one simulation cell belong in the
 * public GPU Lab gallery — text-only or plot-only worksheets are filtered out
 * even if they happen to be PUBLIC.
 */
export function filterGalleryWorksheets<T extends { content: unknown }>(
  worksheets: readonly T[],
): GalleryItem<T>[] {
  return worksheets
    .map((worksheet) => ({ worksheet, simKinds: simKindsOf(worksheet.content) }))
    .filter((item) => item.simKinds.length > 0);
}
