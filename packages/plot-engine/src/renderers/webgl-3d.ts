/**
 * Three.js-based 3D renderer for surface and parametric plots.
 * Uses WebGPURenderer (three/webgpu) which automatically falls back to
 * WebGL 2 when WebGPU is unavailable. Post-processing uses the TSL-native
 * RenderPipeline + node-based bloom, compatible with both backends.
 *
 * MODERNIZATION FEATURES (Three.js 0.183.0):
 * - WebGPURenderer with automatic WebGL 2 fallback
 * - PBR materials (MeshStandardMaterial/MeshPhysicalMaterial)
 * - Node-based post-processing pipeline with RenderPipeline
 * - TSL bloom via BloomNode for glowing effects
 * - Shadow mapping with PCF filtering
 * - HDR tone mapping
 * - Optimized with instanced rendering where applicable
 * - Sprite-based axis labels (canvas texture, no external font loader)
 * - Wireframe overlay using LineSegments with MeshBasicMaterial (lighting-immune)
 * - Procedural HDR environment cubemap for IBL (image-based lighting)
 * - SSAO post-processing via TSL node pipeline for depth cue on surfaces
 *
 * @module renderers/webgl-3d
 */

import * as THREE from 'three/webgpu';
import { WebGPURenderer, RenderPipeline, PCFSoftShadowMap } from 'three/webgpu';
import { pass, mix, float, mrt, output, normalView } from 'three/tsl';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { ao } from 'three/examples/jsm/tsl/display/GTAONode.js';
import type {
  IRenderer,
  RenderBackend,
  PerformanceMetrics,
  PlotConfig,
  Plot3DSurfaceConfig,
  Plot3DParametricSurfaceConfig,
  Plot3DCurveConfig,
  Plot3DParametricCurveConfig,
} from '../types/index';
import { getColorFromMap } from '../utils/color';

// ---------------------------------------------------------------------------
// Axis label sprite helpers
// ---------------------------------------------------------------------------

/**
 * Creates a canvas-based text texture for use as a sprite label.
 * The canvas is sized to the text so it looks crisp at any zoom level.
 */
function makeAxisLabelTexture(text: string): THREE.CanvasTexture {
  const fontSize = 48;
  const padding = 12;

  // Measure text width first
  const offscreen = document.createElement('canvas');
  const ctx2 = offscreen.getContext('2d')!;
  ctx2.font = `bold ${fontSize}px sans-serif`;
  const textWidth = ctx2.measureText(text).width;

  // Size the actual canvas
  const canvasWidth = Math.ceil(textWidth + padding * 2);
  const canvasHeight = Math.ceil(fontSize + padding * 2);
  offscreen.width = canvasWidth;
  offscreen.height = canvasHeight;

  // Redraw at full resolution
  const ctx = offscreen.getContext('2d')!;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Soft dark pill background for legibility against any surface colour
  ctx.fillStyle = 'rgba(10, 10, 20, 0.65)';
  ctx.beginPath();
  const r = canvasHeight * 0.35;
  ctx.roundRect(0, 0, canvasWidth, canvasHeight, r);
  ctx.fill();

  // White text
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);

  const texture = new THREE.CanvasTexture(offscreen);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a billboard sprite positioned at `position`.
 * `scale` controls the world-space size of the label quad.
 */
function makeAxisLabelSprite(
  text: string,
  position: THREE.Vector3,
  scale: number,
): THREE.Sprite {
  const texture = makeAxisLabelTexture(text);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false, // Prevents z-fighting with the surface
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);

  // Preserve the texture's aspect ratio
  const aspect = texture.image.width / texture.image.height;
  sprite.scale.set(scale * aspect, scale, 1);
  return sprite;
}

// ---------------------------------------------------------------------------
// Procedural HDR CubeMap generation — 5 space themes at configurable resolution
// ---------------------------------------------------------------------------

export type SpaceTheme =
  | 'neutron-star-collision'
  | 'black-hole-merger'
  | 'great-attractor'
  | 'dipole-repeller'
  | 'shapley-attractor';

export type CubemapResolution = 512 | 1024 | 2048 | 4096;

export const SPACE_THEMES: ReadonlyArray<{ id: SpaceTheme; label: string }> = [
  { id: 'neutron-star-collision', label: 'Neutron Star Collision' },
  { id: 'black-hole-merger', label: 'Black Hole Merger' },
  { id: 'great-attractor', label: 'Great Attractor' },
  { id: 'dipole-repeller', label: 'Dipole Repeller' },
  { id: 'shapley-attractor', label: 'Shapley Attractor' },
];

/**
 * Generates a procedural HDR-like environment cubemap purely in JavaScript.
 * No external .hdr files are required.
 *
 * Supports 5 space themes:
 *   - neutron-star-collision: Hot-white point sources with orange/red shockwave rings
 *   - black-hole-merger: Dark voids with accretion disks and gravitational wave ripples
 *   - great-attractor: Dense warm-white cluster with galaxy smears and flow lines
 *   - dipole-repeller: Warm/cool split scene with cosmic web filaments
 *   - shapley-attractor: Massive supercluster with ICM glow and cosmic web
 *
 * Resolution is configurable from 512 to 4096 per face.
 *
 * @param theme      Space theme to render. Default: 'neutron-star-collision'
 * @param resolution Cubemap face resolution in pixels. Default: 512
 */
