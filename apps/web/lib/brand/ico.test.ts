import { describe, expect, it } from 'vitest';
import { packIco, pngSize } from './ico';

describe('pngSize', () => {
  it('reads width/height from the IHDR chunk', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    new DataView(png.buffer).setUint32(16, 48, false);
    new DataView(png.buffer).setUint32(20, 32, false);
    expect(pngSize(png)).toEqual({ width: 48, height: 32 });
  });
  it('rejects non-PNG bytes', () => {
    expect(() => pngSize(new Uint8Array([1, 2, 3]))).toThrow();
  });
});

/** Minimal fake PNG payload: the 8-byte PNG signature + filler. */
function fakePng(size: number, fill: number): Uint8Array {
  const bytes = new Uint8Array(8 + size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.fill(fill, 8);
  return bytes;
}

describe('packIco', () => {
  it('writes the ICONDIR header (reserved 0, type 1, count n)', () => {
    const ico = packIco([{ size: 16, png: fakePng(10, 1) }]);
    const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);
    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(1);
  });

  it('writes one 16-byte ICONDIRENTRY per image with correct size/offset fields and embeds PNG data in order', () => {
    const a = fakePng(10, 0xaa);
    const b = fakePng(20, 0xbb);
    const ico = packIco([
      { size: 16, png: a },
      { size: 32, png: b },
    ]);
    const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);
    const headerLen = 6 + 2 * 16;
    // entry 0
    expect(ico[6]).toBe(16); // width
    expect(ico[7]).toBe(16); // height
    expect(ico[8]).toBe(0); // palette
    expect(view.getUint16(6 + 4, true)).toBe(1); // planes
    expect(view.getUint16(6 + 6, true)).toBe(32); // bit depth
    expect(view.getUint32(6 + 8, true)).toBe(a.byteLength);
    expect(view.getUint32(6 + 12, true)).toBe(headerLen);
    // entry 1
    expect(ico[6 + 16]).toBe(32);
    expect(view.getUint32(6 + 16 + 8, true)).toBe(b.byteLength);
    expect(view.getUint32(6 + 16 + 12, true)).toBe(headerLen + a.byteLength);
    // payloads
    expect(Array.from(ico.subarray(headerLen, headerLen + a.byteLength))).toEqual(Array.from(a));
    expect(Array.from(ico.subarray(headerLen + a.byteLength))).toEqual(Array.from(b));
    expect(ico.byteLength).toBe(headerLen + a.byteLength + b.byteLength);
  });

  it('encodes 256px as 0 in the width/height bytes (ICO convention)', () => {
    const ico = packIco([{ size: 256, png: fakePng(4, 1) }]);
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(0);
  });

  it('rejects non-PNG payloads and empty input', () => {
    expect(() => packIco([])).toThrow();
    expect(() => packIco([{ size: 16, png: new Uint8Array([1, 2, 3]) }])).toThrow();
  });
});
