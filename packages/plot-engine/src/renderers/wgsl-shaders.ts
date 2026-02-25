/**
 * WGSL Shader Library for WebGPU 2D Mathematical Plot Rendering
 *
 * Full port of all 12 GLSL ES 3.0 shaders from shaders.ts to WGSL.
 * Each shader module defines:
 *   - Struct definitions for vertex input/output and uniform blocks
 *   - @group(0) @binding(N) declarations for bind group layout consistency
 *   - Proper WGSL built-in decorators and stage entry points
 *
 * Bind group layout convention (matches WebGPU2DRenderer):
 *   @group(0) @binding(0) - SceneUniforms (per-frame, cached)
 *   @group(1) @binding(0) - DrawUniforms (per-draw-call)
 *   @group(1) @binding(1) - optional sampler / texture
 *   @group(1) @binding(2) - optional texture (contour data)
 *
 * @module renderers/wgsl-shaders
 */

/** Identifies a complete WGSL render pipeline source */
export interface WGSLShaderSource {
  /** WGSL source for the vertex stage */
  readonly vertex: string;
  /** WGSL source for the fragment stage */
  readonly fragment: string;
  /** Human-readable name used as pipeline cache key */
  readonly name: string;
}

// ---------------------------------------------------------------------------
// Shared uniform struct definitions (inlined into each shader that needs them)
// ---------------------------------------------------------------------------

/**
 * The WGSL struct text for the per-scene uniform block.
 * Bind: @group(0) @binding(0)
 * Matches WebGL UBO layout: mvpMatrix (mat4x4), resolution (vec2), time, padding.
 */
const SCENE_UNIFORMS_STRUCT = /* wgsl */ `
struct SceneUniforms {
  mvpMatrix  : mat4x4<f32>,
  resolution : vec2<f32>,
  time       : f32,
  _pad0      : f32,
}
@group(0) @binding(0) var<uniform> scene : SceneUniforms;
`;

/**
 * The WGSL struct text for the per-draw color/parameter block.
 * Bind: @group(1) @binding(0)
 */
const DRAW_UNIFORMS_STRUCT = /* wgsl */ `
struct DrawUniforms {
  color       : vec4<f32>,
  lineWidth   : f32,
  feather     : f32,
  dashLength  : f32,
  gapLength   : f32,
  dashOffset  : f32,
  minValue    : f32,
  maxValue    : f32,
  colorScheme : i32,
  pointSize   : f32,
  shape       : i32,
  contourValue     : f32,
  contourThickness : f32,
}
@group(1) @binding(0) var<uniform> draw : DrawUniforms;
`;

// ---------------------------------------------------------------------------
// 1. Smooth line shader (SDF anti-aliased lines with miter joints)
// Mirrors GLSL smoothLineShader
// ---------------------------------------------------------------------------

export const smoothLineShaderWGSL: WGSLShaderSource = {
  name: 'smooth-line',

  vertex: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}
${DRAW_UNIFORMS_STRUCT}

struct VertexIn {
  @location(0) position : vec2<f32>,
  @location(1) normal   : vec2<f32>, // perpendicular to line direction
  @location(2) miter    : f32,       // miter joint scale factor
  @location(3) distance : f32,       // cumulative arc length along curve
  @location(4) color    : vec4<f32>, // per-vertex gradient color
}

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
  @location(0) vNormal    : vec2<f32>,
  @location(1) vMiter     : f32,
  @location(2) vDistance  : f32,
  @location(3) vColor     : vec4<f32>,
  @location(4) vScreenPos : vec2<f32>,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  // Expand line in screen space using normal + miter factor
  var pos = scene.mvpMatrix * vec4<f32>(in.position, 0.0, 1.0);

  // Screen-space offset: convert NDC offset to clip-space offset
  let offset = in.normal * in.miter * draw.lineWidth * 0.5;
  pos = vec4<f32>(
    pos.x + offset.x / scene.resolution.x * pos.w * 2.0,
    pos.y + offset.y / scene.resolution.y * pos.w * 2.0,
    pos.z,
    pos.w,
  );

  var out: VertexOut;
  out.clipPosition = pos;
  out.vNormal      = in.normal;
  out.vMiter       = in.miter;
  out.vDistance    = in.distance;
  out.vColor       = in.color;
  // NDC -> [0,1] for screen-pos varyings
  out.vScreenPos   = pos.xy / pos.w * 0.5 + vec2<f32>(0.5);
  return out;
}
`,

  fragment: /* wgsl */ `
