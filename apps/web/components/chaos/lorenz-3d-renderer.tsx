'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three/webgpu';
import { WebGPURenderer, RenderPipeline } from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  WGSL_LORENZ_COMPUTE,
  LORENZ_PARAMS_SIZE,
  LORENZ_PARTICLE_STRIDE,
  LORENZ_PARTICLE_BYTES,
  LORENZ_WORKGROUP_SIZE,
  LORENZ_DEFAULTS,
} from './lorenz-compute-shaders';

function createSpaceCubeMap(): THREE.CubeTexture {
  const SIZE = 64;

  function paintFace(faceIndex: number): Uint8Array {
    const data = new Uint8Array(SIZE * SIZE * 4);
    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const u = (px / (SIZE - 1)) * 2.0 - 1.0;
        const v = (py / (SIZE - 1)) * 2.0 - 1.0;

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
        const nx = wx / len;
        const ny = wy / len;
        const nz = wz / len;

        // Very dark base gradient
        const elev = (ny + 1) * 0.5;
        let r = 0.01 + elev * 0.03;
        let g = 0.01 + elev * 0.02;
        let b = 0.03 + elev * 0.06;

        // Starfield (~3% density for a richer star field)
        const hash = Math.abs(Math.sin(nx * 12.9898 + ny * 78.233 + nz * 45.164) * 43758.5453);
        const starRand = hash - Math.floor(hash);
        if (starRand > 0.97) {
          const brightness = (starRand - 0.97) * 33.3;
          const temp = Math.sin(nx * 37.0) * 0.5 + 0.5;
          r += brightness * (0.7 + 0.3 * temp);
          g += brightness * (0.8 + 0.15 * (1 - temp));
          b += brightness * (0.7 + 0.3 * (1 - temp));
        }

        // Nebula regions matching Lorenz color theme (cyan -> violet -> rose)
        const neb1 = Math.exp(-5 * ((nx - 0.6) ** 2 + (ny - 0.2) ** 2 + (nz + 0.3) ** 2));
        const neb2 = Math.exp(-4 * ((nx + 0.4) ** 2 + (ny + 0.3) ** 2 + (nz - 0.5) ** 2));
        const neb3 = Math.exp(-6 * ((nx - 0.1) ** 2 + (ny - 0.7) ** 2 + (nz + 0.5) ** 2));
        r += neb1 * 0.03 + neb2 * 0.06 + neb3 * 0.02;
        g += neb1 * 0.06 + neb2 * 0.01 + neb3 * 0.01;
        b += neb1 * 0.08 + neb2 * 0.04 + neb3 * 0.06;

        const idx = (py * SIZE + px) * 4;
        data[idx]     = Math.min(255, Math.floor(r * 255));
        data[idx + 1] = Math.min(255, Math.floor(g * 255));
        data[idx + 2] = Math.min(255, Math.floor(b * 255));
        data[idx + 3] = 255;
      }
    }
    return data;
  }

  const faceImages = Array.from({ length: 6 }, (_, f) => {
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

  const tex = new THREE.CubeTexture(faceImages);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Lorenz3DRendererProps {
  data: Point3D[];
  width?: number;
  height?: number;
  /** When true, draws a translucent wireframe bounding cage around the trajectory. Default: false. */
  showCage?: boolean;
}

/**
 * High-performance 3D renderer for Lorenz Attractor with HDR effects.
 * Uses WebGPURenderer (three/webgpu) which automatically falls back to
 * WebGL 2 when WebGPU is unavailable. Post-processing uses the TSL-native
 * RenderPipeline + BloomNode, compatible with both backends.
 *
 * Features:
 * - ACESFilmic HDR tone mapping with TSL Bloom post-processing
 * - Smooth OrbitControls with inertia damping
 * - Mouse wheel + pinch-to-zoom with +/- button controls
 * - Gradient shader trail: cyan -> violet -> rose -> amber
 * - Additive-blended particle cloud for glow depth
 * - 60fps locked render loop with FPS throttling
 */
export function Lorenz3DRenderer({ data, showCage = false }: Lorenz3DRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  // Typed as WebGPURenderer — covers both WebGPU and WebGL 2 fallback paths
  const rendererRef = useRef<WebGPURenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const renderPipelineRef = useRef<RenderPipeline | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const cageRef = useRef<THREE.LineSegments | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100); // percentage display
  // Internal toggle state — the parent prop is used as the initial value and
  // can be overridden by the user via the in-canvas checkbox.
  const [cageVisible, setCageVisible] = useState(showCage);
  const [skyboxVisible, setSkyboxVisible] = useState(false);
  const skyboxRef = useRef<THREE.CubeTexture | null>(null);

  // --- GPU Particle System State ---
  const [gpuParticlesEnabled, setGpuParticlesEnabled] = useState(false);
  const [particleCount, setParticleCount] = useState(50_000);
  const [gpuAvailable, setGpuAvailable] = useState(false);
  // Ref to track the latest gpuParticlesEnabled value so that async callbacks
  // (e.g. setupGPUParticles) read the current state instead of a stale closure.
  const gpuEnabledRef = useRef(gpuParticlesEnabled);
  const gpuParticleRef = useRef<{
    device: GPUDevice;
    computePipeline: GPUComputePipeline;
    bindGroup: GPUBindGroup;
    particleBuffer: GPUBuffer;
    stagingBuffer: GPUBuffer;
    paramsBuffer: GPUBuffer;
    pointsGeometry: THREE.BufferGeometry;
    pointsMesh: THREE.Points;
    count: number;
    /** True when a stagingBuffer.mapAsync() is in flight — skip readback to avoid overlap. */
    mappingInFlight: boolean;
    /** Centroid offsets used to align GPU particles with the existing trail. */
    centroid: { cx: number; cy: number; cz: number };
  } | null>(null);
  /** Ref holding the GPU particle reinitialisation function, set inside setup(). */
  const reinitGpuParticlesRef = useRef<((count: number) => Promise<void>) | null>(null);

  // Sync zoom level display with camera position
  const syncZoomDisplay = useCallback(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;
    const dist = camera.position.distanceTo(controls.target);
    // Map dist range [30, 150] to zoom % [200, 50]
    const pct = Math.round(200 - ((dist - 30) / 120) * 150);
    setZoomLevel(Math.max(50, Math.min(200, pct)));
  }, []);

  const handleZoomIn = useCallback(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;
    // Dolly in: move camera 15% closer to target
    const direction = camera.position.clone().sub(controls.target);
    const newLength = Math.max(controls.minDistance, direction.length() * 0.85);
    camera.position.copy(controls.target).addScaledVector(direction.normalize(), newLength);
    controls.update();
    syncZoomDisplay();
  }, [syncZoomDisplay]);

  const handleZoomOut = useCallback(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;
    const direction = camera.position.clone().sub(controls.target);
    const newLength = Math.min(controls.maxDistance, direction.length() * 1.15);
    camera.position.copy(controls.target).addScaledVector(direction.normalize(), newLength);
    controls.update();
    syncZoomDisplay();
  }, [syncZoomDisplay]);

  // Sync cage visibility to Three.js object whenever the toggle changes.
  useEffect(() => {
    if (cageRef.current) {
      cageRef.current.visible = cageVisible;
    }
  }, [cageVisible]);

  // Sync skybox visibility to Three.js scene whenever the toggle changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (skyboxVisible) {
      if (!skyboxRef.current) {
        skyboxRef.current = createSpaceCubeMap();
      }
      scene.background = skyboxRef.current;
      scene.backgroundIntensity = 0.12;
      scene.fog = null;
    } else {
      scene.background = new THREE.Color(0x050912);
      scene.fog = new THREE.FogExp2(0x050912, 0.006);
      if (skyboxRef.current) {
        skyboxRef.current.dispose();
        skyboxRef.current = null;
      }
    }
  }, [skyboxVisible]);

  // Keep the gpuEnabledRef in sync with the latest React state so that
  // async closures (setupGPUParticles, animation loop) always read the
  // current value rather than a stale closure capture.
  useEffect(() => {
    gpuEnabledRef.current = gpuParticlesEnabled;
  }, [gpuParticlesEnabled]);

  // Sync GPU particle cloud visibility when the toggle changes.
  useEffect(() => {
    if (gpuParticleRef.current) {
      gpuParticleRef.current.pointsMesh.visible = gpuParticlesEnabled;
    }
  }, [gpuParticlesEnabled]);

  // Reinitialise GPU particle buffers when the particle count slider changes.
  // This avoids tearing down the entire scene just to resize the particle cloud.
  useEffect(() => {
    const reinit = reinitGpuParticlesRef.current;
    if (!reinit || !gpuAvailable) return;
    // Only reinit if the count actually differs from the current buffer size
    if (gpuParticleRef.current && gpuParticleRef.current.count === particleCount) return;
    reinit(particleCount).catch((err: unknown) => {
      console.warn('Lorenz GPU Particles: reinit failed:', err);
    });
  }, [particleCount, gpuAvailable]);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050912);
    scene.fog = new THREE.FogExp2(0x050912, 0.006);
    sceneRef.current = scene;

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(
      48,
      containerWidth / containerHeight,
      0.1,
      1000
    );
    camera.position.set(65, 45, 65);
    camera.lookAt(0, 0, 25);
    cameraRef.current = camera;

    // Track whether the effect is still mounted to guard async init
    let mounted = true;

    // Async setup needed because WebGPURenderer.init() is async.
    // The renderer is created and init()'d before the scene objects are added,
    // then the animation loop is started.
    const setup = async () => {
      // --- WebGPURenderer with HDR ---
      // WebGPURenderer targets WebGPU by default and automatically falls back
      // to WebGL 2 when WebGPU is not available — no explicit fallback code
      // required.
      const renderer = new WebGPURenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
      });
      renderer.setSize(containerWidth, containerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;

      // Mandatory async init — requests the GPU adapter/device for WebGPU or
      // sets up the WebGL 2 context for the fallback path.
      await renderer.init();

      if (!mounted) {
        renderer.dispose();
        return;
      }

      rendererRef.current = renderer;
      container.appendChild(renderer.domElement);

      // --- Node-based post-processing: TSL bloom for HDR glow ---
      // RenderPipeline + BloomNode replaces EffectComposer + UnrealBloomPass
      // and works with both the WebGPU and WebGL 2 backends.
      const scenePass = pass(scene, camera);
      const sceneColor = scenePass.getTextureNode('output');

      // bloom(input, strength, radius, threshold)
      const bloomNode = bloom(sceneColor, 0.8, 0.5, 0.2);
      const outputNode = sceneColor.add(bloomNode);

      const renderPipeline = new RenderPipeline(renderer, outputNode);
      renderPipelineRef.current = renderPipeline;

      // --- OrbitControls with smooth damping ---
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.zoomSpeed = 1.2;
      controls.minDistance = 30;
      controls.maxDistance = 160;
      controls.target.set(0, 0, 25);
      controlsRef.current = controls;

      controls.addEventListener('start', () => setIsInteracting(true));
      controls.addEventListener('end', () => {
        setIsInteracting(false);
        syncZoomDisplay();
      });
      controls.addEventListener('change', syncZoomDisplay);

      // --- Lighting ---
      scene.add(new THREE.AmbientLight(0x0d1b2a, 1.0));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
      keyLight.position.set(50, 60, 50);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0x7b9fff, 0.8);
      fillLight.position.set(-40, 20, -40);
      scene.add(fillLight);
      const rimLight = new THREE.DirectionalLight(0xff66cc, 1.0);
      rimLight.position.set(0, -20, -60);
      scene.add(rimLight);

      // --- Normalize data to scene origin ---
      const xs = data.map(p => p.x);
      const ys = data.map(p => p.y);
      const zs = data.map(p => p.z);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const cz = (Math.min(...zs) + Math.max(...zs)) / 2;

      // --- Trail geometry with vertex colors ---
      const positions: number[] = [];
      const colors: number[] = [];

      for (let i = 0; i < data.length; i++) {
        const p = data[i];
        if (!p) continue;
        positions.push(p.x - cx, p.y - cy, p.z - cz);

        const t = i / (data.length - 1);
        const c = new THREE.Color();

        // Vivid HDR palette: cyan -> violet -> rose -> amber
        if (t < 0.33) {
          const lt = t / 0.33;
          c.setRGB(
            0.05 + 0.55 * lt,
            0.85 - 0.55 * lt,
            0.95 + 0.05 * lt
          );
        } else if (t < 0.66) {
          const lt = (t - 0.33) / 0.33;
          c.setRGB(
            0.60 + 0.35 * lt,
            0.30 - 0.05 * lt,
            1.00 - 0.55 * lt
          );
        } else {
          const lt = (t - 0.66) / 0.34;
          c.setRGB(
            0.95 + 0.05 * lt,
            0.25 + 0.55 * lt,
            0.45 - 0.45 * lt
          );
        }

        colors.push(c.r, c.g, c.b);
      }

      // --- Main trail line ---
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const lineMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: 1, // WebGL limitation: always 1 on most hardware
        transparent: true,
        opacity: 0.90,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, lineMaterial);
      scene.add(line);

      // --- Particle glow cloud (additive blending for HDR look) ---
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const particleMaterial = new THREE.PointsMaterial({
        size: 0.55,
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        depthWrite: false,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      // --- Subtle reference elements ---
      const axesHelper = new THREE.AxesHelper(35);
      (axesHelper.material as THREE.LineBasicMaterial).transparent = true;
      (axesHelper.material as THREE.LineBasicMaterial).opacity = 0.15;
      scene.add(axesHelper);

      const gridHelper = new THREE.GridHelper(80, 16, 0x1a2744, 0x111827);
      gridHelper.position.y = Math.min(...zs) - cz - 4;
      (gridHelper.material as THREE.Material).transparent = true;
      (gridHelper.material as THREE.Material).opacity = 0.12;
      scene.add(gridHelper);

      // --- Bounding cage (wireframe box around trajectory) ---
      // The typical Lorenz attractor occupies roughly ±25 in x/y and 0–50 in z.
      // We use the actual data extents padded by 10% for a tight but clear cage.
      const padFrac = 0.10;
      const cageHalfX = ((Math.max(...xs) - Math.min(...xs)) / 2) * (1 + padFrac);
      const cageHalfY = ((Math.max(...ys) - Math.min(...ys)) / 2) * (1 + padFrac);
      const cageHalfZ = ((Math.max(...zs) - Math.min(...zs)) / 2) * (1 + padFrac);

      // THREE.js is y-up; our math uses (x, y, z) → THREE (x-cx, y-cy, z-cz)
      // where math-z maps to THREE-y.  The cage spans:
      //   THREE-x: [-cageHalfX, cageHalfX]
      //   THREE-y: [-cageHalfZ, cageHalfZ]   (math z → THREE y)
      //   THREE-z: [-cageHalfY, cageHalfY]   (math y → THREE z)
      const cageGeom = new THREE.BoxGeometry(
        cageHalfX * 2,
        cageHalfZ * 2,
        cageHalfY * 2,
      );
      const cageWireGeom = new THREE.EdgesGeometry(cageGeom);
      const cageMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      });
      const cageMesh = new THREE.LineSegments(cageWireGeom, cageMat);
      // Centre the cage on the centroid of the data
      cageMesh.position.set(0, 0, 0);
      scene.add(cageMesh);
      cageRef.current = cageMesh;
      // Apply the current React state immediately after setup completes so the
      // initial showCage prop is honoured even though React's useEffect for cage
      // visibility may have already fired before cageRef was populated.
      cageMesh.visible = cageVisible;

      // Dispose cage geometry helpers (the LineSegments owns its own copy)
      cageGeom.dispose();

      // --- GPU Particle System Setup ---
      // Only available when the WebGPU backend is active (compute shaders).
      // Access the raw GPUDevice from the Three.js WebGPURenderer backend.
      const setupGPUParticles = async (count: number) => {
        // Type-safe access to the renderer backend's device.
        // WebGPURenderer stores the backend object which holds the GPUDevice after init().
        interface WebGPUBackend {
          device?: GPUDevice;
        }
        interface RendererWithBackend {
          backend?: WebGPUBackend;
        }

        const rendererInternal = renderer as unknown as RendererWithBackend;
        const device = rendererInternal.backend?.device;
        if (!device) {
          // WebGL 2 fallback path — no compute shaders available
          return;
        }
        setGpuAvailable(true);

        // Tear down previous GPU particle resources if reinitialising
        if (gpuParticleRef.current) {
          gpuParticleRef.current.particleBuffer.destroy();
          gpuParticleRef.current.stagingBuffer.destroy();
          gpuParticleRef.current.paramsBuffer.destroy();
          gpuParticleRef.current.pointsGeometry.dispose();
          (gpuParticleRef.current.pointsMesh.material as THREE.Material).dispose();
          scene.remove(gpuParticleRef.current.pointsMesh);
          gpuParticleRef.current = null;
        }

        const bufferSize = count * LORENZ_PARTICLE_BYTES;

        // --- Create GPU buffers ---
        const particleBuffer = device.createBuffer({
          label: 'lorenz particle storage',
          size: bufferSize,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });

        const stagingBuffer = device.createBuffer({
          label: 'lorenz particle staging (readback)',
          size: bufferSize,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        const paramsBuffer = device.createBuffer({
          label: 'lorenz params uniform',
          size: LORENZ_PARAMS_SIZE,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // --- Initialize particle positions randomly near the attractor basin ---
        const initData = new Float32Array(count * LORENZ_PARTICLE_STRIDE);
        for (let i = 0; i < count; i++) {
          const base = i * LORENZ_PARTICLE_STRIDE;
          // Random positions in a box around the attractor: x,y in [-20, 20], z in [5, 45]
          initData[base] = (Math.random() - 0.5) * 40;
          initData[base + 1] = (Math.random() - 0.5) * 40;
          initData[base + 2] = Math.random() * 40 + 5;
          initData[base + 3] = 0; // initial speed = 0
        }
        device.queue.writeBuffer(particleBuffer, 0, initData);

        // --- Create compute pipeline ---
        const shaderModule = device.createShaderModule({
          label: 'lorenz compute shader',
          code: WGSL_LORENZ_COMPUTE,
        });

        const bindGroupLayout = device.createBindGroupLayout({
          label: 'lorenz bgl',
          entries: [
            {
              binding: 0,
              // GPUShaderStage.COMPUTE = 0x4 (numeric literal for SSR safety)
              visibility: 0x4,
              buffer: { type: 'uniform' as GPUBufferBindingType },
            },
            {
              binding: 1,
              visibility: 0x4,
              buffer: { type: 'storage' as GPUBufferBindingType },
            },
          ],
        });

        const computePipeline = await device.createComputePipelineAsync({
          label: 'lorenz compute pipeline',
          layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
          }),
          compute: {
            module: shaderModule,
            entryPoint: 'cs_lorenz',
          },
        });

        const bindGroup = device.createBindGroup({
          label: 'lorenz bind group',
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: paramsBuffer } },
            { binding: 1, resource: { buffer: particleBuffer } },
          ],
        });

        // --- Create Three.js Points mesh for the GPU particles ---
        const gpPointsGeometry = new THREE.BufferGeometry();
        const gpPositions = new Float32Array(count * 3);
        const gpColors = new Float32Array(count * 3);
        // Initialise with 0 — first readback will populate actual positions
        gpPointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gpPositions, 3));
        gpPointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(gpColors, 3));

        const gpMaterial = new THREE.PointsMaterial({
          size: 0.35,
          vertexColors: true,
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
          depthWrite: false,
        });
        const gpMesh = new THREE.Points(gpPointsGeometry, gpMaterial);
        // Read from the ref instead of the stale closure capture of
        // gpuParticlesEnabled, which would always be `false` here because
        // setupGPUParticles runs asynchronously after the initial render.
        gpMesh.visible = gpuEnabledRef.current;
        scene.add(gpMesh);

        gpuParticleRef.current = {
          device,
          computePipeline,
          bindGroup,
          particleBuffer,
          stagingBuffer,
          paramsBuffer,
          pointsGeometry: gpPointsGeometry,
          pointsMesh: gpMesh,
          count,
          mappingInFlight: false,
          centroid: { cx, cy, cz },
        };
      };

      // Store the setup function in a ref so particleCount changes can reinitialise
      // the GPU particle buffers without recreating the entire scene.
      reinitGpuParticlesRef.current = setupGPUParticles;

      // Fire GPU particle setup (non-blocking — failures are logged, not thrown)
      setupGPUParticles(particleCount).catch((err: unknown) => {
        console.warn('Lorenz GPU Particles: setup failed:', err);
      });

      // --- 60fps locked animation loop ---
      const TARGET_FPS = 60;
      const FRAME_INTERVAL = 1000 / TARGET_FPS;
      let lastTime = performance.now();

      const animate = () => {
        if (!mounted) return;
        animationFrameRef.current = requestAnimationFrame(animate);
        const now = performance.now();
        const delta = now - lastTime;
        if (delta < FRAME_INTERVAL) return;
        lastTime = now - (delta % FRAME_INTERVAL);
        controls.update();

        // --- GPU Particle Compute Dispatch ---
        if (gpuParticleRef.current && gpuParticleRef.current.pointsMesh.visible) {
          const gp = gpuParticleRef.current;

          // Update params uniform buffer
          const paramsData = new ArrayBuffer(LORENZ_PARAMS_SIZE);
          const u32View = new Uint32Array(paramsData);
          const f32View = new Float32Array(paramsData);
          u32View[0] = gp.count;
          f32View[1] = LORENZ_DEFAULTS.dt;
          f32View[2] = LORENZ_DEFAULTS.sigma;
          f32View[3] = LORENZ_DEFAULTS.rho;
          f32View[4] = LORENZ_DEFAULTS.beta;
          f32View[5] = now / 1000; // time in seconds
          u32View[6] = 0; // _pad0
          u32View[7] = 0; // _pad1
          gp.device.queue.writeBuffer(gp.paramsBuffer, 0, paramsData);

          // Encode compute pass
          const commandEncoder = gp.device.createCommandEncoder({
            label: 'lorenz compute encoder',
          });
          const computePass = commandEncoder.beginComputePass({
            label: 'lorenz compute pass',
          });
          computePass.setPipeline(gp.computePipeline);
          computePass.setBindGroup(0, gp.bindGroup);
          computePass.dispatchWorkgroups(Math.ceil(gp.count / LORENZ_WORKGROUP_SIZE));
          computePass.end();

          // Copy particle buffer to staging for CPU readback
          commandEncoder.copyBufferToBuffer(
            gp.particleBuffer, 0,
            gp.stagingBuffer, 0,
            gp.count * LORENZ_PARTICLE_BYTES,
          );
          gp.device.queue.submit([commandEncoder.finish()]);

          // Async readback — one frame behind to avoid GPU stalls.
          // Skip if a previous mapAsync is still in flight.
          if (!gp.mappingInFlight) {
            gp.mappingInFlight = true;
            // GPUMapMode.READ = 1 — numeric literal for SSR safety
            gp.stagingBuffer.mapAsync(1).then(() => {
              if (!gpuParticleRef.current) return; // destroyed while mapping
              const mapped = new Float32Array(gp.stagingBuffer.getMappedRange());
              const posAttr = gp.pointsGeometry.getAttribute('position') as THREE.BufferAttribute;
              const colAttr = gp.pointsGeometry.getAttribute('color') as THREE.BufferAttribute;
              const centroid = gp.centroid;

              for (let i = 0; i < gp.count; i++) {
                const bx = mapped[i * 4];
                const by = mapped[i * 4 + 1];
                const bz = mapped[i * 4 + 2];
                const speed = mapped[i * 4 + 3];

                if (bx === undefined || by === undefined || bz === undefined || speed === undefined) continue;

                // Map Lorenz (x, y, z) to scene-centred Three.js coords
                // The existing trail uses: p.x - cx, p.y - cy, p.z - cz
                posAttr.setXYZ(i, bx - centroid.cx, by - centroid.cy, bz - centroid.cz);

                // Color by velocity: cool blue (slow) -> hot red (fast)
                const t = Math.min(speed / 50, 1);
                colAttr.setXYZ(
                  i,
                  t,                         // R: increases with speed
                  0.3 * (1 - t) + 0.1 * t,  // G: warm transition
                  1 - t,                      // B: decreases with speed
                );
              }

              posAttr.needsUpdate = true;
              colAttr.needsUpdate = true;
              gp.stagingBuffer.unmap();
              gp.mappingInFlight = false;
            }).catch(() => {
              // Mapping failed (buffer destroyed or device lost) — reset flag
              if (gpuParticleRef.current) {
                gpuParticleRef.current.mappingInFlight = false;
              }
            });
          }
        }

        // RenderPipeline.render() replaces composer.render()
        renderPipeline.render();
      };
      animate();

      // --- Resize handler ---
      const handleResize = () => {
        if (!mounted) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        // WebGPURenderer.setSize handles canvas resize
        renderer.setSize(w, h);
        // RenderPipeline reads the renderer size automatically — no
        // setSize() call needed on the pipeline itself
      };
      window.addEventListener('resize', handleResize);

      // Store cleanup function on ref so the outer cleanup can use it
      cleanupRef.current = () => {
        window.removeEventListener('resize', handleResize);
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        controls.dispose();
        geometry.dispose();
        lineMaterial.dispose();
        particleGeometry.dispose();
        particleMaterial.dispose();
        if (cageRef.current) {
          cageRef.current.geometry.dispose();
          (cageRef.current.material as THREE.Material).dispose();
          cageRef.current = null;
        }
        if (skyboxRef.current) {
          skyboxRef.current.dispose();
          skyboxRef.current = null;
        }
        if (gpuParticleRef.current) {
          gpuParticleRef.current.particleBuffer.destroy();
          gpuParticleRef.current.stagingBuffer.destroy();
          gpuParticleRef.current.paramsBuffer.destroy();
          gpuParticleRef.current.pointsGeometry.dispose();
          (gpuParticleRef.current.pointsMesh.material as THREE.Material).dispose();
          gpuParticleRef.current = null;
        }
        reinitGpuParticlesRef.current = null;
        renderPipeline.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
    };

    // Store the async cleanup callback so the synchronous cleanup can call it
    const cleanupRef: { current: (() => void) | null } = { current: null };

    setup().catch((err: unknown) => {
      console.error('Lorenz3DRenderer: WebGPURenderer initialization failed:', err);
    });

    return () => {
      mounted = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      cleanupRef.current?.();
    };
  }, [data, syncZoomDisplay]);

  return (
    <div className="relative w-full h-full">
      {/* Renderer canvas container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ touchAction: 'none' }}
      />

      {/* Zoom controls - top left */}
      <div
        className="absolute top-3 left-3 flex flex-col gap-1"
        aria-label="Zoom controls"
      >
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold
            bg-black/60 backdrop-blur-sm border border-white/10 text-white/80
            hover:bg-white/10 hover:text-white hover:border-white/25
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
            transition-colors duration-150"
          aria-label="Zoom in"
        >
          +
        </button>
        <div
          className="w-8 h-6 flex items-center justify-center rounded text-[10px]
            font-mono text-white/50 bg-black/40 border border-white/5"
          aria-live="polite"
          aria-label={`Current zoom: ${zoomLevel}%`}
        >
          {zoomLevel}%
        </div>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold
            bg-black/60 backdrop-blur-sm border border-white/10 text-white/80
            hover:bg-white/10 hover:text-white hover:border-white/25
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
            transition-colors duration-150"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {/* Cage toggle — top right, interactive */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
        <label
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer select-none
            bg-black/60 backdrop-blur-sm border border-white/10
            hover:border-white/25 transition-colors duration-150"
          title="Toggle bounding cage"
        >
          <input
            type="checkbox"
            checked={cageVisible}
            onChange={(e) => setCageVisible(e.target.checked)}
            className="w-3.5 h-3.5 accent-white/70 cursor-pointer"
            aria-label="Show bounding cage"
          />
          <span className="text-[10px] font-mono text-white/60">Cage</span>
        </label>
        <label
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer select-none
            bg-black/60 backdrop-blur-sm border border-white/10
            hover:border-white/25 transition-colors duration-150"
          title="Toggle space background"
        >
          <input
            type="checkbox"
            checked={skyboxVisible}
            onChange={(e) => setSkyboxVisible(e.target.checked)}
            className="w-3.5 h-3.5 accent-white/70 cursor-pointer"
            aria-label="Show space background"
          />
          <span className="text-[10px] font-mono text-white/60">Space</span>
        </label>
        {gpuAvailable && (
          <label
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer select-none
              bg-black/60 backdrop-blur-sm border border-white/10
              hover:border-white/25 transition-colors duration-150"
            title="Toggle GPU particle cloud"
          >
            <input
              type="checkbox"
              checked={gpuParticlesEnabled}
              onChange={(e) => setGpuParticlesEnabled(e.target.checked)}
              className="w-3.5 h-3.5 accent-white/70 cursor-pointer"
              aria-label="Show GPU particles"
            />
            <span className="text-[10px] font-mono text-white/60">Particles</span>
          </label>
        )}
        {gpuParticlesEnabled && gpuAvailable && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg
            bg-black/60 backdrop-blur-sm border border-white/10">
            <input
              type="range"
              min={10000}
              max={200000}
              step={10000}
              value={particleCount}
              onChange={(e) => setParticleCount(Number(e.target.value))}
              className="w-20 h-1 accent-white/70 cursor-pointer"
              aria-label="Particle count"
            />
            <span className="text-[10px] font-mono text-white/50 w-12 text-right">
              {(particleCount / 1000).toFixed(0)}K
            </span>
          </div>
        )}
      </div>

      {/* Top-right info badges — shifted down to clear the toggles */}
      <div className="absolute right-3 flex flex-col gap-1 items-end pointer-events-none" style={{ top: gpuAvailable ? '9rem' : '5.5rem' }}>
        <div className="text-[10px] text-white/60 font-mono bg-black/55 backdrop-blur-sm px-2 py-1 rounded border border-white/8">
          WebGPU/WebGL2 · HDR Bloom · {data.length.toLocaleString()} pts
        </div>
        <div className="text-[10px] text-cyan-400/70 font-mono bg-black/55 backdrop-blur-sm px-2 py-1 rounded border border-white/8">
          ACESFilmic · TSL Bloom
        </div>
      </div>

      {/* Bottom interaction hint */}
      {isInteracting && (
        <div className="absolute bottom-3 left-3 text-[10px] text-cyan-400/60 font-mono bg-black/50 backdrop-blur-sm px-2 py-1 rounded pointer-events-none">
          Drag to rotate · Scroll/pinch to zoom · Right-drag to pan
        </div>
      )}
      {!isInteracting && (
        <div className="absolute bottom-3 left-3 text-[10px] text-white/30 font-mono pointer-events-none">
          Drag to rotate · Scroll to zoom
        </div>
      )}
    </div>
  );
}
