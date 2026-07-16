import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { BODIES, BODY_BY_ID, PLANETS, SATELLITES, type BodyId, type CelestialBody } from "../data/bodies";
import { createOrbitPoints, orbitalPosition, spinRadians } from "../simulation/orbits";
import {
  applyRingShadow,
  createAtmosphereMaterial,
  createCloudMaterial,
  createNightLightsMaterial,
  createPlanetMaterial,
  createRingMaterial,
  createStarMaterial,
  createSunMaterial,
  type AnimatedShaderMaterial,
} from "./materials";
import {
  createCoronaTexture,
  createRingTexture,
  loadBodyTextures,
  type BodyTextureSet,
} from "./textures";

export type CameraMode = "overview" | "focus" | "tour" | "cinematic" | "flight";

export type LoadingStage =
  | { stage: "renderer" }
  | { stage: "scene" }
  | { stage: "bodyTexture"; bodyId: BodyId }
  | { stage: "camera" }
  | { stage: "ready" }
  | { stage: "networkTexture" };

export interface SolarSystemEvents {
  onBodySelected: (body: CelestialBody) => void;
  onBodyHovered: (body: CelestialBody | null, x: number, y: number) => void;
  onCameraModeChanged: (mode: CameraMode) => void;
  onDateChanged: (date: Date, rate: number) => void;
  onFpsChanged: (fps: number) => void;
  onLoadingChanged: (progress: number, stage: LoadingStage) => void;
  onContextStateChanged: (state: "lost" | "restored") => void;
  onTextureSourceChanged: (bodyId: BodyId, source: "observation" | "renderDerived" | "loading") => void;
}

interface BodyNode {
  body: CelestialBody;
  root: THREE.Group;
  tilt: THREE.Group;
  surface: THREE.Object3D;
  cloud?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial>;
  cityLights?: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  animatedMaterials: THREE.ShaderMaterial[];
  visualRadius: number;
  framingRadius: number;
  surfaceMaterial?: THREE.MeshPhysicalMaterial;
  ringShadowDirection?: THREE.Vector3;
  textureSource: "observation" | "renderDerived";
}

interface CameraTransition {
  bodyId: BodyId;
  cinematic: boolean;
  startedAt: number;
  duration: number;
  startPosition: THREE.Vector3;
  startTarget: THREE.Vector3;
  offsetDirection: THREE.Vector3;
  distance: number;
  startExposure: number;
  endExposure: number;
  closeApproach: boolean;
}

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const DAY_MS = 86_400_000;
const SATELLITE_ORBIT_RADII: Partial<Record<BodyId, number>> = {
  moon: 1.72,
  phobos: 1.08,
  deimos: 1.68,
};
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const OVERVIEW_MIN_DISTANCE = 2;
const OVERVIEW_MAX_DISTANCE = 190;
const TOUR_SEQUENCE: BodyId[] = [
  "sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune",
];

const RING_SYSTEMS: Partial<Record<BodyId, { inner: number; outer: number }>> = {
  saturn: { inner: 1.11, outer: 2.35 },
};

const BODY_FLATTENING: Partial<Record<BodyId, number>> = {
  jupiter: 0.935,
  saturn: 0.902,
  uranus: 0.977,
  neptune: 0.983,
};

const FOCUS_EXPOSURE: Record<BodyId, number> = {
  sun: 0.88,
  mercury: 1,
  venus: 0.96,
  earth: 1,
  moon: 1,
  mars: 1.02,
  phobos: 1.04,
  deimos: 1.04,
  jupiter: 1.02,
  saturn: 1.04,
  uranus: 1.08,
  neptune: 1.12,
};

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutBack(value: number): number {
  const overshoot = 1.15;
  const shifted = value - 1;
  return 1 + (overshoot + 1) * shifted * shifted * shifted + overshoot * shifted * shifted;
}

function seedRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    return value / 4_294_967_296;
  };
}

export class SolarSystem {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private readonly canvas: HTMLCanvasElement;
  private readonly events: SolarSystemEvents;
  private readonly reducedMotion: boolean;
  private readonly clock = new THREE.Clock();
  private readonly loadingManager = new THREE.LoadingManager();
  private readonly bodyNodes = new Map<BodyId, BodyNode>();
  private readonly clickableObjects: THREE.Object3D[] = [];
  private readonly orbitLines = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly pressedKeys = new Set<string>();
  private readonly animatedMaterials: THREE.ShaderMaterial[] = [];
  private readonly tempPosition = new THREE.Vector3();
  private readonly focusPosition = new THREE.Vector3();
  private readonly previousFocusPosition = new THREE.Vector3();
  private readonly tempQuaternion = new THREE.Quaternion();
  private readonly selectionMarker: THREE.Group;
  private readonly selectionMarkerArcs: THREE.Group;
  private readonly satelliteOrbitLines = new THREE.Group();
  private readonly satelliteOrbits = new Map<BodyId, THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>>();
  private composer: EffectComposer | null = null;
  private frameHandle = 0;
  private frameCount = 0;
  private fpsWindowStarted = performance.now();
  private simulationDays = (Date.now() - J2000_MS) / DAY_MS;
  private timeRate = 1 / 24;
  private previousTimeRate = 1 / 24;
  private selectedBodyId: BodyId = "sun";
  private cameraMode: CameraMode = "overview";
  private cameraTransition: CameraTransition | null = null;
  private tourIndex = 0;
  private nextTourAt = 0;
  private pointerDownPosition = new THREE.Vector2();
  private readonly activePointerIds = new Set<number>();
  private pointerGestureHadMultiplePointers = false;
  private focusInitialized = false;
  private focusCloseApproach = false;
  private cinematicAngle = 0;
  private elapsed = 0;
  private selectionMarkerLockStartedAt = Number.NEGATIVE_INFINITY;
  private destroyed = false;
  private pausedForVisibility = false;
  private readonly overviewExposure: number;

