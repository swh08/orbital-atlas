export type BodyId =
  | "sun"
  | "mercury"
  | "venus"
  | "earth"
  | "moon"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

export type BodyKind = "star" | "rocky" | "terrestrial" | "gas-giant" | "ice-giant" | "moon";

export interface CelestialBody {
  id: BodyId;
  name: string;
  englishName: string;
  kind: BodyKind;
  radiusKm: number;
  visualRadius: number;
  semiMajorAxisAu: number;
  orbitalPeriodDays: number;
  rotationPeriodHours: number;
  inclinationDeg: number;
  axialTiltDeg: number;
  eccentricity: number;
  ascendingNodeDeg: number;
  initialPhaseDeg: number;
  temperature: string;
  description: string;
  accent: string;
}

export const BODIES: readonly CelestialBody[] = [
  {
    id: "sun",
    name: "太阳",
    englishName: "SUN",
    kind: "star",
    radiusKm: 695_700,
    visualRadius: 4.8,
    semiMajorAxisAu: 0,
    orbitalPeriodDays: 0,
    rotationPeriodHours: 609.12,
    inclinationDeg: 0,
    axialTiltDeg: 7.25,
    eccentricity: 0,
    ascendingNodeDeg: 0,
    initialPhaseDeg: 0,
    temperature: "约 5,500 °C（光球层）",
    description: "太阳系的恒星，包含太阳系约 99.86% 的质量。表面纹理由流动噪声模拟光球米粒组织。",
    accent: "#ffd08a",
  },
  {
    id: "mercury",
    name: "水星",
    englishName: "MERCURY",
    kind: "rocky",
    radiusKm: 2_439.4,
    visualRadius: 0.48,
    semiMajorAxisAu: 0.38709927,
    orbitalPeriodDays: 87.969,
    rotationPeriodHours: 1_407.5088,
    inclinationDeg: 7.004979,
    axialTiltDeg: 0.034,
    eccentricity: 0.20563593,
    ascendingNodeDeg: 48.331,
    initialPhaseDeg: 174,
    temperature: "-180 至 430 °C",
    description: "距太阳最近的行星。无稠密大气层，古老表面布满撞击坑与绵延数百公里的断崖。",
    accent: "#a7a39c",
  },
  {
    id: "venus",
    name: "金星",
    englishName: "VENUS",
    kind: "terrestrial",
    radiusKm: 6_051.8,
    visualRadius: 0.78,
    semiMajorAxisAu: 0.72333566,
    orbitalPeriodDays: 224.701,
    rotationPeriodHours: 5_832.432,
    inclinationDeg: 3.394676,
    axialTiltDeg: 177.4,
    eccentricity: 0.00677672,
    ascendingNodeDeg: 76.68,
    initialPhaseDeg: 50,
    temperature: "约 465 °C",
    description: "浓厚的二氧化碳大气与硫酸云完全遮蔽地表。逆向自转极其缓慢，温室效应非常强烈。",
    accent: "#e3bc79",
  },
  {
    id: "earth",
    name: "地球",
    englishName: "EARTH",
    kind: "terrestrial",
    radiusKm: 6_371.0084,
    visualRadius: 0.85,
    semiMajorAxisAu: 1.00000261,
    orbitalPeriodDays: 365.256,
    rotationPeriodHours: 23.9345,
    inclinationDeg: 0,
    axialTiltDeg: 23.439,
    eccentricity: 0.01671123,
    ascendingNodeDeg: -11.26,
    initialPhaseDeg: 357.527,
    temperature: "平均约 15 °C",
    description: "拥有液态海洋、富氧大气与活跃板块构造。云层、城市夜光与稀薄蓝色大气分别独立渲染。",
    accent: "#65a7e8",
  },
  {
    id: "moon",
    name: "月球",
    englishName: "MOON",
    kind: "moon",
    radiusKm: 1_737.4,
    visualRadius: 0.25,
    semiMajorAxisAu: 0.00257,
    orbitalPeriodDays: 27.322,
    rotationPeriodHours: 655.72,
    inclinationDeg: 5.145,
    axialTiltDeg: 6.68,
    eccentricity: 0.0554,
    ascendingNodeDeg: 125.08,
    initialPhaseDeg: 220,
    temperature: "-173 至 127 °C",
    description: "地球唯一的天然卫星。自转周期与公转周期相同，因此始终以近似同一面朝向地球。",
    accent: "#cbc8c1",
  },
  {
    id: "mars",
    name: "火星",
    englishName: "MARS",
    kind: "terrestrial",
    radiusKm: 3_389.5,
    visualRadius: 0.62,
    semiMajorAxisAu: 1.52371034,
    orbitalPeriodDays: 686.98,
    rotationPeriodHours: 24.6229,
    inclinationDeg: 1.849691,
    axialTiltDeg: 25.19,
    eccentricity: 0.0933941,
    ascendingNodeDeg: 49.558,
    initialPhaseDeg: 19.412,
    temperature: "平均约 -63 °C",
    description: "铁氧化物使地表呈红褐色。这里有太阳系最大火山奥林帕斯山与巨型峡谷水手谷。",
    accent: "#d27750",
  },
  {
    id: "jupiter",
    name: "木星",
    englishName: "JUPITER",
    kind: "gas-giant",
    radiusKm: 69_911,
    visualRadius: 2.5,
    semiMajorAxisAu: 5.202887,
    orbitalPeriodDays: 4_332.59,
    rotationPeriodHours: 9.925,
    inclinationDeg: 1.304397,
    axialTiltDeg: 3.13,
    eccentricity: 0.04838624,
    ascendingNodeDeg: 100.464,
    initialPhaseDeg: 19.668,
    temperature: "云顶约 -145 °C",
    description: "太阳系最大的行星。高速自转形成清晰云带，大红斑是一场至少持续数百年的巨大风暴。",
    accent: "#d9b48c",
  },
  {
    id: "saturn",
    name: "土星",
    englishName: "SATURN",
    kind: "gas-giant",
    radiusKm: 58_232,
    visualRadius: 2.1,
    semiMajorAxisAu: 9.53667594,
    orbitalPeriodDays: 10_759.22,
    rotationPeriodHours: 10.656,
    inclinationDeg: 2.485992,
    axialTiltDeg: 26.73,
    eccentricity: 0.05386179,
    ascendingNodeDeg: 113.665,
    initialPhaseDeg: 317.356,
    temperature: "云顶约 -178 °C",
    description: "由氢和氦构成的气态巨行星。主环由无数冰与岩石颗粒组成，卡西尼缝清晰可见。",
    accent: "#e6ce9b",
  },
  {
    id: "uranus",
    name: "天王星",
    englishName: "URANUS",
    kind: "ice-giant",
    radiusKm: 25_362,
    visualRadius: 1.45,
    semiMajorAxisAu: 19.18916464,
    orbitalPeriodDays: 30_688.5,
    rotationPeriodHours: 17.24,
    inclinationDeg: 0.772638,
    axialTiltDeg: 97.77,
    eccentricity: 0.04725744,
    ascendingNodeDeg: 74.006,
    initialPhaseDeg: 140,
    temperature: "云顶约 -224 °C",
    description: "甲烷吸收红光，使大气呈柔和青色。自转轴几乎躺在轨道平面上，季节变化极端。",
    accent: "#8fd8dc",
  },
  {
    id: "neptune",
    name: "海王星",
    englishName: "NEPTUNE",
    kind: "ice-giant",
    radiusKm: 24_622,
    visualRadius: 1.4,
    semiMajorAxisAu: 30.06992276,
    orbitalPeriodDays: 60_182,
    rotationPeriodHours: 16.11,
    inclinationDeg: 1.770043,
    axialTiltDeg: 28.32,
    eccentricity: 0.00859048,
    ascendingNodeDeg: 131.784,
    initialPhaseDeg: 259.916,
    temperature: "云顶约 -214 °C",
    description: "遥远的冰巨行星，拥有太阳系最快的行星风。高层甲烷冰云在深蓝大气上形成明亮条纹。",
    accent: "#4d73de",
  },
] as const;

export const BODY_BY_ID = new Map<BodyId, CelestialBody>(
  BODIES.map((body) => [body.id, body]),
);

export const PLANETS = BODIES.filter(
  (body): body is CelestialBody => body.id !== "sun" && body.id !== "moon",
);

export function displayOrbitRadius(semiMajorAxisAu: number): number {
  return 11 + Math.sqrt(semiMajorAxisAu) * 7.5;
}
