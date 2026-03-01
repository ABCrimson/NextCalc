/**
 * PDF export handler
 *
 * Converts LaTeX math expressions to PDF format via a three-stage pipeline:
 *
 *   1. LaTeX  -> SVG   (MathJax 4.x, see svg-internal.ts)
 *   2. SVG    -> PNG   (@cf-wasm/resvg, see png.ts)
 *   3. PNG    -> PDF   (modern-pdf-lib, embedded raster image)
 *
 * The resulting PDF is a single (or multi-page for batch) document with
 * the math expression centred horizontally near the top of the page,
 * scaled to fit within the configured margins while preserving aspect ratio.
 */

import { createPdf, PageSizes } from 'modern-pdf-lib';
import {
  generateExportKey,
  getMimeType,
  type R2Bucket,
  type UploadResult,
  uploadToR2,
  validateFileSize,
} from '../utils/r2.js';
import { convertSvgToPng } from './png.js';
import { generateRasterSvgFromLatex, type SvgOptions } from './svg-internal.js';

// ---------------------------------------------------------------------------
// Page sizes – modern-pdf-lib provides PageSizes constants for addPage(),
// but we still need numeric dimensions for margin / scaling calculations.
// ---------------------------------------------------------------------------
const PAGE_DIMENSIONS = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
  legal: { width: 612, height: 1008 },
} as const;

const PAGE_SIZE_MAP = {
  letter: PageSizes.Letter,
  a4: PageSizes.A4,
  legal: PageSizes.Legal,
} as const;

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Export configuration for PDF generation
 */
export interface PdfExportRequest {
  latex: string;
  userId?: string;
  options?: {
    pageSize?: 'letter' | 'a4' | 'legal';
    margin?: number;
    fontSize?: number;
    title?: string;
    includeMetadata?: boolean;
  };
}

/**
 * PDF export result
 */
export interface PdfExportResult extends UploadResult {
  format: 'pdf';
  pages: number;
  pageSize: string;
}

// ---------------------------------------------------------------------------
// Private: render a single LaTeX expression into a modern-pdf-lib document page
// ---------------------------------------------------------------------------

/**
 * Renders a LaTeX expression into a complete PDF document.
 *
 * Pipeline:
 *   1. Generate SVG from LaTeX (doubled fontSize for print quality)
 *   2. Convert SVG to PNG at 300 DPI via resvg (single render pass for bytes + dimensions)
 *   3. Create a PDF document via createPdf(), set metadata, add a page
 *   5. Embed the PNG, scale to fit margins preserving aspect ratio
 *   6. Centre horizontally, place near the top of the page
 *
 * @param latex           - LaTeX expression to render
 * @param options         - PDF generation options
 * @returns PDF bytes as Uint8Array
 */
async function generatePdfFromLatex(
  latex: string,
  options: {
    pageSize: 'letter' | 'a4' | 'legal';
    margin: number;
    fontSize: number;
    title: string;
    includeMetadata: boolean;
  },
): Promise<Uint8Array> {
  const { pageSize, margin, fontSize, title, includeMetadata } = options;

  // Margin in inches -> PDF points (1 inch = 72 points)
  const marginPt = margin * 72;

  const dims = PAGE_DIMENSIONS[pageSize];

  // ------------------------------------------------------------------
  // Step 1: LaTeX -> SVG (doubled fontSize for print quality)
  // ------------------------------------------------------------------
  const svgOptions: SvgOptions = {
    fontSize: fontSize * 2,
    color: '#000000',
    backgroundColor: 'transparent',
    inline: false,
  };

  const svgString = await generateRasterSvgFromLatex(latex, svgOptions);

  // ------------------------------------------------------------------
  // Step 2: SVG -> PNG at 300 DPI for print (single render pass)
  // ------------------------------------------------------------------
  const {
    png,
    width: imgWidth,
    height: imgHeight,
  } = await convertSvgToPng(svgString, 300, 'transparent');

  // ------------------------------------------------------------------
  // Step 3: Create PDF document with metadata
  // ------------------------------------------------------------------
  const doc = createPdf();

  if (includeMetadata) {
    doc.setTitle(title);
    doc.setAuthor('NextCalc Pro');
    doc.setSubject('Mathematical Expression Export');
    doc.setCreator('NextCalc Export Service');
    doc.setProducer('modern-pdf-lib + @cf-wasm/resvg');
    doc.setCreationDate(new Date());
  }

  // ------------------------------------------------------------------
  // Step 4: Add page, embed PNG, scale to fit margins
  // ------------------------------------------------------------------
  const pdfPage = doc.addPage(PAGE_SIZE_MAP[pageSize]);

  const pngImage = doc.embedPng(png);

  // Available drawing area after margins
  const availableWidth = dims.width - marginPt * 2;
  const availableHeight = dims.height - marginPt * 2;

  // Scale the image to fit within the available area, preserving aspect ratio
  let drawWidth = imgWidth;
  let drawHeight = imgHeight;

  if (drawWidth > availableWidth) {
    const scale = availableWidth / drawWidth;
    drawWidth = availableWidth;
    drawHeight = drawHeight * scale;
  }

  if (drawHeight > availableHeight) {
    const scale = availableHeight / drawHeight;
    drawHeight = availableHeight;
    drawWidth = drawWidth * scale;
  }

  // Centre horizontally, place near the top of the page
  const x = marginPt + (availableWidth - drawWidth) / 2;
  const y = dims.height - marginPt - drawHeight;

  pdfPage.drawImage(pngImage, {
    x,
    y,
    width: drawWidth,
    height: drawHeight,
  });

  // ------------------------------------------------------------------
  // Step 5: Serialise
  // ------------------------------------------------------------------
  return doc.save();
}