  constructor(
    canvas: HTMLCanvasElement,
    reducedMotion: boolean,
    events: SolarSystemEvents,
  ) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.events = events;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.overviewExposure = 0.88;
    this.renderer.toneMappingExposure = this.overviewExposure;
    // A solar-system-wide point-light shadow cube severely undersamples distant
    // planets in close-up. Direct material lighting keeps their terminators smooth.
    this.renderer.shadowMap.enabled = false;
    this.renderer.setClearColor(0x010205, 1);

    this.camera = new THREE.PerspectiveCamera(43, 1, 0.025, 1_200);
    this.camera.position.set(0, 31, 70);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = !reducedMotion;
    this.controls.dampingFactor = 0.055;
    this.controls.minDistance = OVERVIEW_MIN_DISTANCE;
    this.controls.maxDistance = OVERVIEW_MAX_DISTANCE;
    this.controls.screenSpacePanning = true;
    this.controls.target.set(0, 0, 0);

    this.selectionMarker = new THREE.Group();
    this.selectionMarkerArcs = new THREE.Group();
    const selectionMaterial = new THREE.MeshBasicMaterial({
      color: 0xd7e6f3,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const arcLength = Math.PI * 0.46;
    for (let index = 0; index < 3; index += 1) {
      const arc = new THREE.Mesh(
        new THREE.RingGeometry(1.04, 1.065, 32, 1, Math.PI / 6 + index * Math.PI * 2 / 3, arcLength),
        selectionMaterial,
      );
      arc.renderOrder = 20;
      this.selectionMarkerArcs.add(arc);
    }
    this.selectionMarker.add(this.selectionMarkerArcs);
    this.selectionMarker.visible = false;
    this.scene.add(this.selectionMarker);

    for (const satellite of SATELLITES) {
      const orbit = new THREE.Line(
        this.createSatelliteOrbitGeometry(satellite),
        new THREE.LineBasicMaterial({
          color: satellite.accent,
          transparent: true,
          opacity: satellite.id === "moon" ? 0.18 : 0.24,
          depthWrite: false,
        }),
      );
      if (satellite.parentId === "mars") {
        orbit.rotation.z = THREE.MathUtils.degToRad(BODY_BY_ID.get("mars")?.axialTiltDeg ?? 0);
      }
      this.satelliteOrbits.set(satellite.id, orbit);
      this.satelliteOrbitLines.add(orbit);
    }
    this.scene.add(this.satelliteOrbitLines);
    this.scene.add(this.orbitLines);

    this.configureLoadingManager();
    this.bindEvents();
  }

  async initialize(): Promise<void> {
    this.events.onLoadingChanged(0.06, { stage: "renderer" });
    this.createBackground();
    this.events.onLoadingChanged(0.18, { stage: "scene" });
    this.createSun();
    this.createOrbitLines();
    this.createAsteroidBelt();

    const planetBodies = BODIES.filter((body) => body.id !== "sun");
    let completedTextures = 0;
    const loadedBodies = await Promise.all(
      planetBodies.map(async (body) => {
        const textures = await loadBodyTextures(body.id, this.loadingManager);
        completedTextures += 1;
        this.events.onLoadingChanged(
          0.22 + (completedTextures / planetBodies.length) * 0.58,
          { stage: "bodyTexture", bodyId: body.id },
        );
        return { body, textures };
      }),
    );
    for (const { body, textures } of loadedBodies) this.createPlanet(body, textures);

    this.createPostProcessing();
    this.updateSize();
    this.updateBodies();
    const sun = BODY_BY_ID.get("sun");
    if (sun) this.events.onBodySelected(sun);
    this.events.onLoadingChanged(0.96, { stage: "camera" });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    this.events.onLoadingChanged(1, { stage: "ready" });
    this.frameHandle = requestAnimationFrame(this.animate);
  }

  selectBody(bodyId: BodyId, moveCamera = true): void {
    const body = BODY_BY_ID.get(bodyId);
    const node = this.bodyNodes.get(bodyId);
    if (!body || !node) return;
    this.selectedBodyId = bodyId;
    this.selectionMarkerLockStartedAt = this.elapsed;
    this.selectionMarker.visible = true;

    if (moveCamera) {
      this.setModeInternal(this.cameraMode === "tour" ? "tour" : "focus");
      this.beginFocusTransition(bodyId, false);
    } else {
      this.events.onBodySelected(body);
    }
  }

  setOverview(): void {
    this.stopTour(false);
    this.setModeInternal("overview");
    this.cameraTransition = null;
    this.focusInitialized = false;
    this.focusCloseApproach = false;
    this.controls.minDistance = OVERVIEW_MIN_DISTANCE;
    this.controls.maxDistance = OVERVIEW_MAX_DISTANCE;
    this.controls.enabled = true;
    const duration = this.reducedMotion ? 0.05 : 1.1;
    const target = new THREE.Vector3(0, 0, 0);
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const destination = new THREE.Vector3(0, 31, 70);
    const startExposure = this.renderer.toneMappingExposure;
    const startedAt = performance.now();

    const animateOverview = (): void => {
      if (this.cameraMode !== "overview") return;
      const progress = Math.min(1, (performance.now() - startedAt) / (duration * 1_000));
      const eased = easeInOutCubic(progress);
      this.camera.position.lerpVectors(startPosition, destination, eased);
      this.controls.target.lerpVectors(startTarget, target, eased);
      this.renderer.toneMappingExposure = THREE.MathUtils.lerp(startExposure, this.overviewExposure, eased);
      if (progress < 1) requestAnimationFrame(animateOverview);
    };
    animateOverview();
  }

  startTour(): void {
    this.setModeInternal("tour");
    this.controls.enabled = false;
    this.tourIndex = Math.max(0, TOUR_SEQUENCE.indexOf(this.selectedBodyId));
    this.nextTourAt = performance.now() + (this.reducedMotion ? 5_000 : 7_500);
    this.beginFocusTransition(TOUR_SEQUENCE[this.tourIndex], true);
  }

  stopTour(returnToFocus = true): void {
    if (this.cameraMode !== "tour") return;
    this.setModeInternal(returnToFocus ? "focus" : "overview");
    this.controls.enabled = true;
    this.nextTourAt = 0;
  }

  toggleTour(): void {
    if (this.cameraMode === "tour") this.stopTour();
    else this.startTour();
  }

  startCinematic(): void {
    this.stopTour();
    const node = this.bodyNodes.get(this.selectedBodyId);
    if (!node) return;
    this.setModeInternal("cinematic");
    this.controls.enabled = false;
    node.root.getWorldPosition(this.focusPosition);
    this.cinematicAngle = Math.atan2(
      this.camera.position.z - this.focusPosition.z,
      this.camera.position.x - this.focusPosition.x,
    );
    if (!Number.isFinite(this.selectionMarkerLockStartedAt)) {
      this.selectionMarkerLockStartedAt = this.elapsed;
    }
    this.cameraTransition = {
      bodyId: this.selectedBodyId,
      cinematic: true,
      startedAt: performance.now(),
      duration: this.reducedMotion ? 80 : 1_160,
      startPosition: this.camera.position.clone(),
      startTarget: this.controls.target.clone(),
      offsetDirection: new THREE.Vector3(),
      distance: 0,
      startExposure: this.renderer.toneMappingExposure,
      endExposure: FOCUS_EXPOSURE[this.selectedBodyId],
      closeApproach: false,
    };
  }

  startFlight(): void {
    this.stopTour(false);
    this.setModeInternal("flight");
    this.controls.enabled = true;
    this.cameraTransition = null;
    this.focusInitialized = false;
  }

  approachSelected(): void {
    if (this.cameraMode === "overview" || this.cameraMode === "flight") {
      this.setModeInternal("focus");
    }
    this.beginFocusTransition(this.selectedBodyId, false, true);
  }

  setTimeRate(daysPerSecond: number): void {
    if (daysPerSecond > 0) this.previousTimeRate = daysPerSecond;
    this.timeRate = daysPerSecond;
    this.events.onDateChanged(this.getSimulationDate(), this.timeRate);
  }

  setOrbitLinesVisible(visible: boolean): void {
    this.orbitLines.visible = visible;
    this.satelliteOrbitLines.visible = visible;
  }

  getTimeRate(): number {
    return this.timeRate;
  }

  getSimulationDate(): Date {
    return new Date(J2000_MS + this.simulationDays * DAY_MS);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frameHandle);
    window.removeEventListener("resize", this.updateSize);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleWindowBlur);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerCancel);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    window.visualViewport?.removeEventListener("resize", this.updateSize);
    this.controls.dispose();
    this.renderer.dispose();
  }

  private readonly animate = (): void => {
    if (this.destroyed) return;
    this.frameHandle = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += delta;
    this.simulationDays += delta * this.timeRate;

    this.updateBodies();
    this.updateCamera(delta);
    this.updateAnimatedMaterials();
    this.updateSelectionMarker();
    this.controls.update(delta);

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);

    this.updateDiagnostics();
  };

  private configureLoadingManager(): void {
    this.loadingManager.onProgress = (_url, loaded, total) => {
      if (total > 0) {
        const networkProgress = loaded / total;
        this.events.onLoadingChanged(0.22 + networkProgress * 0.54, { stage: "networkTexture" });
      }
    };
  }

  private bindEvents(): void {
    window.addEventListener("resize", this.updateSize);
    window.visualViewport?.addEventListener("resize", this.updateSize);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleWindowBlur);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerCancel);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
    this.controls.addEventListener("start", () => {
      if (this.cameraMode === "tour") this.stopTour();
      if (this.cameraMode === "cinematic") {
        this.setModeInternal("focus");
        this.controls.enabled = true;
      }
    });
  }

  private readonly updateSize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const pixelRatio = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.composer?.setPixelRatio(pixelRatio);
    this.composer?.setSize(width, height);
    if (this.cameraTransition) {
      const node = this.bodyNodes.get(this.cameraTransition.bodyId);
      if (node) this.cameraTransition.distance = this.focusDistance(node, this.cameraTransition.closeApproach);
    } else {
      this.ensureFocusedBodyFits();
    }
  };

  private createPostProcessing(): void {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(this.canvas.clientWidth, this.canvas.clientHeight),
      0.58,
      0.28,
      1.55,
    );
    this.composer.addPass(bloom);
    this.composer.addPass(new SMAAPass());
    this.composer.addPass(new OutputPass());
  }

  private createBackground(): void {
    const starCount = 18_000;
    const random = seedRandom(83_041);
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const spectralColors = [
      new THREE.Color(0xdce8ff),
      new THREE.Color(0xf1f4ff),
      new THREE.Color(0xfff3d0),
      new THREE.Color(0xffd6aa),
      new THREE.Color(0xb9d7ff),
    ];

    for (let index = 0; index < starCount; index += 1) {
      const theta = random() * Math.PI * 2;
      const cosine = random() * 2 - 1;
      const sine = Math.sqrt(1 - cosine * cosine);
      const radius = 250 + random() * 340;
      positions[index * 3] = radius * sine * Math.cos(theta);
      positions[index * 3 + 1] = radius * cosine;
      positions[index * 3 + 2] = radius * sine * Math.sin(theta);
      const color = spectralColors[Math.floor(random() * spectralColors.length)];
      const brightness = 0.46 + Math.pow(random(), 3) * 0.54;
      colors[index * 3] = color.r * brightness;
      colors[index * 3 + 1] = color.g * brightness;
      colors[index * 3 + 2] = color.b * brightness;
      sizes[index] = 0.7 + Math.pow(random(), 7) * 2.5;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    const material = createStarMaterial(Math.min(window.devicePixelRatio || 1, 2));
    const stars = new THREE.Points(geometry, material);
    stars.frustumCulled = false;
    stars.renderOrder = -10;
    this.scene.add(stars);

    const milkyWayCount = 14_000;
    const milkyPositions = new Float32Array(milkyWayCount * 3);
    const milkyColors = new Float32Array(milkyWayCount * 3);
    const milkySizes = new Float32Array(milkyWayCount);
    for (let index = 0; index < milkyWayCount; index += 1) {
      const longitude = random() * Math.PI * 2;
      const latitude = (random() + random() + random() - 1.5) * 0.105;
      const dustLane = Math.abs(latitude) < 0.018 && random() < 0.72;
      const radius = 285 + random() * 95;
      milkyPositions[index * 3] = radius * Math.cos(latitude) * Math.cos(longitude);
      milkyPositions[index * 3 + 1] = radius * Math.sin(latitude);
      milkyPositions[index * 3 + 2] = radius * Math.cos(latitude) * Math.sin(longitude);
      const warmCenter = Math.pow(Math.max(0, Math.cos(longitude)), 10);
      const brightness = dustLane ? 0.035 : 0.12 + random() * 0.22 + warmCenter * 0.16;
      milkyColors[index * 3] = brightness * (0.72 + warmCenter * 0.38);
      milkyColors[index * 3 + 1] = brightness * (0.77 + warmCenter * 0.2);
      milkyColors[index * 3 + 2] = brightness * (0.94 - warmCenter * 0.18);
      milkySizes[index] = 0.8 + random() * 1.8;
    }
    const milkyGeometry = new THREE.BufferGeometry();
    milkyGeometry.setAttribute("position", new THREE.BufferAttribute(milkyPositions, 3));
    milkyGeometry.setAttribute("color", new THREE.BufferAttribute(milkyColors, 3));
    milkyGeometry.setAttribute("size", new THREE.BufferAttribute(milkySizes, 1));
    const milkyWay = new THREE.Points(
      milkyGeometry,
      createStarMaterial(Math.min(window.devicePixelRatio || 1, 2), 0.56),
    );
    milkyWay.rotation.set(0.36, -0.2, -0.42);
    milkyWay.frustumCulled = false;
    milkyWay.renderOrder = -9;
    this.scene.add(milkyWay);
  }

  private createSun(): void {
    const body = BODY_BY_ID.get("sun");
    if (!body) return;
    const root = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.rotation.z = THREE.MathUtils.degToRad(body.axialTiltDeg);
    root.add(tilt);

    const segments = 128;
    const sunMaterial = createSunMaterial();
    const surface = new THREE.Mesh(new THREE.SphereGeometry(body.visualRadius, segments, segments), sunMaterial);
    surface.userData.bodyId = body.id;
    tilt.add(surface);
    this.clickableObjects.push(surface);
    this.animatedMaterials.push(sunMaterial);

    const coronaTexture = createCoronaTexture(1024);
    const corona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: coronaTexture,
        color: 0xffa446,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    corona.scale.setScalar(body.visualRadius * 3.85);
    root.add(corona);

    const light = new THREE.PointLight(0xffead1, 2.45, 0, 0);
    root.add(light);
    this.scene.add(new THREE.AmbientLight(0x1c2941, 0.04));
    this.scene.add(root);

    this.bodyNodes.set(body.id, {
      body,
      root,
      tilt,
      surface,
      animatedMaterials: [sunMaterial],
      visualRadius: body.visualRadius,
      framingRadius: body.visualRadius * 1.06,
      textureSource: "renderDerived",
    });
  }

  private createPlanet(body: CelestialBody, textures: BodyTextureSet): void {
    const root = new THREE.Group();
    root.name = body.id;
    const tilt = new THREE.Group();
    tilt.rotation.z = THREE.MathUtils.degToRad(body.axialTiltDeg);
    root.add(tilt);

    const material = createPlanetMaterial(body, textures);
    const surface = new THREE.Mesh(
      new THREE.SphereGeometry(body.visualRadius, 128, 64),
      material,
    );
    surface.scale.y = BODY_FLATTENING[body.id] ?? 1;
    surface.userData.bodyId = body.id;
    tilt.add(surface);
    this.clickableObjects.push(surface);

    const node: BodyNode = {
      body,
      root,
      tilt,
      surface,
      animatedMaterials: [],
      visualRadius: body.visualRadius,
      framingRadius: body.visualRadius * (RING_SYSTEMS[body.id]?.outer ?? 1.03),
      surfaceMaterial: material,
      textureSource: textures.source,
    };

    if ((body.id === "earth" || body.id === "venus" || body.id === "mars") && textures.clouds) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(
          body.visualRadius * (body.id === "earth" ? 1.008 : body.id === "mars" ? 1.012 : 1.015),
          96,
          48,
        ),
        createCloudMaterial(textures.clouds, body.id),
      );
      cloud.userData.bodyId = body.id;
      tilt.add(cloud);
      node.cloud = cloud;
      this.clickableObjects.push(cloud);
    }

    if (body.id === "earth" && textures.emissive) {
      const cityLights = new THREE.Mesh(
        new THREE.SphereGeometry(body.visualRadius * 1.006, 64, 32),
        createNightLightsMaterial(textures.emissive),
      );
      cityLights.userData.bodyId = body.id;
      tilt.add(cityLights);
      node.cityLights = cityLights;
      this.clickableObjects.push(cityLights);
    }

    this.addAtmosphere(body, tilt);
    if (RING_SYSTEMS[body.id]) {
      node.ringShadowDirection = this.addRingSystem(body, root, tilt, material, textures.rings);
    }

    this.scene.add(root);
    this.bodyNodes.set(body.id, node);
  }

  private addAtmosphere(body: CelestialBody, parent: THREE.Group): void {
    const atmosphere: Partial<Record<BodyId, [THREE.ColorRepresentation, number, number, number, number]>> = {
      venus: [0xe8bd78, 0.42, 4.1, 1.028, 0.035],
      earth: [0x4b9dff, 0.52, 4.4, 1.025, 0.025],
      mars: [0xd57a52, 0.18, 4.8, 1.022, 0.025],
      jupiter: [0xd6a16d, 0.1, 5, 1.015, 0.025],
      saturn: [0xe1c28b, 0.1, 5, 1.015, 0.025],
      uranus: [0x83d6dc, 0.2, 4.6, 1.02, 0.03],
      neptune: [0x557de2, 0.22, 4.6, 1.02, 0.025],
    };
    const settings = atmosphere[body.id];
    if (!settings) return;
    const [color, intensity, power, scale, nightFloor] = settings;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(body.visualRadius * scale, 64, 32),
      createAtmosphereMaterial(color, intensity, power, nightFloor),
    );
    mesh.renderOrder = 8;
    parent.add(mesh);
  }

  private addRingSystem(
    body: CelestialBody,
    root: THREE.Group,
    parent: THREE.Group,
    surfaceMaterial: THREE.MeshPhysicalMaterial,
    observedTexture?: THREE.Texture,
  ): THREE.Vector3 {
    const settings = RING_SYSTEMS[body.id];
    if (!settings) {
      return new THREE.Vector3(1, 0, 0);
    }
    const innerRadius = body.visualRadius * settings.inner;
    const outerRadius = body.visualRadius * settings.outer;
    const texture = observedTexture ?? createRingTexture(4096);
    const ring = new THREE.Mesh(
      this.createRingGeometry(innerRadius, outerRadius, 512),
      createRingMaterial(texture, root.position, body.visualRadius),
    );
    ring.rotation.x = Math.PI / 2;
    ring.renderOrder = 9;
    ring.userData.bodyId = body.id;
    parent.add(ring);
    this.clickableObjects.push(ring);
    return applyRingShadow(surfaceMaterial, texture, innerRadius, outerRadius);
  }

  private createRingGeometry(inner: number, outer: number, segments: number): THREE.BufferGeometry {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      positions.push(inner * cosine, inner * sine, 0, outer * cosine, outer * sine, 0);
      uvs.push(0, index / segments, 1, index / segments);
      if (index < segments) {
        const base = index * 2;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  private createOrbitLines(): void {
    for (const planet of PLANETS) {
      const geometry = new THREE.BufferGeometry().setFromPoints(createOrbitPoints(planet, 320));
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(planet.accent).lerp(new THREE.Color(0x71839a), 0.72),
        transparent: true,
        opacity: planet.id === "earth" ? 0.23 : 0.12,
        depthWrite: false,
      });
      const orbit = new THREE.LineLoop(geometry, material);
      orbit.renderOrder = -1;
      this.orbitLines.add(orbit);
    }
  }

  private createSatelliteOrbitGeometry(body: CelestialBody): THREE.BufferGeometry {
    const orbitRadius = SATELLITE_ORBIT_RADII[body.id];
    const points = orbitRadius ? createOrbitPoints(body, 128, orbitRadius) : [];
    return new THREE.BufferGeometry().setFromPoints(points);
  }

  private createAsteroidBelt(): void {
    const count = 4_200;
    const random = seedRandom(201_021);
    const geometry = new THREE.IcosahedronGeometry(0.055, 0);
    geometry.scale(1, 0.72, 0.82);
    const material = new THREE.MeshStandardMaterial({ color: 0x746e66, roughness: 0.98, metalness: 0.04 });
    const asteroids = new THREE.InstancedMesh(geometry, material, count);
    asteroids.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();

    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 22.65 + Math.pow(random(), 0.72) * 3.3;
      const inclination = (random() - 0.5) * 0.15;
      position.set(
        Math.cos(angle) * radius,
        Math.sin(inclination) * radius * (0.25 + random() * 0.75),
        Math.sin(angle) * radius * (0.97 + random() * 0.06),
      );
      euler.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      quaternion.setFromEuler(euler);
      const size = 0.16 + Math.pow(random(), 5) * 1.18;
      scale.set(size * (0.7 + random() * 0.8), size * (0.5 + random()), size * (0.6 + random()));
      matrix.compose(position, quaternion, scale);
      asteroids.setMatrixAt(index, matrix);
    }
    asteroids.computeBoundingSphere();
    asteroids.castShadow = false;
    asteroids.receiveShadow = false;
    this.scene.add(asteroids);
  }

  private updateBodies(): void {
    for (const [bodyId, node] of this.bodyNodes) {
      const { body, root, surface } = node;
      if (bodyId === "sun") {
        surface.rotation.y = spinRadians(body, this.simulationDays);
        continue;
      }

      let satelliteSurfaceRotation: number | null = null;
      if (body.parentId) {
        const parentNode = this.bodyNodes.get(body.parentId);
        const orbitRadius = SATELLITE_ORBIT_RADII[bodyId];
        if (parentNode && orbitRadius) {
          const angle = (this.simulationDays / body.orbitalPeriodDays) * Math.PI * 2 +
            THREE.MathUtils.degToRad(body.initialPhaseDeg);
          const local = orbitalPosition(body, this.simulationDays, this.tempPosition, orbitRadius);
          if (body.parentId === "mars") {
            local.applyAxisAngle(Z_AXIS, THREE.MathUtils.degToRad(parentNode.body.axialTiltDeg));
          }
          root.position.copy(parentNode.root.position).add(local);
          this.satelliteOrbits.get(bodyId)?.position.copy(parentNode.root.position);
          satelliteSurfaceRotation = Math.PI - angle;
        }
      } else {
        root.position.copy(orbitalPosition(body, this.simulationDays, this.tempPosition));
      }

      surface.rotation.y = satelliteSurfaceRotation ?? spinRadians(body, this.simulationDays);
      if (node.cityLights) node.cityLights.rotation.y = surface.rotation.y;
      if (node.cloud) {
        const cloudPeriod = bodyId === "earth" ? 0.82 : bodyId === "venus" ? 4.2 : 1.027;
        node.cloud.rotation.y = (this.simulationDays / cloudPeriod) * Math.PI * 2;
      }
      if (node.ringShadowDirection && root.position.lengthSq() > 0.001) {
        this.tempPosition.copy(root.position).negate().normalize();
        surface.getWorldQuaternion(this.tempQuaternion).invert();
        this.tempPosition.applyQuaternion(this.tempQuaternion);
        this.tempPosition.y /= BODY_FLATTENING[bodyId] ?? 1;
        node.ringShadowDirection.copy(this.tempPosition.normalize());
      }
    }
  }

  private updateCamera(delta: number): void {
    if (this.cameraMode === "tour" && performance.now() >= this.nextTourAt && !this.cameraTransition) {
      this.tourIndex = (this.tourIndex + 1) % TOUR_SEQUENCE.length;
      this.beginFocusTransition(TOUR_SEQUENCE[this.tourIndex], true);
      this.nextTourAt = performance.now() + (this.reducedMotion ? 5_000 : 7_500);
    }

    if (this.cameraTransition) {
      this.updateCameraTransition();
      return;
    }

    if (this.cameraMode === "focus" || this.cameraMode === "tour") {
      const node = this.bodyNodes.get(this.selectedBodyId);
      if (!node) return;
      node.root.getWorldPosition(this.focusPosition);
      if (!this.focusInitialized) {
        this.previousFocusPosition.copy(this.focusPosition);
        this.focusInitialized = true;
      }
      const movement = this.tempPosition.copy(this.focusPosition).sub(this.previousFocusPosition);
      this.camera.position.add(movement);
      this.controls.target.add(movement);
      this.previousFocusPosition.copy(this.focusPosition);
      if (this.cameraMode === "tour") this.camera.lookAt(this.focusPosition);
    } else if (this.cameraMode === "cinematic") {
      const node = this.bodyNodes.get(this.selectedBodyId);
      if (!node) return;
      node.root.getWorldPosition(this.focusPosition);
      this.cinematicAngle += delta * (this.reducedMotion ? 0 : 0.09);
      this.cinematicPosition(node, this.focusPosition, this.camera.position);
      this.camera.lookAt(this.focusPosition);
      this.controls.target.copy(this.focusPosition);
    } else if (this.cameraMode === "flight") {
      this.updateFlight(delta);
    }
  }

  private fitDistanceForRadius(radius: number, occupancy: number): number {
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(this.camera.aspect, 0.01));
    const limitingFov = Math.min(verticalFov, horizontalFov);
    return radius / Math.sin(limitingFov * 0.5 * occupancy);
  }

  private fitDistance(node: BodyNode, occupancy: number): number {
    return this.fitDistanceForRadius(node.framingRadius, occupancy);
  }

  private cinematicPosition(node: BodyNode, target: THREE.Vector3, result: THREE.Vector3): THREE.Vector3 {
    const distance = this.fitDistance(node, 0.58);
    return result.set(
      target.x + Math.cos(this.cinematicAngle) * distance,
      target.y + distance * 0.28 + Math.sin(this.elapsed * 0.16) * distance * 0.055,
      target.z + Math.sin(this.cinematicAngle) * distance,
    );
  }

  private focusDistance(node: BodyNode, closeApproach: boolean): number {
    const prioritizeIceGiantDisk = closeApproach && (node.body.id === "uranus" || node.body.id === "neptune");
    const radius = prioritizeIceGiantDisk ? node.visualRadius * 1.08 : node.framingRadius;
    return this.fitDistanceForRadius(radius, closeApproach ? 0.8 : 0.52);
  }

  private ensureFocusedBodyFits(): void {
    if (this.cameraMode !== "focus" && this.cameraMode !== "tour") return;
    const node = this.bodyNodes.get(this.selectedBodyId);
    if (!node) return;
    node.root.getWorldPosition(this.focusPosition);
    const minimumDistance = this.focusDistance(node, this.focusCloseApproach);
    const currentDistance = this.camera.position.distanceTo(this.focusPosition);
    if (currentDistance >= minimumDistance) return;
    this.tempPosition.copy(this.camera.position).sub(this.focusPosition);
    if (this.tempPosition.lengthSq() < 0.001) this.tempPosition.set(0.8, 0.35, 1);
    this.camera.position.copy(this.focusPosition).add(this.tempPosition.normalize().multiplyScalar(minimumDistance));
    this.controls.target.copy(this.focusPosition);
  }

  private beginFocusTransition(bodyId: BodyId, fromTour: boolean, closeApproach = false): void {
    const body = BODY_BY_ID.get(bodyId);
    const node = this.bodyNodes.get(bodyId);
    if (!body || !node) return;
    const bodyChanged = this.selectedBodyId !== bodyId;
    this.selectedBodyId = bodyId;
    if (bodyChanged || !Number.isFinite(this.selectionMarkerLockStartedAt)) {
      this.selectionMarkerLockStartedAt = this.elapsed;
    }
    this.focusCloseApproach = closeApproach;
    this.events.onBodySelected(body);
    this.events.onTextureSourceChanged(bodyId, node.textureSource);
    this.selectionMarker.visible = true;
    const target = node.root.getWorldPosition(new THREE.Vector3());
    const currentDirection = this.camera.position.clone().sub(this.controls.target).normalize();
    if (currentDirection.lengthSq() < 0.5) currentDirection.set(0.8, 0.35, 1).normalize();
    const offsetDirection = currentDirection.clone();
    if (bodyId !== "sun" && target.lengthSq() > 0.1) {
      const towardSun = target.clone().negate().normalize();
      const tangent = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, towardSun).normalize();
      const tangentSign = Math.sign(currentDirection.dot(tangent)) || 1;
      const airlessCloseUp = bodyId === "mercury" || body.kind === "moon";
      offsetDirection
        .copy(towardSun)
        .multiplyScalar(airlessCloseUp ? 0.48 : 0.68)
        .addScaledVector(THREE.Object3D.DEFAULT_UP, airlessCloseUp ? 0.2 : 0.24)
        .addScaledVector(tangent, (airlessCloseUp ? 0.78 : 0.43) * tangentSign)
        .normalize();
    }
    if (RING_SYSTEMS[bodyId]) {
      const ringNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(node.tilt.getWorldQuaternion(this.tempQuaternion));
      const ringFacing = offsetDirection.dot(ringNormal);
      if (Math.abs(ringFacing) < 0.3) {
        offsetDirection.addScaledVector(ringNormal, (ringFacing < 0 ? -1 : 1) * (0.3 - Math.abs(ringFacing))).normalize();
      }
    }
    const distance = this.focusDistance(node, closeApproach);
    this.cameraTransition = {
      bodyId,
      cinematic: false,
      startedAt: performance.now(),
      duration: this.reducedMotion ? 80 : closeApproach ? 920 : 1_160,
      startPosition: this.camera.position.clone(),
      startTarget: this.controls.target.clone(),
      offsetDirection,
      distance,
      startExposure: this.renderer.toneMappingExposure,
      endExposure: FOCUS_EXPOSURE[bodyId],
      closeApproach,
    };
    this.focusInitialized = false;
    this.controls.enabled = false;
    if (!fromTour && this.cameraMode !== "cinematic") this.setModeInternal("focus");
  }

  private updateCameraTransition(): void {
    const transition = this.cameraTransition;
    if (!transition) return;
    const node = this.bodyNodes.get(transition.bodyId);
    if (!node) return;
    const target = node.root.getWorldPosition(this.focusPosition);
    const destination = transition.cinematic
      ? this.cinematicPosition(node, target, this.tempPosition)
      : this.tempPosition.copy(transition.offsetDirection).multiplyScalar(transition.distance).add(target);
    const progress = Math.min(1, (performance.now() - transition.startedAt) / transition.duration);
    const eased = easeInOutCubic(progress);
    this.camera.position.lerpVectors(transition.startPosition, destination, eased);
    this.controls.target.lerpVectors(transition.startTarget, target, eased);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(
      transition.startExposure,
      transition.endExposure,
      eased,
    );
    this.camera.lookAt(this.controls.target);
    if (progress >= 1) {
      this.cameraTransition = null;
      this.previousFocusPosition.copy(target);
      this.focusInitialized = true;
      this.controls.enabled = this.cameraMode !== "tour" && this.cameraMode !== "cinematic";
      this.controls.minDistance = Math.max(node.visualRadius * 1.25, node.body.kind === "moon" ? 0.12 : 0.7);
      this.controls.maxDistance = Math.max(node.visualRadius * 35, 35);
    }
  }

  private updateFlight(delta: number): void {
    const speed = (this.pressedKeys.has("ShiftLeft") ? 25 : 9) * delta;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
    const movement = new THREE.Vector3();
    if (this.pressedKeys.has("KeyW")) movement.add(forward);
    if (this.pressedKeys.has("KeyS")) movement.sub(forward);
    if (this.pressedKeys.has("KeyD")) movement.add(right);
    if (this.pressedKeys.has("KeyA")) movement.sub(right);
    if (this.pressedKeys.has("KeyE")) movement.add(this.camera.up);
    if (this.pressedKeys.has("KeyQ")) movement.sub(this.camera.up);
    if (movement.lengthSq() > 0) {
      movement.normalize().multiplyScalar(speed);
      this.camera.position.add(movement);
      this.controls.target.add(movement);
    }
  }

  private updateAnimatedMaterials(): void {
    for (const material of this.animatedMaterials) {
      const animated = material as AnimatedShaderMaterial;
      if (animated.uniforms.uTime) animated.uniforms.uTime.value = this.elapsed;
    }
  }

  private updateSelectionMarker(): void {
    const node = this.bodyNodes.get(this.selectedBodyId);
    const shouldShow = Number.isFinite(this.selectionMarkerLockStartedAt) && this.cameraTransition !== null;
    this.selectionMarker.visible = shouldShow;
    if (!node || !shouldShow) return;
    node.root.getWorldPosition(this.focusPosition);
    this.selectionMarker.position.copy(this.focusPosition);
    this.selectionMarker.quaternion.copy(this.camera.quaternion);
    this.selectionMarkerArcs.rotation.z = this.reducedMotion ? 0 : -this.elapsed * 0.45;
    const lockProgress = this.reducedMotion
      ? 1
      : THREE.MathUtils.clamp((this.elapsed - this.selectionMarkerLockStartedAt) / 0.72, 0, 1);
    const lockScale = THREE.MathUtils.lerp(2.2, 1, easeOutBack(lockProgress));
    const scale = node.framingRadius * 1.22 * lockScale;
    this.selectionMarker.scale.setScalar(scale);
  }

  private updateDiagnostics(): void {
    this.frameCount += 1;
    const now = performance.now();
    const duration = now - this.fpsWindowStarted;
    if (duration >= 750) {
      const fps = Math.round((this.frameCount * 1_000) / duration);
      this.events.onFpsChanged(fps);
      this.frameCount = 0;
      this.fpsWindowStarted = now;
      this.events.onDateChanged(this.getSimulationDate(), this.timeRate);
    }
  }

  private setModeInternal(mode: CameraMode): void {
    if (this.cameraMode === mode) return;
    this.cameraMode = mode;
    this.events.onCameraModeChanged(mode);
  }

  private pickBody(event: PointerEvent): BodyId | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.clickableObjects, false);
    for (const intersection of intersections) {
      const bodyId = intersection.object.userData.bodyId as BodyId | undefined;
      if (bodyId) return bodyId;
    }
    return null;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.activePointerIds.add(event.pointerId);
    if (this.activePointerIds.size > 1) this.pointerGestureHadMultiplePointers = true;
    if (this.activePointerIds.size === 1) this.pointerDownPosition.set(event.clientX, event.clientY);
    if (this.cameraMode === "tour") this.stopTour();
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const hadMultiplePointers = this.pointerGestureHadMultiplePointers;
    this.activePointerIds.delete(event.pointerId);
    if (this.activePointerIds.size === 0) this.pointerGestureHadMultiplePointers = false;
    if (hadMultiplePointers) return;
    const distance = this.pointerDownPosition.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
    const tapThreshold = event.pointerType === "touch" ? 12 : 6;
    if (distance > tapThreshold) return;
    const bodyId = this.pickBody(event);
    if (bodyId) this.selectBody(bodyId);
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.activePointerIds.delete(event.pointerId);
    if (this.activePointerIds.size === 0) this.pointerGestureHadMultiplePointers = false;
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse" || event.buttons !== 0) {
      if (this.canvas.classList.contains("is-hovering-body")) {
        this.canvas.classList.remove("is-hovering-body");
        this.events.onBodyHovered(null, event.clientX, event.clientY);
      }
      return;
    }
    const bodyId = this.pickBody(event);
    const body = bodyId ? BODY_BY_ID.get(bodyId) ?? null : null;
    this.canvas.classList.toggle("is-hovering-body", Boolean(body));
    this.events.onBodyHovered(body, event.clientX, event.clientY);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) {
      return;
    }
    this.pressedKeys.add(event.code);
    if (event.code === "Space") {
      event.preventDefault();
      this.setTimeRate(this.timeRate === 0 ? this.previousTimeRate : 0);
    } else if (event.code === "KeyT") {
      this.toggleTour();
    } else if (event.code === "Escape") {
      this.setOverview();
    } else if (event.code === "BracketLeft") {
      this.setTimeRate(Math.max(0, this.timeRate / 7));
    } else if (event.code === "BracketRight") {
      this.setTimeRate(this.timeRate === 0 ? 1 / 24 : Math.min(30, this.timeRate * 7));
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private readonly handleWindowBlur = (): void => {
    this.pressedKeys.clear();
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.setTimeRate(0);
    this.events.onContextStateChanged("lost");
  };

  private readonly handleContextRestored = (): void => {
    this.events.onContextStateChanged("restored");
    window.location.reload();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden && this.timeRate > 0) {
      this.pausedForVisibility = true;
      this.setTimeRate(0);
    } else if (!document.hidden && this.pausedForVisibility) {
      this.pausedForVisibility = false;
      this.setTimeRate(this.previousTimeRate);
    }
  };
}
