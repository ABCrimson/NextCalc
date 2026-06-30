'use client';

import { createProceduralHDRCubeMap } from '@nextcalc/plot-engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import {
  Fn,
  float,
  instancedArray,
  instanceIndex,
  length,
  min,
  pass,
  uniform,
  vec3,
  vec4,
} from 'three/tsl';
import * as THREE from 'three/webgpu';
import { PointsNodeMaterial, RenderPipeline, WebGPUBackend, WebGPURenderer } from 'three/webgpu';
import { LORENZ_DEFAULTS } from './lorenz-compute-shaders';

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

/** Workgroup size for the TSL compute kernel — 256 threads per workgroup. */
const TSL_WORKGROUP_SIZE = 256;

/**
 * High-performance 3D renderer for Lorenz Attractor with HDR effects.
 * Uses WebGPURenderer (three/webgpu) which automatically falls back to
 * WebGL 2 when WebGPU is unavailable. Post-processing uses the TSL-native
 * RenderPipeline + BloomNode, compatible with both backends.
 *
 * GPU Particles (WebGPU only): uses TSL instancedArray + Fn compute idiom.
 * Particles are fully GPU-resident — no CPU readback each frame.
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

  // --- TSL GPU Particle System State ---
  const [gpuParticlesEnabled, setGpuParticlesEnabled] = useState(false);
  const [particleCount, setParticleCount] = useState(50_000);
  const [gpuAvailable, setGpuAvailable] = useState(false);
  // Ref to track the latest gpuParticlesEnabled value so that async callbacks
  // (e.g. setupGPUParticles) read the current state instead of a stale closure.
  const gpuEnabledRef = useRef(gpuParticlesEnabled);
  const gpuParticleRef = useRef<{
    computeNode: import('three/webgpu').ComputeNode;
    pointsMesh: THREE.Points;
    count: number;
    dtUniform: THREE.UniformNode<'float', number>;
    sigmaUniform: THREE.UniformNode<'float', number>;
    rhoUniform: THREE.UniformNode<'float', number>;
    betaUniform: THREE.UniformNode<'float', number>;
    centroidUniform: THREE.UniformNode<'vec3', THREE.Vector3>;
  } | null>(null);
  /** Ref holding the GPU particle reinitialisation function, set inside setup(). */
  const reinitGpuParticlesRef = useRef<((count: number) => void) | null>(null);

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
        skyboxRef.current = createProceduralHDRCubeMap('neutron-star-collision', 512);
      }
      scene.background = skyboxRef.current;
      scene.backgroundIntensity = 0.18;
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
    reinit(particleCount);
  }, [particleCount, gpuAvailable]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: full Three.js/WebGPU scene init; `cageVisible` and `particleCount` are read once to seed the initial cage visibility and particle buffer size. Dedicated effects above sync both reactively (cageRef.visible and reinitGpuParticlesRef) — adding them here would tear down and rebuild the entire renderer on every toggle/slider change.
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
    const camera = new THREE.PerspectiveCamera(48, containerWidth / containerHeight, 0.1, 1000);
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
      const xs = data.map((p) => p.x);
      const ys = data.map((p) => p.y);
      const zs = data.map((p) => p.z);
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
          c.setRGB(0.05 + 0.55 * lt, 0.85 - 0.55 * lt, 0.95 + 0.05 * lt);
        } else if (t < 0.66) {
          const lt = (t - 0.33) / 0.33;
          c.setRGB(0.6 + 0.35 * lt, 0.3 - 0.05 * lt, 1.0 - 0.55 * lt);
        } else {
          const lt = (t - 0.66) / 0.34;
          c.setRGB(0.95 + 0.05 * lt, 0.25 + 0.55 * lt, 0.45 - 0.45 * lt);
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
        opacity: 0.9,
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
      const padFrac = 0.1;
      const cageHalfX = ((Math.max(...xs) - Math.min(...xs)) / 2) * (1 + padFrac);
      const cageHalfY = ((Math.max(...ys) - Math.min(...ys)) / 2) * (1 + padFrac);
      const cageHalfZ = ((Math.max(...zs) - Math.min(...zs)) / 2) * (1 + padFrac);

      // THREE.js is y-up; our math uses (x, y, z) → THREE (x-cx, y-cy, z-cz)
      // where math-z maps to THREE-y.  The cage spans:
      //   THREE-x: [-cageHalfX, cageHalfX]
      //   THREE-y: [-cageHalfZ, cageHalfZ]   (math z → THREE y)
      //   THREE-z: [-cageHalfY, cageHalfY]   (math y → THREE z)
      const cageGeom = new THREE.BoxGeometry(cageHalfX * 2, cageHalfZ * 2, cageHalfY * 2);
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

      // --- TSL GPU Particle System ---
      // Only available when the WebGPU backend is active — TSL compute requires
      // WebGPU. Detected via instanceof WebGPUBackend (no unsafe casts needed).
      const isWebGPU = renderer.backend instanceof WebGPUBackend;

      if (isWebGPU) {
        setGpuAvailable(true);
      }

      // Build and attach the TSL GPU particle system.
      // Returns disposers for cleanup when count changes or component unmounts.
      const setupGPUParticles = (count: number) => {
        // Tear down previous TSL particle resources if reinitialising
        if (gpuParticleRef.current) {
          gpuParticleRef.current.pointsMesh.geometry.dispose();
          const prevMat = gpuParticleRef.current.pointsMesh.material;
          if (!Array.isArray(prevMat)) prevMat.dispose();
          scene.remove(gpuParticleRef.current.pointsMesh);
          gpuParticleRef.current = null;
        }

        // --- Seed initial particle positions along the attractor trajectory ---
        // The Float32Array is passed directly to instancedArray() so that
        // StorageInstancedBufferAttribute picks it up as the initial GPU data.
        // Layout: vec4 per particle → [x, y, z, speed]
        const initData = new Float32Array(count * 4);
        const trajectoryLen = data.length;
        for (let i = 0; i < count; i++) {
          const base = i * 4;
          if (trajectoryLen > 0) {
            // Sample evenly along the trajectory with a small hash-based offset
            const idx = Math.floor((i / count) * trajectoryLen) % trajectoryLen;
            const point = data[idx];
            const hash = Math.sin(i * 12.9898) * 43758.5453;
            const offset = hash - Math.floor(hash) - 0.5;
            initData[base] = (point?.x ?? 0) + offset * 2;
            initData[base + 1] = (point?.y ?? 0) + offset * 2;
            initData[base + 2] = (point?.z ?? 25) + offset * 2;
          } else {
            // Fallback if no trajectory data yet
            initData[base] = (((Math.sin(i * 12.9898) * 43758.5453) % 1) - 0.5) * 40;
            initData[base + 1] = (((Math.sin(i * 78.233) * 43758.5453) % 1) - 0.5) * 40;
            initData[base + 2] = ((Math.sin(i * 45.164) * 43758.5453) % 1) * 40 + 5;
          }
          // Staggered initial speed (w component)
          initData[base + 3] = ((Math.sin(i * 37.0) * 43758.5453) % 1) * 4.0;
        }

        // Storage buffer: vec4 per particle [x, y, z, speed], GPU-resident.
        // Passing the pre-filled Float32Array seeds initial values on upload.
        const particleBuffer = instancedArray(initData, 'vec4');

        // --- TSL uniforms updated each frame from JS ---
        const dtUniform = uniform(LORENZ_DEFAULTS.dt);
        const sigmaUniform = uniform(LORENZ_DEFAULTS.sigma);
        const rhoUniform = uniform(LORENZ_DEFAULTS.rho);
        const betaUniform = uniform(LORENZ_DEFAULTS.beta);
        // Centroid offset aligns GPU particles with the existing trail
        const centroidUniform = uniform(new THREE.Vector3(cx, cy, cz));

        // --- Compute kernel: RK4 Lorenz integration per particle ---
        // Fn(() => void)() returns ShaderCallNodeInternal<void> (a Node),
        // then .compute(count, [workgroupSize]) produces the ComputeNode.
        const lorenzComputeNode = Fn(() => {
          const particle = particleBuffer.element(instanceIndex).toVar();
          const pos = particle.xyz.toVar();

          const dt = dtUniform;
          const sigma = sigmaUniform;
          const rho = rhoUniform;
          const beta = betaUniform;

          // Lorenz derivative: d/dt [x,y,z]
          const lorenzDeriv = Fn(([p]: [THREE.Node<'vec3'>]) => {
            return vec3(
              sigma.mul(p.y.sub(p.x)),
              p.x.mul(rho.sub(p.z)).sub(p.y),
              p.x.mul(p.y).sub(beta.mul(p.z)),
            );
          });

          // RK4 integration
          const k1 = lorenzDeriv(pos).toVar();
          const k2 = lorenzDeriv(pos.add(k1.mul(dt.mul(0.5)))).toVar();
          const k3 = lorenzDeriv(pos.add(k2.mul(dt.mul(0.5)))).toVar();
          const k4 = lorenzDeriv(pos.add(k3.mul(dt))).toVar();

          const newPos = pos.add(k1.add(k2.mul(2)).add(k3.mul(2)).add(k4).mul(dt.div(6.0))).toVar();

          // Speed from instantaneous derivative magnitude for color mapping
          const speed = length(k1).toVar();

          // Write back position and speed
          particleBuffer.element(instanceIndex).assign(vec4(newPos, speed));
        })().compute(count, [TSL_WORKGROUP_SIZE]);

        // --- Render material: PointsNodeMaterial reading from the storage buffer ---
        // For a THREE.Points draw the per-point index is the VERTEX index, and a
        // non-instanced draw has instanceIndex === 0 — so reading the storage
        // buffer via .element(instanceIndex) in the render nodes would collapse
        // every point onto particle 0. Bind the same storage buffer as a
        // per-vertex attribute instead (the documented compute-points idiom);
        // the GPU then fetches the correct vec4 per point. (instanceIndex stays
        // correct inside the compute kernel, where it is the invocation index.)
        const particleAttribute = particleBuffer.toAttribute();

        // positionNode: read the vec4 attribute, subtract centroid to align with trail.
        const positionNode = particleAttribute.xyz.sub(centroidUniform);

        // colorNode: speed-based color (cool blue slow → hot red fast).
        const speedNode = particleAttribute.w;
        // t = min(speed / 50, 1) maps speed to [0,1]
        const t = min(speedNode.div(50), float(1));
        const colorNode = vec3(
          t, // R: increases with speed
          float(0.3).mul(float(1).sub(t)).add(float(0.1).mul(t)), // G: warm transition
          float(1).sub(t), // B: decreases with speed
        );

        const gpMaterial = new PointsNodeMaterial({
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
          depthWrite: false,
        });
        // positionNode and colorNode set after construction to avoid
        // PointsNodeMaterialParameters typing constraints
        gpMaterial.positionNode = positionNode;
        gpMaterial.colorNode = colorNode;
        // Preserve the original particle world-size (PointsNodeMaterial defaults
        // to 1.0). NOTE: on the WebGPU backend point primitives may be clamped
        // to 1px regardless of size — flagged as a visual-QA item.
        gpMaterial.size = 0.35;

        // BufferGeometry with a dummy position attribute sized to particle count.
        // The actual vertex positions are overridden by positionNode at shader time,
        // but the draw call count is derived from the position attribute's item count.
        const gpGeometry = new THREE.BufferGeometry();
        gpGeometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3),
        );

        const gpMesh = new THREE.Points(gpGeometry, gpMaterial);
        // Read from ref instead of stale closure capture of gpuParticlesEnabled
        gpMesh.visible = gpuEnabledRef.current;
        scene.add(gpMesh);

        gpuParticleRef.current = {
          computeNode: lorenzComputeNode,
          pointsMesh: gpMesh,
          count,
          dtUniform,
          sigmaUniform,
          rhoUniform,
          betaUniform,
          centroidUniform,
        };
      };

      // Store in ref so particleCount changes can reinitialise without
      // recreating the entire scene.
      reinitGpuParticlesRef.current = setupGPUParticles;

      // Fire initial GPU particle setup only when WebGPU backend is active
      if (isWebGPU) {
        setupGPUParticles(particleCount);
      }

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

        // --- TSL Compute Dispatch: step the Lorenz particle simulation ---
        // renderer.computeAsync() dispatches the TSL compute kernel.
        // Particles are fully GPU-resident — no CPU readback.
        if (gpuParticleRef.current?.pointsMesh.visible) {
          const gp = gpuParticleRef.current;
          renderer.computeAsync(gp.computeNode).catch((err: unknown) => {
            console.warn('Lorenz TSL Compute: dispatch failed:', err);
          });
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
          gpuParticleRef.current.pointsMesh.geometry.dispose();
          const gpMat = gpuParticleRef.current.pointsMesh.material;
          if (!Array.isArray(gpMat)) gpMat.dispose();
          scene.remove(gpuParticleRef.current.pointsMesh);
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
    <div className="relative size-full">
      {/* Renderer canvas container */}
      <div ref={containerRef} className="size-full" style={{ touchAction: 'none' }} />

      {/* Zoom controls - top left */}
      <fieldset
        className="absolute top-3 left-3 flex flex-col gap-1 border-0 p-0 m-0"
        aria-label="Zoom controls"
      >
        <button
          type="button"
          onClick={handleZoomIn}
          className="size-8 flex items-center justify-center rounded-lg text-sm font-bold
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
          role="status"
          aria-live="polite"
          aria-label={`Current zoom: ${zoomLevel}%`}
        >
          {zoomLevel}%
        </div>
        <button
          type="button"
          onClick={handleZoomOut}
          className="size-8 flex items-center justify-center rounded-lg text-sm font-bold
            bg-black/60 backdrop-blur-sm border border-white/10 text-white/80
            hover:bg-white/10 hover:text-white hover:border-white/25
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
            transition-colors duration-150"
          aria-label="Zoom out"
        >
          −
        </button>
      </fieldset>

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
            className="size-3.5 accent-white/70 cursor-pointer"
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
            className="size-3.5 accent-white/70 cursor-pointer"
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
              className="size-3.5 accent-white/70 cursor-pointer"
              aria-label="Show GPU particles"
            />
            <span className="text-[10px] font-mono text-white/60">Particles</span>
          </label>
        )}
        {gpuParticlesEnabled && gpuAvailable && (
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg
            bg-black/60 backdrop-blur-sm border border-white/10"
          >
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
      <div
        className="absolute right-3 flex flex-col gap-1 items-end pointer-events-none"
        style={{ top: gpuAvailable ? '9rem' : '5.5rem' }}
      >
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