// ---------------------------------------------------------------------------
// Core export function
// ---------------------------------------------------------------------------

/**
 * Converts a LaTeX expression to PDF and uploads it to R2.
 *
 * @param request      - PDF export request (LaTeX + options)
 * @param bucket       - R2 bucket binding for storage
 * @param maxFileSize  - Maximum allowed PDF size in bytes
 * @returns Upload result including page count, page size, and download URL
 */
export async function exportToPdf(
  request: PdfExportRequest,
  bucket: R2Bucket,
  maxFileSize: number,
): Promise<PdfExportResult> {
  const { latex, userId, options = {} } = request;

  // Resolve defaults
  const pageSize = options.pageSize ?? 'a4';
  const margin = options.margin ?? 1;
  const fontSize = options.fontSize ?? 12;
  const title = options.title ?? 'NextCalc Export';
  const includeMetadata = options.includeMetadata ?? true;

  // Generate PDF
  const pdfBytes = await generatePdfFromLatex(latex, {
    pageSize,
    margin,
    fontSize,
    title,
    includeMetadata,
  });

  // Validate file size
  validateFileSize(pdfBytes.byteLength, maxFileSize);

  // Upload to R2
  const key = generateExportKey(userId, 'pdf');

  const uploadResult = await uploadToR2(bucket, key, pdfBytes, getMimeType('pdf'), {
    latex,
    pageSize,
    title,
    createdAt: new Date().toISOString(),
    userId: userId ?? 'anonymous',
  });

  return {
    ...uploadResult,
    format: 'pdf',
    pages: 1,
    pageSize,
  };
}

// ---------------------------------------------------------------------------
// Batch export
// ---------------------------------------------------------------------------

/**
 * Batch export multiple LaTeX expressions into a single multi-page PDF.
 *
 * Each expression is rendered onto its own page.  The resulting document
 * is uploaded to R2 as a single file.
 *
 * @param expressions  - Array of LaTeX strings (one per page)
 * @param userId       - Optional user ID for R2 key namespacing
 * @param bucket       - R2 bucket binding
 * @param maxFileSize  - Maximum file size in bytes
 * @param options      - Common PDF options applied to every page
 * @returns PDF export result for the combined document
 */
