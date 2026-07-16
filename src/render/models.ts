import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { BodyId, CelestialBody } from "../data/bodies";

const OBSERVATION_MODEL_URLS: Partial<Record<BodyId, string>> = {
  phobos: "/models/phobos.glb",
  deimos: "/models/deimos.glb",
};

export interface BodyModelAsset {
  surface: THREE.Group;
  source: "observation";
}

function configureMaterial(material: THREE.Material): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) return;
  material.color.set(0xffffff);
  material.metalness = 0;
  material.roughness = Math.max(material.roughness, 0.94);
  if (material.map) {
    material.map.colorSpace = THREE.SRGBColorSpace;
    material.map.anisotropy = 8;
  }
}

export async function loadBodyModel(
  body: CelestialBody,
  loadingManager: THREE.LoadingManager,
): Promise<BodyModelAsset | null> {
  const url = OBSERVATION_MODEL_URLS[body.id];
  if (!url) return null;

  try {
    const gltf = await new GLTFLoader(loadingManager).loadAsync(url);
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) return null;

    model.position.sub(sphere.center);
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) configureMaterial(material);
    });

    const surface = new THREE.Group();
    surface.name = `${body.id}-observation-model`;
    surface.add(model);
    surface.scale.setScalar(body.visualRadius / sphere.radius);
    return { surface, source: "observation" };
  } catch (error) {
    console.warn(`Unable to load observation model for ${body.id}`, error);
    return null;
  }
}

export function hasObservationModel(bodyId: BodyId): boolean {
  return Boolean(OBSERVATION_MODEL_URLS[bodyId]);
}
