/**
 * WGSL Shader Library for WebGPU 2D Mathematical Plot Rendering
 *
 * Only shaders actually compiled and drawn by WebGPU2DRenderer live here:
 * a basic Cartesian line shader, a polar line shader (coordinate conversion
 * in the vertex stage), a solid-color grid shader, a region-fill shader for
 * relation plots (per-pixel sign(F) shading), and an axis shader.
 * Each shader module defines:
 *   - Struct definitions for vertex input/output and uniform blocks
 *   - @group(0) @binding(N) declarations for bind group layout consistency
 *   - Proper WGSL built-in decorators and stage entry points
 *
 * Bind group layout convention (matches WebGPU2DRenderer):
 *   @group(0) @binding(0) - SceneUniforms (per-frame, cached)
 *   @group(1) @binding(0) - DrawUniforms (per-draw-call, dynamic-offset ring)
 *   (region-fill uses its own @group(1): RegionUniforms + field texture array)
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
// 1. Basic Cartesian line shader
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
// 2. Polar line shader (converts r,theta in vertex stage)
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
// 3. Grid shader (solid-color lines for Cartesian and polar grids)
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
// 4. Region fill shader (per-pixel sign(F) shading for relation plots)
//
// Draws a viewport-covering quad in math space; the fragment stage samples
// one or more scalar fields F_k from an r32float texture_2d_array and shades
// the pixel where every dir_k * F_k > 0 (mask multiplication = system
// intersection in a single pass).
//
// r32float is NOT filterable without the optional 'float32-filterable'
// feature, so bilinear reconstruction is done manually with 4 textureLoad
// calls. fwidth()-based smoothstep gives resolution-independent antialiasing
// of the region edge; any NaN corner zeroes the mask (holes at
// singularities instead of smeared artifacts).
//
// Bind groups: @group(0) scene (shared), @group(1) region uniforms + field
// texture array (own layout — not the shared draw-uniform group).
// ---------------------------------------------------------------------------

export const regionFillShaderWGSL: WGSLShaderSource = {
  name: 'region-fill',

  vertex: /* wgsl */ `
${SCENE_UNIFORMS_STRUCT}

struct VertexIn {
  @location(0) position : vec2<f32>,
}

struct VertexOut {
  @builtin(position) clipPosition : vec4<f32>,
  @location(0) mathPos : vec2<f32>,
}

@vertex
fn vsMain(in: VertexIn) -> VertexOut {
  var out: VertexOut;
  out.clipPosition = scene.mvpMatrix * vec4<f32>(in.position, 0.0, 1.0);
  out.mathPos      = in.position;
  return out;
}
`,

  fragment: /* wgsl */ `
struct RegionUniforms {
  fillColor    : vec4<f32>,
  viewportMin  : vec2<f32>,
  viewportSize : vec2<f32>,
  gridSize     : vec2<f32>, // (cols, rows) of the field grid
  layerCount   : u32,
  _pad         : u32,
  dirs         : array<vec4<f32>, 2>, // dir per layer, packed 4 per vec4 (max 8)
}
@group(1) @binding(0) var<uniform> region : RegionUniforms;
@group(1) @binding(1) var fieldTex : texture_2d_array<f32>;

// Bit-pattern NaN test — 'v != v' can be constant-folded away because WGSL
// implementations are allowed to assume floats are not NaN.
fn isNan(v: f32) -> bool {
  return (bitcast<u32>(v) & 0x7fffffffu) > 0x7f800000u;
}

@fragment
fn fsMain(@location(0) mathPos: vec2<f32>) -> @location(0) vec4<f32> {
  let uv = (mathPos - region.viewportMin) / region.viewportSize;
  let gp = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0)) * (region.gridSize - 1.0);
  let base = clamp(floor(gp), vec2<f32>(0.0), region.gridSize - 2.0);
  let frac = gp - base;
  let b = vec2<i32>(base);

  var mask = 1.0;
  for (var layer = 0u; layer < region.layerCount; layer++) {
    let v00 = textureLoad(fieldTex, b,                     layer, 0).r;
    let v10 = textureLoad(fieldTex, b + vec2<i32>(1, 0),   layer, 0).r;
    let v01 = textureLoad(fieldTex, b + vec2<i32>(0, 1),   layer, 0).r;
    let v11 = textureLoad(fieldTex, b + vec2<i32>(1, 1),   layer, 0).r;

    let anyCornerNaN = isNan(v00) || isNan(v10) || isNan(v01) || isNan(v11);

    let dir = region.dirs[layer / 4u][layer % 4u];
    let v = dir * mix(mix(v00, v10, frac.x), mix(v01, v11, frac.x), frac.y);

    // Screen-space antialiased sign(F) step
    let w = max(fwidth(v), 1e-6);
    mask *= select(smoothstep(-w, w, v), 0.0, anyCornerNaN);
  }

  return vec4<f32>(region.fillColor.rgb, region.fillColor.a * mask);
}
`,
};

// ---------------------------------------------------------------------------
// 5. Axis shader (thicker lines for x=0 and y=0 axes)
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
