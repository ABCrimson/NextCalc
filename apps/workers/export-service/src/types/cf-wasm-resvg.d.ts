/**
 * Ambient type declaration for `@cf-wasm/resvg` (v0.3.x).
 *
 * @cf-wasm/resvg is a WebAssembly build of resvg that runs inside Cloudflare
 * Workers.  The `/workerd` sub-path export is optimised for the Workers
 * runtime (workerd) and must be used instead of the default export.
 *
 * The package does not ship TypeScript declarations, so we declare the
 * minimal surface area used by our PNG export handler.
 *
 * Reference: https://github.com/aspect-build/aspect-wasm/tree/main/packages/resvg
 */

declare module '@cf-wasm/resvg/workerd' {
  /**
   * Options accepted by the Resvg constructor / async initialiser.
   */
  export interface ResvgOptions {
    /** Dots per inch — controls the rasterisation resolution. */
    dpi?: number;

    /**
     * How to fit the SVG into the output image.
     *
     * - `{ mode: 'original' }` renders at the SVG's intrinsic size.
     * - `{ mode: 'width', value: number }` scales to fit the given width.
     * - `{ mode: 'height', value: number }` scales to fit the given height.
     * - `{ mode: 'zoom', value: number }` applies a zoom factor.
     */
    fitTo?:
      | { mode: 'original' }
      | { mode: 'width'; value: number }
      | { mode: 'height'; value: number }
      | { mode: 'zoom'; value: number };

    /** Background colour (CSS colour string, e.g. '#FFFFFF'). */
    background?: string;

    /** Whether to crop the output to the bounding box of the content. */
    cropToContent?: boolean;

    /** Font-related options. */
    font?: {
      /** Extra font file buffers to register. */
      fontBuffers?: ArrayBuffer[];
      /** Default font family name. */
      defaultFontFamily?: string;
    };
  }

  /**
   * Rendered image returned by `Resvg.render()`.
   */
  export interface RenderedImage {
    /** Width of the rendered image in pixels. */
    width: number;
    /** Height of the rendered image in pixels. */
    height: number;
    /** Serialises the rendered image as a PNG byte array. */
    asPng(): Uint8Array;
  }

  /**
   * Resvg SVG-to-PNG converter backed by WebAssembly.
   *
   * In Cloudflare Workers the async factory **must** be used because WASM
   * instantiation is asynchronous in the workerd runtime.
   */
  export class Resvg {
    /**
     * Asynchronous factory — required in Cloudflare Workers (workerd).
     *
     * @param svg - SVG content as a Buffer or Uint8Array.
     * @param options - Rendering options.
     * @returns A ready-to-use Resvg instance.
     */
    static async(svg: Uint8Array, options?: ResvgOptions): Promise<Resvg>;

    /** Renders the SVG to a raster image. */
    render(): RenderedImage;
  }
}
