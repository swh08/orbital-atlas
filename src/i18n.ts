import type { BodyId, BodyKind, CelestialBody } from "./data/bodies";

export type Locale = "en" | "zh-Hans";

export interface LocaleSelection {
  locale: Locale;
  formatLocale: string;
}

interface UnitLabel {
  one: string;
  other: string;
}

export interface Messages {
  document: {
    title: string;
    description: string;
  };
  loading: {
    renderer: string;
    scene: string;
    bodyTexture: (name: string) => string;
    camera: string;
    ready: string;
    networkTexture: string;
  };
  modes: Record<"overview" | "focus" | "tour" | "cinematic" | "flight", string>;
  kinds: Record<BodyKind, string>;
  units: {
    hour: UnitLabel;
    day: UnitLabel;
    year: UnitLabel;
    secondShort: string;
  };
  format: {
    notApplicable: string;
    paused: string;
    realTime: string;
    solarSystemCenter: string;
    fromBody: (distance: string, parentName: string) => string;
    focused: (name: string) => string;
  };
  hud: {
    atlasEyebrow: string;
    atlasTitle: string;
    loadingInitial: string;
    loadingNote: string;
    canvasAria: string;
    loadingAria: string;
    sceneStatusAria: string;
    solarSystem: string;
    simulationUtc: string;
    simulationDateAria: string;
    rendering: string;
    language: string;
    switchLanguageValue: string;
    switchLanguageAria: string;
    catalogTitle: string;
    profileEyebrow: string;
    averageRadius: string;
    orbitalDistance: string;
    orbitalPeriod: string;
    rotationPeriod: string;
    axialTilt: string;
    orbitalInclination: string;
    temperature: string;
    surfaceSource: string;
    approach: string;
    returnOverview: string;
    collapseDetails: string;
    expandDetails: string;
    controlsAria: string;
    bodies: string;
    overview: string;
    settings: string;
    settingsTitle: string;
    orbitLines: string;
    settingOn: string;
    settingOff: string;
    oneHourPerSecond: string;
    oneDayPerSecond: string;
    cycleTimeRateAria: (current: string, next: string) => string;
    cameraModes: string;
    tour: string;
    guidedTour: string;
    cinematic: string;
    compactCinematic: string;
    freeFlight: string;
    compactFlight: string;
    cycleCameraModeAria: (current: string, next: string) => string;
    compactTourHelp: string;
    compactDefaultHelp: string;
    flightHelp: string;
    tourHelp: string;
    cinematicHelp: string;
    defaultHelp: string;
    compactHint: string;
    desktopHint: string;
    contextEyebrow: string;
    contextTitle: string;
    contextBody: string;
    rendererEyebrow: string;
    rendererTitle: string;
    rendererBody: string;
    reload: string;
  };
  texture: {
    nasa: string;
    nasaModel: string;
    nasaLoading: string;
    procedural: string;
    sun: string;
  };
  errors: {
    missingRoot: string;
    missingCanvas: string;
    rendererInit: string;
    resources: string;
  };
}

export interface LocalizedBodyCopy {
  name: string;
  temperature: string;
  description: string;
}

export const LANGUAGE_STORAGE_KEY = "orbital-atlas-language";

