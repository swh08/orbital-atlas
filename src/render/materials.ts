import * as THREE from "three";
import type { CelestialBody } from "../data/bodies";
import type { BodyTextureSet } from "./textures";

export interface AnimatedShaderMaterial extends THREE.ShaderMaterial {
  uniforms: {
    uTime: THREE.IUniform<number>;
    [key: string]: THREE.IUniform<unknown>;
  };
}

const noiseFunctions = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x),
          mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x),
          mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 5; octave++) {
      value += amplitude * noise3(p);
      p = p * 2.03 + vec3(9.1, 7.7, 5.3);
      amplitude *= 0.5;
    }
    return value;
  }
`;

export function createSunMaterial(): AnimatedShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalPosition;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vLocalPosition = position;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vLocalPosition;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${noiseFunctions}

      void main() {
        vec3 p = normalize(vLocalPosition);
        float slow = uTime * 0.045;
        float flow = fbm(p * 5.2 + vec3(slow, -slow * 0.6, slow * 0.35));
        float cells = fbm(p * 34.0 + vec3(-slow * 1.8, slow, slow * 1.3));
        float ridges = abs(cells * 2.0 - 1.0);
        float granules = smoothstep(0.16, 0.7, 1.0 - ridges);
        float filaments = smoothstep(0.53, 0.82, flow + cells * 0.28);
        float energy = 0.58 + flow * 0.38 + granules * 0.38 + filaments * 0.16;

        vec3 deepOrange = vec3(1.0, 0.16, 0.015);
        vec3 amber = vec3(1.0, 0.53, 0.075);
        vec3 whiteHot = vec3(1.0, 0.93, 0.67);
        vec3 color = mix(deepOrange, amber, smoothstep(0.42, 0.83, energy));
        color = mix(color, whiteHot, smoothstep(0.82, 1.24, energy));

        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float facing = clamp(dot(vWorldNormal, viewDirection), 0.0, 1.0);
        float limb = pow(facing, 0.28);
        color *= mix(0.56, 1.18, limb);
        gl_FragColor = vec4(color * 1.9, 1.0);
      }
    `,
    toneMapped: true,
  }) as AnimatedShaderMaterial;
}

export function createPlanetMaterial(body: CelestialBody, textures: BodyTextureSet): THREE.MeshPhysicalMaterial {
  const rocky = body.kind === "rocky" || body.kind === "terrestrial" || body.kind === "moon";
  const airless = body.id === "mercury" || body.id === "moon";
  const giantRoughness: Partial<Record<CelestialBody["id"], number>> = {
    jupiter: 0.97,
    saturn: 0.97,
    uranus: 0.96,
    neptune: 0.95,
  };
  const giantSpecular: Partial<Record<CelestialBody["id"], number>> = {
    jupiter: 0.09,
    saturn: 0.09,
    uranus: 0.12,
    neptune: 0.14,
  };
  const parameters: THREE.MeshPhysicalMaterialParameters = {
    map: textures.color,
    color: body.id === "mercury" ? 0xd8d1c6 : body.id === "moon" ? 0xd8d6d1 : 0xffffff,
    bumpScale: body.id === "moon"
      ? 0.009
      : body.id === "mercury"
        ? 0.006
        : body.id === "mars"
          ? 0.009
          : body.id === "earth"
            ? 0.002
            : 0,
    roughness: giantRoughness[body.id] ?? (airless ? 1 : body.id === "earth" ? 0.82 : 0.94),
    metalness: 0,
    specularIntensity: giantSpecular[body.id] ?? (airless ? 0.14 : body.id === "earth" ? 0.22 : 0.12),
    clearcoat: 0,
  };
  if (rocky && textures.bump) parameters.bumpMap = textures.bump;
  return new THREE.MeshPhysicalMaterial(parameters);
}

export function createCloudMaterial(texture: THREE.Texture, body: "earth" | "venus"): THREE.MeshPhysicalMaterial {
  if (body === "venus") {
    return new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: 1,
      metalness: 0,
      specularIntensity: 0.08,
      depthWrite: true,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    alphaMap: texture,
    transparent: true,
    opacity: 0.82,
    alphaTest: 0.018,
    depthWrite: false,
    roughness: 1,
    metalness: 0,
    specularIntensity: 0.08,
    blending: THREE.NormalBlending,
  });
}

export function createNightLightsMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uSunPosition;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
        vec3 lightDirection = normalize(uSunPosition - vWorldPosition);
        float night = 1.0 - smoothstep(-0.28, 0.12, dot(vWorldNormal, lightDirection));
        vec3 lights = texture2D(uMap, vUv).rgb;
        float intensity = max(max(lights.r, lights.g), lights.b) * night;
        gl_FragColor = vec4(lights * 1.45 * night, intensity * 0.88);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  });
}

export function createAtmosphereMaterial(
  color: THREE.ColorRepresentation,
  intensity = 0.9,
  power = 3.2,
  nightFloor = 0.04,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uPower: { value: power },
      uNightFloor: { value: nightFloor },
      uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uPower;
      uniform float uNightFloor;
      uniform vec3 uSunPosition;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 lightDirection = normalize(uSunPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(vWorldNormal, viewDirection)), uPower);
        float day = smoothstep(-0.15, 0.16, dot(vWorldNormal, lightDirection));
        float twilight = smoothstep(-0.38, 0.04, dot(vWorldNormal, lightDirection));
        float alpha = fresnel * uIntensity * mix(uNightFloor, 1.0, day);
        gl_FragColor = vec4(uColor * (0.35 + twilight * 0.65), alpha);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  });
}

