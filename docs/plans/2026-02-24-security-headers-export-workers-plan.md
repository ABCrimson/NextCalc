# Security Headers + Export Workers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add HTTP security headers via Nosecone middleware (CSP with per-request nonce, HSTS, X-Frame-Options, etc.) and implement real PNG + PDF export in the Cloudflare Workers export service.

**Architecture:** Two independent features. Feature 1 adds a Next.js middleware with Nosecone for security headers. Feature 2 replaces stub handlers in the export-service Worker with real SVG-to-PNG (via @cf-wasm/resvg WASM) and PNG-to-PDF (via pdf-lib) pipelines.

**Tech Stack:** Nosecone 1.1.0, @nosecone/next 1.1.0, @cf-wasm/resvg 0.3.3, pdf-lib 1.17.1, Hono 4.12.2, MathJax 4.1.1

---

## Feature 1: HTTP Security Headers

### Task 1: Install Nosecone dependencies

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install nosecone and @nosecone/next**

Run from repo root:
```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter @nextcalc/web add nosecone@1.1.0 @nosecone/next@1.1.0 2>&1"
```

Expected: packages added to `apps/web/package.json` dependencies.

**Step 2: Verify installation**

```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest ls --filter @nextcalc/web nosecone @nosecone/next 2>&1"
```

Expected: Both packages at version 1.1.0.

**Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add nosecone 1.1.0 for security headers"
```

---

### Task 2: Create Next.js middleware with CSP nonce

**Files:**
- Create: `apps/web/middleware.ts`

**Step 1: Create the middleware file**

Create `apps/web/middleware.ts` with the following content:

```typescript
import { createMiddleware } from '@nosecone/next';
import type { NoseconeOptions } from 'nosecone';

const noseconeConfig: NoseconeOptions = {
  contentSecurityPolicy: {
    directives: {
      scriptSrc: [
        "'self'",
        // Nonce is automatically added by @nosecone/next
      ],
      workerSrc: ["'self'", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "https://exports.nextcalc.pro",
        "https://*.upstash.io",
      ],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  },
  xContentTypeOptions: true,
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
  },
};

export const middleware = createMiddleware(noseconeConfig);

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|sw.js.map|swe-worker|manifest.json|icon).*)',
  ],
};
```

**Step 2: Verify the middleware builds**

Run:
```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter @nextcalc/web build 2>&1"
```

Expected: Build succeeds. All pages render as dynamic (ƒ) instead of static (○) due to the CSP nonce forcing dynamic rendering.

**Step 3: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat(security): add Nosecone middleware with CSP nonce and security headers"
```

---

### Task 3: Add static security headers for API routes

**Files:**
- Modify: `apps/web/next.config.ts`

**Step 1: Add headers() function to next.config.ts**

Add a `headers` async function to the `nextConfig` object. Insert it after the `experimental` block (after line 81, before the closing `};` on line 82):

```typescript
  // Security headers for routes not covered by middleware
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/api/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
```

**Step 2: Verify the build**

Run:
```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter @nextcalc/web build 2>&1"
```

Expected: Build succeeds with no new errors.

**Step 3: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "feat(security): add static security headers for API routes"
```

---

## Feature 2: Export Workers (PNG + PDF)

### Task 4: Install export worker dependencies

**Files:**
- Modify: `apps/workers/export-service/package.json`

**Step 1: Install @cf-wasm/resvg and pdf-lib**

Run from repo root:
```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc\apps\workers\export-service'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest add @cf-wasm/resvg@0.3.3 pdf-lib@1.17.1 2>&1"
```

Expected: Both packages added to `apps/workers/export-service/package.json` dependencies.

**Step 2: Commit**

```bash
git add apps/workers/export-service/package.json pnpm-lock.yaml
git commit -m "chore: add @cf-wasm/resvg 0.3.3 and pdf-lib 1.17.1 to export service"
```

---

### Task 5: Implement PNG export handler

**Files:**
- Modify: `apps/workers/export-service/src/handlers/png.ts`

**Step 1: Replace the entire png.ts with the real implementation**

Replace the full contents of `apps/workers/export-service/src/handlers/png.ts` with:

```typescript
/**
 * PNG export handler
 *
 * Converts LaTeX math expressions to PNG format via the pipeline:
 * LaTeX → MathJax SVG (svg-internal.ts) → resvg WASM PNG
 */

