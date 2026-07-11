import * as THREE from "three";
import type { BodyId } from "../data/bodies";

export interface BodyTextureSet {
  color: THREE.Texture;
  bump?: THREE.Texture;
  roughness?: THREE.Texture;
  emissive?: THREE.Texture;
  clouds?: THREE.Texture;
  rings?: THREE.Texture;
  source: "observation" | "renderDerived";
}

const OBSERVATION_COLOR_MAPS: Partial<Record<BodyId, string>> = {
  mercury: "/textures/mercury-color.jpg",
  venus: "/textures/venus-color.jpg",
  earth: "/textures/earth-color.jpg",
  moon: "/textures/moon-color.jpg",
  mars: "/textures/mars-color.jpg",
  jupiter: "/textures/jupiter-color.jpg",
  saturn: "/textures/saturn-color.jpg",
  uranus: "/textures/uranus-color.png",
  neptune: "/textures/neptune-color.png",
};

const OBSERVATION_HEIGHT_MAPS: Partial<Record<BodyId, string>> = {
  mercury: "/textures/mercury-height.jpg",
  earth: "/textures/earth-height.png",
  moon: "/textures/moon-height.jpg",
  mars: "/textures/mars-height.png",
};

const EARTH_CLOUD_MAP = "/textures/earth-clouds.png";
const EARTH_NIGHT_MAP = "/textures/earth-night.jpg";
const SATURN_RING_MAP = "/textures/saturn-rings.png";

const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, value));

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function gridHash(x: number, y: number, seed: number): number {
  let value = Math.imul(x + seed * 101, 374_761_393) ^ Math.imul(y + seed * 173, 668_265_263);
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_295;
}

function valueNoise2D(u: number, v: number, frequency: number, seed: number): number {
  const x = u * frequency;
  const y = v * frequency;
  const rawX0 = Math.floor(x);
  const x0 = ((rawX0 % frequency) + frequency) % frequency;
  const x1 = (x0 + 1) % frequency;
  const y0 = Math.max(0, Math.min(frequency, Math.floor(y)));
  const y1 = Math.max(0, Math.min(frequency, y0 + 1));
  const txRaw = x - rawX0;
  const tyRaw = y - Math.floor(y);
  const tx = txRaw * txRaw * (3 - 2 * txRaw);
  const ty = tyRaw * tyRaw * (3 - 2 * tyRaw);
  const top = THREE.MathUtils.lerp(gridHash(x0, y0, seed), gridHash(x1, y0, seed), tx);
  const bottom = THREE.MathUtils.lerp(gridHash(x0, y1, seed), gridHash(x1, y1, seed), tx);
  return THREE.MathUtils.lerp(top, bottom, ty);
}

function fractalNoise2D(u: number, v: number, seed: number): number {
  return (
    valueNoise2D(u, v, 4, seed) * 0.48 +
    valueNoise2D(u, v, 8, seed + 11) * 0.26 +
    valueNoise2D(u, v, 16, seed + 23) * 0.16 +
    valueNoise2D(u, v, 32, seed + 37) * 0.1
  );
}

function surfaceNoise(longitude: number, latitude: number, seed: number): number {
  const x = Math.cos(longitude) * Math.cos(latitude);
  const y = Math.sin(latitude);
  const z = Math.sin(longitude) * Math.cos(latitude);
  const a = Math.sin(x * (8.3 + seed) + z * 5.7 + y * 3.9);
  const b = Math.sin(x * 17.1 - z * (13.4 + seed * 0.2) + y * 11.7);
  const c = Math.sin(x * 41.7 + z * 37.2 - y * (29.8 + seed));
  const d = Math.sin(x * 83.1 - z * 71.9 + y * 61.3);
  return clamp(0.5 + a * 0.24 + b * 0.13 + c * 0.075 + d * 0.035);
}

function textureCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasTexture(canvas: HTMLCanvasElement, color = true): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function paletteFor(body: BodyId, n: number, latitude: number): [number, number, number] {
  const polar = Math.pow(Math.abs(latitude) / (Math.PI / 2), 6);
  switch (body) {
    case "mercury": {
      const value = 83 + n * 82;
      return [value * 1.02, value, value * 0.96];
    }
    case "venus": {
      return [204 + n * 40, 153 + n * 50, 70 + n * 52];
    }
    case "earth": {
      if (polar > 0.5) return [205 + polar * 45, 220 + polar * 30, 226 + polar * 28];
      if (n > 0.57) return [42 + n * 82, 76 + n * 72, 44 + n * 34];
      return [7 + n * 15, 43 + n * 43, 86 + n * 84];
    }
    case "moon": {
      const value = 92 + n * 85;
      return [value * 1.04, value * 1.02, value];
    }
    case "mars": {
      return [118 + n * 89 + polar * 32, 47 + n * 62 + polar * 84, 28 + n * 40 + polar * 98];
    }
    case "jupiter": {
      const band = 0.5 + Math.sin(latitude * 28 + n * 3) * 0.5;
      return [154 + band * 76, 103 + band * 78, 67 + band * 68];
    }
    case "saturn": {
      const band = 0.5 + Math.sin(latitude * 38 + n * 2) * 0.5;
      return [182 + band * 54, 155 + band * 56, 100 + band * 58];
    }
    case "uranus": {
      const band = Math.sin(latitude * 18) * 6;
      return [112 + n * 16 + band, 187 + n * 24 + band, 195 + n * 26 + band];
    }
    case "neptune": {
      const band = 0.5 + Math.sin(latitude * 24 + n * 2) * 0.5;
      return [30 + band * 30, 58 + band * 50, 139 + band * 73];
    }
    default:
      return [160, 160, 160];
  }
}