export function createProceduralHDRCubeMap(
  theme: SpaceTheme = 'neutron-star-collision',
  resolution: CubemapResolution = 512,
): THREE.CubeTexture {
  const SIZE = resolution;

  // Seeded PRNG for deterministic starfields
  function seededRandom(seed: number): () => number {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Shared: direction-based star hash (deterministic)
  function starHash(nx: number, ny: number, nz: number): number {
    const h = Math.abs(Math.sin(nx * 12.9898 + ny * 78.233 + nz * 45.164) * 43758.5453);
    return h - Math.floor(h);
  }

  // Shared: Gaussian blob
  function gaussian(nx: number, ny: number, nz: number,
                    cx: number, cy: number, cz: number, falloff: number): number {
    return Math.exp(-falloff * ((nx - cx) ** 2 + (ny - cy) ** 2 + (nz - cz) ** 2));
  }

  // Get direction vector for cubemap face texel
  function getDirection(faceIndex: number, u: number, v: number): [number, number, number] {
    let wx = 0, wy = 0, wz = 0;
    switch (faceIndex) {
      case 0: wx =  1; wy = -v; wz = -u; break;
      case 1: wx = -1; wy = -v; wz =  u; break;
      case 2: wx =  u; wy =  1; wz =  v; break;
      case 3: wx =  u; wy = -1; wz = -v; break;
      case 4: wx =  u; wy = -v; wz =  1; break;
      case 5: wx = -u; wy = -v; wz = -1; break;
    }
    const len = Math.sqrt(wx * wx + wy * wy + wz * wz);
    return [wx / len, wy / len, wz / len];
  }

  // Paint a face based on theme
  function paintFace(faceIndex: number): Uint8Array {
    const data = new Uint8Array(SIZE * SIZE * 4);
    const rng = seededRandom(faceIndex * 7919 + 42);

    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const u = (px / (SIZE - 1)) * 2.0 - 1.0;
        const v = (py / (SIZE - 1)) * 2.0 - 1.0;
        const [nx, ny, nz] = getDirection(faceIndex, u, v);

        let r = 0, g = 0, b = 0;

        switch (theme) {
          case 'neutron-star-collision':
            [r, g, b] = paintNeutronStar(nx, ny, nz, rng);
            break;
          case 'black-hole-merger':
            [r, g, b] = paintBlackHole(nx, ny, nz, rng);
            break;
          case 'great-attractor':
            [r, g, b] = paintGreatAttractor(nx, ny, nz, rng);
            break;
          case 'dipole-repeller':
            [r, g, b] = paintDipoleRepeller(nx, ny, nz, rng);
            break;
          case 'shapley-attractor':
            [r, g, b] = paintShapleyAttractor(nx, ny, nz, rng);
            break;
        }

        const idx = (py * SIZE + px) * 4;
        data[idx]     = Math.min(255, Math.floor(Math.max(0, r) * 255));
        data[idx + 1] = Math.min(255, Math.floor(Math.max(0, g) * 255));
        data[idx + 2] = Math.min(255, Math.floor(Math.max(0, b) * 255));
        data[idx + 3] = 255;
      }
    }
    return data;
  }

  // --- THEME IMPLEMENTATIONS ---

  function paintNeutronStar(nx: number, ny: number, nz: number, _rng: () => number): [number, number, number] {
    // Deep blue-black base
    const elev = (ny + 1) * 0.5;
    let r = 0.01 + elev * 0.02;
    let g = 0.01 + elev * 0.03;
    let b = 0.04 + elev * 0.08;

    // Dense blue starfield
    const star = starHash(nx, ny, nz);
    if (star > 0.97) {
      const bright = (star - 0.97) * 33;
      r += bright * 0.7; g += bright * 0.85; b += bright * 1.0;
    }

    // Two hot-white point sources (collision partners)
    const src1 = gaussian(nx, ny, nz, 0.3, 0.7, 0.2, 40);
    const src2 = gaussian(nx, ny, nz, -0.2, 0.65, 0.3, 40);
    r += (src1 + src2) * 1.5;
    g += (src1 + src2) * 1.4;
    b += (src1 + src2) * 1.6;

    // Orange/red shockwave rings radiating from collision midpoint
    const mid = { x: 0.05, y: 0.675, z: 0.25 };
    const distToMid = Math.sqrt((nx - mid.x) ** 2 + (ny - mid.y) ** 2 + (nz - mid.z) ** 2);
    const ring1 = Math.exp(-80 * (distToMid - 0.3) ** 2) * 0.4;
    const ring2 = Math.exp(-80 * (distToMid - 0.5) ** 2) * 0.25;
    r += (ring1 + ring2) * 1.2;
    g += (ring1 + ring2) * 0.4;
    b += (ring1 + ring2) * 0.1;

    // Gravitational lensing distortion (radial stretch near collision)
    const lensing = gaussian(nx, ny, nz, mid.x, mid.y, mid.z, 8);
    r += lensing * 0.05; g += lensing * 0.03; b += lensing * 0.08;

    return [r * 2.5, g * 2.5, b * 2.5];
  }

  function paintBlackHole(nx: number, ny: number, nz: number, _rng: () => number): [number, number, number] {
    // Dark base
    const elev = (ny + 1) * 0.5;
    let r = 0.02 + elev * 0.02;
    let g = 0.01 + elev * 0.02;
    let b = 0.03 + elev * 0.05;

    // Starfield
    const star = starHash(nx, ny, nz);
    if (star > 0.975) {
      const bright = (star - 0.975) * 40;
      r += bright * 0.8; g += bright * 0.9; b += bright * 1.0;
    }

    // Two dark voids (black holes)
    const void1 = gaussian(nx, ny, nz, 0.2, 0.5, 0.1, 60);
    const void2 = gaussian(nx, ny, nz, -0.15, 0.45, 0.2, 60);
    const voidMask = 1.0 - Math.min(1, (void1 + void2) * 2);
    r *= voidMask; g *= voidMask; b *= voidMask;

    // Bright accretion disk arcs (orange/white)
    const dist1 = Math.sqrt((nx - 0.2) ** 2 + (ny - 0.5) ** 2 + (nz - 0.1) ** 2);
    const disk1 = Math.exp(-120 * (dist1 - 0.15) ** 2) * 0.8;
    const dist2 = Math.sqrt((nx + 0.15) ** 2 + (ny - 0.45) ** 2 + (nz - 0.2) ** 2);
    const disk2 = Math.exp(-120 * (dist2 - 0.12) ** 2) * 0.7;
    r += (disk1 + disk2) * 1.3;
    g += (disk1 + disk2) * 0.8;
    b += (disk1 + disk2) * 0.3;

    // Gravitational wave ripples (concentric rings)
    const merger = { x: 0.025, y: 0.475, z: 0.15 };
    const distMerger = Math.sqrt((nx - merger.x) ** 2 + (ny - merger.y) ** 2 + (nz - merger.z) ** 2);
    const ripple = Math.sin(distMerger * 30) * Math.exp(-3 * distMerger) * 0.08;
    r += Math.max(0, ripple * 0.5);
    g += Math.max(0, ripple * 0.6);
    b += Math.max(0, ripple * 1.2);

    return [r * 2.5, g * 2.5, b * 2.5];
  }

  function paintGreatAttractor(nx: number, ny: number, nz: number, _rng: () => number): [number, number, number] {
    // Gradient from deep navy to dark purple
    const elev = (ny + 1) * 0.5;
    let r = 0.03 + elev * 0.04;
    let g = 0.02 + elev * 0.02;
    let b = 0.05 + elev * 0.08;

    // Dense warm-white cluster in one hemisphere
    const cluster = gaussian(nx, ny, nz, 0.4, 0.3, -0.2, 3);
    const star = starHash(nx, ny, nz);
    const clusterDensity = 0.96 - cluster * 0.12; // More stars near attractor
    if (star > clusterDensity) {
      const bright = (star - clusterDensity) * 25;
      r += bright * 1.0; g += bright * 0.95; b += bright * 0.8;
    }

    // Galaxy smears (elongated blobs)
    const gal1 = gaussian(nx, ny, nz, 0.5, 0.25, -0.1, 15) * 0.15;
    const gal2 = gaussian(nx, ny, nz, 0.3, 0.4, -0.3, 20) * 0.12;
    const gal3 = gaussian(nx, ny, nz, 0.6, 0.15, 0.1, 18) * 0.1;
    r += (gal1 + gal2 + gal3) * 1.0;
    g += (gal1 + gal2 + gal3) * 0.9;
    b += (gal1 + gal2 + gal3) * 0.7;

    // Flow lines converging toward attractor (subtle streaks)
    const toAttractor = Math.atan2(nz + 0.2, nx - 0.4);
    const streak = Math.exp(-2 * Math.abs(ny - 0.3)) * (0.5 + 0.5 * Math.sin(toAttractor * 8)) * 0.03;
    r += streak * 0.8; g += streak * 0.6; b += streak * 1.0;

    return [r * 2.5, g * 2.5, b * 2.5];
  }

  function paintDipoleRepeller(nx: number, ny: number, nz: number, _rng: () => number): [number, number, number] {
    // Split scene: warm (attractor side nz>0) vs cool (repeller side nz<0)
    const warmCool = (nz + 1) * 0.5; // 0=repeller, 1=attractor

    let r = 0.02 + warmCool * 0.04;
    let g = 0.02 + (1 - warmCool) * 0.02;
    let b = 0.04 + (1 - warmCool) * 0.06;

    // Star density: sparse on repeller side, dense on attractor side
    const star = starHash(nx, ny, nz);
    const threshold = 0.99 - warmCool * 0.04; // 0.99 (sparse) to 0.95 (dense)
    if (star > threshold) {
      const bright = (star - threshold) * (1 / (1 - threshold));
      const temp = warmCool;
      r += bright * (0.6 + 0.4 * temp);
      g += bright * 0.85;
      b += bright * (0.6 + 0.4 * (1 - temp));
    }

    // Cosmic web filaments (faint curved streaks)
    const fil1 = Math.exp(-12 * (Math.abs(ny - 0.3 * Math.sin(nx * 3 + nz * 2)) - 0.02));
    const fil2 = Math.exp(-12 * (Math.abs(nx - 0.4 * Math.cos(ny * 2.5 + nz * 1.5)) - 0.02));
    const filament = (fil1 + fil2) * 0.02 * warmCool;
    r += filament * 0.8; g += filament * 0.6; b += filament * 1.0;

    // Void region on repeller side
    const voidBlob = gaussian(nx, ny, nz, 0, 0, -0.7, 4);
    const voidDarken = 1.0 - voidBlob * 0.5;
    r *= voidDarken; g *= voidDarken; b *= voidDarken;

    return [r * 2.5, g * 2.5, b * 2.5];
  }

  function paintShapleyAttractor(nx: number, ny: number, nz: number, _rng: () => number): [number, number, number] {
    // Deep blue-black void base
    const elev = (ny + 1) * 0.5;
    let r = 0.01 + elev * 0.02;
    let g = 0.01 + elev * 0.02;
    let b = 0.03 + elev * 0.06;

    // Massive supercluster: hundreds of bright points in concentrated region
    const clusterCenter = gaussian(nx, ny, nz, -0.2, 0.1, 0.4, 2);
    const star = starHash(nx, ny, nz);
    const threshold = 0.97 - clusterCenter * 0.15;
    if (star > threshold) {
      const bright = (star - threshold) * 20;
      r += bright * 1.0; g += bright * 0.95; b += bright * 0.9;
    }

    // ICM glow (diffuse pink/purple halos around cluster centers)
    const icm1 = gaussian(nx, ny, nz, -0.2, 0.1, 0.4, 6) * 0.08;
    const icm2 = gaussian(nx, ny, nz, -0.1, 0.2, 0.5, 10) * 0.05;
    const icm3 = gaussian(nx, ny, nz, -0.3, 0.0, 0.3, 8) * 0.06;
    r += (icm1 + icm2 + icm3) * 1.2;
    g += (icm1 + icm2 + icm3) * 0.4;
    b += (icm1 + icm2 + icm3) * 1.0;

    // Cosmic web structure (faint filaments)
    const web1 = Math.exp(-15 * (Math.abs(ny - 0.2 * Math.sin(nx * 4 + nz * 3)) - 0.015));
    const web2 = Math.exp(-15 * (Math.abs(nz - 0.3 - 0.2 * Math.cos(nx * 3 + ny * 2)) - 0.015));
    const web = (web1 + web2) * 0.015;
    r += web * 0.6; g += web * 0.5; b += web * 0.8;

    return [r * 2.5, g * 2.5, b * 2.5];
  }

  // Build cubemap from 6 faces
  const faceImages: HTMLCanvasElement[] = Array.from({ length: 6 }, (_, f) => {
    const pixels = paintFace(f);
    const c = document.createElement('canvas');
    c.width = SIZE;
    c.height = SIZE;
    c.getContext('2d')!.putImageData(
      new ImageData(new Uint8ClampedArray(pixels.buffer as ArrayBuffer), SIZE, SIZE),
      0, 0,
    );
    return c;
  });

  const cubeTexture = new THREE.CubeTexture(faceImages);
  cubeTexture.colorSpace = THREE.SRGBColorSpace;
  cubeTexture.needsUpdate = true;
  return cubeTexture;
}