import { Resvg } from '@cf-wasm/resvg/workerd';
import { generateSvgFromLatex, type SvgOptions } from './svg-internal.js';
import type { R2Bucket } from '../utils/r2.js';
import {
  uploadToR2,
  generateExportKey,
  validateFileSize,
  getMimeType,
  type UploadResult,
} from '../utils/r2.js';

/**
 * Export configuration for PNG generation
 */
export interface PngExportRequest {
  latex: string;
  userId?: string;
  options?: {
    width?: number;
    height?: number;
    dpi?: number;
    backgroundColor?: string;
    transparent?: boolean;
  };
}

/**
 * PNG export result
 */
export interface PngExportResult extends UploadResult {
  format: 'png';
  dimensions: {
    width: number;
    height: number;
  };
  dpi: number;
}

/**
 * Converts LaTeX expression to PNG format.
 *
 * Pipeline:
 * 1. Render LaTeX to SVG via MathJax (svg-internal.ts)
 * 2. Convert SVG to PNG via @cf-wasm/resvg (WASM, Workers-compatible)
 * 3. Upload PNG to R2 and return a signed download URL
 */
export async function exportToPng(
  request: PngExportRequest,
  bucket: R2Bucket,
  maxFileSize: number,
): Promise<PngExportResult> {
  const { latex, userId, options = {} } = request;

  const dpi = options.dpi || 144;
  const backgroundColor = options.transparent ? 'transparent' : (options.backgroundColor || '#FFFFFF');

  // Step 1: Render LaTeX to SVG via MathJax
  const svgOptions: SvgOptions = {
    fontSize: 24,
    color: '#000000',
    backgroundColor,
    inline: false,
  };
  const svgString = await generateSvgFromLatex(latex, svgOptions);

  // Step 2: Convert SVG to PNG via resvg WASM
  const pngBuffer = await convertSvgToPng(svgString, dpi, backgroundColor);

  // Extract dimensions from the PNG (resvg renders at native SVG size scaled by DPI)
  const resvgForDimensions = await Resvg.async(Buffer.from(svgString), { dpi });
  const renderedImage = resvgForDimensions.render();
  const width = renderedImage.width;
  const height = renderedImage.height;

  // Validate file size
  validateFileSize(pngBuffer.byteLength, maxFileSize);

  // Generate unique key for R2
  const key = generateExportKey(userId, 'png');

  // Upload to R2
  const uploadResult = await uploadToR2(
    bucket,
    key,
    pngBuffer,
    getMimeType('png'),
    {
      latex,
      width: width.toString(),
      height: height.toString(),
      dpi: dpi.toString(),
      createdAt: new Date().toISOString(),
      userId: userId || 'anonymous',
    },
  );

  return {
    ...uploadResult,
    format: 'png',
    dimensions: { width, height },
    dpi,
  };
}

/**
 * Converts SVG string to PNG bytes via @cf-wasm/resvg WASM.
 *
 * Uses Resvg.async() which is required in Cloudflare Workers
 * (synchronous WASM instantiation is blocked by the runtime).
 */
export async function convertSvgToPng(
  svgString: string,
  dpi: number,
  _backgroundColor: string,
): Promise<ArrayBuffer> {
  const resvg = await Resvg.async(Buffer.from(svgString), {
    dpi,
    fitTo: { mode: 'original' as const },
  });

  const rendered = resvg.render();
  const pngBytes = rendered.asPng();

  return pngBytes.buffer as ArrayBuffer;
}

/**
 * Batch export multiple expressions to PNG
 */
export async function batchExportToPng(
  expressions: string[],
  userId: string | undefined,
  bucket: R2Bucket,
  maxFileSize: number,
  options?: PngExportRequest['options'],
): Promise<PngExportResult[]> {
  const results: PngExportResult[] = [];

  for (const latex of expressions) {
    try {
      const result = await exportToPng(
        { latex, userId, options },
        bucket,
        maxFileSize,
      );
      results.push(result);
    } catch (error) {
      console.error(`Failed to export expression "${latex}":`, error);
    }
  }

  return results;
}

/**
 * Calculates optimal DPI based on target use case
 */
export function getRecommendedDpi(
  useCase: 'web' | 'print' | 'retina' | 'presentation',
): number {
  const dpiMap = {
    web: 72,
    retina: 144,
    presentation: 150,
    print: 300,
  };

  return dpiMap[useCase];
}