${DRAW_UNIFORMS_STRUCT}

struct FragIn {
  @location(0) vNormal    : vec2<f32>,
  @location(1) vMiter     : f32,
  @location(2) vDistance  : f32,
  @location(3) vColor     : vec4<f32>,
  @location(4) vScreenPos : vec2<f32>,
}

@fragment
fn fsMain(in: FragIn) -> @location(0) vec4<f32> {
  // SDF distance to line edge
  let dist = abs(in.vMiter) * draw.lineWidth * 0.5;
  let edge = draw.lineWidth * 0.5;

  // Smooth alpha at edge (anti-aliasing feather)
  let alpha = 1.0 - smoothstep(edge - draw.feather, edge + draw.feather, dist);

  if alpha < 0.01 {
    discard;
  }

  return vec4<f32>(in.vColor.rgb, in.vColor.a * alpha);
}
`,
};

// ---------------------------------------------------------------------------
// 2. Dashed line shader (fragment-based dash pattern)
// Mirrors GLSL dashedLineShader
// ---------------------------------------------------------------------------

export const dashedLineShaderWGSL: WGSLShaderSource = {
  name: 'dashed-line',

  vertex: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}

struct VertexIn {
  @location(0) position : vec2<f32>,
  @location(1) distance : f32, // cumulative arc length for dash pattern
}

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
  @location(0) vDistance : f32,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  var out: VertexOut;
  out.clipPosition = scene.mvpMatrix * vec4<f32>(in.position, 0.0, 1.0);
  out.vDistance    = in.distance;
  return out;
}
`,

  fragment: /* wgsl */ `
${DRAW_UNIFORMS_STRUCT}

struct FragIn {
  @location(0) vDistance : f32,
}

@fragment
fn fsMain(in: FragIn) -> @location(0) vec4<f32> {
  let totalLength  = draw.dashLength + draw.gapLength;
  let offsetDist   = (in.vDistance + draw.dashOffset) % totalLength;

  // Solid in dash segment, zero in gap
  var alpha = select(0.0, 1.0, offsetDist <= draw.dashLength);

  // Smooth anti-aliasing at boundaries
  alpha *= smoothstep(0.0, 1.0, offsetDist);
  alpha *= smoothstep(totalLength, totalLength - 1.0, offsetDist);

  if alpha < 0.01 {
    discard;
  }

  return vec4<f32>(draw.color.rgb, draw.color.a * alpha);
}
`,
};

// ---------------------------------------------------------------------------
// 3. Gradient line shader (Viridis / Plasma / Turbo / Rainbow color maps)
// Mirrors GLSL gradientLineShader
// ---------------------------------------------------------------------------

export const gradientLineShaderWGSL: WGSLShaderSource = {
  name: 'gradient-line',

  vertex: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}
${DRAW_UNIFORMS_STRUCT}

struct VertexIn {
  @location(0) position : vec2<f32>,
  @location(1) value    : f32, // scalar for gradient mapping (curvature, velocity…)
}

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
  @location(0) vNormalized : f32,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  var out: VertexOut;
  out.clipPosition  = scene.mvpMatrix * vec4<f32>(in.position, 0.0, 1.0);
  out.vNormalized   = clamp(
    (in.value - draw.minValue) / (draw.maxValue - draw.minValue),
    0.0,
    1.0
  );
  return out;
}
`,

  fragment: /* wgsl */ `