export async function batchExportToPdf(
  expressions: string[],
  userId: string | undefined,
  bucket: R2Bucket,
  maxFileSize: number,
  options?: PdfExportRequest['options'],
): Promise<PdfExportResult> {
  const pageSize = options?.pageSize ?? 'a4';
  const margin = options?.margin ?? 1;
  const fontSize = options?.fontSize ?? 12;
  const title = options?.title ?? `NextCalc Export (${expressions.length} expressions)`;
  const includeMetadata = options?.includeMetadata ?? true;

  // Margin in inches -> PDF points
  const marginPt = margin * 72;
  const dims = PAGE_DIMENSIONS[pageSize];

  const doc = createPdf();

  if (includeMetadata) {
    doc.setTitle(title);
    doc.setAuthor('NextCalc Pro');
    doc.setSubject('Mathematical Expression Export');
    doc.setCreator('NextCalc Export Service');
    doc.setProducer('modern-pdf-lib + @cf-wasm/resvg');
    doc.setCreationDate(new Date());
  }

  // Available drawing area after margins
  const availableWidth = dims.width - marginPt * 2;
  const availableHeight = dims.height - marginPt * 2;

  for (const latex of expressions) {
    // Step 1: LaTeX -> SVG
    const svgOptions: SvgOptions = {
      fontSize: fontSize * 2,
      color: '#000000',
      backgroundColor: 'transparent',
      inline: false,
    };

    const svgString = await generateRasterSvgFromLatex(latex, svgOptions);

    // Step 2: SVG -> PNG at 300 DPI (single render pass)
    const {
      png,
      width: imgWidth,
      height: imgHeight,
    } = await convertSvgToPng(svgString, 300, 'transparent');

    // Step 3: Add page, embed PNG, scale to fit
    const pdfPage = doc.addPage(PAGE_SIZE_MAP[pageSize]);
    const pngImage = doc.embedPng(png);

    let drawWidth = imgWidth;
    let drawHeight = imgHeight;

    if (drawWidth > availableWidth) {
      const scale = availableWidth / drawWidth;
      drawWidth = availableWidth;
      drawHeight = drawHeight * scale;
    }

    if (drawHeight > availableHeight) {
      const scale = availableHeight / drawHeight;
      drawHeight = availableHeight;
      drawWidth = drawWidth * scale;
    }

    const x = marginPt + (availableWidth - drawWidth) / 2;
    const y = dims.height - marginPt - drawHeight;

    pdfPage.drawImage(pngImage, {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
    });
  }

  const pdfBytes = await doc.save();

  // Validate file size
  validateFileSize(pdfBytes.byteLength, maxFileSize);

  // Upload to R2
  const key = generateExportKey(userId, 'pdf');

  const uploadResult = await uploadToR2(bucket, key, pdfBytes, getMimeType('pdf'), {
    latex: expressions.join(' | '),
    pageSize,
    title,
    pages: expressions.length.toString(),
    createdAt: new Date().toISOString(),
    userId: userId ?? 'anonymous',
  });

  return {
    ...uploadResult,
    format: 'pdf',
    pages: expressions.length,
    pageSize,
  };
}

// ---------------------------------------------------------------------------
// LaTeX document utilities
// ---------------------------------------------------------------------------

/**
 * Creates a LaTeX document template
 *
 * @param content - LaTeX content to include
 * @param options - Document options
 * @returns Complete LaTeX document source
 */
export function createLatexDocument(
  content: string,
  options: {
    documentClass?: string;
    packages?: string[];
    title?: string;
    author?: string;
  } = {},
): string {
  const documentClass = options.documentClass ?? 'article';
  const packages = options.packages ?? ['amsmath', 'amssymb', 'amsfonts'];
  const title = options.title ?? 'Mathematical Expressions';
  const author = options.author ?? 'NextCalc Pro';

  const packageImports = packages.map((pkg) => `\\usepackage{${pkg}}`).join('\n');

  return `\\documentclass{${documentClass}}

${packageImports}

\\title{${title}}
\\author{${author}}
\\date{\\today}

\\begin{document}

\\maketitle

${content}

\\end{document}`;
}

/**
 * Validates LaTeX syntax (basic check)
 *
 * @param latex - LaTeX source
 * @returns True if basic syntax appears valid
 */
export function validateLatexSyntax(latex: string): boolean {
  // Basic validation checks
  const checks = [
    // Check for balanced braces
    () => {
      const openBraces = (latex.match(/\{/g) || []).length;
      const closeBraces = (latex.match(/\}/g) || []).length;
      return openBraces === closeBraces;
    },
    // Check for balanced math delimiters
    () => {
      const dollarSigns = (latex.match(/\$/g) || []).length;
      return dollarSigns % 2 === 0;
    },
    // Check for common LaTeX commands
    () => {
      return /\\[a-zA-Z]+/.test(latex) || !latex.includes('\\');
    },
  ];

  return checks.every((check) => check());
}