// ---------------------------------------------------------------------------
// Renderer factory: WebGPURenderer with built-in WebGL 2 fallback
// ---------------------------------------------------------------------------

/**
 * Detects the active backend after renderer.init().
 * WebGPURenderer exposes isWebGPURenderer; its internal backend reports
 * coordinateSystem to distinguish WebGPU from WebGL.
 */
function detectBackend(renderer: WebGPURenderer): RenderBackend {
  // THREE.WebGPUCoordinateSystem = 2 (Y-up, clip-space 0..1)
  // THREE.WebGLCoordinateSystem = 2000 (Y-up, clip-space -1..1)
  // We use the renderer's reported coordinate system as a reliable signal.
  return renderer.backend.coordinateSystem === THREE.WebGPUCoordinateSystem
    ? 'webgpu'
    : 'webgl2';
}

// ---------------------------------------------------------------------------
// SSAO configuration type
// ---------------------------------------------------------------------------

/**
 * Configuration for the SSAO (Screen Space Ambient Occlusion) effect.
 * All fields are optional; reasonable defaults are provided.
 */
export interface SSAOConfig {
  /** Sampling radius in world-space units. Default: 0.5 */
  radius?: number;
  /** Intensity multiplier for the AO contribution. Default: 1.0 */
  intensity?: number;
}

