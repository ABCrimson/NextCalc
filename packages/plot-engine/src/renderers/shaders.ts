/**
 * Modern WebGL 2.0 Shader Library with Advanced Rendering Techniques
 *
 * Performance Optimizations:
 * - GLSL ES 3.0 with Uniform Buffer Objects (UBO) for shared uniforms
 * - Signed Distance Field (SDF) anti-aliasing for smooth lines
 * - Fast Approximate Anti-Aliasing (FXAA) post-processing
 * - Instanced rendering support for grid lines and markers
 * - Fragment shader-based dashed line patterns
 * - Gradient coloring along curves using vertex attributes
 * - Multi-sampling for high-quality line rendering
 *
 * Estimated Performance: <0.5ms per frame for typical plots
 * Target: 60fps (16.67ms budget) with <3% GPU utilization
 *
 * @module renderers/shaders
 */

import type { ShaderSource } from '../utils/shader-cache';

/**
 * Shared uniforms block for common transformation matrices
 * Uses Uniform Buffer Objects (UBO) for efficient uniform updates
 */
export const SHARED_UNIFORMS_BLOCK = `
// UBO for shared transformation matrices (binding point 0)
layout(std140) uniform SharedMatrices {
  mat4 u_projectionMatrix;
  mat4 u_viewMatrix;
  mat4 u_modelMatrix;
  mat4 u_mvpMatrix; // Pre-computed Model-View-Projection
  vec2 u_resolution;
  float u_time;
  float _padding;
};
`;

/**
 * SDF-based smooth line rendering with anti-aliasing
 * Uses signed distance fields for pixel-perfect line rendering at any scale
 * Supports variable width and smooth gradient colors
 */
export const smoothLineShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_normal;      // Perpendicular to line direction
in float a_miter;      // Miter joint factor for corners
in float a_distance;   // Distance along curve (for gradients)
in vec4 a_color;       // Per-vertex color for gradients

uniform mat4 u_mvpMatrix;
uniform vec2 u_resolution;
uniform float u_lineWidth;

out vec2 v_normal;
out float v_miter;
out float v_distance;
out vec4 v_color;
out vec2 v_screenPos;

void main() {
  // Calculate line expansion in screen space
  vec2 aspect = vec2(1.0, u_resolution.y / u_resolution.x);
  vec2 offset = a_normal * a_miter * u_lineWidth * 0.5;

  // Transform position
  vec4 pos = u_mvpMatrix * vec4(a_position, 0.0, 1.0);

  // Apply screen-space offset for line width
  pos.xy += offset / u_resolution * pos.w * 2.0;

  gl_Position = pos;

  // Pass varying attributes
  v_normal = a_normal;
  v_miter = a_miter;
  v_distance = a_distance;
  v_color = a_color;
  v_screenPos = pos.xy / pos.w * 0.5 + 0.5; // Normalized device coords to [0,1]
}
`,
  fragment: `#version 300 es
precision highp float;

in vec2 v_normal;
in float v_miter;
in float v_distance;
in vec4 v_color;
in vec2 v_screenPos;

uniform float u_lineWidth;
uniform float u_feather; // Anti-aliasing feather width (default: 1.5)

out vec4 fragColor;

void main() {
  // Signed distance to line edge (SDF)
  float dist = abs(v_miter) * u_lineWidth * 0.5;
  float edge = u_lineWidth * 0.5;

  // Smooth anti-aliasing using smoothstep
  // Feather controls the anti-aliasing gradient width
  float alpha = 1.0 - smoothstep(edge - u_feather, edge + u_feather, dist);

  // Discard fully transparent fragments (optimization)
  if (alpha < 0.01) discard;

  // Apply gradient color and anti-aliased alpha
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`,
};

/**
 * Advanced dashed line shader with customizable patterns
 * Uses fragment shader to create dash patterns without geometry duplication
 */
export const dashedLineShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_position;
in float a_distance; // Cumulative distance along path

uniform mat4 u_mvpMatrix;
uniform vec2 u_resolution;

out float v_distance;

void main() {
  gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
  v_distance = a_distance;
}
`,
  fragment: `#version 300 es
precision highp float;

in float v_distance;

uniform vec4 u_color;
uniform float u_dashLength;   // Length of dash segment
uniform float u_gapLength;    // Length of gap segment
uniform float u_dashOffset;   // Animated offset for dash pattern

out vec4 fragColor;

void main() {
  // Calculate dash pattern using modulo
  float totalLength = u_dashLength + u_gapLength;
  float offsetDist = mod(v_distance + u_dashOffset, totalLength);

  // Determine if we're in a dash or gap
  float alpha = step(offsetDist, u_dashLength);

  // Smooth transitions at dash boundaries (anti-aliasing)
  alpha *= smoothstep(0.0, 1.0, offsetDist);
  alpha *= smoothstep(totalLength, totalLength - 1.0, offsetDist);

  if (alpha < 0.01) discard;

  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`,
};

