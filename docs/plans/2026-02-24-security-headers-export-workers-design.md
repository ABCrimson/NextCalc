# Security Headers + Export Workers Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement the corresponding plan task-by-task.

**Goal:** Add comprehensive HTTP security headers (CSP with per-request nonce, HSTS, X-Frame-Options, etc.) and implement working PNG + PDF export in the Cloudflare Workers export service.

**Architecture:** Two independent features. Security headers are enforced via Next.js middleware using Nosecone. Export workers extend the existing export-service Cloudflare Worker with @cf-wasm/resvg for SVG-to-PNG and pdf-lib for PNG-to-PDF.

**Tech Stack:** Nosecone 1.1.0, @nosecone/next 1.1.0, @cf-wasm/resvg 0.3.3, pdf-lib 1.17.1

---

## Feature 1: HTTP Security Headers

### Dependencies
- `nosecone@1.1.0` — Core security headers library (by Arcjet)
- `@nosecone/next@1.1.0` — Next.js middleware integration

### New File: `apps/web/middleware.ts`

Next.js middleware that runs on every non-static request:

1. Generates per-request nonce via `crypto.randomUUID()`
2. Configures Nosecone with strict CSP including WebGL/Worker exceptions:
   - `script-src 'self' 'nonce-{nonce}'`
   - `worker-src 'self' blob:` (compute worker, plot sampling Blob workers, Serwist SW)
   - `style-src 'self' 'unsafe-inline'` (KaTeX/MathJax inline styles)
   - `img-src 'self' data: blob:` (WebGL textures, canvas exports)
   - `connect-src 'self' https://exports.nextcalc.pro https://*.upstash.io`
   - `frame-ancestors 'none'` (replaces X-Frame-Options DENY)
3. Static headers alongside CSP:
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
4. Matcher: `/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)`

### Modify: `apps/web/next.config.ts`

Add `headers()` function for API route security headers (excluded from middleware matcher):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Cache-Control: no-store` on `/api/auth/**`

### Impact
- All pages become dynamic (nonce-based CSP prevents static pre-rendering)
- Inline theme script in layout.tsx gets nonce automatically from Next.js
- No changes to existing components, just header injection

---

## Feature 2: Export Workers (PNG + PDF)

### Dependencies (added to `apps/workers/export-service`)
- `@cf-wasm/resvg@0.3.3` — WASM-based SVG-to-PNG, Cloudflare Workers compatible
- `pdf-lib@1.17.1` — Pure JS PDF creation, no native deps

### Pipeline
```
LaTeX string
  → MathJax 4.1.1 SVG (existing, working)
    → @cf-wasm/resvg PNG (new)
      → pdf-lib PDF (new)
```

### Modify: `apps/workers/export-service/src/handlers/png.ts`

Replace NOT_IMPLEMENTED stub:
1. Import `Resvg` from `@cf-wasm/resvg/workerd`
2. `generatePngFromLatex()`:
   - Call `generateSvgFromLatex()` from `svg-internal.ts`
   - `await Resvg.async(svgBuffer, { dpi, background, fitTo })` — async init required in Workers
   - `resvg.render().asPng()` → `Uint8Array`
   - Upload to R2 via existing `uploadToR2()`
3. Keep existing helpers: `getRecommendedDpi()`, `estimatePngSize()`
4. Replace `convertSvgToPng()` stub with real resvg logic
5. Fix `batchExportToPng()` to use working pipeline

### Modify: `apps/workers/export-service/src/handlers/pdf.ts`

Replace placeholder stub:
1. Import `PDFDocument` from `pdf-lib`
2. `generatePdfFromLatex()`:
   - Get SVG from `generateSvgFromLatex()`
   - Convert to PNG via resvg (same logic as png handler)
   - `PDFDocument.create()` → embed PNG → add page sized to image + margins
   - Set metadata: title, author ("NextCalc Pro"), creation date
   - `doc.save()` → `Uint8Array`
   - Upload to R2
3. `batchExportToPdf()` — one document, one page per expression
4. Keep `validateLatexSyntax()` and `createLatexDocument()`

### Modify: `apps/workers/export-service/src/index.ts`

Remove the 501 NOT_IMPLEMENTED special-casing for PNG route — it now returns real results.

### Modify: `apps/workers/export-service/package.json`

Add `@cf-wasm/resvg` and `pdf-lib` to dependencies.

---

## Unchanged

- Rate limiter worker (already has CORS, sliding window, multi-tier)
- Auth middleware with RBAC (already working)
- SVG export handler (already working)
- R2 storage utilities (already working)
- Client-side plot export toolbar (separate from LaTeX export)
- Service worker (Serwist, from previous CI/CD+PWA work)

## Post-Deployment Manual Steps

- Test CSP with browser DevTools → Console for violations
- Consider adding `report-uri` or `report-to` CSP directive later for monitoring
- Verify export worker with `curl` against the deployed endpoint
