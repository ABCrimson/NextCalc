/**
 * Export Service Client
 *
 * Thin client for the NextCalc export Cloudflare Worker.
 * Provides typed functions for exporting LaTeX expressions to PDF, PNG, and SVG.
 *
 * The Worker URL is read from `NEXT_PUBLIC_EXPORT_SERVICE_URL` at build time,
 * falling back to `http://localhost:8787` for local development.
 *
 * @module lib/export-client
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const EXPORT_SERVICE_URL = process.env['NEXT_PUBLIC_EXPORT_SERVICE_URL'] ?? 'http://localhost:8787';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** Formats supported by the export service. */
export type ExportFormat = 'pdf' | 'png' | 'svg';

/** Error shape returned by the export Worker on failure. */
interface ExportServiceError {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

/** Common fields present on every successful export response. */
interface ExportResultBase {
  key: string;
  url: string;
  size: number;
  contentType: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** Options accepted by POST /export/pdf. */
export interface PdfExportOptions {
  pageSize?: 'letter' | 'a4' | 'legal';
  margin?: number;
  fontSize?: number;
  title?: string;
  includeMetadata?: boolean;
}

/** Successful PDF response shape. */
export interface PdfExportResult extends ExportResultBase {
  format: 'pdf';
  pageCount: number;
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

/** Options accepted by POST /export/png. */
export interface PngExportOptions {
  width?: number;
  height?: number;
  dpi?: number;
  backgroundColor?: string;
  transparent?: boolean;
}

/** Successful PNG response shape. */
export interface PngExportResult extends ExportResultBase {
  format: 'png';
  dimensions: { width: number; height: number };
  dpi: number;
}

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

/** Options accepted by POST /export/svg. */
export interface SvgExportOptions {
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  inline?: boolean;
}

/** Successful SVG response shape. */
export interface SvgExportResult extends ExportResultBase {
  format: 'svg';
  dimensions?: { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Union of all results
// ---------------------------------------------------------------------------

export type ExportResult = PdfExportResult | PngExportResult | SvgExportResult;

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

export class ExportError extends Error {
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Sends a POST request to the export Worker and returns the parsed result.
 * Throws {@link ExportError} on network failures or Worker-reported errors.
 */
async function postExport<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${EXPORT_SERVICE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new ExportError(
      'Unable to reach the export service. Please try again later.',
      'NETWORK_ERROR',
      networkErr,
    );
  }

  const json: { success: true; data: T } | ExportServiceError = await response.json();

  if (!json.success) {
    throw new ExportError(json.error.message, json.error.code, json.error.details);
  }

  return json.data;
}

/**
 * Triggers a browser download for the given URL.
 * Fetches the resource as a blob, creates an object URL, and clicks a
 * temporary anchor element so the user gets a standard Save-As experience.
 */
async function downloadUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ExportError('Failed to download the exported file.', 'DOWNLOAD_ERROR');
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();

  // Clean up after a tick to let the browser initiate the download
  requestAnimationFrame(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export a LaTeX expression to PDF and return the result metadata.
 *
 * @param latex - The LaTeX expression string.
 * @param options - Optional PDF formatting options.
 * @returns Export result including a download URL.
 */
export async function exportToPdf(
  latex: string,
  options?: PdfExportOptions,
): Promise<PdfExportResult> {
  const body: Record<string, unknown> = { latex };
  if (options !== undefined) {
    body['options'] = options;
  }
  return postExport<PdfExportResult>('/export/pdf', body);
}

/**
 * Export a LaTeX expression to PNG and return the result metadata.
 *
 * @param latex - The LaTeX expression string.
 * @param options - Optional PNG rendering options.
 * @returns Export result including a download URL.
 */
export async function exportToPng(
  latex: string,
  options?: PngExportOptions,
): Promise<PngExportResult> {
  const body: Record<string, unknown> = { latex };
  if (options !== undefined) {
    body['options'] = options;
  }
  return postExport<PngExportResult>('/export/png', body);
}

/**
 * Export a LaTeX expression to SVG and return the result metadata.
 *
 * @param latex - The LaTeX expression string.
 * @param options - Optional SVG rendering options.
 * @returns Export result including a download URL.
 */
export async function exportToSvg(
  latex: string,
  options?: SvgExportOptions,
): Promise<SvgExportResult> {
  const body: Record<string, unknown> = { latex };
  if (options !== undefined) {
    body['options'] = options;
  }
  return postExport<SvgExportResult>('/export/svg', body);
}

/**
 * High-level convenience: export + immediate browser download.
 *
 * Calls the appropriate export function, then triggers a file download
 * using the returned URL.
 *
 * @param format - Target format: 'pdf' | 'png' | 'svg'.
 * @param latex - The LaTeX expression string.
 * @param options - Format-specific options.
 * @returns The export result metadata (the download has already started).
 */
export async function exportAndDownload(
  format: ExportFormat,
  latex: string,
  options?: PdfExportOptions | PngExportOptions | SvgExportOptions,
): Promise<ExportResult> {
  let result: ExportResult;

  switch (format) {
    case 'pdf':
      result = await exportToPdf(latex, options as PdfExportOptions | undefined);
      break;
    case 'png':
      result = await exportToPng(latex, options as PngExportOptions | undefined);
      break;
    case 'svg':
      result = await exportToSvg(latex, options as SvgExportOptions | undefined);
      break;
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `nextcalc-export-${timestamp}.${format}`;
  await downloadUrl(result.url, filename);

  return result;
}