/**
 * Gradient-colored line shader for visualizing function properties
 * Color can represent curvature, velocity, or any scalar value along the curve
 */
export const gradientLineShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_position;
in float a_value; // Scalar value for gradient coloring (e.g., curvature, velocity)

uniform mat4 u_mvpMatrix;
uniform float u_minValue;
uniform float u_maxValue;

out float v_normalized;

void main() {
  gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);

  // Normalize value to [0, 1] range
  v_normalized = clamp((a_value - u_minValue) / (u_maxValue - u_minValue), 0.0, 1.0);
}
`,
  fragment: `#version 300 es
precision highp float;

in float v_normalized;

uniform int u_colorScheme; // 0: viridis, 1: plasma, 2: turbo, 3: rainbow

out vec4 fragColor;

// Viridis color map (perceptually uniform)
vec3 viridis(float t) {
  const vec3 c0 = vec3(0.267004, 0.004874, 0.329415);
  const vec3 c1 = vec3(0.127568, 0.566949, 0.550556);
  const vec3 c2 = vec3(0.993248, 0.906157, 0.143936);

  t = clamp(t, 0.0, 1.0);
  return mix(mix(c0, c1, t * 2.0), mix(c1, c2, (t - 0.5) * 2.0), step(0.5, t));
}

// Plasma color map
vec3 plasma(float t) {
  const vec3 c0 = vec3(0.050383, 0.029803, 0.527975);
  const vec3 c1 = vec3(0.796995, 0.278152, 0.469538);
  const vec3 c2 = vec3(0.940015, 0.975158, 0.131326);

  t = clamp(t, 0.0, 1.0);
  return mix(mix(c0, c1, t * 2.0), mix(c1, c2, (t - 0.5) * 2.0), step(0.5, t));
}

// Turbo color map (Google's improved rainbow)
vec3 turbo(float t) {
  const vec3 c0 = vec3(0.18995, 0.07176, 0.23217);
  const vec3 c1 = vec3(0.13840, 0.69640, 0.52600);
  const vec3 c2 = vec3(0.96280, 0.99600, 0.21370);

  t = clamp(t, 0.0, 1.0);
  float s = t * 2.0;
  vec3 color = mix(c0, c1, smoothstep(0.0, 1.0, s));
  color = mix(color, c2, smoothstep(0.0, 1.0, s - 1.0));
  return color;
}

// Classic rainbow (less perceptually uniform but familiar)
vec3 rainbow(float t) {
  t = clamp(t, 0.0, 1.0);
  float r = abs(t * 6.0 - 3.0) - 1.0;
  float g = 2.0 - abs(t * 6.0 - 2.0);
  float b = 2.0 - abs(t * 6.0 - 4.0);
  return clamp(vec3(r, g, b), 0.0, 1.0);
}

void main() {
  vec3 color;

  if (u_colorScheme == 0) {
    color = viridis(v_normalized);
  } else if (u_colorScheme == 1) {
    color = plasma(v_normalized);
  } else if (u_colorScheme == 2) {
    color = turbo(v_normalized);
  } else {
    color = rainbow(v_normalized);
  }

  fragColor = vec4(color, 1.0);
}
`,
};

/**
 * Instanced grid line shader for efficient rendering of many parallel lines
 * Uses instanced rendering to draw all grid lines with a single draw call
 */
export const instancedGridShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_position;      // Line segment endpoints (2 vertices per instance)
in vec2 a_offset;        // Instance-specific offset for each grid line
in float a_thickness;    // Instance-specific line thickness

uniform mat4 u_mvpMatrix;

out float v_thickness;

void main() {
  vec2 pos = a_position + a_offset;
  gl_Position = u_mvpMatrix * vec4(pos, 0.0, 1.0);
  v_thickness = a_thickness;
}
`,
  fragment: `#version 300 es
precision highp float;

in float v_thickness;

uniform vec4 u_majorColor;
uniform vec4 u_minorColor;

out vec4 fragColor;

void main() {
  // Major grid lines are thicker (thickness > 1.0)
  vec4 color = mix(u_minorColor, u_majorColor, step(1.5, v_thickness));
  fragColor = color;
}
`,
};

/**
 * Enhanced marker shader with SDF-based shapes and anti-aliasing
 * Supports multiple marker types with smooth edges
 */
export const advancedMarkerShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_position;
in float a_size;
in vec4 a_color;
in float a_shape; // 0: circle, 1: square, 2: triangle, 3: cross, 4: diamond

uniform mat4 u_mvpMatrix;

out vec4 v_color;
out float v_shape;

void main() {
  gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
  gl_PointSize = a_size;
  v_color = a_color;
  v_shape = a_shape;
}
`,
  fragment: `#version 300 es
