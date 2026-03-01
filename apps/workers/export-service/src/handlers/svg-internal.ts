/**
 * Internal SVG generation — KaTeX 0.16.33 server-side rendering.
 *
 * Uses KaTeX's `renderToString` for high-fidelity LaTeX rendering
 * entirely in JavaScript — no filesystem, no Node.js globals, fully
 * compatible with Cloudflare Workers.
 *
 * Two rendering modes:
 *
 * 1. **Rich SVG** (`generateSvgFromLatex`): Produces a standalone SVG with
 *    `<foreignObject>` embedding KaTeX HTML + inlined CSS.  Renders
 *    perfectly in browsers and can be saved as `.svg`.
 *
 * 2. **Rasterisable SVG** (`generateRasterSvgFromLatex`): Produces a pure
 *    SVG with `<text>` elements using Unicode symbols converted from LaTeX.
 *    Suitable for resvg (WASM) rasterisation in the PNG/PDF pipeline.
 */

import katex from 'katex';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options accepted by both SVG generation modes. */
export interface SvgOptions {
  fontSize: number;
  color: string;
  backgroundColor: string;
  inline: boolean;
}

// ---------------------------------------------------------------------------
// KaTeX CSS — minimal inline stylesheet for Workers (no font files).
//
// Font files (woff2/woff/ttf) cannot be bundled into a Worker script.
// KaTeX's HTML output still renders correctly using system math fonts
// (STIX Two Math, Cambria Math, Times New Roman) which cover virtually
// all math symbols. The CSS below captures KaTeX's layout rules.
// ---------------------------------------------------------------------------

const KATEX_CSS = `
.katex{font:normal 1.21em 'STIX Two Math','Cambria Math','Latin Modern Math','Times New Roman',serif;line-height:1.2;text-indent:0;text-rendering:auto;direction:ltr}
.katex-display{display:block;margin:1em 0;text-align:center}
.katex-display>.katex{display:block;text-align:center;white-space:nowrap}
.katex .katex-html{display:inline-block}
.katex .base{position:relative;display:inline-block;white-space:nowrap;width:min-content}
.katex .strut{display:inline-block}
.katex .mord{padding:0 .03em}
.katex .mbin{margin:0 .22222em}
.katex .mrel{margin:0 .27778em}
.katex .mpunct{margin-right:.16667em}
.katex .mopen,.katex .mclose{margin:0 .05556em}
.katex .minner{padding:0 .16667em}
.katex .frac-line{border-bottom-style:solid;border-bottom-width:0.04em;width:100%}
.katex .mfrac>span>span{text-align:center}
.katex .mfrac .frac-line{width:100%}
.katex .sqrt{display:inline-block}
.katex .sqrt>.sqrt-sign{position:relative}
.katex .sqrt>.root{position:absolute}
.katex .overline .overline-line,.katex .underline .underline-line{border-bottom-style:solid;border-bottom-width:0.04em}
.katex .stretchy{width:100%;display:block;position:relative;overflow:hidden}
.katex .vlist-t{display:inline-table;table-layout:fixed;border-collapse:collapse}
.katex .vlist-r{display:table-row}
.katex .vlist{display:table-cell;vertical-align:bottom;position:relative}
.katex .vlist>span{display:block;height:0;position:relative}
.katex .vlist>span>span{display:inline-block}
.katex .vlist-s{display:table-cell;vertical-align:bottom;font-size:1px;width:1px;min-width:1px}
.katex .msupsub{text-align:left}
.katex .delimsizing.size1{font-family:'STIX Two Math','Cambria Math',serif}
.katex .delimsizing.size2{font-family:'STIX Two Math','Cambria Math',serif}
.katex .delimsizing.size3{font-family:'STIX Two Math','Cambria Math',serif}
.katex .delimsizing.size4{font-family:'STIX Two Math','Cambria Math',serif}
.katex .op-symbol{position:relative}
.katex .op-symbol.large-op{font-size:1.5em}
.katex .op-symbol.small-op{font-size:1em}
.katex .accent>.vlist-t{text-align:center}
.katex .accent .accent-body{position:relative}
.katex .mtable .vertical-separator{display:inline-block;min-width:1px}
.katex .mtable .arraycolsep{display:inline-block}
.katex .enclosing{display:inline-block;position:relative}
`;

// ---------------------------------------------------------------------------
// XML / HTML helpers
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// 1. Rich SVG via KaTeX (browser-renderable, <foreignObject>)
// ---------------------------------------------------------------------------

