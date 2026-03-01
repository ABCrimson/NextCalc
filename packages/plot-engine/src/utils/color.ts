/**
 * Color utilities for parsing and converting colors
 * @module utils/color
 */

import type { Color } from '../types/index';

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Parses a color value to RGBA components
 * @param color Color in various formats
 * @returns RGBA color components (0-1 range)
 */
export function parseColor(color: Color): RGBA {
  if (typeof color === 'string') {
    return parseColorString(color);
  }

  return {
    r: color.r / 255,
    g: color.g / 255,
    b: color.b / 255,
    a: color.a !== undefined ? color.a : 1,
  };
}

/**
 * Parses a color string (hex, rgb, rgba) to RGBA
 */
function parseColorString(color: string): RGBA {
  // Hex color (#RGB or #RRGGBB or #RRGGBBAA)
  if (color.startsWith('#')) {
    return parseHexColor(color);
  }

  // RGB/RGBA color
  if (color.startsWith('rgb')) {
    return parseRGBColor(color);
  }

  // Named colors (basic support)
  return parseNamedColor(color);
}

/**
 * Parses hex color string
 */
function parseHexColor(hex: string): RGBA {
  const cleaned = hex.replace('#', '');

  if (cleaned.length === 3) {
    // #RGB
    const r = parseInt(cleaned[0]! + cleaned[0]!, 16) / 255;
    const g = parseInt(cleaned[1]! + cleaned[1]!, 16) / 255;
    const b = parseInt(cleaned[2]! + cleaned[2]!, 16) / 255;
    return { r, g, b, a: 1 };
  }

  if (cleaned.length === 6) {
    // #RRGGBB
    const r = parseInt(cleaned.slice(0, 2), 16) / 255;
    const g = parseInt(cleaned.slice(2, 4), 16) / 255;
    const b = parseInt(cleaned.slice(4, 6), 16) / 255;
    return { r, g, b, a: 1 };
  }

  if (cleaned.length === 8) {
    // #RRGGBBAA
    const r = parseInt(cleaned.slice(0, 2), 16) / 255;
    const g = parseInt(cleaned.slice(2, 4), 16) / 255;
    const b = parseInt(cleaned.slice(4, 6), 16) / 255;
    const a = parseInt(cleaned.slice(6, 8), 16) / 255;
    return { r, g, b, a };
  }

  throw new Error(`Invalid hex color: ${hex}`);
}

/**
 * Parses RGB/RGBA color string
 */
function parseRGBColor(rgb: string): RGBA {
  const match = rgb.match(/rgba?\(([^)]+)\)/);
  if (!match || !match[1]) {
    throw new Error(`Invalid RGB color: ${rgb}`);
  }

  const parts = match[1].split(',').map((s) => s.trim());
  const r = Number.parseInt(parts[0]!, 10) / 255;
  const g = Number.parseInt(parts[1]!, 10) / 255;
  const b = Number.parseInt(parts[2]!, 10) / 255;
  const a = parts[3] ? Number.parseFloat(parts[3]) : 1;

  return { r, g, b, a };
}

/**
 * Basic named color support
 */
function parseNamedColor(name: string): RGBA {
  const colors: Record<string, string> = {
    red: '#ff0000',
    green: '#00ff00',
    blue: '#0000ff',
    white: '#ffffff',
    black: '#000000',
    yellow: '#ffff00',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    gray: '#808080',
    orange: '#ffa500',
    purple: '#800080',
  };

  const hex = colors[name.toLowerCase()];
  if (hex) {
    return parseHexColor(hex);
  }

  throw new Error(`Unknown color name: ${name}`);
}

/**
 * Converts Color (string or object) to CSS color string
 */
export function colorToString(color: Color): string {
  if (typeof color === 'string') {
    return color;
  }
  return rgbaToString(parseColor(color));
}

/**
 * Converts RGBA to CSS color string
 */
export function rgbaToString(color: RGBA): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);

  if (color.a === 1) {
    return `rgb(${r}, ${g}, ${b})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${color.a})`;
}

/**
 * Converts RGBA to hex string
 */
export function rgbaToHex(color: RGBA): string {
  const r = Math.round(color.r * 255)
    .toString(16)
    .padStart(2, '0');
  const g = Math.round(color.g * 255)
    .toString(16)
    .padStart(2, '0');
  const b = Math.round(color.b * 255)
    .toString(16)
    .padStart(2, '0');

  if (color.a === 1) {
    return `#${r}${g}${b}`;
  }

  const a = Math.round(color.a * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}${a}`;
}

/**
 * Interpolates between two colors
 */
export function interpolateColor(color1: Color, color2: Color, t: number): RGBA {
  const c1 = parseColor(color1);
  const c2 = parseColor(color2);

  return {
    r: c1.r + (c2.r - c1.r) * t,
    g: c1.g + (c2.g - c1.g) * t,
    b: c1.b + (c2.b - c1.b) * t,
    a: c1.a + (c2.a - c1.a) * t,
  };
}

/**
 * Color maps for scientific visualization
 */
export const ColorMaps = {
  viridis: [
    '#440154',
    '#482878',
    '#3e4a89',
    '#31688e',
    '#26828e',
    '#1f9e89',
    '#35b779',
    '#6ece58',
    '#b5de2b',
    '#fde724',
  ],
  plasma: [
    '#0d0887',
    '#46039f',
    '#7201a8',
    '#9c179e',
    '#bd3786',
    '#d8576b',
    '#ed7953',
    '#fb9f3a',
    '#fdca26',
    '#f0f921',
  ],
  turbo: [
    '#30123b',
    '#4454c4',
    '#4690fe',
    '#39b3ed',
    '#1bd0d5',
    '#1ae4b6',
    '#59f38f',
    '#8ffe65',
    '#bcfd3d',
    '#e9f70f',
  ],
  rainbow: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'],
  inferno: [
    '#000004',
    '#160b39',
    '#420a68',
    '#6a176e',
    '#932667',
    '#bc3754',
    '#dd513a',
    '#f37819',
    '#fca50a',
    '#f0f921',
  ],
  coolwarm: [
    '#3b4cc0',
    '#6688ee',
    '#99bbff',
    '#c9d8ef',
    '#edd1c2',
    '#f7a889',
    '#e26952',
    '#b40426',
  ],
  cividis: [
    '#002051',
    '#0d346b',
    '#30486e',
    '#525e6c',
    '#6e7487',
    '#8d8fa3',
    '#a8acb8',
    '#c3cccc',
    '#e1e4aa',
    '#fdea45',
  ],
  magma: [
    '#000004',
    '#140e36',
    '#3b0f70',
    '#641a80',
    '#8c2981',
    '#b73779',
    '#de4968',
    '#f7735c',
    '#feb97d',
    '#fcfdbf',
  ],
  spectral: [
    '#9e0142',
    '#d53e4f',
    '#f46d43',
    '#fdae61',
    '#fee08b',
    '#e6f598',
    '#abdda4',
    '#66c2a5',
    '#3288bd',
    '#5e4fa2',
  ],
};

/**
 * Gets a color from a color map based on normalized value (0-1)
 */
export function getColorFromMap(map: keyof typeof ColorMaps, value: number): RGBA {
  const colors = ColorMaps[map];
  const t = Math.max(0, Math.min(1, value));
  const index = t * (colors.length - 1);
  const i = Math.floor(index);
  const j = Math.ceil(index);
  const f = index - i;

  if (i === j) {
    return parseColor(colors[i]!);
  }

  return interpolateColor(colors[i]!, colors[j]!, f);
}