export function createRingMaterial(
  texture: THREE.Texture,
  planetPosition: THREE.Vector3,
  planetRadius: number,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uPlanetPosition: { value: planetPosition },
      uPlanetRadius: { value: planetRadius },
      uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uPlanetPosition;
      uniform float uPlanetRadius;
      uniform vec3 uSunPosition;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;

      void main() {
        vec4 texel = texture2D(uMap, vUv);
        if (texel.a < 0.006) discard;

        vec3 lightDirection = normalize(uSunPosition - vWorldPosition);
        vec3 toPlanet = uPlanetPosition - vWorldPosition;
        float planetAhead = step(0.0, dot(toPlanet, lightDirection));
        float closestApproach = length(cross(toPlanet, lightDirection));
        float softness = max(0.004, uPlanetRadius * 0.025);
        float planetShadow = planetAhead * (
          1.0 - smoothstep(uPlanetRadius - softness, uPlanetRadius + softness, closestApproach)
        );
        float incidence = abs(dot(normalize(vWorldNormal), lightDirection));
        float lighting = 0.2 + incidence * 0.8;
        vec3 color = texel.rgb * lighting * mix(1.0, 0.14, planetShadow);
        gl_FragColor = vec4(color, texel.a);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: true,
  });
  material.forceSinglePass = true;
  return material;
}

export function applyRingShadow(
  material: THREE.MeshPhysicalMaterial,
  ringTexture: THREE.Texture,
  innerRadius: number,
  outerRadius: number,
): THREE.Vector3 {
  const sunDirectionLocal = new THREE.Vector3(1, 0, 0);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRingMap = { value: ringTexture };
    shader.uniforms.uSunDirectionLocal = { value: sunDirectionLocal };
    shader.uniforms.uRingInnerRadius = { value: innerRadius };
    shader.uniforms.uRingOuterRadius = { value: outerRadius };
    shader.vertexShader = `varying vec3 vRingLocalPosition;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n vRingLocalPosition = position;",
    );
    shader.fragmentShader = `
      uniform sampler2D uRingMap;
      uniform vec3 uSunDirectionLocal;
      uniform float uRingInnerRadius;
      uniform float uRingOuterRadius;
      varying vec3 vRingLocalPosition;
    ${shader.fragmentShader}`.replace(
      "#include <opaque_fragment>",
      `
        float ringShadow = 0.0;
        if (abs(uSunDirectionLocal.y) > 0.0001) {
          float ringT = -vRingLocalPosition.y / uSunDirectionLocal.y;
          if (ringT > 0.0) {
            vec3 ringHit = vRingLocalPosition + uSunDirectionLocal * ringT;
            float ringRadius = length(ringHit.xz);
            if (ringRadius >= uRingInnerRadius && ringRadius <= uRingOuterRadius) {
              float radialUv = (ringRadius - uRingInnerRadius) / (uRingOuterRadius - uRingInnerRadius);
              ringShadow = texture2D(uRingMap, vec2(radialUv, 0.5)).a;
            }
          }
        }
        outgoingLight *= 1.0 - ringShadow * 0.84;
        #include <opaque_fragment>
      `,
    );
  };
  material.customProgramCacheKey = () => "orbital-atlas-ring-shadow-v1";
  return sunDirectionLocal;
}

export function createStarMaterial(pixelRatio: number, opacity = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      uniform float uPixelRatio;
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(size * uPixelRatio * (290.0 / -viewPosition.z), 1.0, 5.2);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        vec2 point = gl_PointCoord - 0.5;
        float distanceToCenter = length(point);
        if (distanceToCenter > 0.5) discard;
        float core = smoothstep(0.5, 0.06, distanceToCenter);
        gl_FragColor = vec4(vColor, core * uOpacity);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

export function createSolarLoopMaterial(
  motionScale: number,
  tubeRadius: number,
  phase: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xff9a42) },
      uMotionScale: { value: motionScale },
      uTubeRadius: { value: tubeRadius },
      uPhase: { value: phase },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uMotionScale;
      uniform float uTubeRadius;
      uniform float uPhase;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        float anchored = pow(max(sin(uv.x * 3.14159265), 0.0), 1.35);
        float motionTime = uTime * 0.3 + uPhase;
        float outwardWave = 0.5 + 0.5 * sin(uv.x * 7.1 + motionTime);
        float crossWave = sin(uv.x * 11.3 - motionTime * 0.7 + uPhase);
        float thickness = mix(0.18, 1.0, smoothstep(0.0, 0.18, anchored));

        vec3 displaced = position + normal * uTubeRadius * (thickness - 1.0);
        displaced.y += outwardWave * uMotionScale * anchored;
        displaced.z += crossWave * uMotionScale * 0.35 * anchored;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uPhase;
      varying vec2 vUv;
      void main() {
        float travellingPulse = 0.42 + 0.58 * sin(vUv.x * 36.0 - uTime * 3.2 + uPhase);
        float edge = smoothstep(0.0, 0.35, sin(vUv.y * 3.14159265));
        float endpointFade = smoothstep(0.0, 0.04, vUv.x) * smoothstep(0.0, 0.04, 1.0 - vUv.x);
        gl_FragColor = vec4(
          uColor * (1.4 + travellingPulse),
          edge * endpointFade * (0.16 + travellingPulse * 0.34)
        );
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