const EN_MESSAGES: Messages = {
  document: {
    title: "Orbital Atlas | Interactive Solar System",
    description: "An interactive 3D Solar System based on scientific data, with close-up exploration, time simulation, and guided camera modes.",
  },
  loading: {
    renderer: "Initializing renderer",
    scene: "Building stars and orbits",
    bodyTexture: (name) => `Preparing ${name} texture`,
    camera: "Calibrating camera and color",
    ready: "Ready",
    networkTexture: "Transferring observation textures",
  },
  modes: {
    overview: "Overview",
    focus: "Body focus",
    tour: "Guided tour",
    cinematic: "Cinematic",
    flight: "Free flight",
  },
  kinds: {
    star: "Star",
    rocky: "Rocky planet",
    terrestrial: "Terrestrial planet",
    "gas-giant": "Gas giant",
    "ice-giant": "Ice giant",
    moon: "Natural satellite",
  },
  units: {
    hour: { one: "hour", other: "hours" },
    day: { one: "day", other: "days" },
    year: { one: "year", other: "years" },
    secondShort: "s",
  },
  format: {
    notApplicable: "Not applicable",
    paused: "Paused",
    realTime: "Real time",
    solarSystemCenter: "Solar System center",
    fromBody: (distance, parentName) => `${distance} from ${parentName}`,
    focused: (name) => `Focused on ${name}`,
  },
  hud: {
    atlasEyebrow: "INTERACTIVE SOLAR SYSTEM",
    atlasTitle: "Orbital Atlas",
    loadingInitial: "Preparing scientific data",
    loadingNote: "Local observation maps come from NASA, USGS, NOAA and scientific archives; measured elevation is used where available.",
    canvasAria: "Interactive 3D Solar System",
    loadingAria: "Solar System loading progress",
    sceneStatusAria: "Scene status",
    solarSystem: "Solar System",
    simulationUtc: "Simulation UTC",
    simulationDateAria: "Simulation UTC date",
    rendering: "Render",
    language: "Language",
    switchLanguageValue: "中文",
    switchLanguageAria: "Switch language to Simplified Chinese",
    catalogTitle: "Bodies",
    profileEyebrow: "ORBITAL PROFILE",
    averageRadius: "Average radius",
    orbitalDistance: "Orbital distance",
    orbitalPeriod: "Orbital period",
    rotationPeriod: "Rotation period",
    axialTilt: "Axial tilt",
    orbitalInclination: "Orbital inclination",
    temperature: "Temperature",
    surfaceSource: "Surface source",
    approach: "Approach",
    returnOverview: "Return to overview",
    collapseDetails: "Collapse details",
    expandDetails: "Expand details",
    controlsAria: "Solar System controls",
    bodies: "Bodies",
    overview: "Overview",
    settings: "Settings",
    settingsTitle: "Display settings",
    orbitLines: "Orbit lines",
    settingOn: "On",
    settingOff: "Off",
    oneHourPerSecond: "1 hour/s",
    oneDayPerSecond: "1 day/s",
    cycleTimeRateAria: (current, next) => `Change time rate. Current: ${current}. Next: ${next}.`,
    cameraModes: "Mode",
    tour: "Tour",
    guidedTour: "Guided tour",
    cinematic: "Cinematic",
    compactCinematic: "Cinema",
    freeFlight: "Free flight",
    compactFlight: "Flight",
    cycleCameraModeAria: (current, next) => `Switch camera mode. Current: ${current}. Next: ${next}.`,
    compactTourHelp: "The camera advances automatically; drag to stop",
    compactDefaultHelp: "One finger to orbit, pinch to zoom",
    flightHelp: "WASD to move, Q/E for elevation, Shift to accelerate, Esc to exit",
    tourHelp: "The camera advances by chapter; drag the scene to stop",
    cinematicHelp: "The camera orbits automatically; choose another mode to exit",
    defaultHelp: "Drag to orbit, scroll to zoom",
    compactHint: "Tap “Bodies” to choose a target. Drag to orbit; pinch to zoom.",
    desktopHint: "Select a body for a close view. Press T for a tour; Space to pause time.",
    contextEyebrow: "GRAPHICS CONTEXT",
    contextTitle: "Graphics context paused",
    contextBody: "The browser is attempting to restore the scene. Simulation time is paused.",
    rendererEyebrow: "RENDERER ERROR",
    rendererTitle: "Unable to start the 3D scene",
    rendererBody: "Check that your browser and device support WebGL2.",
    reload: "Reload",
  },
  texture: {
    nasa: "Scientific observation map",
    nasaModel: "NASA/JPL 3D model",
    nasaLoading: "Loading scientific observation map",
    procedural: "Render-derived scientific material",
    sun: "Procedural photosphere based on NASA/SDO",
  },
  errors: {
    missingRoot: "Application root is missing",
    missingCanvas: "3D canvas is missing",
    rendererInit: "The browser could not initialize WebGL2.",
    resources: "Solar System resources failed to initialize.",
  },
};