/**
 * Estimates PNG file size based on dimensions
 */
export function estimatePngSize(
  width: number,
  height: number,
  hasTransparency: boolean,
): number {
  const bytesPerPixel = hasTransparency ? 4 : 3;
  const overhead = 1024;
  return width * height * bytesPerPixel + overhead;
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc\apps\workers\export-service'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest type-check 2>&1"
```

Expected: No type errors. If there are import resolution issues with `@cf-wasm/resvg/workerd`, check whether the package needs a `Buffer` polyfill or if `Buffer.from()` should be replaced with `new TextEncoder().encode()`. The `nodejs_compat` flag in wrangler.toml should provide `Buffer`.

**Step 3: Commit**

```bash
git add apps/workers/export-service/src/handlers/png.ts
git commit -m "feat(export): implement PNG export via @cf-wasm/resvg WASM pipeline"
```

---

### Task 6: Implement PDF export handler

**Files:**
- Modify: `apps/workers/export-service/src/handlers/pdf.ts`

**Step 1: Replace the entire pdf.ts with the real implementation**

Replace the full contents of `apps/workers/export-service/src/handlers/pdf.ts` with:

```typescript
/**
 * PDF export handler
 *
 * Converts LaTeX math expressions to PDF format via the pipeline:
 * LaTeX → MathJax SVG → resvg PNG → pdf-lib PDF
 */

import { PDFDocument } from 'pdf-lib';
import { generateSvgFromLatex, type SvgOptions } from './svg-internal.js';
import { convertSvgToPng } from './png.js';
import type { R2Bucket } from '../utils/r2.js';
import {
  uploadToR2,
  generateExportKey,
  validateFileSize,
  getMimeType,
  type UploadResult,
} from '../utils/r2.js';
import { Resvg } from '@cf-wasm/resvg/workerd';

/**
 * Page dimensions in PDF points (72 points = 1 inch)
 */
const PAGE_SIZES = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
  legal: { width: 612, height: 1008 },
} as const;

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

/**
 * Converts LaTeX expression to PDF format.
 *
 * Pipeline:
 * 1. Render LaTeX to SVG via MathJax
 * 2. Convert SVG to PNG via resvg
 * 3. Embed PNG in a PDF page via pdf-lib
 * 4. Upload PDF to R2 and return a signed download URL
 */
export async function exportToPdf(
  request: PdfExportRequest,
  bucket: R2Bucket,
  maxFileSize: number,
): Promise<PdfExportResult> {
  const { latex, userId, options = {} } = request;

  const pageSize = options.pageSize || 'a4';
  const margin = (options.margin || 1) * 72; // Convert inches to points
  const fontSize = options.fontSize || 12;
  const title = options.title || 'NextCalc Export';
  const includeMetadata = options.includeMetadata ?? true;

  const pdfBuffer = await generatePdfFromLatex(latex, {
    pageSize,
    margin,
    fontSize,
    title,
    includeMetadata,
  });

  validateFileSize(pdfBuffer.byteLength, maxFileSize);

  const key = generateExportKey(userId, 'pdf');

  const uploadResult = await uploadToR2(
    bucket,
    key,
    pdfBuffer,
    getMimeType('pdf'),
    {
      latex,
      pageSize,
      title,
      createdAt: new Date().toISOString(),
      userId: userId || 'anonymous',
    },
  );

  return {
    ...uploadResult,
    format: 'pdf',
    pages: 1,
    pageSize,
  };
}