${DRAW_UNIFORMS_STRUCT}

struct FragIn {
  @location(0) vNormalized : f32,
}

// Viridis perceptually-uniform color map
fn viridis(t: f32) -> vec3<f32> {
  let c0 = vec3<f32>(0.267004, 0.004874, 0.329415);
  let c1 = vec3<f32>(0.127568, 0.566949, 0.550556);
  let c2 = vec3<f32>(0.993248, 0.906157, 0.143936);
  let tc = clamp(t, 0.0, 1.0);
  return mix(mix(c0, c1, tc * 2.0), mix(c1, c2, (tc - 0.5) * 2.0), step(0.5, tc));
}

// Plasma color map
fn plasma(t: f32) -> vec3<f32> {
  let c0 = vec3<f32>(0.050383, 0.029803, 0.527975);
  let c1 = vec3<f32>(0.796995, 0.278152, 0.469538);
  let c2 = vec3<f32>(0.940015, 0.975158, 0.131326);
  let tc = clamp(t, 0.0, 1.0);
  return mix(mix(c0, c1, tc * 2.0), mix(c1, c2, (tc - 0.5) * 2.0), step(0.5, tc));
}

// Turbo color map (Google's improved rainbow)
fn turbo(t: f32) -> vec3<f32> {
  let c0 = vec3<f32>(0.18995, 0.07176, 0.23217);
  let c1 = vec3<f32>(0.13840, 0.69640, 0.52600);
  let c2 = vec3<f32>(0.96280, 0.99600, 0.21370);
  let tc = clamp(t, 0.0, 1.0);
  let s  = tc * 2.0;
  var color = mix(c0, c1, smoothstep(0.0, 1.0, s));
  color = mix(color, c2, smoothstep(0.0, 1.0, s - 1.0));
  return color;
}