const ZH_MESSAGES: Messages = {
  document: {
    title: "轨道图谱 | 交互式太阳系",
    description: "基于科学数据的交互式三维太阳系，支持天体聚焦、时间推演与电影式导览。",
  },
  loading: {
    renderer: "初始化渲染器",
    scene: "构建恒星与轨道",
    bodyTexture: (name) => `完成${name}纹理`,
    camera: "校准镜头与色彩",
    ready: "准备完成",
    networkTexture: "传输观测纹理",
  },
  modes: {
    overview: "全景浏览",
    focus: "天体聚焦",
    tour: "自动导览",
    cinematic: "电影镜头",
    flight: "自由飞行",
  },
  kinds: {
    star: "G 型主序星",
    rocky: "岩质行星",
    terrestrial: "类地行星",
    "gas-giant": "气态巨行星",
    "ice-giant": "冰巨行星",
    moon: "天然卫星",
  },
  units: {
    hour: { one: "小时", other: "小时" },
    day: { one: "天", other: "天" },
    year: { one: "年", other: "年" },
    secondShort: "秒",
  },
  format: {
    notApplicable: "不适用",
    paused: "已暂停",
    realTime: "实时时间",
    solarSystemCenter: "太阳系中心",
    fromBody: (distance, parentName) => `${distance}（距${parentName}）`,
    focused: (name) => `已聚焦${name}`,
  },
  hud: {
    atlasEyebrow: "ORBITAL ATLAS",
    atlasTitle: "轨道图谱",
    loadingInitial: "准备科学数据",
    loadingNote: "本地观测纹理来自 NASA、USGS、NOAA 与科学档案；可用时使用实测高程",
    canvasAria: "交互式三维太阳系",
    loadingAria: "太阳系资源载入进度",
    sceneStatusAria: "场景状态",
    solarSystem: "太阳系",
    simulationUtc: "模拟 UTC",
    simulationDateAria: "模拟 UTC 日期",
    rendering: "渲染",
    language: "语言",
    switchLanguageValue: "EN",
    switchLanguageAria: "切换语言为英文",
    catalogTitle: "天体目录",
    profileEyebrow: "天体档案",
    averageRadius: "平均半径",
    orbitalDistance: "轨道距离",
    orbitalPeriod: "公转周期",
    rotationPeriod: "自转周期",
    axialTilt: "轴倾角",
    orbitalInclination: "轨道倾角",
    temperature: "温度",
    surfaceSource: "表面来源",
    approach: "近轨观测",
    returnOverview: "返回全景",
    collapseDetails: "收起天体详情",
    expandDetails: "展开天体详情",
    controlsAria: "太阳系控制",
    bodies: "天体",
    overview: "全景",
    settings: "设置",
    settingsTitle: "显示设置",
    orbitLines: "轨道线",
    settingOn: "开",
    settingOff: "关",
    oneHourPerSecond: "1 小时/秒",
    oneDayPerSecond: "1 天/秒",
    cycleTimeRateAria: (current, next) => `切换时间倍率。当前：${current}；下一档：${next}。`,
    cameraModes: "模式",
    tour: "导览",
    guidedTour: "自动导览",
    cinematic: "电影镜头",
    compactCinematic: "电影",
    freeFlight: "自由飞行",
    compactFlight: "飞行",
    cycleCameraModeAria: (current, next) => `切换视角模式。当前：${current}；下一项：${next}。`,
    compactTourHelp: "镜头自动推进，拖动画面可中止",
    compactDefaultHelp: "单指环绕，双指缩放",
    flightHelp: "WASD 移动，Q/E 升降，Shift 加速，Esc 退出",
    tourHelp: "镜头按章节推进，拖动画面可中止",
    cinematicHelp: "镜头自动环绕，选择其他模式可退出",
    defaultHelp: "拖动环绕，滚轮缩放",
    compactHint: "轻点“天体”选择目标，单指环绕，双指缩放。",
    desktopHint: "选择任一天体进入近轨观察。按 T 开始导览，空格暂停时间。",
    contextEyebrow: "GRAPHICS CONTEXT",
    contextTitle: "图形上下文已暂停",
    contextBody: "浏览器正在尝试恢复场景，模拟时间已经暂停。",
    rendererEyebrow: "RENDERER ERROR",
    rendererTitle: "无法启动三维场景",
    rendererBody: "请检查浏览器是否支持 WebGL2。",
    reload: "重新载入",
  },
  texture: {
    nasa: "科学观测纹理",
    nasaModel: "NASA/JPL 观测模型",
    nasaLoading: "正在载入科学观测纹理",
    procedural: "科学参考的渲染派生材质",
    sun: "程序光球，参考 NASA/SDO",
  },
  errors: {
    missingRoot: "缺少应用根节点",
    missingCanvas: "缺少三维画布",
    rendererInit: "浏览器无法初始化 WebGL2。",
    resources: "太阳系资源初始化失败。",
  },
};