/**
 * Generates PDF from LaTeX expression.
 *
 * Renders the expression as a high-DPI PNG via MathJax+resvg,
 * then embeds it centered on a PDF page with configurable margins.
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
): Promise<ArrayBuffer> {
  const dpi = 300; // High quality for PDF

  // Step 1: Render LaTeX to SVG
  const svgOptions: SvgOptions = {
    fontSize: options.fontSize * 2, // Scale up for print quality
    color: '#000000',
    backgroundColor: 'transparent',
    inline: false,
  };
  const svgString = await generateSvgFromLatex(latex, svgOptions);

  // Step 2: Convert SVG to PNG via resvg
  const pngBuffer = await convertSvgToPng(svgString, dpi, 'transparent');

  // Get rendered dimensions for positioning
  const resvg = await Resvg.async(Buffer.from(svgString), { dpi });
  const rendered = resvg.render();
  const imgWidth = rendered.width;
  const imgHeight = rendered.height;

  // Step 3: Create PDF with pdf-lib
  const pdfDoc = await PDFDocument.create();

  if (options.includeMetadata) {
    pdfDoc.setTitle(options.title);
    pdfDoc.setAuthor('NextCalc Pro');
    pdfDoc.setSubject('Mathematical Expression Export');
    pdfDoc.setCreator('NextCalc Export Service');
    pdfDoc.setProducer('pdf-lib + @cf-wasm/resvg');
    pdfDoc.setCreationDate(new Date());
  }

  const pageDims = PAGE_SIZES[options.pageSize];
  const page = pdfDoc.addPage([pageDims.width, pageDims.height]);

  // Embed the PNG
  const pngImage = await pdfDoc.embedPng(new Uint8Array(pngBuffer));

  // Scale image to fit within page margins while preserving aspect ratio
  const availableWidth = pageDims.width - 2 * options.margin;
  const availableHeight = pageDims.height - 2 * options.margin;
  const scale = Math.min(
    availableWidth / imgWidth,
    availableHeight / imgHeight,
    1, // Don't scale up beyond native size
  );
  const drawWidth = imgWidth * scale;
  const drawHeight = imgHeight * scale;

  // Center horizontally, place near top with margin
  const x = (pageDims.width - drawWidth) / 2;
  const y = pageDims.height - options.margin - drawHeight;

  page.drawImage(pngImage, {
    x,
    y,
    width: drawWidth,
    height: drawHeight,
  });

  return pdfDoc.save();
}

/**
 * Batch export multiple expressions to a single PDF (one page per expression)
 */
export async function batchExportToPdf(
  expressions: string[],
  userId: string | undefined,
  bucket: R2Bucket,
  maxFileSize: number,
  options?: PdfExportRequest['options'],
): Promise<PdfExportResult> {
  const pageSize = options?.pageSize || 'a4';
  const margin = (options?.margin || 1) * 72;
  const fontSize = options?.fontSize || 12;
  const title = options?.title || `NextCalc Export (${expressions.length} expressions)`;
  const includeMetadata = options?.includeMetadata ?? true;
  const dpi = 300;

  const pdfDoc = await PDFDocument.create();

  if (includeMetadata) {
    pdfDoc.setTitle(title);
    pdfDoc.setAuthor('NextCalc Pro');
    pdfDoc.setCreator('NextCalc Export Service');
    pdfDoc.setCreationDate(new Date());
  }

  const pageDims = PAGE_SIZES[pageSize];

  for (const latex of expressions) {
    const svgOptions: SvgOptions = {
      fontSize: fontSize * 2,
      color: '#000000',
      backgroundColor: 'transparent',
      inline: false,
    };
    const svgString = await generateSvgFromLatex(latex, svgOptions);
    const pngBuffer = await convertSvgToPng(svgString, dpi, 'transparent');

    const resvg = await Resvg.async(Buffer.from(svgString), { dpi });
    const rendered = resvg.render();

    const page = pdfDoc.addPage([pageDims.width, pageDims.height]);
    const pngImage = await pdfDoc.embedPng(new Uint8Array(pngBuffer));

    const availableWidth = pageDims.width - 2 * margin;
    const availableHeight = pageDims.height - 2 * margin;
    const scale = Math.min(
      availableWidth / rendered.width,
      availableHeight / rendered.height,
      1,
    );
    const drawWidth = rendered.width * scale;
    const drawHeight = rendered.height * scale;
    const x = (pageDims.width - drawWidth) / 2;
    const y = pageDims.height - margin - drawHeight;

    page.drawImage(pngImage, { x, y, width: drawWidth, height: drawHeight });
  }

  const pdfBytes = await pdfDoc.save();
  validateFileSize(pdfBytes.byteLength, maxFileSize);

  const key = generateExportKey(userId, 'pdf');
  const uploadResult = await uploadToR2(
    bucket,
    key,
    pdfBytes,
    getMimeType('pdf'),
    {
      pageSize,
      title,
      pages: expressions.length.toString(),
      createdAt: new Date().toISOString(),
      userId: userId || 'anonymous',
    },
  );

  return {
    ...uploadResult,
    format: 'pdf',
    pages: expressions.length,
    pageSize,
  };
}

