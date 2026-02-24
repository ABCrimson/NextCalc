/**
 * NextCalc Pro Plot Engine
 * GPU-accelerated mathematical visualization library
 * @module @nextcalc/plot-engine
 */

// Types
export * from './types/index';

// Renderers
export { WebGL2DRenderer } from './renderers/webgl-2d';
export type { WebGL3DRenderer } from './renderers/webgl-3d';
export { WebGPU2DRenderer } from './renderers/webgpu-2d';
export { createBest2DRenderer } from './renderers/index';

// Space cubemap themes
export type { SpaceTheme, CubemapResolution } from './renderers/webgl-3d';
export { SPACE_THEMES, createProceduralHDRCubeMap } from './renderers/webgl-3d';

// WGSL shaders (WebGPU)
export {
  smoothLineShaderWGSL,
  dashedLineShaderWGSL,
  gradientLineShaderWGSL,
  instancedGridShaderWGSL,
  advancedMarkerShaderWGSL,
  fxaaShaderWGSL,
  cartesianLineShaderWGSL,
  polarLineShaderWGSL,
  gridShaderWGSL,
  axisShaderWGSL,
  contourLineShaderWGSL,
  solidLineShaderWGSL,
  WGSL_SHADERS,
  type WGSLShaderSource,
} from './renderers/wgsl-shaders';

// Sampling
export {
  adaptiveSample1D,
  adaptiveSampleParametric2D,
  uniformSample1D,
  defaultSamplingConfig,
  SamplingWorkerManager,
  type SamplingResult,
} from './sampling/index';

// Controls
export { Plot2DController } from './controls/index';

// Export
export {
  exportToPNG,
  downloadAsPNG,
  exportToSVG,
  downloadAsSVG,
  exportToCSV2D,
  exportToCSV3D,
  downloadAsCSV2D,
  downloadAsCSV3D,
} from './export/index';

// Utilities
export {
  parseColor,
  rgbaToString,
  rgbaToHex,
  interpolateColor,
  getColorFromMap,
  ColorMaps,
  type RGBA,
} from './utils/color';

export {
  identity,
  ortho,
  perspective,
  translation,
  scaling,
  rotationX,
  rotationY,
  rotationZ,
  multiply,
  invert,
  lookAt,
  type Mat4,
} from './utils/matrix';

export {
  marchingSquares,
  type ContourSegment,
} from './utils/marching-squares';

export {
  detectBestBackend,
  probeGPUCapabilities,
  isWebGPUAvailable,
  isWebGL2Available,
  type GPUCapabilityReport,
} from './utils/gpu-detection';

/**
 * Lazy-loads the Three.js 3D renderer
 * This avoids including Three.js in the initial bundle
 */
export async function loadWebGL3DRenderer(): Promise<typeof import('./renderers/webgl-3d')> {
  return import('./renderers/webgl-3d');
}