const EN_BODY_COPY: Record<BodyId, LocalizedBodyCopy> = {
  sun: {
    name: "Sun",
    temperature: "About 5,500 °C (photosphere)",
    description: "The star at the center of the Solar System, accounting for about 99.86% of its total mass. Animated flow noise recreates the granular texture of the photosphere.",
  },
  mercury: {
    name: "Mercury",
    temperature: "-180 to 430 °C",
    description: "The closest planet to the Sun. With almost no atmosphere, its ancient surface is scarred by impact craters and cliffs stretching for hundreds of kilometers.",
  },
  venus: {
    name: "Venus",
    temperature: "About 465 °C",
    description: "A dense carbon dioxide atmosphere and clouds of sulfuric acid completely hide the surface. Venus rotates very slowly in the opposite direction to most planets, and its greenhouse effect is extreme.",
  },
  earth: {
    name: "Earth",
    temperature: "Average: about 15 °C",
    description: "Earth has liquid oceans, an oxygen-rich atmosphere, and active plate tectonics. Clouds, city lights on the night side, and a thin blue atmospheric glow are rendered as separate layers.",
  },
  moon: {
    name: "Moon",
    temperature: "-173 to 127 °C",
    description: "Earth’s only natural satellite. Its rotation period matches its orbital period, so nearly the same hemisphere always faces Earth.",
  },
  mars: {
    name: "Mars",
    temperature: "Average: about -63 °C",
    description: "Observation color, measured elevation, polar caps, and a thin dust haze reveal terrain including Olympus Mons and the vast Valles Marineris canyon system.",
  },
  phobos: {
    name: "Phobos",
    temperature: "About -112 to -4 °C",
    description: "Mars’s inner moon is irregular and heavily cratered. It circles Mars in about 7 hours 39 minutes, orbiting faster than Mars rotates.",
  },
  deimos: {
    name: "Deimos",
    temperature: "About -112 to -4 °C",
    description: "Mars’s outer moon is smaller than Phobos. A deep layer of loose regolith softens the outlines of its impact craters.",
  },
  jupiter: {
    name: "Jupiter",
    temperature: "Cloud tops: about -145 °C",
    description: "The largest planet in the Solar System. Rapid rotation shapes its distinct cloud bands, while the Great Red Spot is a colossal storm that has raged for centuries.",
  },
  saturn: {
    name: "Saturn",
    temperature: "Cloud tops: about -178 °C",
    description: "A gas giant composed mainly of hydrogen and helium. Its main rings consist of countless particles of ice and rock, with the Cassini Division clearly visible.",
  },
  uranus: {
    name: "Uranus",
    temperature: "Cloud tops: about -224 °C",
    description: "Methane absorbs red light, giving the atmosphere its soft cyan hue. Uranus rotates with its axis almost in the plane of its orbit, producing extreme seasonal changes.",
  },
  neptune: {
    name: "Neptune",
    temperature: "Cloud tops: about -214 °C",
    description: "A distant ice giant with the fastest winds of any planet in the Solar System. High-altitude methane-ice clouds form bright streaks against its deep-blue atmosphere.",
  },
};

function localeForLanguage(language: string): Locale | null {
  const primaryLanguage = language.trim().split("-")[0]?.toLowerCase();
  if (primaryLanguage === "zh") return "zh-Hans";
  if (primaryLanguage === "en") return "en";
  return null;
}

function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "zh-Hans";
}

export function resolveLocale(
  savedLocale: string | null,
  languages: readonly string[] = [],
  fallbackLanguage = "",
): LocaleSelection {
  const candidates = languages.length > 0
    ? [...languages]
    : fallbackLanguage
      ? [fallbackLanguage]
      : [];

  if (isLocale(savedLocale)) {
    const formatLocale = candidates.find((language) => localeForLanguage(language) === savedLocale)
      ?? (savedLocale === "zh-Hans" ? "zh-CN" : "en");
    return { locale: savedLocale, formatLocale };
  }

  for (const language of candidates) {
    const locale = localeForLanguage(language);
    if (locale) return { locale, formatLocale: language };
  }

  return { locale: "en", formatLocale: "en" };
}

export function getMessages(locale: Locale): Messages {
  return locale === "zh-Hans" ? ZH_MESSAGES : EN_MESSAGES;
}

export function getBodyCopy(locale: Locale, body: CelestialBody): LocalizedBodyCopy {
  if (locale === "zh-Hans") {
    return { name: body.name, temperature: body.temperature, description: body.description };
  }
  return EN_BODY_COPY[body.id];
}

export function applyDocumentLocale(locale: Locale): void {
  const messages = getMessages(locale);
  document.documentElement.lang = locale;
  document.title = messages.document.title;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')
    ?.setAttribute("content", messages.document.description);
}