/**
 * Creates a LaTeX document template
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
  const documentClass = options.documentClass || 'article';
  const packages = options.packages || ['amsmath', 'amssymb', 'amsfonts'];
  const title = options.title || 'Mathematical Expressions';
  const author = options.author || 'NextCalc Pro';

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
 */
export function validateLatexSyntax(latex: string): boolean {
  const checks = [
    () => {
      const openBraces = (latex.match(/\{/g) || []).length;
      const closeBraces = (latex.match(/\}/g) || []).length;
      return openBraces === closeBraces;
    },
    () => {
      const dollarSigns = (latex.match(/\$/g) || []).length;
      return dollarSigns % 2 === 0;
    },
    () => {
      return /\\[a-zA-Z]+/.test(latex) || !latex.includes('\\');
    },
  ];

  return checks.every((check) => check());
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc\apps\workers\export-service'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest type-check 2>&1"
```

Expected: No type errors.

**Step 3: Commit**

```bash
git add apps/workers/export-service/src/handlers/pdf.ts
git commit -m "feat(export): implement PDF export via pdf-lib with embedded PNG pipeline"
```

---

### Task 7: Remove 501 NOT_IMPLEMENTED special-casing from index.ts

**Files:**
- Modify: `apps/workers/export-service/src/index.ts`

**Step 1: Remove the NOT_IMPLEMENTED catch block in the PNG route**

In `apps/workers/export-service/src/index.ts`, find the PNG route handler's catch block (lines 301-318) that checks for `'PNG export is not yet implemented'` and returns 501. Remove that entire `if` block:

Remove these lines:
```typescript
    // PNG export is a stub that throws a NOT_IMPLEMENTED error.
    // Return 501 so callers know this is a missing feature, not a server fault.
    if (
      error instanceof Error &&
      error.message.startsWith('PNG export is not yet implemented')
    ) {
      return c.json(
        {
          success: false,
          error: {
            message: 'PNG export is not yet implemented',
            code: 'NOT_IMPLEMENTED',
            hint: 'Use POST /export/svg for vector output. PNG support is planned via resvg-js (WebAssembly).',
          },
        },
        501
      );
    }
```

The generic error handler below it (`console.error('Error in /export/png:', error);`) will catch any real errors.

**Step 2: Verify TypeScript compiles**

Run:
```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc\apps\workers\export-service'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest type-check 2>&1"
```

Expected: No type errors.

**Step 3: Commit**

```bash
git add apps/workers/export-service/src/index.ts
git commit -m "refactor(export): remove 501 NOT_IMPLEMENTED stub for PNG route"
```

---

### Task 8: Update export service tests

**Files:**
- Modify: `apps/workers/export-service/src/index.test.ts`

**Step 1: Update PNG tests to expect 200 instead of 501**

In the existing test file, find all tests that assert 501 status for PNG and update them to expect 200 with `success: true`. The exact test changes depend on how MathJax and R2 are mocked — the key change is:

- Remove or update tests that assert `code: 'NOT_IMPLEMENTED'`
- Update the mock for PNG handler to return a valid result
- Ensure the R2 mock returns a valid upload result with signed URL

**Step 2: Run tests**

Run:
```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc\apps\workers\export-service'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest test 2>&1"
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add apps/workers/export-service/src/index.test.ts
git commit -m "test(export): update PNG and PDF tests for working implementations"
```

---

### Task 9: Verify full build and lint

**Files:** None (verification only)

**Step 1: Run lint on export service**

```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc\apps\workers\export-service'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest lint 2>&1"
```

Expected: Clean or only pre-existing warnings.

**Step 2: Run type-check on export service**

```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc\apps\workers\export-service'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest type-check 2>&1"
```

Expected: No errors.

**Step 3: Run web app build (includes middleware)**

```bash
powershell.exe -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\alber\Desktop\Projects\NextCalc'; & 'C:\Program Files\nodejs\npx.cmd' --yes pnpm@latest --filter @nextcalc/web build 2>&1"
```

Expected: Build succeeds. Serwist generates sw.js. Pages now show as dynamic (ƒ) due to CSP nonce middleware.

**Step 4: Verify security headers in build output**

Check that the middleware is being loaded by looking for middleware compilation in the build output.

**Step 5: Commit any remaining fixes**

If any lint or type errors were found, fix and commit them.
