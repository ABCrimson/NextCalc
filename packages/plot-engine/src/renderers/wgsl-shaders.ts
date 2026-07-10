/**
 * WGSL Shader Library for WebGPU 2D Mathematical Plot Rendering
 *
 * Only shaders actually compiled and drawn by WebGPU2DRenderer live here:
 * a basic Cartesian line shader, a polar line shader (coordinate conversion
 * in the vertex stage), a solid-color grid shader, and an axis shader.
 * Each shader module defines:
 *   - Struct definitions for vertex input/output and uniform blocks
 *   - @group(0) @binding(N) declarations for bind group layout consistency
 *   - Proper WGSL built-in decorators and stage entry points
 *
 * Bind group layout convention (matches WebGPU2DRenderer):
 *   @group(0) @binding(0) - SceneUniforms (per-frame, cached)
 *   @group(1) @binding(0) - DrawUniforms (per-draw-call)
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
// 4. Axis shader (thicker lines for x=0 and y=0 axes)
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
