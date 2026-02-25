/**
 * Ambient type declaration for the `mathjax` npm package (v4.x).
 *
 * MathJax 4.x does not ship TypeScript declaration files (.d.ts) with its
 * npm package.  This declaration covers the minimal surface used by
 * svg-internal.ts and keeps the project in strict-mode TypeScript compliance.
 *
 * When/if MathJax publishes official types, replace this file with the
 * official package types (e.g. `@types/mathjax` for MathJax 4, if ever
 * published, or by re-exporting from `@mathjax/src` if that ships types).
 *
 * Reference: https://docs.mathjax.org/en/v4.0/server/components.html
 */

declare module 'mathjax' {
  /**
   * Lightweight DOM adaptor returned by MathJax startup.
   * Used to serialise the rendered math node back to an SVG string.
   */
  export interface LiteAdaptor {
    /**
     * Serialises a lite DOM node (or subtree) to an XML string.
     */
    serializeXML(node: unknown): string;

    /**
     * Returns all descendant elements with the given tag name.
     */
    tags(node: unknown, tagName: string): unknown[];
  }

  /**
   * MathJax startup object, available after `init()` resolves.
   */
  export interface MathJaxStartup {
    /** The liteAdaptor instance used for DOM-free rendering. */
    adaptor: LiteAdaptor;
  }

  /**
   * Options accepted by `MathJax.init()`.
   */
  export interface MathJaxInitConfig {
    loader?: {
      /** Component bundle names to load (e.g. 'input/tex', 'output/svg'). */
      load?: string[];
      /** Base path for resolving components. */
      paths?: Record<string, string>;
    };
    tex?: {
      /** TeX extension packages to enable (e.g. ['base', 'ams']). */
      packages?: string[];
      /** Inline math delimiters. */
      inlineMath?: Array<[string, string]>;
      /** Display math delimiters. */
      displayMath?: Array<[string, string]>;
      /** Equation numbering scheme ('none' | 'ams' | 'all'). */
      tags?: string;
    };
    svg?: {
      /**
       * Font path caching strategy.
       * 'global' — share paths across all expressions on the page (recommended).
       * 'local'  — embed paths in each <svg>.
       * 'none'   — no caching; largest output.
       */
      fontCache?: 'global' | 'local' | 'none';
      /** Ratio of ex to em for the selected font. */
      exFactor?: number;
    };
    startup?: {
      /** Set to false to suppress automatic page typesetting on init. */
      typeset?: boolean;
      /** Callback invoked when MathJax is fully ready. */
      ready?: () => void;
    };
    options?: {
      skipHtmlTags?: string[];
    };
  }

  /**
   * Options accepted by conversion methods such as `tex2svgPromise`.
   */
  export interface MathJaxConvertOptions {
    /** true = display mode (centred, larger); false = inline mode. */
    display?: boolean;
    /** Font size in pixels (em unit for MathJax sizing). */
    em?: number;
    /** x-height in pixels (ex unit for MathJax sizing). */
    ex?: number;
    /** Container width in pixels, used for line-breaking decisions. */
    containerWidth?: number;
  }

  /**
   * The MathJax object returned by `init()` and exposed as the default export.
   */
  export interface MathJaxObject {
    /**
     * Initialises MathJax with the given configuration.
     * Returns a promise that resolves to the same MathJaxObject once all
     * requested components are loaded and ready.
     */
    init(config: MathJaxInitConfig): Promise<MathJaxObject>;

    /**
     * Converts a TeX/LaTeX string to an SVG DOM node (async, handles font loads).
     * Use `startup.adaptor.serializeXML(adaptor.tags(node, 'svg')[0])` to get
     * the SVG markup string.
     */
    tex2svgPromise(math: string, options?: MathJaxConvertOptions): Promise<unknown>;

    /**
     * Synchronous variant of tex2svgPromise.
     * Prefer the promise-based method in v4 — font data may load asynchronously.
     */
    tex2svg(math: string, options?: MathJaxConvertOptions): unknown;

    /** Startup state, available after init() resolves. */
    startup: MathJaxStartup;

    /**
     * Signals MathJax that no further rendering will occur.
     * Terminates any background worker threads used for font loading.
     * Call this when the Worker is about to shut down to allow clean exit.
     */
    done?(): void;
  }

  /**
   * The convenience `init` named export (same as `MathJax.init`).
   */
  export const init: MathJaxObject['init'];

  /** Default export is the MathJax object itself. */
  const MathJax: MathJaxObject;
  export default MathJax;
}