// Classic rainbow (hue rotation)
fn rainbow(t: f32) -> vec3<f32> {
  let tc = clamp(t, 0.0, 1.0);
  let r  = abs(tc * 6.0 - 3.0) - 1.0;
  let g  = 2.0 - abs(tc * 6.0 - 2.0);
  let b  = 2.0 - abs(tc * 6.0 - 4.0);
  return clamp(vec3<f32>(r, g, b), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn fsMain(in: FragIn) -> @location(0) vec4<f32> {
  var color: vec3<f32>;
  switch draw.colorScheme {
    case 0: { color = viridis(in.vNormalized); }
    case 1: { color = plasma(in.vNormalized);  }
    case 2: { color = turbo(in.vNormalized);   }
    default: { color = rainbow(in.vNormalized); }
  }
  return vec4<f32>(color, 1.0);
}
`,
};

// ---------------------------------------------------------------------------
// 4. Instanced grid shader
// Mirrors GLSL instancedGridShader
// ---------------------------------------------------------------------------

export const instancedGridShaderWGSL: WGSLShaderSource = {
  name: 'instanced-grid',

  vertex: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}

struct VertexIn {
  @location(0) position  : vec2<f32>, // base line endpoint (one of two vertices)
  @location(1) offset    : vec2<f32>, // per-instance offset for this grid line
  @location(2) thickness : f32,       // per-instance thickness (major vs minor)
}

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
  @location(0) vThickness : f32,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  var out: VertexOut;
  let worldPos     = in.position + in.offset;
  out.clipPosition = scene.mvpMatrix * vec4<f32>(worldPos, 0.0, 1.0);
  out.vThickness   = in.thickness;
  return out;
}
`,

  fragment: /* wgsl */ `
${DRAW_UNIFORMS_STRUCT}

// Major / minor colors encoded in draw.color (major) and a separate uniform.
// For simplicity the WebGPU renderer re-issues draw calls per grid type,
// so here we just use draw.color directly.

struct FragIn {
  @location(0) vThickness : f32,
}

@fragment
fn fsMain(in: FragIn) -> @location(0) vec4<f32> {
  // Thickness > 1.5 => major grid line (brighter); otherwise minor
  let isMajor = step(1.5, in.vThickness);
  let alpha   = mix(0.35, 0.70, isMajor);
  return vec4<f32>(draw.color.rgb, draw.color.a * alpha);
}
`,
};

// ---------------------------------------------------------------------------
// 5. Advanced marker shader (SDF shapes: circle, square, triangle, cross,
//    diamond). Mirrors GLSL advancedMarkerShader using point primitives.
// ---------------------------------------------------------------------------

export const advancedMarkerShaderWGSL: WGSLShaderSource = {
  name: 'advanced-marker',

  vertex: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}
${DRAW_UNIFORMS_STRUCT}

struct VertexIn {
  @location(0) position : vec2<f32>,
  @location(1) size     : f32,
  @location(2) color    : vec4<f32>,
  @location(3) shape    : f32, // 0=circle 1=square 2=triangle 3=cross 4=diamond
}

struct VertexOut {
  @builtin(position)    clipPosition : vec4<f32>,
  @builtin(point_size)  pointSize    : f32,
  @location(0) vColor : vec4<f32>,
  @location(1) vShape : f32,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  var out: VertexOut;
  out.clipPosition = scene.mvpMatrix * vec4<f32>(in.position, 0.0, 1.0);
  out.pointSize    = in.size;
  out.vColor       = in.color;
  out.vShape       = in.shape;
  return out;
}
`,

  fragment: /* wgsl */ `
struct FragIn {
  @builtin(position)   fragCoord : vec4<f32>,
  @location(0)         vColor    : vec4<f32>,
  @location(1)         vShape    : f32,
}

// SDF functions
fn sdCircle(p: vec2<f32>, r: f32) -> f32 {
  return length(p) - r;
}

fn sdSquare(p: vec2<f32>, r: f32) -> f32 {
  let d = abs(p) - vec2<f32>(r);
  return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
}

fn sdTriangle(pIn: vec2<f32>, r: f32) -> f32 {
  var p = pIn;
  let k = sqrt(3.0);
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if p.x + k * p.y > 0.0 {
    p = vec2<f32>(p.x - k * p.y, -k * p.x - p.y) * 0.5;
  }
  p.x = p.x - clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

fn sdCross(p: vec2<f32>, r: f32, w: f32) -> f32 {
  let q = abs(p);
  return min(abs(q.x - r) - w, abs(q.y - r) - w);
}

fn sdDiamond(p: vec2<f32>, r: f32) -> f32 {
  let q = abs(p);
  return (q.x + q.y - r) / sqrt(2.0);
}

@fragment
fn fsMain(in: FragIn) -> @location(0) vec4<f32> {
  // WebGPU does not expose gl_PointCoord as a built-in in the same way.
  // The renderer uses a quad (two triangles) approach and passes UV via varyings.
  // Here coord is expected in [-1, 1] via varyings; for point primitives we
  // approximate using fragCoord — actual UVs are passed from the renderer.
  // (See WebGPU2DRenderer.renderMarkers for the quad-based approach.)
  let coord = in.fragCoord.xy * 2.0 - vec2<f32>(1.0);

  let shapeId = i32(in.vShape);
  var dist: f32;

  switch shapeId {
    case 0:  { dist = sdCircle(coord, 0.8);           }
    case 1:  { dist = sdSquare(coord, 0.7);            }
    case 2:  { dist = sdTriangle(coord, 0.8);          }
    case 3:  { dist = sdCross(coord, 0.8, 0.15);       }
    default: { dist = sdDiamond(coord, 0.8);           }
  }

  let alpha = 1.0 - smoothstep(-0.02, 0.02, dist);

  if alpha < 0.01 {
    discard;
  }

  return vec4<f32>(in.vColor.rgb, in.vColor.a * alpha);
}
`,
};

// ---------------------------------------------------------------------------
// 6. FXAA post-processing shader
// Mirrors GLSL fxaaShader. Operates on a texture containing the rendered scene.
// ---------------------------------------------------------------------------

export const fxaaShaderWGSL: WGSLShaderSource = {
  name: 'fxaa',

  vertex: /* wgsl */ `
struct VertexIn {
  @location(0) position : vec2<f32>,
  @location(1) texCoord : vec2<f32>,
}

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
  @location(0) vTexCoord : vec2<f32>,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  var out: VertexOut;
  out.clipPosition = vec4<f32>(in.position, 0.0, 1.0);
  out.vTexCoord    = in.texCoord;
  return out;
}
`,

  fragment: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}

@group(1) @binding(0) var sceneSampler : sampler;
@group(1) @binding(1) var sceneTexture : texture_2d<f32>;

struct FragIn {
  @location(0) vTexCoord : vec2<f32>,
}

const FXAA_SPAN_MAX   : f32 = 8.0;
const FXAA_REDUCE_MUL : f32 = 0.125;  // 1/8
const FXAA_REDUCE_MIN : f32 = 0.0078125; // 1/128

@fragment
fn fsMain(in: FragIn) -> @location(0) vec4<f32> {
  let texelSize = vec2<f32>(1.0) / scene.resolution;

  let rgbNW = textureSample(sceneTexture, sceneSampler, in.vTexCoord + vec2<f32>(-1.0, -1.0) * texelSize).rgb;
  let rgbNE = textureSample(sceneTexture, sceneSampler, in.vTexCoord + vec2<f32>( 1.0, -1.0) * texelSize).rgb;
  let rgbSW = textureSample(sceneTexture, sceneSampler, in.vTexCoord + vec2<f32>(-1.0,  1.0) * texelSize).rgb;
  let rgbSE = textureSample(sceneTexture, sceneSampler, in.vTexCoord + vec2<f32>( 1.0,  1.0) * texelSize).rgb;
  let rgbM  = textureSample(sceneTexture, sceneSampler, in.vTexCoord).rgb;

  let luma = vec3<f32>(0.299, 0.587, 0.114);
  let lumaNW = dot(rgbNW, luma);
  let lumaNE = dot(rgbNE, luma);
  let lumaSW = dot(rgbSW, luma);
  let lumaSE = dot(rgbSE, luma);
  let lumaM  = dot(rgbM,  luma);

  let lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
  let lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

  var dir: vec2<f32>;
  dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
  dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

  let dirReduce = max(
    (lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL),
    FXAA_REDUCE_MIN
  );

  let rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(dir * rcpDirMin, vec2<f32>(-FXAA_SPAN_MAX), vec2<f32>(FXAA_SPAN_MAX)) * texelSize;

  let rgbA = 0.5 * (
    textureSample(sceneTexture, sceneSampler, in.vTexCoord + dir * (1.0 / 3.0 - 0.5)).rgb +
    textureSample(sceneTexture, sceneSampler, in.vTexCoord + dir * (2.0 / 3.0 - 0.5)).rgb
  );

  let rgbB = rgbA * 0.5 + 0.25 * (
    textureSample(sceneTexture, sceneSampler, in.vTexCoord + dir * -0.5).rgb +
    textureSample(sceneTexture, sceneSampler, in.vTexCoord + dir *  0.5).rgb
  );

  let lumaB = dot(rgbB, luma);

  if lumaB < lumaMin || lumaB > lumaMax {
    return vec4<f32>(rgbA, 1.0);
  }
  return vec4<f32>(rgbB, 1.0);
}
`,
};