/**
 * Renders LaTeX to a standalone SVG string using KaTeX 0.16.33.
 *
 * The SVG embeds KaTeX's HTML output inside a `<foreignObject>` together
 * with inlined CSS, making it fully self-contained — no external
 * stylesheets or fonts needed when viewed in a browser.
 *
 * KaTeX 0.16.33 options used:
 * - `output: "htmlAndMathml"` — dual output for accessibility
 * - `displayMode`             — block vs inline rendering
 * - `throwOnError: false`     — graceful fallback for bad input
 * - `errorColor`              — visible error indicator
 * - `strict: "ignore"`        — permissive parsing
 * - `trust: true`             — allow all LaTeX commands
 * - `globalGroup: false`      — isolated macro scope per render
 * - `maxExpand: 1000`         — generous macro expansion limit
 * - `maxSize: Infinity`       — no size restrictions
 * - `minRuleThickness: 0.04`  — crisp fraction/rule lines
 *
 * @param latex   — LaTeX expression (bare or delimited)
 * @param options — rendering configuration
 * @returns standalone SVG markup string
 */
export async function generateSvgFromLatex(latex: string, options: SvgOptions): Promise<string> {
  const { fontSize, color, backgroundColor, inline } = options;

  // Strip surrounding delimiters if present
  let cleanLatex = latex.trim();
  cleanLatex = cleanLatex.replace(/^\$\$|\$\$$/g, '');
  cleanLatex = cleanLatex.replace(/^\$|\$$/g, '');
  cleanLatex = cleanLatex.replace(/^\\\[|\\\]$/g, '');
  cleanLatex = cleanLatex.replace(/^\\\(|\\\)$/g, '');

  // Render with KaTeX 0.16.33 — full feature set
  const katexHtml = katex.renderToString(cleanLatex, {
    displayMode: !inline,
    output: 'htmlAndMathml',
    throwOnError: false,
    errorColor: '#cc0000',
    strict: 'ignore',
    trust: true,
    globalGroup: false,
    maxExpand: 1000,
    maxSize: Infinity,
    minRuleThickness: 0.04,
    colorIsTextColor: false,
    fleqn: false,
    leqno: false,
    macros: {
      '\\RR': '\\mathbb{R}',
      '\\CC': '\\mathbb{C}',
      '\\ZZ': '\\mathbb{Z}',
      '\\NN': '\\mathbb{N}',
      '\\QQ': '\\mathbb{Q}',
    },
  });

  // Size estimation: KaTeX HTML width scales roughly with expression length
  const estimatedChars = cleanLatex.length;
  const baseFontPx = fontSize * 1.21; // KaTeX default scaling
  const charWidth = baseFontPx * 0.55;
  const svgWidth = Math.max(Math.ceil(estimatedChars * charWidth + baseFontPx * 4), 200);
  const svgHeight = inline ? Math.ceil(baseFontPx * 2.5) : Math.ceil(baseFontPx * 4);

  const bgRect =
    backgroundColor !== 'transparent'
      ? `<rect width="100%" height="100%" fill="${escapeXml(backgroundColor)}"/>`
      : '';

  // Font face references stripped from CSS — KaTeX will fall back to
  // system serif fonts (Times New Roman, etc.) which cover the vast
  // majority of math symbols.  The HTML includes MathML as well for
  // screen-reader accessibility.
  const cssWithColor = `${KATEX_CSS}
.katex { font-size: ${fontSize}px !important; color: ${color}; }
.katex-display { margin: 0 !important; }`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${svgWidth}" height="${svgHeight}"
     viewBox="0 0 ${svgWidth} ${svgHeight}">
  <title>${escapeXml(latex)}</title>
  ${bgRect}
  <foreignObject x="0" y="0" width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml"
         style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:8px;box-sizing:border-box;">
      <style>${cssWithColor}</style>
      ${katexHtml}
    </div>
  </foreignObject>
</svg>`;
}

// ---------------------------------------------------------------------------
// 2. Rasterisable SVG (for resvg WASM — pure SVG text, no foreignObject)
// ---------------------------------------------------------------------------

/**
 * LaTeX command → Unicode mapping for the text-based fallback renderer.
 */
const LATEX_UNICODE: ReadonlyArray<readonly [RegExp, string]> = [
  // Greek
  [/\\alpha/g, '\u03B1'],
  [/\\beta/g, '\u03B2'],
  [/\\gamma/g, '\u03B3'],
  [/\\delta/g, '\u03B4'],
  [/\\epsilon/g, '\u03B5'],
  [/\\zeta/g, '\u03B6'],
  [/\\eta/g, '\u03B7'],
  [/\\theta/g, '\u03B8'],
  [/\\iota/g, '\u03B9'],
  [/\\kappa/g, '\u03BA'],
  [/\\lambda/g, '\u03BB'],
  [/\\mu/g, '\u03BC'],
  [/\\nu/g, '\u03BD'],
  [/\\xi/g, '\u03BE'],
  [/\\pi/g, '\u03C0'],
  [/\\rho/g, '\u03C1'],
  [/\\sigma/g, '\u03C3'],
  [/\\tau/g, '\u03C4'],
  [/\\phi/g, '\u03C6'],
  [/\\chi/g, '\u03C7'],
  [/\\psi/g, '\u03C8'],
  [/\\omega/g, '\u03C9'],
  [/\\Gamma/g, '\u0393'],
  [/\\Delta/g, '\u0394'],
  [/\\Theta/g, '\u0398'],
  [/\\Lambda/g, '\u039B'],
  [/\\Pi/g, '\u03A0'],
  [/\\Sigma/g, '\u03A3'],
  [/\\Phi/g, '\u03A6'],
  [/\\Psi/g, '\u03A8'],
  [/\\Omega/g, '\u03A9'],
  // Operators
  [/\\times/g, '\u00D7'],
  [/\\div/g, '\u00F7'],
  [/\\pm/g, '\u00B1'],
  [/\\cdot/g, '\u00B7'],
  [/\\leq/g, '\u2264'],
  [/\\geq/g, '\u2265'],
  [/\\neq/g, '\u2260'],
  [/\\approx/g, '\u2248'],
  [/\\equiv/g, '\u2261'],
  [/\\infty/g, '\u221E'],
  [/\\partial/g, '\u2202'],
  [/\\nabla/g, '\u2207'],
  [/\\int/g, '\u222B'],
  [/\\sum/g, '\u2211'],
  [/\\prod/g, '\u220F'],
  [/\\sqrt/g, '\u221A'],
  [/\\forall/g, '\u2200'],
  [/\\exists/g, '\u2203'],
  [/\\in/g, '\u2208'],
  [/\\cup/g, '\u222A'],
  [/\\cap/g, '\u2229'],
  [/\\rightarrow/g, '\u2192'],
  [/\\leftarrow/g, '\u2190'],
  [/\\Rightarrow/g, '\u21D2'],
  [/\\Leftarrow/g, '\u21D0'],
  // Structure — simplify
  [/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)'],
  [/\\text\{([^}]*)\}/g, '$1'],
  [/\\mathrm\{([^}]*)\}/g, '$1'],
  [/\^{([^}]*)}/g, '^($1)'],
  [/_{([^}]*)}/g, '_($1)'],
  [/\\[,;:!]\s?/g, ' '],
  [/\\quad/g, '  '],
  [/\\[a-zA-Z]+/g, ''],
  [/[{}]/g, ''],
] as const;

function latexToUnicode(latex: string): string {
  let r = latex
    .trim()
    .replace(/^\$+|\$+$/g, '')
    .replace(/^\\\[|\\\]$/g, '');
  for (const [p, s] of LATEX_UNICODE) r = r.replace(p, s);
  return r.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Produces a pure SVG with `<text>` — compatible with resvg rasterisation.
 *
 * Used internally by the PNG and PDF export pipelines where `<foreignObject>`
 * is not supported by the rasteriser.
 */
export async function generateRasterSvgFromLatex(
  latex: string,
  options: SvgOptions,
): Promise<string> {
  const { fontSize, color, backgroundColor, inline } = options;
  const display = latexToUnicode(latex);
  const escaped = escapeXml(display);
  const escapedLatex = escapeXml(latex);

  const charW = fontSize * 0.62;
  const padding = fontSize;
  const w = Math.max(Math.ceil(display.length * charW + padding * 2), fontSize * 4);
  const h = inline ? Math.ceil(fontSize * 2) : Math.ceil(fontSize * 3.5);

  const bg =
    backgroundColor !== 'transparent'
      ? `<rect width="100%" height="100%" fill="${escapeXml(backgroundColor)}"/>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <title>${escapedLatex}</title>
  ${bg}
  <text x="${Math.ceil(w / 2)}" y="${Math.ceil(h / 2)}"
    text-anchor="middle" dominant-baseline="central"
    font-family="'STIX Two Math','Cambria Math','Latin Modern Math',serif"
    font-size="${fontSize}" fill="${escapeXml(color)}">${escaped}</text>
</svg>`;
}
