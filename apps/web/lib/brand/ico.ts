/**
 * Minimal ICO container writer (PNG-compressed entries, as every browser and
 * Windows ≥ Vista accept). No dependency — 6-byte ICONDIR + 16-byte entries +
 * the PNG payloads back to back.
 */

export interface IcoImage {
  /** Square pixel size (1–256). */
  readonly size: number;
  /** Complete PNG file bytes. */
  readonly png: Uint8Array;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

/** Width/height from a PNG's IHDR chunk (bytes 16–23, big-endian). */
export function pngSize(png: Uint8Array): { readonly width: number; readonly height: number } {
  if (!isPng(png) || png.byteLength < 24) throw new Error('pngSize: not a PNG');
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

export function packIco(images: readonly IcoImage[]): Uint8Array {
  if (images.length === 0) throw new Error('packIco: at least one image is required');
  for (const img of images) {
    if (!isPng(img.png)) throw new Error(`packIco: ${img.size}px payload is not a PNG`);
    if (img.size < 1 || img.size > 256) throw new Error(`packIco: unsupported size ${img.size}`);
  }
  const headerLength = 6 + 16 * images.length;
  const total = headerLength + images.reduce((n, img) => n + img.png.byteLength, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, images.length, true);
  let offset = headerLength;
  images.forEach((img, i) => {
    const e = 6 + i * 16;
    out[e] = img.size === 256 ? 0 : img.size; // width (0 = 256)
    out[e + 1] = img.size === 256 ? 0 : img.size; // height
    out[e + 2] = 0; // palette colors
    out[e + 3] = 0; // reserved
    view.setUint16(e + 4, 1, true); // color planes
    view.setUint16(e + 6, 32, true); // bits per pixel
    view.setUint32(e + 8, img.png.byteLength, true);
    view.setUint32(e + 12, offset, true);
    out.set(img.png, offset);
    offset += img.png.byteLength;
  });
  return out;
}