// ---------------------------------------------------------------------------
// 7. Basic Cartesian line shader
// Mirrors GLSL cartesianLineShader
// ---------------------------------------------------------------------------

export const cartesianLineShaderWGSL: WGSLShaderSource = {
  name: 'cartesian-line',

  vertex: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}
${DRAW_UNIFORMS_STRUCT}

struct VertexIn {
  @location(0) position : vec2<f32>,
}

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
  @location(0) vColor : vec4<f32>,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  var out: VertexOut;
  out.clipPosition = scene.mvpMatrix * vec4<f32>(in.position, 0.0, 1.0);
  out.vColor       = draw.color;
  return out;
}
`,

  fragment: /* wgsl */ `
struct FragIn {
  @location(0) vColor : vec4<f32>,
}

@fragment
fn fsMain(in: FragIn) -> @location(0) vec4<f32> {
  return in.vColor;
}
`,
};

// ---------------------------------------------------------------------------
// 8. Polar line shader (converts r,theta in vertex stage)
// Mirrors GLSL polarLineShader
// ---------------------------------------------------------------------------

export const polarLineShaderWGSL: WGSLShaderSource = {
  name: 'polar-line',

  vertex: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}
${DRAW_UNIFORMS_STRUCT}

struct VertexIn {
  @location(0) polar : vec2<f32>, // (r, theta)
}

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
  @location(0) vColor : vec4<f32>,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  let r     = in.polar.x;
  let theta = in.polar.y;
  let x     = r * cos(theta);
  let y     = r * sin(theta);

  var out: VertexOut;
  out.clipPosition = scene.mvpMatrix * vec4<f32>(x, y, 0.0, 1.0);
  out.vColor       = draw.color;
  return out;
}
`,

  fragment: /* wgsl */ `
struct FragIn {
  @location(0) vColor : vec4<f32>,
}

@fragment
fn fsMain(in: FragIn) -> @location(0) vec4<f32> {
  return in.vColor;
}
`,
};