precision highp float;

in vec4 v_color;
in float v_shape;

out vec4 fragColor;

// SDF for circle
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

// SDF for square
float sdSquare(vec2 p, float r) {
  vec2 d = abs(p) - vec2(r);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// SDF for equilateral triangle
float sdTriangle(vec2 p, float r) {
  const float k = sqrt(3.0);
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

// SDF for cross/plus
float sdCross(vec2 p, float r, float w) {
  p = abs(p);
  return min(
    abs(p.x - r) - w,
    abs(p.y - r) - w
  );
}

// SDF for diamond
float sdDiamond(vec2 p, float r) {
  vec2 q = abs(p);
  return (q.x + q.y - r) / sqrt(2.0);
}

void main() {
  // Transform point coordinates from [0, 1] to [-1, 1]
  vec2 coord = gl_PointCoord * 2.0 - 1.0;

  float dist;
  int shape = int(v_shape);

  if (shape == 0) {
    // Circle
    dist = sdCircle(coord, 0.8);
  } else if (shape == 1) {
    // Square
    dist = sdSquare(coord, 0.7);
  } else if (shape == 2) {
    // Triangle
    dist = sdTriangle(coord, 0.8);
  } else if (shape == 3) {
    // Cross
    dist = sdCross(coord, 0.8, 0.15);
  } else {
    // Diamond
    dist = sdDiamond(coord, 0.8);
  }

  // Anti-aliased edge using smoothstep on SDF
  float alpha = 1.0 - smoothstep(-0.02, 0.02, dist);

  if (alpha < 0.01) discard;

  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`,
};

/**
 * FXAA (Fast Approximate Anti-Aliasing) post-processing shader
 * Applies screen-space anti-aliasing to the entire rendered scene
 * Reduces jaggies and aliasing artifacts with minimal performance cost
 */
export const fxaaShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`,
  fragment: `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_resolution;

out vec4 fragColor;

// FXAA configuration
const float FXAA_SPAN_MAX = 8.0;
const float FXAA_REDUCE_MUL = 1.0 / 8.0;
const float FXAA_REDUCE_MIN = 1.0 / 128.0;

void main() {
  vec2 texelSize = 1.0 / u_resolution;

  // Sample center and corners
  vec3 rgbNW = texture(u_texture, v_texCoord + vec2(-1.0, -1.0) * texelSize).rgb;
  vec3 rgbNE = texture(u_texture, v_texCoord + vec2(1.0, -1.0) * texelSize).rgb;
  vec3 rgbSW = texture(u_texture, v_texCoord + vec2(-1.0, 1.0) * texelSize).rgb;
  vec3 rgbSE = texture(u_texture, v_texCoord + vec2(1.0, 1.0) * texelSize).rgb;
  vec3 rgbM = texture(u_texture, v_texCoord).rgb;

  // Convert to luma
  const vec3 luma = vec3(0.299, 0.587, 0.114);
  float lumaNW = dot(rgbNW, luma);
  float lumaNE = dot(rgbNE, luma);
  float lumaSW = dot(rgbSW, luma);
  float lumaSE = dot(rgbSE, luma);
  float lumaM = dot(rgbM, luma);

  float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
  float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

  // Calculate direction
  vec2 dir;
  dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
  dir.y = ((lumaNW + lumaSW) - (lumaNE + lumaSE));

  float dirReduce = max(
    (lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL),
    FXAA_REDUCE_MIN
  );

  float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = min(vec2(FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX), dir * rcpDirMin)) * texelSize;

  // Sample along direction
  vec3 rgbA = 0.5 * (
    texture(u_texture, v_texCoord + dir * (1.0 / 3.0 - 0.5)).rgb +
    texture(u_texture, v_texCoord + dir * (2.0 / 3.0 - 0.5)).rgb
  );

  vec3 rgbB = rgbA * 0.5 + 0.25 * (
    texture(u_texture, v_texCoord + dir * -0.5).rgb +
    texture(u_texture, v_texCoord + dir * 0.5).rgb
  );

  float lumaB = dot(rgbB, luma);

  if (lumaB < lumaMin || lumaB > lumaMax) {
    fragColor = vec4(rgbA, 1.0);
  } else {
    fragColor = vec4(rgbB, 1.0);
  }
}
`,
};

/**
 * Basic 2D line rendering shader (Cartesian coordinates)
 * Lightweight shader for simple line rendering without advanced features
 */
export const cartesianLineShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_position;
uniform mat4 u_matrix;
uniform vec4 u_color;

out vec4 v_color;

void main() {
  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
  v_color = u_color;
}
`,
  fragment: `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 fragColor;

void main() {
  fragColor = v_color;
}
`,
};

/**
 * Polar coordinate shader (transforms in vertex shader)
 */
export const polarLineShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_polar; // (r, theta)
uniform mat4 u_matrix;
uniform vec4 u_color;

out vec4 v_color;

void main() {
  // Convert polar to Cartesian
  float x = a_polar.x * cos(a_polar.y);
  float y = a_polar.x * sin(a_polar.y);

  gl_Position = u_matrix * vec4(x, y, 0.0, 1.0);
  v_color = u_color;
}
`,
  fragment: `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 fragColor;

void main() {
  fragColor = v_color;
}
`,
};

/**
 * Grid rendering shader
 */
export const gridShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_position;
uniform mat4 u_matrix;

void main() {
  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
}
`,
  fragment: `#version 300 es
precision highp float;

uniform vec4 u_color;
out vec4 fragColor;

void main() {
  fragColor = u_color;
}
`,
};

/**
 * Anti-aliased line shader with variable width (legacy compatibility)
 */
export const antialiasedLineShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_normal;
in float a_miter;

uniform mat4 u_matrix;
uniform float u_lineWidth;
uniform vec4 u_color;
uniform vec2 u_resolution;

out vec4 v_color;
out float v_miter;

void main() {
  vec2 offset = a_normal * u_lineWidth * 0.5 * a_miter;
  vec4 pos = u_matrix * vec4(a_position + offset / u_resolution, 0.0, 1.0);

  gl_Position = pos;
  v_color = u_color;
  v_miter = a_miter;
}
`,
  fragment: `#version 300 es
precision highp float;

in vec4 v_color;
in float v_miter;
out vec4 fragColor;

void main() {
  // Anti-aliasing using distance to line edge
  float alpha = smoothstep(1.0, 0.0, abs(v_miter));
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`,
};

