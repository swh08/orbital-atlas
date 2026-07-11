import "./styles.css";
import { applyDocumentLocale, getMessages, LANGUAGE_STORAGE_KEY, resolveLocale } from "./i18n";
import { SolarSystem } from "./render/SolarSystem";
import { Hud } from "./ui/Hud";

async function bootstrap(): Promise<void> {
  const localeSelection = resolveLocale(
    window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
    navigator.languages,
    navigator.language,
  );
  applyDocumentLocale(localeSelection.locale);
  const messages = getMessages(localeSelection.locale);
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) throw new Error(messages.errors.missingRoot);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hud = new Hud(root, localeSelection);
  const canvas = root.querySelector<HTMLCanvasElement>("#space-canvas");
  if (!canvas) throw new Error(messages.errors.missingCanvas);

  let solarSystem: SolarSystem;
  try {
    solarSystem = new SolarSystem(canvas, reducedMotion, {
      onBodySelected: (body) => hud.setSelectedBody(body),
      onBodyHovered: (body, x, y) => hud.setHoveredBody(body, x, y),
      onCameraModeChanged: (mode) => hud.setCameraMode(mode),
      onDateChanged: (date, rate) => hud.setDate(date, rate),
      onFpsChanged: (fps) => hud.setFps(fps),
      onLoadingChanged: (progress, stage) => hud.setLoading(progress, stage),
      onContextStateChanged: (state) => hud.setContextState(state),
      onTextureSourceChanged: (bodyId, source) => hud.setTextureSource(bodyId, source),
    });
  } catch (error) {
    console.error(error);
    hud.showFatalError(messages.errors.rendererInit);
    return;
  }

  hud.setActions({
    selectBody: (bodyId) => solarSystem.selectBody(bodyId),
    overview: () => solarSystem.setOverview(),
    toggleTour: () => solarSystem.toggleTour(),
    cinematic: () => solarSystem.startCinematic(),
    flight: () => solarSystem.startFlight(),
    approach: () => solarSystem.approachSelected(),
    setTimeRate: (rate) => solarSystem.setTimeRate(rate),
    resetDate: () => solarSystem.resetDate(),
    changeLocale: (nextLocale) => {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale);
      window.location.reload();
    },
  });
  hud.setDate(solarSystem.getSimulationDate(), solarSystem.getTimeRate());

  try {
    await solarSystem.initialize();
  } catch (error) {
    console.error(error);
    hud.showFatalError(messages.errors.resources);
  }

  window.addEventListener("beforeunload", () => solarSystem.destroy(), { once: true });
}

void bootstrap();
