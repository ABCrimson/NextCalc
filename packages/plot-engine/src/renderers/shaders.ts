/**
 * WebGL 2.0 Shader Library
 *
 * Only shaders actually compiled and drawn by WebGL2DRenderer live here:
 * a basic Cartesian line shader, a polar line shader (coordinate conversion
 * in the vertex stage), a solid-color grid shader, and an axis shader.
 *
 * GLSL ES 3.0 with Uniform Buffer Objects (UBO) for shared uniforms.
 *
 * @module renderers/shaders
 */

import type { ShaderSource } from '../utils/shader-cache';

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
