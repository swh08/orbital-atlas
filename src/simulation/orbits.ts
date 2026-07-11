import * as THREE from "three";
import type { CelestialBody } from "../data/bodies";
import { displayOrbitRadius } from "../data/bodies";

const DEG_TO_RAD = Math.PI / 180;

export function orbitalPosition(body: CelestialBody, simulationDays: number, target = new THREE.Vector3()): THREE.Vector3 {
  if (body.semiMajorAxisAu === 0 || body.orbitalPeriodDays === 0) {
    return target.set(0, 0, 0);
  }

  const a = displayOrbitRadius(body.semiMajorAxisAu);
  const e = body.eccentricity;
  const meanAnomaly =
    ((simulationDays / body.orbitalPeriodDays) * Math.PI * 2 + body.initialPhaseDeg * DEG_TO_RAD) %
    (Math.PI * 2);

  let eccentricAnomaly = meanAnomaly;
  for (let index = 0; index < 4; index += 1) {
    eccentricAnomaly -=
      (eccentricAnomaly - e * Math.sin(eccentricAnomaly) - meanAnomaly) /
      (1 - e * Math.cos(eccentricAnomaly));
  }

  const x = a * (Math.cos(eccentricAnomaly) - e);
  const z = a * Math.sqrt(1 - e * e) * Math.sin(eccentricAnomaly);
  target.set(x, 0, z);

  target.applyAxisAngle(new THREE.Vector3(1, 0, 0), body.inclinationDeg * DEG_TO_RAD);
  target.applyAxisAngle(new THREE.Vector3(0, 1, 0), body.ascendingNodeDeg * DEG_TO_RAD);
  return target;
}

export function createOrbitPoints(body: CelestialBody, segments = 256): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  if (body.orbitalPeriodDays === 0) return points;

  for (let index = 0; index <= segments; index += 1) {
    const simulationDays = (index / segments) * body.orbitalPeriodDays -
      (body.initialPhaseDeg / 360) * body.orbitalPeriodDays;
    points.push(orbitalPosition(body, simulationDays, new THREE.Vector3()));
  }
  return points;
}

export function spinRadians(body: CelestialBody, simulationDays: number): number {
  const periodDays = body.rotationPeriodHours / 24;
  if (periodDays === 0) return 0;
  return (simulationDays / periodDays) * Math.PI * 2;
}
