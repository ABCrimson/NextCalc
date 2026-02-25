/**
 * Internal SVG generation utilities
 * Shared between SVG and PNG export handlers
 *
 * Uses MathJax 4.x to render LaTeX expressions to real SVG output.
 *
 * MathJax 4 provides a component-based API via the `mathjax` npm package.
 * The `init()` function sets up a fully configured MathJax instance with
 * TeX input and SVG output jax, plus the liteAdaptor (a minimal DOM shim
 * that works without a browser or Node DOM).
 *
 * Cloudflare Workers compatibility notes:
 * - Dynamic import() is not supported; all imports must be static.
 * - The `global` object does not exist; use `globalThis` instead.
 * - Worker threads (used by MathJax for font loading) are not available.
 *   MathJax 4 still works because `tex2svgPromise` handles font loading
 *   internally without spawning actual OS threads in the lite path.
 * - CPU time limit is raised to 5000ms in wrangler.toml to accommodate
 *   MathJax's first-call initialization cost; see the [limits] section.
 */

// MathJax 4.x component-based API.
// The default export is the MathJax object itself; calling `.init()` loads
// the requested component bundles and returns the same object once ready.
// Type declarations live in src/types/mathjax.d.ts.
import MathJax, { type MathJaxObject } from 'mathjax';

/**
 * SVG generation options
 */
export interface SvgOptions {
  fontSize: number;
  color: string;
  backgroundColor: string;
  inline: boolean;
}

/**
 * Singleton: one initialized MathJax instance reused across requests.
 *
 * We initialize lazily on the first call so that the Worker startup
 * (which runs before any request is received) stays fast and does not
 * block if MathJax has deferred font-loading work to perform.
 */
let mathJaxInstance: MathJaxObject | null = null;

/**
 * Returns a fully initialized MathJax instance, creating it on first call.
 *
 * Subsequent calls return the cached singleton without re-initializing.
 */
async function getMathJax(): Promise<MathJaxObject> {
  if (mathJaxInstance !== null) {
    return mathJaxInstance;
  }

  // `MathJax.init()` loads the requested component bundles and returns the
  // same MathJax object once everything is ready.  We pass only the
  // components we need to minimise bundle size and initialization time.
  mathJaxInstance = await MathJax.init({
    // The `loader` section tells MathJax which component bundles to load.
    // `input/tex`      - processes LaTeX/TeX math notation.
    // `output/svg`     - serialises typeset results to SVG.
    // `adaptors/liteDOM` - lightweight DOM shim for non-browser environments
    //                    (Node, Cloudflare Workers); avoids importing jsdom.
    loader: {
      load: ['input/tex', 'output/svg', 'adaptors/liteDOM'],
    },

    tex: {
      // `base` is always included.  Adding `ams` and `newcommand` covers
      // the vast majority of mathematics typeset with LaTeX.
      packages: ['base', 'ams', 'newcommand'],
      // MathJax operates on bare LaTeX strings here (no surrounding
      // $ delimiters required), but specifying delimiters prevents the
      // parser from choking if users include them in their input.
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
    },

    svg: {
      // 'global' stores font path data once per document rather than
      // embedding it into every individual <svg> element.  Since each
      // Worker invocation renders into a single document context, this is
      // safe and produces smaller per-expression output.
      fontCache: 'global',
    },

    startup: {
      // We drive typesetting ourselves via tex2svgPromise; suppress the
      // automatic page-level scan that normally runs on init.
      typeset: false,
    },
  });

  return mathJaxInstance;
}

/**
 * Renders a LaTeX expression to an SVG string using MathJax 4.x.
 *
 * The returned SVG is a complete, standalone `<svg>` element suitable for
 * embedding directly in HTML or saving as a `.svg` file.  It does NOT
 * include an XML declaration so it embeds cleanly without escaping.
 *
 * @param latex - LaTeX expression (bare, e.g. `\\frac{1}{2}` or `$x^2$`)
 * @param options - Rendering options (fontSize, color, background, mode)
 * @returns Full SVG markup string
 * @throws Error if MathJax fails to initialize or the LaTeX is invalid
 */
export async function generateSvgFromLatex(
  latex: string,
  options: SvgOptions
): Promise<string> {
  const { fontSize, color, backgroundColor, inline } = options;

  // MathJax uses `em` as the primary font-size unit and `ex` (x-height) for
  // vertical sizing.  A typical ex/em ratio for math fonts is ~0.44.
  const em = fontSize;
  const ex = Math.round(fontSize * 0.44);
  // Generous container width keeps MathJax from inserting line breaks.
  const containerWidth = 1200;

  let mathJax: MathJaxObject;
  try {
    mathJax = await getMathJax();
  } catch (initError) {
    // Surface a clear error if MathJax cannot load its bundles (e.g. the
    // Worker bundler stripped them or a component path is wrong).
    const message = initError instanceof Error ? initError.message : String(initError);
    throw new Error(`MathJax initialization failed: ${message}`);
  }

  let node: unknown;
  try {
    // tex2svgPromise handles asynchronous font loading internally and is
    // the recommended method in MathJax 4.  It resolves with a lite DOM
    // node containing the rendered <svg> as a child element.
    node = await mathJax.tex2svgPromise(latex, {
      display: !inline,
      em,
      ex,
      containerWidth,
    });
  } catch (renderError) {
    // MathJax throws on parse errors (unknown commands, unbalanced braces,
    // etc.).  Wrap the error so the route handler can return a 400.
    const message = renderError instanceof Error ? renderError.message : String(renderError);
    throw new Error(`LaTeX render error: ${message}`);
  }

  const adaptor = mathJax.startup.adaptor;

  // `tex2svgPromise` returns a container node; the actual <svg> is the
  // first child element with tag name 'svg'.
  const svgNodes = adaptor.tags(node, 'svg');
  const firstSvg = svgNodes[0];

  if (firstSvg === undefined) {
    throw new Error('MathJax produced no SVG output for the given expression');
  }

  let svgString = adaptor.serializeXML(firstSvg);

  // Apply the requested foreground color.
  // MathJax emits `currentColor` on path fills by default; setting the
  // `color` CSS property on the root <svg> element cascades to all paths.
  if (color !== '#000000') {
    svgString = svgString.replace(/^<svg /, `<svg color="${color}" `);
  }

  // Apply background color when not transparent.
  // We insert a <rect> covering 100% of the SVG area immediately after the
  // opening tag so it renders behind all math content.
  if (backgroundColor !== 'transparent') {
    svgString = svgString.replace(
      /(<svg[^>]*>)/,
      `$1<rect width="100%" height="100%" fill="${backgroundColor}"/>`
    );
  }

  return svgString;
}