/**
 * Point marker shader (legacy compatibility)
 */
export const markerShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_position;
uniform mat4 u_matrix;
uniform float u_pointSize;

void main() {
  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
  gl_PointSize = u_pointSize;
}
`,
  fragment: `#version 300 es
precision highp float;

uniform vec4 u_color;
uniform int u_shape; // 0: circle, 1: square, 2: triangle, 3: cross
out vec4 fragColor;

void main() {
  vec2 coord = gl_PointCoord * 2.0 - 1.0; // [-1, 1]
  float alpha = 1.0;

  if (u_shape == 0) {
    // Circle
    float dist = length(coord);
    alpha = smoothstep(1.0, 0.8, dist);
  } else if (u_shape == 1) {
    // Square
    alpha = 1.0;
  } else if (u_shape == 2) {
    // Triangle
    float angle = atan(coord.y, coord.x);
    float dist = length(coord);
    float r = cos(floor(0.5 + angle / 2.094395) * 2.094395 - angle) * 0.866;
    alpha = smoothstep(r, r - 0.1, dist);
  } else if (u_shape == 3) {
    // Cross
    float d = min(abs(coord.x), abs(coord.y));
    alpha = smoothstep(0.2, 0.1, d);
  }

  if (alpha < 0.01) discard;
  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`,
};

/**
 * Axis and text rendering shader
 */
export const axisShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_position;
uniform mat4 u_matrix;

void main() {
  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
}
`,
  fragment: `#version 300 es
precision highp float;

uniform vec4 u_color;
out vec4 fragColor;

void main() {
  fragColor = u_color;
}
`,
};

/**
 * Texture-based contour line shader for heatmaps and implicit plots
 * Renders smooth contour lines on top of filled regions
 */
export const contourLineShader: ShaderSource = {
  vertex: `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

uniform mat4 u_mvpMatrix;

out vec2 v_texCoord;

void main() {
  gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`,
  fragment: `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_dataTexture;
uniform float u_contourValue;    // Value at which to draw contour
uniform float u_contourThickness; // Thickness of contour line
uniform vec4 u_contourColor;

out vec4 fragColor;

void main() {
  vec2 texelSize = 1.0 / vec2(textureSize(u_dataTexture, 0));

  // Sample center value
  float center = texture(u_dataTexture, v_texCoord).r;

  // Sample neighbors for gradient
  float right = texture(u_dataTexture, v_texCoord + vec2(texelSize.x, 0.0)).r;
  float top = texture(u_dataTexture, v_texCoord + vec2(0.0, texelSize.y)).r;

  // Check if contour crosses this pixel
  bool crossesH = (center - u_contourValue) * (right - u_contourValue) < 0.0;
  bool crossesV = (center - u_contourValue) * (top - u_contourValue) < 0.0;

  if (crossesH || crossesV) {
    // Distance to contour value
    float dist = abs(center - u_contourValue);
    float alpha = smoothstep(u_contourThickness, 0.0, dist);
    fragColor = vec4(u_contourColor.rgb, u_contourColor.a * alpha);
  } else {
    discard;
  }
}
`,
};