// ---------------------------------------------------------------------------
// 9. Grid shader (solid-color lines for Cartesian and polar grids)
// Mirrors GLSL gridShader
// ---------------------------------------------------------------------------

export const gridShaderWGSL: WGSLShaderSource = {
  name: 'grid',

  vertex: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}

struct VertexIn {
  @location(0) position : vec2<f32>,
}

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  var out: VertexOut;
  out.clipPosition = scene.mvpMatrix * vec4<f32>(in.position, 0.0, 1.0);
  return out;
}
`,

  fragment: /* wgsl */ `
${DRAW_UNIFORMS_STRUCT}

@fragment
fn fsMain() -> @location(0) vec4<f32> {
  return draw.color;
}
`,
};

// ---------------------------------------------------------------------------
// 10. Axis shader (thicker lines for x=0 and y=0 axes)
// Mirrors GLSL axisShader
// ---------------------------------------------------------------------------

export const axisShaderWGSL: WGSLShaderSource = {
  name: 'axis',

  vertex: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}

struct VertexIn {
  @location(0) position : vec2<f32>,
}

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  var out: VertexOut;
  out.clipPosition = scene.mvpMatrix * vec4<f32>(in.position, 0.0, 1.0);
  return out;
}
`,

  fragment: /* wgsl */ `
${DRAW_UNIFORMS_STRUCT}

@fragment
fn fsMain() -> @location(0) vec4<f32> {
  return draw.color;
}
`,
};

// ---------------------------------------------------------------------------
// 11. Contour line shader (texture-sampled contour detection)
// Mirrors GLSL contourLineShader. Requires a data texture bound at binding 3.
// ---------------------------------------------------------------------------

export const contourLineShaderWGSL: WGSLShaderSource = {
  name: 'contour-line',

  vertex: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}

struct VertexIn {
  @location(0) position : vec2<f32>,
  @location(1) texCoord : vec2<f32>,
}

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
  @location(0) vTexCoord : vec2<f32>,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  var out: VertexOut;
  out.clipPosition = scene.mvpMatrix * vec4<f32>(in.position, 0.0, 1.0);
  out.vTexCoord    = in.texCoord;
  return out;
}
`,

  fragment: /* wgsl */ `
