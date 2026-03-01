/**
 * NextCalc Pro Plot Engine
 * GPU-accelerated mathematical visualization library
 * @module @nextcalc/plot-engine
 */

// Controls
export { Plot2DController } from './controls/index';
// Export
export {
  downloadAsCSV2D,
  downloadAsCSV3D,
  downloadAsPNG,
  downloadAsSVG,
  exportToCSV2D,
  exportToCSV3D,
  exportToPNG,
  exportToSVG,
} from './export/index';
export { createBest2DRenderer } from './renderers/index';
// Renderers
export { WebGL2DRenderer } from './renderers/webgl-2d';
// Space cubemap themes
export type { CubemapResolution, SpaceTheme, WebGL3DRenderer } from './renderers/webgl-3d';
export { createProceduralHDRCubeMap, SPACE_THEMES } from './renderers/webgl-3d';
export { WebGPU2DRenderer } from './renderers/webgpu-2d';
// WGSL shaders (WebGPU)
export {
  advancedMarkerShaderWGSL,
  axisShaderWGSL,
  cartesianLineShaderWGSL,
  contourLineShaderWGSL,
  dashedLineShaderWGSL,
  fxaaShaderWGSL,
  gradientLineShaderWGSL,
  gridShaderWGSL,
  instancedGridShaderWGSL,
  polarLineShaderWGSL,
  smoothLineShaderWGSL,
  solidLineShaderWGSL,
  WGSL_SHADERS,
  type WGSLShaderSource,
} from './renderers/wgsl-shaders';
// Sampling
export {
  adaptiveSample1D,
  adaptiveSampleParametric2D,
  defaultSamplingConfig,
  type SamplingResult,
  SamplingWorkerManager,
  uniformSample1D,
} from './sampling/index';
// Types
export * from './types/index';

// Utilities
export {
  ColorMaps,
  getColorFromMap,
  interpolateColor,
  parseColor,
  type RGBA,
  rgbaToHex,
  rgbaToString,
} from './utils/color';
export {
  detectBestBackend,
  type GPUCapabilityReport,
  isWebGL2Available,
  isWebGPUAvailable,
  probeGPUCapabilities,
} from './utils/gpu-detection';

export {
  type ContourSegment,
  marchingSquares,
} from './utils/marching-squares';
export {
  identity,
  invert,
  lookAt,
  type Mat4,
  multiply,
  ortho,
  perspective,
  rotationX,
  rotationY,
  rotationZ,
  scaling,
  translation,
} from './utils/matrix';

/**
 * Lazy-loads the Three.js 3D renderer
 * This avoids including Three.js in the initial bundle
 */
export async function loadWebGL3DRenderer(): Promise<typeof import('./renderers/webgl-3d')> {
  return import('./renderers/webgl-3d');
}
