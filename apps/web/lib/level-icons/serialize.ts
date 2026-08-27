/**
 * Scene model + SVG serializer for the level icons.
 *
 * The icon art is authored ONCE as a framework-free scene tree (`SceneNode`).
 * Two consumers render it:
 *   - `scripts/generate-level-icons.ts` serializes it to static `.svg` files
 *     (runtime DB data: `User.image` avatar URLs), and
 *   - `components/profile/level-icon.tsx` renders the same tree as React elements.
 *
 * Attribute keys are written in React camelCase (`strokeWidth`, `stopColor`);
 * the serializer converts them to the SVG spec spelling, preserving the
 * attributes that are camelCase in SVG itself (`viewBox`, `gradientUnits`, …).
 */

export type AttrValue = string | number | undefined;

export interface SceneNode {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, AttrValue>>;
  readonly children: readonly SceneNode[];
  /** Text content (used for `<style>`); mutually exclusive with `children`. */
  readonly text?: string;
}

/** Build a scene node. Pass a string as the third argument for text content. */
export function el(
  tag: string,
  attrs: Readonly<Record<string, AttrValue>> = {},
  children: readonly SceneNode[] | string = [],
): SceneNode {
  if (typeof children === 'string') return { tag, attrs, children: [], text: children };
  return { tag, attrs, children };
}

/**
 * SVG attributes that are genuinely camelCase in the spec (and so must NOT be
 * kebab-cased). Everything else that contains an uppercase letter is a React
 * camelCase spelling of a kebab-case presentation attribute.
 */
const CAMEL_CASE_SVG_ATTRS = new Set([
  'attributeName',
  'attributeType',
  'baseFrequency',
  'calcMode',
  'clipPathUnits',
  'diffuseConstant',
  'edgeMode',
  'filterUnits',
  'gradientTransform',
  'gradientUnits',
  'kernelMatrix',
  'kernelUnitLength',
  'keyPoints',
  'keySplines',
  'keyTimes',
  'lengthAdjust',
  'limitingConeAngle',
  'markerHeight',
  'markerUnits',
  'markerWidth',
  'maskContentUnits',
  'maskUnits',
  'numOctaves',
  'pathLength',
  'patternContentUnits',
  'patternTransform',
  'patternUnits',
  'pointsAtX',
  'pointsAtY',
  'pointsAtZ',
  'preserveAlpha',
  'preserveAspectRatio',
  'primitiveUnits',
  'refX',
  'refY',
  'repeatCount',
  'repeatDur',
  'requiredExtensions',
  'requiredFeatures',
  'specularConstant',
  'specularExponent',
  'spreadMethod',
  'startOffset',
  'stdDeviation',
  'stitchTiles',
  'surfaceScale',
  'systemLanguage',
  'tableValues',
  'targetX',
  'targetY',
  'textLength',
  'viewBox',
  'viewTarget',
  'xChannelSelector',
  'yChannelSelector',
  'zoomAndPan',
]);

function svgAttrName(key: string): string {
  if (CAMEL_CASE_SVG_ATTRS.has(key)) return key;
  return key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
}

function escapeAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Compact numeric formatting: ≤2 decimals, no trailing zeros, never "-0". */
export function fmt(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded === 0 ? 0 : rounded);
}

function attrString(attrs: Readonly<Record<string, AttrValue>>): string {
  let out = '';
  for (const [key, raw] of Object.entries(attrs)) {
    if (raw === undefined) continue;
    const value = typeof raw === 'number' ? fmt(raw) : escapeAttr(raw);
    out += ` ${svgAttrName(key)}="${value}"`;
  }
  return out;
}

/** Serialize a scene tree to compact SVG markup. */
export function serializeSvg(node: SceneNode): string {
  const open = `<${node.tag}${attrString(node.attrs)}`;
  if (node.text !== undefined) return `${open}>${escapeText(node.text)}</${node.tag}>`;
  if (node.children.length === 0) return `${open}/>`;
  return `${open}>${node.children.map(serializeSvg).join('')}</${node.tag}>`;
}