// ---------------------------------------------------------------------------
// HDR environment map configuration type
// ---------------------------------------------------------------------------

/**
 * Configuration for the procedural HDR environment map.
 */
export interface HDREnvConfig {
  /**
   * Intensity for scene.environment (IBL on PBR surfaces). Default: 0.4
   * Lower values keep the math-surface colormaps dominant.
   */
  envIntensity?: number;
  /**
   * Intensity for scene.background (visible sky).
   * Default: 0.08 — barely visible so it adds depth without distraction.
   */
  backgroundIntensity?: number;
  /** Space theme for the procedural cubemap. Default: 'neutron-star-collision' */
  theme?: SpaceTheme;
  /** Cubemap face resolution in pixels. Default: 512 */
  resolution?: CubemapResolution;
}

/**
 * Three.js 3D renderer implementation with modern PBR and node-based
 * post-processing. Targets WebGPU with automatic WebGL 2 fallback.
 */
export class WebGL3DRenderer implements IRenderer {
  readonly canvas: HTMLCanvasElement;

  // Actual backend determined after async init()
  private _backend: RenderBackend = 'webgl2';
  get backend(): RenderBackend {
    return this._backend;
  }

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: WebGPURenderer | null = null;
  private currentMesh: THREE.Mesh | null = null;
  private currentWireframe: THREE.LineSegments | null = null;
  private axisLabelGroup: THREE.Group | null = null;
  private animationFrameId: number | null = null;

  // Node-based post-processing pipeline (replaces EffectComposer)
  private renderPipeline: RenderPipeline | null = null;

  // Lighting
  private directionalLight: THREE.DirectionalLight | null = null;

  // HDR environment map
  private envMap: THREE.CubeTexture | null = null;
  private _envMapEnabled = false;
  private _envIntensity = 0.4;
  private _backgroundIntensity = 0.08;
  private _spaceTheme: SpaceTheme = 'neutron-star-collision';
  private _cubemapResolution: CubemapResolution = 512;

  // SSAO state — when enabled the post-processing pipeline is rebuilt
  private _ssaoEnabled = false;
  private _ssaoRadius = 0.5;
  private _ssaoIntensity = 1.0;

  // Performance tracking
  private metrics: PerformanceMetrics = {
    initTime: 0,
    renderTime: 0,
    frameTime: 0,
    fps: 0,
    memoryUsage: 0,
    pointCount: 0,
    drawCalls: 0,
  };

  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsUpdateTime = 0;

  // Geometry caching to avoid regeneration
  private lastConfigHash: string | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /**
   * Initializes the Three.js WebGPURenderer (with automatic WebGL 2 fallback)
   * and the node-based post-processing pipeline.
   *
   * IMPORTANT: WebGPURenderer.init() is async and must complete before the
   * first render() call.
   */
  async initialize(): Promise<void> {
    const startTime = performance.now();

    try {
      // Create scene with modern settings
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0d0d1a); // Dark blue-black background
      this.scene.fog = new THREE.FogExp2(0x0d0d1a, 0.002); // Subtle depth fog

      // Create camera (adjusted for 4x larger scene)
      const aspect = this.canvas.width / this.canvas.height;
      this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000);
      this.camera.position.set(20, 20, 20);
      this.camera.lookAt(0, 0, 0);