${DRAW_UNIFORMS_STRUCT}

@group(1) @binding(1) var dataSampler : sampler;
@group(1) @binding(2) var dataTexture : texture_2d<f32>;

struct FragIn {
  @location(0) vTexCoord : vec2<f32>,
}

@fragment
fn fsMain(in: FragIn) -> @location(0) vec4<f32> {
  let dims      = vec2<f32>(textureDimensions(dataTexture, 0));
  let texelSize = vec2<f32>(1.0) / dims;

  let center = textureSample(dataTexture, dataSampler, in.vTexCoord).r;
  let right  = textureSample(dataTexture, dataSampler, in.vTexCoord + vec2<f32>(texelSize.x, 0.0)).r;
  let top    = textureSample(dataTexture, dataSampler, in.vTexCoord + vec2<f32>(0.0, texelSize.y)).r;

  let cv      = draw.contourValue;
  let crossH  = (center - cv) * (right - cv) < 0.0;
  let crossV  = (center - cv) * (top   - cv) < 0.0;

  if crossH || crossV {
    let dist  = abs(center - cv);
    let alpha = smoothstep(draw.contourThickness, 0.0, dist);
    return vec4<f32>(draw.color.rgb, draw.color.a * alpha);
  }

  discard;
}
`,
};

// ---------------------------------------------------------------------------
// 12. Basic solid-color line shader (alias/compatibility name "solid-line")
// Equivalent to the GLSL antialiasedLineShader but simplified for WebGPU
// (the smooth-line shader is preferred for quality; this is used as fallback).
// ---------------------------------------------------------------------------

export const solidLineShaderWGSL: WGSLShaderSource = {
  name: 'solid-line',

  vertex: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}
${DRAW_UNIFORMS_STRUCT}

struct VertexIn {
  @location(0) position : vec2<f32>,
  @location(1) normal   : vec2<f32>,
  @location(2) miter    : f32,
}

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
  @location(0) vColor : vec4<f32>,
  @location(1) vMiter : f32,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  let offset = in.normal * draw.lineWidth * 0.5 * in.miter;
  let pos    = scene.mvpMatrix * vec4<f32>(
    in.position + offset / scene.resolution,
    0.0,
    1.0
  );

  var out: VertexOut;
  out.clipPosition = pos;
  out.vColor       = draw.color;
  out.vMiter       = in.miter;
  return out;
}
`,

  fragment: /* wgsl */ `
struct FragIn {
  @location(0) vColor : vec4<f32>,
  @location(1) vMiter : f32,
}

@fragment
fn fsMain(in: FragIn) -> @location(0) vec4<f32> {
  let alpha = smoothstep(1.0, 0.0, abs(in.vMiter));
  return vec4<f32>(in.vColor.rgb, in.vColor.a * alpha);
}
`,
};

// ---------------------------------------------------------------------------
// Convenience re-export: all shaders as a registry map
// ---------------------------------------------------------------------------

/** All WGSL shaders keyed by their pipeline name */
export const WGSL_SHADERS: Readonly<Record<string, WGSLShaderSource>> = {
  'smooth-line':      smoothLineShaderWGSL,
  'dashed-line':      dashedLineShaderWGSL,
  'gradient-line':    gradientLineShaderWGSL,
  'instanced-grid':   instancedGridShaderWGSL,
  'advanced-marker':  advancedMarkerShaderWGSL,
  'fxaa':             fxaaShaderWGSL,
  'cartesian-line':   cartesianLineShaderWGSL,
  'polar-line':       polarLineShaderWGSL,
  'grid':             gridShaderWGSL,
  'axis':             axisShaderWGSL,
  'contour-line':     contourLineShaderWGSL,
  'solid-line':       solidLineShaderWGSL,
} as const;