function createProceduralColor(body: BodyId, size: number): THREE.CanvasTexture {
  const width = size;
  const height = Math.floor(size / 2);
  const canvas = textureCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("无法创建纹理画布");

  const image = context.createImageData(width, height);
  const data = image.data;
  const seed = body.length * 1.71;

  for (let y = 0; y < height; y += 1) {
    const latitude = (0.5 - y / height) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const longitude = (x / width - 0.5) * Math.PI * 2;
      const rockyNoise = ["mercury", "earth", "moon", "mars"].includes(body);
      let noise = rockyNoise
        ? fractalNoise2D(x / width, y / height, Math.floor(seed * 17))
        : surfaceNoise(longitude, latitude, seed);

      if (body === "jupiter" || body === "saturn" || body === "uranus" || body === "neptune") {
        noise = clamp(noise * 0.42 + 0.58 * (0.5 + Math.sin(latitude * 44 + noise * 4) * 0.5));
      }

      const [red, green, blue] = paletteFor(body, noise, latitude);
      const offset = (y * width + x) * 4;
      data[offset] = clamp(red, 0, 255);
      data[offset + 1] = clamp(green, 0, 255);
      data[offset + 2] = clamp(blue, 0, 255);
      data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

  if (["mercury", "moon", "mars"].includes(body)) {
    const random = seeded(body === "mercury" ? 17 : body === "moon" ? 29 : 43);
    const count = body === "mars" ? 85 : 230;
    context.globalCompositeOperation = "multiply";
    for (let index = 0; index < count; index += 1) {
      const radius = Math.pow(random(), 3) * width * 0.026 + 1;
      const cx = random() * width;
      const cy = random() * height;
      context.beginPath();
      context.ellipse(cx, cy, radius, radius * (0.42 + random() * 0.48), 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(34, 27, 22, ${0.13 + random() * 0.25})`;
      context.lineWidth = Math.max(1, radius * 0.16);
      context.stroke();
    }
    context.globalCompositeOperation = "source-over";
  }

  if (body === "jupiter") {
    context.save();
    context.globalCompositeOperation = "multiply";
    context.fillStyle = "rgba(142, 52, 34, 0.78)";
    context.beginPath();
    context.ellipse(width * 0.69, height * 0.61, width * 0.07, height * 0.035, -0.08, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(244, 190, 145, 0.48)";
    context.lineWidth = Math.max(2, size * 0.004);
    context.stroke();
    context.restore();
  }

  if (body === "neptune") {
    context.fillStyle = "rgba(9, 18, 57, 0.58)";
    context.beginPath();
    context.ellipse(width * 0.62, height * 0.57, width * 0.055, height * 0.027, 0, 0, Math.PI * 2);
    context.fill();
  }

  return canvasTexture(canvas);
}

function createSurfaceDetail(body: BodyId, size: number): THREE.CanvasTexture {
  const width = Math.max(256, Math.floor(size / 2));
  const height = Math.floor(width / 2);
  const canvas = textureCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("无法创建表面细节纹理");
  const image = context.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const noise = fractalNoise2D(x / width, y / height, body.length * 19);
      const value = Math.floor(74 + noise * 162);
      const offset = (y * width + x) * 4;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvasTexture(canvas, false);
}

function createCloudTexture(body: "earth" | "venus", size: number): THREE.CanvasTexture {
  const width = size;
  const height = Math.floor(size / 2);
  const canvas = textureCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建云层纹理");
  const image = context.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    const latitude = (0.5 - y / height) * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const longitude = (x / width - 0.5) * Math.PI * 2;
      const base = surfaceNoise(longitude + Math.sin(latitude * 3) * 0.11, latitude, body === "earth" ? 11 : 19);
      let density: number;
      let cloudStreak = 0;
      if (body === "earth") {
        const detail = surfaceNoise(longitude * 2 + 0.37, latitude + Math.sin(longitude * 3) * 0.045, 23);
        const wisps = surfaceNoise(longitude * 3 - 0.21, latitude * 0.92, 31);
        const combined = base * 0.55 + detail * 0.3 + wisps * 0.15;
        density = clamp((combined - 0.525) * 4.6);
      } else {
        const broadWave = 0.5 + Math.sin(longitude * 5 + latitude * 18 + base * 6) * 0.5;
        const fineWave = 0.5 + Math.sin(longitude * 13 - latitude * 37 + base * 11) * 0.5;
        cloudStreak = broadWave * 0.68 + fineWave * 0.32;
        density = clamp(0.24 + base * 0.48 + cloudStreak * 0.28);
      }
      const offset = (y * width + x) * 4;
      image.data[offset] = body === "earth" ? density * 255 : 158 + density * 72 + cloudStreak * 18;
      image.data[offset + 1] = body === "earth" ? density * 255 : 116 + density * 68 + cloudStreak * 12;
      image.data[offset + 2] = body === "earth" ? density * 255 : 62 + density * 57 + cloudStreak * 8;
      image.data[offset + 3] = Math.floor(density * (body === "earth" ? 220 : 245));
    }
  }
  context.putImageData(image, 0, 0);
  return canvasTexture(canvas);
}

function createEarthLights(size: number): THREE.CanvasTexture {
  const width = size;
  const height = Math.floor(size / 2);
  const canvas = textureCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建夜光纹理");
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);

  const cities = [
    [-74, 41, 1.0], [-118, 34, 0.8], [-99, 19, 0.72], [-47, -23, 0.72],
    [2, 49, 0.95], [13, 52, 0.92], [30, 31, 0.6], [37, 56, 0.7],
    [77, 29, 1.0], [90, 24, 0.7], [116, 40, 1.0], [121, 31, 0.92],
    [139, 36, 1.0], [127, 37, 0.82], [151, -34, 0.7], [28, -26, 0.58],
  ] as const;

  context.globalCompositeOperation = "lighter";
  for (const [longitude, latitude, strength] of cities) {
    const x = ((longitude + 180) / 360) * width;
    const y = ((90 - latitude) / 180) * height;
    const radius = width * (0.005 + strength * 0.006);
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255, 206, 112, ${0.9 * strength})`);
    gradient.addColorStop(0.25, `rgba(255, 157, 58, ${0.42 * strength})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  return canvasTexture(canvas);
}

async function loadObservationColorTexture(
  body: BodyId,
  loadingManager: THREE.LoadingManager,
): Promise<THREE.Texture | null> {
  const url = OBSERVATION_COLOR_MAPS[body];
  if (!url) return null;
  return loadTexture(url, loadingManager, true);
}

async function loadTexture(
  url: string,
  loadingManager: THREE.LoadingManager,
  color: boolean,
): Promise<THREE.Texture | null> {
  try {
    const loader = new THREE.TextureLoader(loadingManager);
    loader.setCrossOrigin("anonymous");
    const texture = await loader.loadAsync(url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 8;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  } catch {
    return null;
  }
}

export async function loadBodyTextures(
  body: BodyId,
  loadingManager: THREE.LoadingManager,
): Promise<BodyTextureSet> {
  const size = 2048;
  const heightUrl = OBSERVATION_HEIGHT_MAPS[body];
  const [observationTexture, observedHeight, earthClouds, earthNight, saturnRings] = await Promise.all([
    loadObservationColorTexture(body, loadingManager),
    heightUrl ? loadTexture(heightUrl, loadingManager, false) : Promise.resolve(null),
    body === "earth" ? loadTexture(EARTH_CLOUD_MAP, loadingManager, false) : Promise.resolve(null),
    body === "earth" ? loadTexture(EARTH_NIGHT_MAP, loadingManager, true) : Promise.resolve(null),
    body === "saturn" ? loadTexture(SATURN_RING_MAP, loadingManager, true) : Promise.resolve(null),
  ]);
  const color = observationTexture ?? createProceduralColor(body, size);

  const textures: BodyTextureSet = {
    color,
    source: observationTexture ? "observation" : "renderDerived",
  };

  if (["mercury", "earth", "moon", "mars"].includes(body)) {
    textures.bump = observedHeight ?? createSurfaceDetail(body, size);
  }
  if (body === "earth") {
    textures.emissive = earthNight ?? createEarthLights(size);
    textures.clouds = earthClouds ?? createCloudTexture("earth", size);
  }
  if (body === "venus") {
    textures.clouds = createCloudTexture("venus", size);
  }
  if (body === "saturn" && saturnRings) {
    saturnRings.wrapS = THREE.ClampToEdgeWrapping;
    saturnRings.wrapT = THREE.ClampToEdgeWrapping;
    textures.rings = saturnRings;
  }
  return textures;
}

export function createRingTexture(body: "saturn" | "uranus" | "neptune", size = 4096): THREE.CanvasTexture {
  const height = body === "neptune" ? 256 : 32;
  const canvas = textureCanvas(size, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建行星环纹理");
  const image = context.createImageData(size, height);

  const gaussian = (radius: number, center: number, width: number): number => {
    const distance = (radius - center) / width;
    return Math.exp(-distance * distance);
  };

  for (let x = 0; x < size; x += 1) {
    const radius = x / (size - 1);
    for (let y = 0; y < height; y += 1) {
      const angle = (y / height) * Math.PI * 2;
      let alpha = 0;
      let red = 165;
      let green = 171;
      let blue = 171;

      if (body === "saturn") {
        const fineBands = Math.sin(radius * 860) * 0.045 + Math.sin(radius * 173) * 0.075;
        const cRing = radius > 0.04 && radius < 0.27 ? 0.24 : 0;
        const bRing = radius >= 0.27 && radius < 0.64 ? 0.83 : 0;
        const cassini = radius >= 0.64 && radius < 0.71;
        const aRing = radius >= 0.71 && radius < 0.965 ? 0.63 : 0;
        alpha = cassini ? 0.025 : clamp(Math.max(cRing, bRing, aRing) + fineBands);
        alpha *= clamp(radius / 0.018) * clamp((1 - radius) / 0.035);
        const warmth = 0.5 + Math.sin(radius * 61) * 0.5;
        red = 207 + warmth * 30;
        green = 192 + warmth * 25;
        blue = 161 + warmth * 21;
      } else if (body === "uranus") {
        const rings = [
          [0.08, 0.006, 0.1], [0.18, 0.004, 0.08], [0.29, 0.006, 0.12],
          [0.42, 0.004, 0.09], [0.53, 0.005, 0.13], [0.64, 0.005, 0.1],
          [0.76, 0.006, 0.15], [0.88, 0.005, 0.14], [0.965, 0.009, 0.29],
        ] as const;
        for (const [center, width, strength] of rings) {
          alpha = Math.max(alpha, gaussian(radius, center, width) * strength);
        }
        red = 82;
        green = 102;
        blue = 103;
      } else {
        const inner = gaussian(radius, 0.035, 0.006) * 0.12;
        const lassell = gaussian(radius, 0.53, 0.012) * 0.1;
        const arago = gaussian(radius, 0.67, 0.006) * 0.11;
        const adamsArc = 0.3 + 0.7 * Math.pow(Math.max(0, Math.cos(angle * 3 - 0.7)), 10);
        const adams = gaussian(radius, 0.972, 0.008) * (0.12 + adamsArc * 0.34);
        alpha = Math.max(inner, lassell, arago, adams);
        red = 91;
        green = 112;
        blue = 131;
      }

      const offset = (y * size + x) * 4;
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = blue;
      image.data[offset + 3] = Math.floor(clamp(alpha) * 255);
    }
  }
  context.putImageData(image, 0, 0);
  const texture = canvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createCoronaTexture(size = 512): THREE.CanvasTexture {
  const canvas = textureCanvas(size, size);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建日冕纹理");
  const center = size / 2;
  const gradient = context.createRadialGradient(center, center, size * 0.08, center, center, center);
  gradient.addColorStop(0, "rgba(255, 246, 210, 1)");
  gradient.addColorStop(0.18, "rgba(255, 192, 82, .86)");
  gradient.addColorStop(0.45, "rgba(255, 116, 34, .24)");
  gradient.addColorStop(0.72, "rgba(255, 95, 24, .07)");
  gradient.addColorStop(1, "rgba(255, 90, 20, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return canvasTexture(canvas);
}

export function textureSourceUrl(body: BodyId): string | undefined {
  return OBSERVATION_COLOR_MAPS[body];
}