      // Create WebGPURenderer — passes the existing canvas element.
      // The renderer will attempt WebGPU first; if the browser does not
      // support it, it falls back to WebGL 2 automatically without any
      // additional code path.
      this.renderer = new WebGPURenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });

      // Async initialisation is mandatory for WebGPURenderer.
      // This call requests the GPU adapter/device for the WebGPU path
      // or sets up the WebGL 2 context for the fallback path.
      await this.renderer.init();

      // Record which backend is actually in use
      this._backend = detectBackend(this.renderer);

      this.renderer.setSize(this.canvas.width, this.canvas.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Shadow mapping — API is identical to WebGLRenderer
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = PCFSoftShadowMap;

      // HDR tone mapping
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2;

      // Add modern PBR lighting
      this.setupModernLighting();

      // Setup node-based post-processing pipeline
      this.setupPostProcessing();

      // Grid helper (4x larger)
      const gridHelper = new THREE.GridHelper(40, 40, 0x66ccff, 0x334455);
      if (!Array.isArray(gridHelper.material)) {
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
      }
      this.scene.add(gridHelper);

      // Axes helper (X=red, Y=green, Z=blue) — scaled 4x
      const axesHelper = new THREE.AxesHelper(20);
      if (!Array.isArray(axesHelper.material)) {
        (axesHelper.material as THREE.LineBasicMaterial).linewidth = 2;
      }
      this.scene.add(axesHelper);

      // Sprite-based axis labels positioned just beyond each axis tip.
      // The THREE.js scene uses y-up, so our mathematical Z maps to THREE Y.
      const labelScale = 3.5;
      this.axisLabelGroup = new THREE.Group();

      const xLabel = makeAxisLabelSprite('X', new THREE.Vector3(22, 0, 0), labelScale);
      const yLabel = makeAxisLabelSprite('Y', new THREE.Vector3(0, 0, 22), labelScale);
      const zLabel = makeAxisLabelSprite('Z', new THREE.Vector3(0, 22, 0), labelScale);

      this.axisLabelGroup.add(xLabel, yLabel, zLabel);
      this.scene.add(this.axisLabelGroup);

      this.metrics.initTime = performance.now() - startTime;
    } catch (error) {
      throw new Error(`Three.js 3D renderer initialization failed: ${error}`);
    }
  }

  /**
   * Sets up modern PBR lighting with shadows.
   */
  private setupModernLighting(): void {
    if (!this.scene) return;

    // Ambient light (softer for PBR)
    const ambientLight = new THREE.AmbientLight(0x404060, 0.3);
    this.scene.add(ambientLight);

    // Main directional light with shadows (sun)
    this.directionalLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    this.directionalLight.position.set(15, 25, 15);
    this.directionalLight.castShadow = true;

    // Configure shadow mapping for high quality
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 100;
    this.directionalLight.shadow.camera.left = -30;
    this.directionalLight.shadow.camera.right = 30;
    this.directionalLight.shadow.camera.top = 30;
    this.directionalLight.shadow.camera.bottom = -30;
    this.directionalLight.shadow.bias = -0.0001;
    this.directionalLight.shadow.normalBias = 0.02;

    this.scene.add(this.directionalLight);

    // Fill light (softer, from opposite side)
    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.4);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    // Rim light (back light for edge highlights)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(0, 5, -15);
    this.scene.add(rimLight);

    // Hemisphere light for natural ambient (sky and ground)
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x543210, 0.4);
    this.scene.add(hemiLight);
  }

  /**
   * Sets up (or rebuilds) the node-based post-processing pipeline using
   * Three.js's RenderPipeline and TSL bloom node.
   *
   * When SSAO is enabled, a proper GTAO (Ground Truth Ambient Occlusion) pass
   * is used. This requires MRT (Multiple Render Targets) on the scene pass to
   * populate the 'normal' and 'depth' texture slots, which are then fed into
   * the GTAONode to compute per-pixel occlusion.
   *
   * NOTE: The previous implementation used `scenePass.getTextureNode('ao')`
   * which returns a constant 0.0 (black) because the 'ao' texture slot is NOT
   * natively populated by `pass()`. This caused `mix(1.0, 0.0, strength)` to
   * evaluate to ~0.3, darkening the entire scene to 30%.
   *
   * Pipeline composition:
   *   sceneColor  <- base render output (via MRT 'output' slot)
   *   bloomNode   <- additive bloom on bright areas (threshold 0.85)
   *   aoPass      <- GTAONode driven by depth + normal from MRT (SSAO only)
   *   outputNode  <- sceneColor * aoFactor + bloom
   */
  private setupPostProcessing(): void {
    if (!this.scene || !this.camera || !this.renderer) return;

    // Dispose the previous pipeline before rebuilding
    if (this.renderPipeline) {
      this.renderPipeline.dispose();
      this.renderPipeline = null;
    }

    // Scene pass — renders the scene to an internal render target.
    // When SSAO is enabled we configure MRT so the pass populates both the
    // color output and view-space normals into separate texture slots.
    const scenePass = pass(this.scene, this.camera);

    if (this._ssaoEnabled) {
      // MRT: write scene color to 'output' and view-space normals to 'normal'.
      // This is required by GTAONode which reads depth and normals from the
      // scene pass to compute screen-space ambient occlusion.
      scenePass.setMRT(
        mrt({
          output,
          normal: normalView,
        }),
      );
    }

    const sceneColor = scenePass.getTextureNode('output');

    // Bloom node — threshold 0.85, strength 0.6, radius 0.4
    const bloomNode = bloom(sceneColor, 0.6, 0.4, 0.85);

    // The TSL node graph is built through method chaining; the exact return
    // type is an internal ShaderNodeObject<Node> subtype. We use `Node` as
    // the declared type since RenderPipeline accepts THREE.Node.
    let outputNode: THREE.Node;

    if (this._ssaoEnabled) {
      // Use GTAONode for proper screen-space ambient occlusion.
      // GTAONode reads depth and normals from the scene pass MRT and computes
      // per-pixel occlusion using the Activision GTAO algorithm.
      const scenePassDepth = scenePass.getTextureNode('depth');
      const scenePassNormal = scenePass.getTextureNode('normal');

      const aoPass = ao(scenePassDepth, scenePassNormal, this.camera);

      // Configure GTAO parameters from our SSAO settings
      aoPass.radius.value = this._ssaoRadius;
      aoPass.scale.value = this._ssaoIntensity;

      // Get the AO texture and blend it with the scene color.
      // aoFactor is in [0, 1] where 1 = fully lit, 0 = fully occluded.
      // We mix between full brightness and the AO factor based on strength
      // to keep the effect subtle and not overpower the colormap.
      const aoTexture = aoPass.getTextureNode();
      const radiusFactor = Math.min(this._ssaoRadius / 0.5, 2.0);
      const strength = Math.min(this._ssaoIntensity * 0.4 * radiusFactor, 0.7);

      // aoMask = lerp(1.0, aoTexture, strength) = (1-strength) + strength * ao
      const aoMask = mix(float(1.0), aoTexture, float(strength));

      const aoModulated = sceneColor.mul(aoMask);
      outputNode = aoModulated.add(bloomNode);
    } else {
      // Combine scene colour with bloom additive contribution
      outputNode = sceneColor.add(bloomNode);
    }

    // RenderPipeline is the r183 replacement for PostProcessing
    this.renderPipeline = new RenderPipeline(this.renderer, outputNode);
  }

  // ---------------------------------------------------------------------------
  // Public API: HDR Environment Map toggle
  // ---------------------------------------------------------------------------

  /**
   * Enables or disables the procedural HDR environment map.
   *
   * When enabled:
   *   - A gradient cubemap is generated and applied to `scene.environment`
   *     so PBR surfaces receive image-based lighting (IBL).
   *   - The same cubemap is applied to `scene.background` at very low
   *     intensity to add spatial depth.
   *   - All PBR materials in the current mesh automatically receive IBL
   *     through `envMapIntensity` (already set per-material).
   *
   * When disabled:
   *   - `scene.environment` is set to null (pure direct-light mode).
   *   - `scene.background` reverts to the solid dark background colour.
   *   - The cubemap texture is disposed to free GPU memory.
   *
   * @param enabled   Whether to activate the environment map.
   * @param config    Optional intensity overrides.
   */
  setEnvMapEnabled(enabled: boolean, config?: HDREnvConfig): void {
    this._envMapEnabled = enabled;

    if (config?.envIntensity !== undefined) this._envIntensity = config.envIntensity;
    if (config?.backgroundIntensity !== undefined) this._backgroundIntensity = config.backgroundIntensity;

    const themeChanged = config?.theme !== undefined && config.theme !== this._spaceTheme;
    const resChanged = config?.resolution !== undefined && config.resolution !== this._cubemapResolution;

    if (config?.theme !== undefined) this._spaceTheme = config.theme;
    if (config?.resolution !== undefined) this._cubemapResolution = config.resolution;

    if (!this.scene) return;

    if (enabled) {
      if (!this.envMap || themeChanged || resChanged) {
        if (this.envMap) this.envMap.dispose();
        this.envMap = createProceduralHDRCubeMap(this._spaceTheme, this._cubemapResolution);
      }

      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = this._envIntensity;
      this.scene.background = this.envMap;
      this.scene.backgroundIntensity = this._backgroundIntensity;
      this.scene.fog = null;
    } else {
      this.scene.environment = null;
      this.scene.background = new THREE.Color(0x0d0d1a);
      this.scene.backgroundIntensity = 1.0;
      this.scene.fog = new THREE.FogExp2(0x0d0d1a, 0.002);

      if (this.envMap) {
        this.envMap.dispose();
        this.envMap = null;
      }
    }
  }

  /**
   * Returns whether the HDR environment map is currently active.
   */
  get envMapEnabled(): boolean {
    return this._envMapEnabled;
  }

  // ---------------------------------------------------------------------------
  // Public API: SSAO toggle
  // ---------------------------------------------------------------------------

  /**
   * Enables or disables Screen-Space Ambient Occlusion (SSAO).
   *
   * SSAO enhances depth perception on 3D surfaces by darkening valleys and
   * concave regions relative to exposed ridges, giving a subtle but clear
   * sense of surface curvature even in flat-lit areas.
   *
   * The effect is intentionally subtle (intensity ~1.0, radius ~0.5) to
   * avoid overwhelming the colormap-based data representation.
   *
   * Enabling or disabling SSAO rebuilds the RenderPipeline since the
   * composition graph changes.
   *
   * @param enabled   Whether to activate SSAO.
   * @param config    Optional SSAO parameter overrides.
   */
  setSsaoEnabled(enabled: boolean, config?: SSAOConfig): void {
    this._ssaoEnabled = enabled;

    if (config?.radius !== undefined) {
      this._ssaoRadius = config.radius;
    }
    if (config?.intensity !== undefined) {
      this._ssaoIntensity = config.intensity;
    }

    // Rebuild the post-processing pipeline with/without the AO node
    this.setupPostProcessing();
  }

  /**
   * Returns whether SSAO post-processing is currently active.
   */
  get ssaoEnabled(): boolean {
    return this._ssaoEnabled;
  }

  /**
   * Creates a hash of the config to detect changes.
   */
  private hashConfig(config: PlotConfig): string {
    const { type } = config;

    if (type === '3d-surface') {
      const { viewport, resolution, colorMap, wireframe } = config;
      return JSON.stringify({ type, viewport, resolution, colorMap, wireframe, fn: 'function' });
    } else if (type === '3d-parametric') {
      const { uRange, vRange, resolution, colorMap } = config;
      return JSON.stringify({ type, uRange, vRange, resolution, colorMap, functions: 'functions' });
    } else {
      const { type: _configType, ...rest } = config as Plot3DCurveConfig | Plot3DParametricCurveConfig;
      return JSON.stringify({ type, ...rest });
    }
  }

  /**
   * Renders a plot configuration.
   * Uses caching to avoid regenerating geometry on every frame.
   */
  render(config: PlotConfig): void {
    if (!this.scene || !this.camera || !this.renderer) {
      throw new Error('Renderer not initialized');
    }

    const startTime = performance.now();

    // Check if config has changed
    const configHash = this.hashConfig(config);
    const configChanged = this.lastConfigHash !== configHash;

    if (configChanged) {
      this.lastConfigHash = configHash;

      // Remove existing mesh
      if (this.currentMesh) {
        this.scene.remove(this.currentMesh);
        this.currentMesh.geometry.dispose();
        if (Array.isArray(this.currentMesh.material)) {
          this.currentMesh.material.forEach((m) => m.dispose());
        } else {
          this.currentMesh.material.dispose();
        }
        this.currentMesh = null;
      }

      // Remove existing wireframe overlay
      if (this.currentWireframe) {
        this.scene.remove(this.currentWireframe);
        this.currentWireframe.geometry.dispose();
        (this.currentWireframe.material as THREE.Material).dispose();
        this.currentWireframe = null;
      }

      // Render based on plot type
      if (config.type === '3d-surface') {
        this.renderSurface(config);
      } else if (config.type === '3d-parametric') {
        this.renderParametricSurface(config);
      } else if (config.type === '3d-curve') {
        this.renderCurve(config);
      } else if (config.type === '3d-parametric-curve') {
        this.renderParametricCurve(config);
      } else {
        throw new Error(`Unsupported plot type for WebGL 3D renderer: ${config.type}`);
      }

      this.metrics.renderTime = performance.now() - startTime;
    }

    // Render through the node-based pipeline (or direct if not available)
    if (this.renderPipeline) {
      this.renderPipeline.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.updateFPS();
  }

  /**
   * Renders a 3D surface plot z = f(x, y).
   *
   * Wireframe mode uses a two-object approach:
   *   1. The solid surface mesh rendered with reduced opacity so the shape
   *      remains visible.
   *   2. A separate LineSegments overlay built from WireframeGeometry, using
   *      MeshBasicMaterial (unlit, immune to bloom darkening) so the
   *      wireframe edges are always the intended bright colour.
   */
  private renderSurface(config: Plot3DSurfaceConfig): void {
    if (!this.scene) return;

    const { fn, viewport, resolution, colorMap, wireframe } = config;

    const xRes = resolution.x;
    const yRes = resolution.y;
    const vertexCount = (xRes + 1) * (yRes + 1);

    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices: number[] = [];

    const xMin = viewport.xMin;
    const xMax = viewport.xMax;
    const yMin = viewport.yMin;
    const yMax = viewport.yMax;
    const dx = (xMax - xMin) / xRes;
    const dy = (yMax - yMin) / yRes;

    let zMin = Infinity;
    let zMax = -Infinity;

    // First pass: compute positions and find z range
    let idx = 0;
    for (let i = 0; i <= xRes; i++) {
      for (let j = 0; j <= yRes; j++) {
        const x = xMin + i * dx;
        const y = yMin + j * dy;

        let z = 0;
        try {
          z = fn(x, y);
          if (!Number.isFinite(z)) {
            z = 0;
          } else {
            zMin = Math.min(zMin, z);
            zMax = Math.max(zMax, z);
          }
        } catch {
          z = 0;
        }

        // Store position (THREE.js uses y-up; our math Z maps to THREE Y)
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = z;
        positions[idx * 3 + 2] = y;
        idx++;
      }
    }

    // Second pass: assign colors based on z range
    if (colorMap) {
      const zRange = zMax - zMin;
      for (let i = 0; i < vertexCount; i++) {
        const z = positions[i * 3 + 1] ?? 0;
        const t = zRange > 0 ? (z - zMin) / zRange : 0.5;
        const color = getColorFromMap(colorMap, t);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
    } else {
      for (let i = 0; i < vertexCount; i++) {
        colors[i * 3] = 0.4;
        colors[i * 3 + 1] = 0.6;
        colors[i * 3 + 2] = 0.9;
      }
    }

    // Create indices for triangles
    for (let i = 0; i < xRes; i++) {
      for (let j = 0; j < yRes; j++) {
        const a = i * (yRes + 1) + j;
        const b = a + yRes + 1;
        const c = a + 1;
        const d = b + 1;

        indices.push(a, b, c);
        indices.push(c, b, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    if (wireframe) {
      // --- Wireframe mode ---
      // Keep a ghost surface (very low opacity) so the form reads spatially,
      // then overlay per-vertex-colored LineSegments driven by the same
      // colormap as the solid surface.
      const surfaceMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        flatShading: false,
        metalness: 0.1,
        roughness: 0.8,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.0,
      });

      this.currentMesh = new THREE.Mesh(geometry, surfaceMaterial);
      this.currentMesh.castShadow = false;
      this.currentMesh.receiveShadow = false;
      this.scene.add(this.currentMesh);

      // Build the wireframe geometry from the surface geometry.
      // WireframeGeometry reindexes vertices so we must re-map colors onto
      // those new positions by looking up each position's z-value (stored in
      // the y-component of THREE.js's y-up coordinate system).
      const wireGeometry = new THREE.WireframeGeometry(geometry);

      // WireframeGeometry.attributes.position mirrors the source geometry's
      // layout — we can derive z (=THREE Y) per vertex and re-color.
      const wirePosAttr = wireGeometry.attributes['position'] as THREE.BufferAttribute;
      const wireVertexCount = wirePosAttr.count;
      const wireColors = new Float32Array(wireVertexCount * 3);

      if (colorMap) {
        const zRange = zMax - zMin;
        for (let i = 0; i < wireVertexCount; i++) {
          // In our scene y-up layout, the math z maps to THREE Y
          const zVal = wirePosAttr.getY(i);
          const t = zRange > 0 ? (zVal - zMin) / zRange : 0.5;
          const c = getColorFromMap(colorMap, Math.max(0, Math.min(1, t)));
          wireColors[i * 3]     = c.r;
          wireColors[i * 3 + 1] = c.g;
          wireColors[i * 3 + 2] = c.b;
        }
      } else {
        // No colormap: use a soft cyan so the wireframe is still attractive
        for (let i = 0; i < wireVertexCount; i++) {
          wireColors[i * 3]     = 0.53;
          wireColors[i * 3 + 1] = 0.93;
          wireColors[i * 3 + 2] = 1.0;
        }
      }

      wireGeometry.setAttribute('color', new THREE.BufferAttribute(wireColors, 3));

      const wireMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
      });

      const wireLines = new THREE.LineSegments(wireGeometry, wireMaterial);
      this.currentWireframe = wireLines;
      this.scene.add(wireLines);
    } else {
      // --- Solid surface mode ---
      if (this.currentWireframe) {
        this.scene.remove(this.currentWireframe);
        this.currentWireframe.geometry.dispose();
        (this.currentWireframe.material as THREE.Material).dispose();
        this.currentWireframe = null;
      }

      const material = new THREE.MeshStandardMaterial({
        vertexColors: !!colorMap,
        side: THREE.DoubleSide,
        flatShading: false,
        metalness: 0.2,
        roughness: 0.6,
        envMapIntensity: 1.0,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.0,
      });

      this.currentMesh = new THREE.Mesh(geometry, material);
      this.currentMesh.castShadow = true;
      this.currentMesh.receiveShadow = true;
      this.scene.add(this.currentMesh);
    }

    this.metrics.pointCount = vertexCount;
  }

  /**
   * Renders a parametric surface.
   */
  private renderParametricSurface(config: Plot3DParametricSurfaceConfig): void {
    if (!this.scene) return;

    const { functions, uRange, vRange, resolution, colorMap } = config;

    const uRes = resolution.u;
    const vRes = resolution.v;
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const du = (uRange.max - uRange.min) / uRes;
    const dv = (vRange.max - vRange.min) / vRes;

    for (let i = 0; i <= uRes; i++) {
      for (let j = 0; j <= vRes; j++) {
        const u = uRange.min + i * du;
        const v = vRange.min + j * dv;

        try {
          const x = functions.x(u, v);
          const y = functions.y(u, v);
          const z = functions.z(u, v);

          if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
            vertices.push(x, z, y); // THREE.js y-up

            if (colorMap) {
              const t = (u - uRange.min) / (uRange.max - uRange.min);
              const color = getColorFromMap(colorMap, t);
              colors.push(color.r, color.g, color.b);
            } else {
              colors.push(0.4, 0.6, 0.9);
            }
          } else {
            vertices.push(0, 0, 0);
            colors.push(1, 0, 0);
          }
        } catch {
          vertices.push(0, 0, 0);
          colors.push(1, 0, 0);
        }
      }
    }

    for (let i = 0; i < uRes; i++) {
      for (let j = 0; j < vRes; j++) {
        const a = i * (vRes + 1) + j;
        const b = a + vRes + 1;
        const c = a + 1;
        const d = b + 1;

        indices.push(a, b, c);
        indices.push(c, b, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: !!colorMap,
      side: THREE.DoubleSide,
      flatShading: false,
      metalness: 0.3,
      roughness: 0.5,
      envMapIntensity: 1.2,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0.0,
    });

    this.currentMesh = new THREE.Mesh(geometry, material);
    this.currentMesh.castShadow = true;
    this.currentMesh.receiveShadow = true;
    this.scene.add(this.currentMesh);

    this.metrics.pointCount = vertices.length / 3;
  }

  /**
   * Renders a 3D parametric curve (legacy support).
   */
  private renderCurve(config: Plot3DCurveConfig): void {
    if (!this.scene) return;

    const { functions, tRange, style } = config;

    const samples = 1000;
    const dt = (tRange.max - tRange.min) / samples;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= samples; i++) {
      const t = tRange.min + i * dt;

      try {
        const x = functions.x(t);
        const y = functions.y(t);
        const z = functions.z(t);

        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
          points.push(new THREE.Vector3(x, z, y)); // THREE.js y-up
        }
      } catch {
        // Skip invalid points
      }
    }

    if (points.length < 2) return;

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
      color: 0x2563eb,
      linewidth: style?.line?.width ?? 2,
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    this.metrics.pointCount = points.length;
  }

  /**
   * Renders a 3D parametric curve with optional tube geometry.
   */
  private renderParametricCurve(config: Plot3DParametricCurveConfig): void {
    if (!this.scene) return;

    const { functions, tRange, samples = 1000, style } = config;

    const dt = (tRange.max - tRange.min) / samples;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= samples; i++) {
      const t = tRange.min + i * dt;

      try {
        const x = functions.x(t);
        const y = functions.y(t);
        const z = functions.z(t);

        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
          points.push(new THREE.Vector3(x, z, y)); // THREE.js y-up
        }
      } catch {
        // Skip invalid points
      }
    }

    if (points.length < 2) return;

    this.metrics.pointCount = points.length;

    if (style?.tube?.enabled) {
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeRadius = style.tube.radius ?? 0.05;
      const radialSegments = style.tube.radialSegments ?? 8;

      const geometry = new THREE.TubeGeometry(
        curve,
        samples,
        tubeRadius,
        radialSegments,
        false
      );

      const color = style.line?.color ?? '#2563eb';
      const colorHex = typeof color === 'string' && color.startsWith('#')
        ? parseInt(color.substring(1), 16)
        : 0x2563eb;

      const material = new THREE.MeshPhongMaterial({
        color: colorHex,
        shininess: 30,
        specular: 0x222222,
      });

      const tube = new THREE.Mesh(geometry, material);
      this.scene.add(tube);

      if (this.currentMesh) {
        this.scene.remove(this.currentMesh);
        this.currentMesh.geometry.dispose();
        if (Array.isArray(this.currentMesh.material)) {
          this.currentMesh.material.forEach((m) => m.dispose());
        } else {
          this.currentMesh.material.dispose();
        }
      }
      this.currentMesh = tube;
    } else {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      const color = style?.line?.color ?? '#2563eb';
      const colorHex = typeof color === 'string' && color.startsWith('#')
        ? parseInt(color.substring(1), 16)
        : 0x2563eb;

      const material = new THREE.LineBasicMaterial({
        color: colorHex,
        linewidth: style?.line?.width ?? 2,
      });

      const line = new THREE.Line(geometry, material);
      this.scene.add(line);

      if (this.currentMesh) {
        this.scene.remove(this.currentMesh);
        this.currentMesh.geometry.dispose();
        if (Array.isArray(this.currentMesh.material)) {
          this.currentMesh.material.forEach((m) => m.dispose());
        } else {
          this.currentMesh.material.dispose();
        }
      }
      // Cast to Mesh for compatibility with the tracking field type
      this.currentMesh = line as unknown as THREE.Mesh;
    }
  }

  /**
   * Updates the FPS counter.
   */
  private updateFPS(): void {
    this.frameCount++;
    const now = performance.now();

    if (now - this.fpsUpdateTime >= 1000) {
      this.metrics.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }

    if (this.lastFrameTime > 0) {
      this.metrics.frameTime = now - this.lastFrameTime;
    }
    this.lastFrameTime = now;
  }

  /**
   * Resizes the renderer.
   * Note: RenderPipeline does not expose setSize — the WebGPURenderer's
   * own setSize is sufficient as the pipeline reads the renderer's canvas size.
   */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;

    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  /**
   * Disposes the renderer and frees resources.
   */
  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.currentMesh) {
      this.currentMesh.geometry.dispose();
      if (Array.isArray(this.currentMesh.material)) {
        this.currentMesh.material.forEach((m) => m.dispose());
      } else {
        this.currentMesh.material.dispose();
      }
    }

    if (this.currentWireframe) {
      this.currentWireframe.geometry.dispose();
      (this.currentWireframe.material as THREE.Material).dispose();
      this.currentWireframe = null;
    }

    // Dispose axis label sprites (canvas textures need explicit disposal)
    if (this.axisLabelGroup) {
      this.axisLabelGroup.traverse((child) => {
        if (child instanceof THREE.Sprite) {
          child.material.map?.dispose();
          child.material.dispose();
        }
      });
      this.axisLabelGroup = null;
    }

    // Dispose procedural environment cubemap
    if (this.envMap) {
      this.envMap.dispose();
      this.envMap = null;
    }

    // Dispose node-based post-processing pipeline
    if (this.renderPipeline) {
      this.renderPipeline.dispose();
      this.renderPipeline = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.directionalLight = null;
  }

  /**
   * Gets performance metrics.
   */
  getMetrics(): PerformanceMetrics {
    if (this.renderer) {
      // info.render.calls is the same API on both WebGLRenderer and
      // WebGPURenderer (inherited from the common Renderer base class)
      this.metrics.drawCalls = this.renderer.info.render.calls;
    }

    if ('memory' in performance) {
      const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      this.metrics.memoryUsage = memory?.usedJSHeapSize ?? 0;
    }

    return { ...this.metrics };
  }

  /**
   * Gets the camera for external control (e.g., OrbitControls).
   */
  getCamera(): THREE.Camera | null {
    return this.camera;
  }

  /**
   * Gets the scene for adding custom objects.
   */
  getScene(): THREE.Scene | null {
    return this.scene;
  }

  /**
   * Gets the Three.js renderer instance.
   * Returns WebGPURenderer which covers both GPU and WebGL fallback paths.
   */
  getThreeRenderer(): WebGPURenderer | null {
    return this.renderer;
  }
}
