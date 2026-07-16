import { BODIES, BODY_BY_ID, type BodyId, type CelestialBody } from "../data/bodies";
import { getBodyCopy, getMessages, type Locale, type LocaleSelection, type Messages } from "../i18n";
import type { CameraMode, LoadingStage } from "../render/SolarSystem";
import { hasObservationSurface, textureSourceUrl } from "../render/textures";

export interface HudActions {
  selectBody: (bodyId: BodyId) => void;
  overview: () => void;
  toggleTour: () => void;
  cinematic: () => void;
  flight: () => void;
  approach: () => void;
  setTimeRate: (rate: number) => void;
  setOrbitLinesVisible: (visible: boolean) => void;
  changeLocale: (locale: Locale) => void;
}

type PanelName = "catalog" | "details" | "settings";
type CycledCameraMode = Extract<CameraMode, "tour" | "cinematic" | "flight">;

const MOBILE_CAMERA_MODES: readonly CycledCameraMode[] = ["tour", "cinematic", "flight"];
const TIME_RATES = [1 / 86_400, 1 / 24, 1, 7, 30] as const;
const AU_KM = 149_597_870.7;

export class Hud {
  private readonly root: HTMLElement;
  private readonly locale: Locale;
  private readonly formatLocale: string;
  private readonly messages: Messages;
  private actions: HudActions | null = null;
  private orbitLinesVisible = true;
  private timeRate = 1 / 24;
  private selectedBodyId: BodyId = "sun";
  private loaderDismissed = false;
  private hasInitialSelection = false;
  private cameraMode: CameraMode = "overview";
  private panelReturnFocus: HTMLElement | null = null;
  private readonly compactUiQuery = window.matchMedia(
    "(max-width: 720px), (pointer: coarse) and (max-width: 840px), (orientation: landscape) and (max-height: 520px)",
  );
  private compactUi = this.compactUiQuery.matches;

  constructor(root: HTMLElement, localeSelection: LocaleSelection) {
    this.root = root;
    this.locale = localeSelection.locale;
    this.formatLocale = localeSelection.formatLocale;
    this.messages = getMessages(this.locale);
    this.render();
    this.bindEvents();
  }

  setActions(actions: HudActions): void {
    this.actions = actions;
  }

  setLoading(progress: number, stage: LoadingStage): void {
    const loader = this.query<HTMLElement>("#loading-screen");
    const bar = this.query<HTMLElement>("#loading-progress");
    const value = this.query<HTMLElement>("#loading-value");
    const status = this.query<HTMLElement>("#loading-status");
    const safeProgress = Math.max(0, Math.min(1, progress));
    bar.style.transform = `scaleX(${safeProgress})`;
    value.textContent = `${Math.round(safeProgress * 100)}%`;
    const label = this.loadingLabel(stage);
    status.textContent = label;
    loader.setAttribute("aria-valuenow", String(Math.round(safeProgress * 100)));
    loader.setAttribute("aria-valuetext", label);
    if (safeProgress >= 1 && !this.loaderDismissed) {
      this.loaderDismissed = true;
      window.setTimeout(() => {
        loader.classList.add("is-complete");
        this.query<HTMLElement>("#interaction-hint").classList.add("is-visible");
        window.setTimeout(() => this.query<HTMLElement>("#interaction-hint").classList.remove("is-visible"), 5_500);
      }, 160);
    }
  }

  setSelectedBody(body: CelestialBody): void {
    const copy = getBodyCopy(this.locale, body);
    this.selectedBodyId = body.id;
    this.query<HTMLElement>("#current-body-name").textContent = copy.name;
    this.query<HTMLElement>("#details-name").textContent = copy.name;
    this.query<HTMLElement>("#details-english").textContent = this.locale === "zh-Hans"
      ? body.englishName
      : this.messages.hud.profileEyebrow;
    this.query<HTMLElement>("#details-kind").textContent = this.messages.kinds[body.kind];
    this.query<HTMLElement>("#details-description").textContent = copy.description;
    this.query<HTMLElement>("#detail-radius").textContent = `${this.formatNumber(body.radiusKm)} km`;
    const parent = body.parentId ? BODY_BY_ID.get(body.parentId) : undefined;
    this.query<HTMLElement>("#detail-distance").textContent = body.id === "sun"
      ? this.messages.format.solarSystemCenter
      : parent
        ? this.messages.format.fromBody(
          `${this.formatNumber(body.semiMajorAxisAu * AU_KM, 0)} km`,
          getBodyCopy(this.locale, parent).name,
        )
        : `${this.formatNumber(body.semiMajorAxisAu, 4)} AU`;
    this.query<HTMLElement>("#detail-orbit").textContent = this.formatPeriod(body.orbitalPeriodDays);
    this.query<HTMLElement>("#detail-rotation").textContent = this.formatPeriod(Math.abs(body.rotationPeriodHours) / 24);
    this.query<HTMLElement>("#detail-tilt").textContent = `${this.formatNumber(body.axialTiltDeg, 3)}°`;
    this.query<HTMLElement>("#detail-inclination").textContent = `${this.formatNumber(body.inclinationDeg, 3)}°`;
    this.query<HTMLElement>("#detail-temperature").textContent = copy.temperature;
    this.query<HTMLElement>("#texture-source").textContent = this.textureSourceLabel(body.id);
    if (this.hasInitialSelection && this.cameraMode !== "tour") {
      this.openPanel("details", this.query<HTMLButtonElement>("#catalog-button"));
    } else if (!this.hasInitialSelection) {
      this.hasInitialSelection = true;
    }
    this.query<HTMLElement>("#live-region").textContent = this.messages.format.focused(copy.name);

    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-body-id]")) {
      const active = button.dataset.bodyId === body.id;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "true" : "false");
    }
  }

  setHoveredBody(body: CelestialBody | null, x: number, y: number): void {
    const tooltip = this.query<HTMLElement>("#body-tooltip");
    if (!body) {
      tooltip.classList.remove("is-visible");
      return;
    }
    const copy = getBodyCopy(this.locale, body);
    const secondary = this.locale === "zh-Hans" ? body.englishName : this.messages.kinds[body.kind];
    tooltip.innerHTML = `<strong>${copy.name}</strong><span>${secondary}</span>`;
    tooltip.style.transform = `translate3d(${Math.min(window.innerWidth - 150, x + 16)}px, ${Math.min(window.innerHeight - 70, y + 16)}px, 0)`;
    tooltip.classList.add("is-visible");
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.query<HTMLElement>("#camera-mode").textContent = this.messages.modes[mode];
    const help = this.query<HTMLElement>("#camera-help");
    help.textContent = this.compactUi
      ? mode === "tour"
        ? this.messages.hud.compactTourHelp
        : this.messages.hud.compactDefaultHelp
      : mode === "flight"
      ? this.messages.hud.flightHelp
      : mode === "tour"
        ? this.messages.hud.tourHelp
        : mode === "cinematic"
          ? this.messages.hud.cinematicHelp
          : this.messages.hud.defaultHelp;
    if (mode === "flight") this.closePanel("details");
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-camera-mode]")) {
      button.classList.toggle("is-active", button.dataset.cameraMode === mode);
      button.setAttribute("aria-pressed", String(button.dataset.cameraMode === mode));
    }
    this.syncMobileCameraModeButton(mode);
    if (this.compactUi && (mode === "tour" || mode === "cinematic")) this.closePanel("details");
  }

  setDate(date: Date, rate: number): void {
    this.timeRate = rate;
    this.query<HTMLElement>("#simulation-date").textContent = new Intl.DateTimeFormat(this.formatLocale, {
      timeZone: "UTC",
      dateStyle: "short",
    }).format(date);
    const button = this.query<HTMLButtonElement>("#time-rate-toggle");
    const currentLabel = this.formatRate(rate);
    const nextLabel = this.formatRate(this.nextTimeRate(rate));
    this.query<HTMLElement>("#rate-label").textContent = currentLabel;
    button.setAttribute("aria-label", this.messages.hud.cycleTimeRateAria(currentLabel, nextLabel));
  }

  setFps(fps: number): void {
    this.query<HTMLElement>("#fps-value").textContent = `${fps} FPS`;
  }

  setContextState(state: "lost" | "restored"): void {
    const overlay = this.query<HTMLElement>("#context-overlay");
    overlay.classList.toggle("is-visible", state === "lost");
    overlay.setAttribute("aria-hidden", String(state !== "lost"));
  }

  setTextureSource(bodyId: BodyId, source: "observation" | "renderDerived" | "loading"): void {
    if (bodyId !== this.selectedBodyId) return;
    const label = source === "observation"
      ? bodyId === "phobos" || bodyId === "deimos"
        ? this.messages.texture.nasaModel
        : this.messages.texture.nasa
      : source === "loading"
        ? this.messages.texture.nasaLoading
        : this.messages.texture.procedural;
    this.query<HTMLElement>("#texture-source").textContent = label;
  }

  showFatalError(message: string): void {
    this.query<HTMLElement>("#fatal-message").textContent = message;
    const overlay = this.query<HTMLElement>("#fatal-overlay");
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
  }

  private render(): void {
    const m = this.messages;
    const sun = BODIES[0];
    const sunCopy = getBodyCopy(this.locale, sun);
    this.root.innerHTML = `
      <main class="experience-shell">
        <canvas id="space-canvas" class="space-canvas" tabindex="0" aria-label="${m.hud.canvasAria}" aria-describedby="camera-help"></canvas>

        <div id="loading-screen" class="loading-screen" role="progressbar" aria-label="${m.hud.loadingAria}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="loading-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="loading-copy">
            <div class="loading-heading">
              <img src="/brand/orbital-atlas-logo.png" alt="" aria-hidden="true" />
              <div class="loading-heading-copy"><p>${m.hud.atlasEyebrow}</p><h1>${m.hud.atlasTitle}</h1></div>
            </div>
            <div class="loading-meta"><span id="loading-status">${m.hud.loadingInitial}</span><span id="loading-value">0%</span></div>
            <div class="loading-track"><span id="loading-progress"></span></div>
            <small>${m.hud.loadingNote}</small>
          </div>
        </div>

        <header class="top-bar" aria-label="${m.hud.sceneStatusAria}">
          <div class="brand-lockup">
            <img class="brand-mark" src="/brand/orbital-atlas-logo.png" alt="" aria-hidden="true" />
            <div class="brand-copy">
              <p>ORBITAL ATLAS</p>
              <div class="brand-current"><strong>${m.hud.solarSystem}</strong><span>/</span><span id="current-body-name">${sunCopy.name}</span></div>
            </div>
          </div>
          <div class="status-cluster">
            <div class="status-item" aria-label="${m.hud.simulationDateAria}"><span>${m.hud.simulationUtc}</span><strong id="simulation-date">----</strong></div>
            <div class="status-item status-fps"><span>${m.hud.rendering}</span><strong id="fps-value">-- FPS</strong></div>
          </div>
        </header>

        <div id="panel-scrim" class="panel-scrim" aria-hidden="true"></div>

        <section id="catalog-panel" class="catalog-panel" role="dialog" aria-modal="false" aria-hidden="true" aria-labelledby="catalog-title" inert>
          <h2 id="catalog-title" class="sr-only">${m.hud.catalogTitle}</h2>
          <div class="catalog-grid">
            ${BODIES.map((body) => {
              const copy = getBodyCopy(this.locale, body);
              const textureUrl = textureSourceUrl(body.id);
              const textureStyle = textureUrl ? `--body-texture:url(${textureUrl});` : "";
              return `
              <button class="catalog-item" type="button" data-body-id="${body.id}" style="--body-color:${body.accent};${textureStyle}">
                <span class="body-orb" aria-hidden="true"></span>
                <strong>${copy.name}</strong>
              </button>
            `;
            }).join("")}
          </div>
        </section>

        <section id="settings-panel" class="settings-panel" role="dialog" aria-modal="false" aria-hidden="true" aria-labelledby="settings-title" inert>
          <div class="settings-heading">
            <strong id="settings-title">${m.hud.settingsTitle}</strong>
          </div>
          <button id="language-button" class="settings-toggle" type="button" aria-label="${m.hud.switchLanguageAria}">
            <span>${m.hud.language}</span><strong lang="${this.locale === "en" ? "zh-Hans" : "en"}">${m.hud.switchLanguageValue}</strong>
          </button>
          <button id="orbit-lines-toggle" class="settings-toggle is-active" type="button" aria-pressed="true">
            <span>${m.hud.orbitLines}</span>
            <strong>${m.hud.settingOn}</strong>
          </button>
        </section>

        <aside id="details-panel" class="details-panel" role="dialog" aria-modal="${String(this.compactUi)}" aria-hidden="true" aria-labelledby="details-name" inert>
          <div class="details-accent" aria-hidden="true"></div>
          <div class="panel-heading details-heading">
            <div><p id="details-english">${this.locale === "zh-Hans" ? sun.englishName : m.hud.profileEyebrow}</p><h2 id="details-name">${sunCopy.name}</h2></div>
            <div class="details-summary">
              <p id="details-kind" class="body-kind">${m.kinds[sun.kind]}</p>
              <p id="details-description" class="details-description"></p>
            </div>
          </div>
          <dl class="body-facts">
            <div><dt>${m.hud.averageRadius} / ${m.hud.orbitalDistance}</dt><dd><span id="detail-radius"></span> / <span id="detail-distance"></span></dd></div>
            <div><dt>${m.hud.orbitalPeriod} / ${m.hud.rotationPeriod}</dt><dd><span id="detail-orbit"></span> / <span id="detail-rotation"></span></dd></div>
            <div><dt>${m.hud.axialTilt} / ${m.hud.orbitalInclination}</dt><dd><span id="detail-tilt"></span> / <span id="detail-inclination"></span></dd></div>
            <div><dt>${m.hud.temperature}</dt><dd id="detail-temperature"></dd></div>
          </dl>
          <div class="source-note"><span>${m.hud.surfaceSource}</span><strong id="texture-source">${m.texture.procedural}</strong></div>
          <div class="details-actions">
            <button id="approach-button" class="primary-button" type="button">${m.hud.approach}</button>
            <button id="overview-detail-button" class="secondary-button" type="button">${m.hud.returnOverview}</button>
          </div>
        </aside>

        <div class="bottom-controls" role="group" aria-label="${m.hud.controlsAria}">
          <button class="control-button is-active" type="button" data-camera-mode="overview" aria-pressed="true">${m.hud.overview}</button>
          <button id="catalog-button" class="control-button" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="catalog-panel">${m.hud.bodies}</button>
          <span class="control-separator" aria-hidden="true"></span>
          <button id="time-rate-toggle" class="control-button time-rate-toggle control-group-start" type="button" aria-label="${m.hud.cycleTimeRateAria(m.hud.oneHourPerSecond, m.hud.oneDayPerSecond)}"><span id="rate-label">${m.hud.oneHourPerSecond}</span></button>
          <span class="control-separator mode-separator" aria-hidden="true"></span>
          <button id="tour-button" class="control-button mode-control control-group-start" type="button" data-camera-mode="tour" aria-pressed="false">${this.compactUi ? m.hud.tour : m.hud.guidedTour}</button>
          <button id="cinematic-button" class="control-button mode-control" type="button" data-camera-mode="cinematic" aria-pressed="false">${m.hud.cinematic}</button>
          <button id="flight-button" class="control-button mode-control" type="button" data-camera-mode="flight" aria-pressed="false">${m.hud.freeFlight}</button>
          <button id="mobile-mode-button" class="control-button mobile-mode-control control-group-start" type="button" aria-pressed="false" aria-label="${m.hud.cycleCameraModeAria(m.modes.overview, m.modes.tour)}">${m.hud.cameraModes}</button>
          <span class="control-separator settings-separator" aria-hidden="true"></span>
          <button id="settings-button" class="control-button control-group-start" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="settings-panel">${m.hud.settings}</button>
        </div>

        <div class="camera-chip"><span id="camera-mode">${m.modes.overview}</span><span id="camera-help">${this.compactUi ? m.hud.compactDefaultHelp : m.hud.defaultHelp}</span></div>
        <div id="interaction-hint" class="interaction-hint" role="status">${this.compactUi ? m.hud.compactHint : m.hud.desktopHint}</div>
        <div id="body-tooltip" class="body-tooltip" aria-hidden="true"></div>

        <div id="context-overlay" class="system-overlay" aria-hidden="true">
          <div><p>${m.hud.contextEyebrow}</p><h2>${m.hud.contextTitle}</h2><span>${m.hud.contextBody}</span></div>
        </div>
        <div id="fatal-overlay" class="system-overlay" role="alertdialog" aria-modal="true" aria-labelledby="fatal-title" aria-hidden="true">
          <div><p>${m.hud.rendererEyebrow}</p><h2 id="fatal-title">${m.hud.rendererTitle}</h2><span id="fatal-message">${m.hud.rendererBody}</span><button type="button" onclick="location.reload()">${m.hud.reload}</button></div>
        </div>
        <div id="live-region" class="sr-only" aria-live="polite"></div>
      </main>
    `;
  }

  private bindEvents(): void {
    this.root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      this.closePopoversOutside(target);
      if (target.closest("#panel-scrim")) {
        this.closeOpenPanel();
        return;
      }
      const bodyButton = target.closest<HTMLButtonElement>("[data-body-id]");
      if (bodyButton?.dataset.bodyId) {
        this.actions?.selectBody(bodyButton.dataset.bodyId as BodyId);
        const detailsOpened = this.query<HTMLElement>("#details-panel").classList.contains("is-open");
        this.closePanel("catalog", !detailsOpened);
        return;
      }
      if (target.closest("#catalog-button")) this.toggleCatalog();
      else if (target.closest("#settings-button")) this.toggleSettings();
      else if (target.closest("#overview-detail-button")) {
        this.actions?.overview();
        this.closePanel("details");
      }
      else if (target.closest("#orbit-lines-toggle")) this.toggleOrbitLines();
      else if (target.closest("[data-camera-mode='overview']")) this.actions?.overview();
      else if (target.closest("#time-rate-toggle")) this.actions?.setTimeRate(this.nextTimeRate(this.timeRate));
      else if (target.closest("#mobile-mode-button")) this.cycleMobileCameraMode();
      else if (target.closest("#tour-button")) this.actions?.toggleTour();
      else if (target.closest("#cinematic-button")) this.actions?.cinematic();
      else if (target.closest("#flight-button")) {
        this.actions?.flight();
        this.query<HTMLCanvasElement>("#space-canvas").focus({ preventScroll: true });
      }
      else if (target.closest("#approach-button")) {
        this.actions?.approach();
        if (this.compactUi) this.closePanel("details");
      }
      else if (target.closest("#language-button")) this.actions?.changeLocale(this.locale === "en" ? "zh-Hans" : "en");
    });

    this.root.addEventListener("focusout", (event) => {
      const nextFocus = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      window.setTimeout(() => this.closeBlurredPopovers(nextFocus));
    });

    this.compactUiQuery.addEventListener("change", this.handleCompactUiChange);

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (this.closeOpenPanel()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (this.cameraMode === "flight") {
        window.requestAnimationFrame(() => {
          this.query<HTMLButtonElement>("[data-camera-mode='overview']").focus({ preventScroll: true });
        });
      }
    });
  }

  private toggleCatalog(): void {
    const panel = this.query<HTMLElement>("#catalog-panel");
    const open = !panel.classList.contains("is-open");
    if (open) this.openPanel("catalog", this.query<HTMLButtonElement>("#catalog-button"));
    else this.closePanel("catalog");
  }

  private toggleSettings(): void {
    const panel = this.query<HTMLElement>("#settings-panel");
    const open = !panel.classList.contains("is-open");
    if (open) this.openPanel("settings", this.query<HTMLButtonElement>("#settings-button"));
    else this.closePanel("settings");
  }

  private toggleOrbitLines(): void {
    this.orbitLinesVisible = !this.orbitLinesVisible;
    this.actions?.setOrbitLinesVisible(this.orbitLinesVisible);
    const button = this.query<HTMLButtonElement>("#orbit-lines-toggle");
    button.classList.toggle("is-active", this.orbitLinesVisible);
    button.setAttribute("aria-pressed", String(this.orbitLinesVisible));
    button.querySelector("strong")!.textContent = this.orbitLinesVisible
      ? this.messages.hud.settingOn
      : this.messages.hud.settingOff;
  }

  private cycleMobileCameraMode(): void {
    const currentIndex = MOBILE_CAMERA_MODES.indexOf(this.cameraMode as CycledCameraMode);
    const nextMode = MOBILE_CAMERA_MODES[(currentIndex + 1) % MOBILE_CAMERA_MODES.length];
    if (nextMode === "tour") this.actions?.toggleTour();
    else if (nextMode === "cinematic") this.actions?.cinematic();
    else {
      this.actions?.flight();
      this.query<HTMLCanvasElement>("#space-canvas").focus({ preventScroll: true });
    }
  }

  private syncMobileCameraModeButton(mode: CameraMode): void {
    const button = this.query<HTMLButtonElement>("#mobile-mode-button");
    const currentIndex = MOBILE_CAMERA_MODES.indexOf(mode as CycledCameraMode);
    const active = currentIndex >= 0;
    const nextMode = MOBILE_CAMERA_MODES[(currentIndex + 1) % MOBILE_CAMERA_MODES.length];
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      this.messages.hud.cycleCameraModeAria(this.messages.modes[mode], this.messages.modes[nextMode]),
    );
    button.textContent = mode === "tour"
      ? this.messages.hud.tour
      : mode === "cinematic"
        ? this.messages.hud.compactCinematic
        : mode === "flight"
          ? this.messages.hud.compactFlight
          : this.messages.hud.cameraModes;
  }

  private closePopoversOutside(target: HTMLElement): void {
    for (const panelName of ["catalog", "settings"] as const) {
      const panel = this.query<HTMLElement>(`#${panelName}-panel`);
      const trigger = this.query<HTMLButtonElement>(`#${panelName}-button`);
      if (panel.classList.contains("is-open") && !panel.contains(target) && !trigger.contains(target)) {
        this.closePanel(panelName, false);
      }
    }
  }

  private closeBlurredPopovers(focusTarget: Element | null): void {
    for (const panelName of ["catalog", "settings"] as const) {
      const panel = this.query<HTMLElement>(`#${panelName}-panel`);
      const trigger = this.query<HTMLButtonElement>(`#${panelName}-button`);
      if (panel.classList.contains("is-open") && !panel.contains(focusTarget) && !trigger.contains(focusTarget)) {
        this.closePanel(panelName, false);
      }
    }
  }

  private openPanel(panelName: PanelName, returnFocus: HTMLElement): void {
    for (const otherPanel of ["catalog", "details", "settings"] as const) {
      if (otherPanel !== panelName) this.closePanel(otherPanel, false);
    }
    const panel = this.query<HTMLElement>(`#${panelName}-panel`);
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    panel.inert = false;
    this.panelReturnFocus = returnFocus;
    if (panelName === "catalog") this.query<HTMLButtonElement>("#catalog-button").setAttribute("aria-expanded", "true");
    if (panelName === "settings") this.query<HTMLButtonElement>("#settings-button").setAttribute("aria-expanded", "true");
    this.syncPanelState();
    const focusPanel = (): void => {
      if (panel.classList.contains("is-open")) {
        const focusTarget = panelName === "catalog"
          ? panel.querySelector<HTMLButtonElement>(".catalog-item.is-active") ?? panel.querySelector<HTMLButtonElement>(".catalog-item")
          : panelName === "settings"
            ? panel.querySelector<HTMLButtonElement>(".settings-toggle")
            : panel.querySelector<HTMLButtonElement>("#approach-button");
        focusTarget?.focus({ preventScroll: true });
      }
    };
    panel.addEventListener("transitionend", focusPanel, { once: true });
    window.setTimeout(focusPanel);
  }

  private closePanel(panelName: PanelName, restoreFocus = true): void {
    const panel = this.query<HTMLElement>(`#${panelName}-panel`);
    const wasOpen = panel.classList.contains("is-open");
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    panel.inert = true;
    if (panelName === "catalog") this.query<HTMLButtonElement>("#catalog-button").setAttribute("aria-expanded", "false");
    if (panelName === "settings") this.query<HTMLButtonElement>("#settings-button").setAttribute("aria-expanded", "false");
    this.syncPanelState();
    if (wasOpen && !restoreFocus) this.panelReturnFocus = null;
    if (wasOpen && restoreFocus && this.panelReturnFocus) {
      const returnFocus = this.panelReturnFocus;
      this.panelReturnFocus = null;
      window.requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
    }
  }

  private closeOpenPanel(): boolean {
    if (this.query<HTMLElement>("#details-panel").classList.contains("is-open")) {
      this.closePanel("details");
      return true;
    }
    if (this.query<HTMLElement>("#settings-panel").classList.contains("is-open")) {
      this.closePanel("settings");
      return true;
    }
    if (this.query<HTMLElement>("#catalog-panel").classList.contains("is-open")) {
      this.closePanel("catalog");
      return true;
    }
    return false;
  }

  private syncPanelState(): void {
    const catalogOpen = this.query<HTMLElement>("#catalog-panel").classList.contains("is-open");
    const detailsOpen = this.query<HTMLElement>("#details-panel").classList.contains("is-open");
    const settingsOpen = this.query<HTMLElement>("#settings-panel").classList.contains("is-open");
    const shell = this.query<HTMLElement>(".experience-shell");
    shell.classList.toggle("has-open-catalog", catalogOpen);
    shell.classList.toggle("has-open-settings", settingsOpen);
    shell.classList.toggle("has-open-panel", detailsOpen);
    this.query<HTMLElement>("#panel-scrim").setAttribute("aria-hidden", String(!detailsOpen));
    this.query<HTMLElement>(".top-bar").inert = this.compactUi && detailsOpen;
    this.query<HTMLElement>(".bottom-controls").inert = this.compactUi && detailsOpen;
    if (catalogOpen || detailsOpen || settingsOpen) this.query<HTMLElement>("#interaction-hint").classList.remove("is-visible");
  }

  private readonly handleCompactUiChange = (event: MediaQueryListEvent): void => {
    this.compactUi = event.matches;
    this.query<HTMLElement>("#details-panel").setAttribute("aria-modal", String(this.compactUi));
    this.query<HTMLButtonElement>("#tour-button").textContent = this.compactUi
      ? this.messages.hud.tour
      : this.messages.hud.guidedTour;
    this.query<HTMLElement>("#interaction-hint").textContent = this.compactUi
      ? this.messages.hud.compactHint
      : this.messages.hud.desktopHint;
    this.setCameraMode(this.cameraMode);
    this.syncPanelState();
  };

  private loadingLabel(stage: LoadingStage): string {
    if (stage.stage === "renderer") return this.messages.loading.renderer;
    if (stage.stage === "scene") return this.messages.loading.scene;
    if (stage.stage === "camera") return this.messages.loading.camera;
    if (stage.stage === "ready") return this.messages.loading.ready;
    if (stage.stage === "networkTexture") return this.messages.loading.networkTexture;
    const body = BODY_BY_ID.get(stage.bodyId);
    const name = body ? getBodyCopy(this.locale, body).name : stage.bodyId;
    return this.messages.loading.bodyTexture(name);
  }

  private formatNumber(value: number, maximumFractionDigits = 1): string {
    return new Intl.NumberFormat(this.formatLocale, { maximumFractionDigits }).format(value);
  }

  private formatUnit(value: number, unit: "hour" | "day" | "year", maximumFractionDigits: number): string {
    const labels = this.messages.units[unit];
    const label = Math.abs(value - 1) < Number.EPSILON ? labels.one : labels.other;
    return `${this.formatNumber(value, maximumFractionDigits)} ${label}`;
  }

  private formatPeriod(days: number): string {
    if (days === 0) return this.messages.format.notApplicable;
    if (days < 1) return this.formatUnit(days * 24, "hour", 2);
    if (days > 730) return this.formatUnit(days / 365.256, "year", 2);
    return this.formatUnit(days, "day", 2);
  }

  private formatRate(rate: number): string {
    if (rate === 0) return this.messages.format.paused;
    if (rate < 1 / 1_000) return this.messages.format.realTime;
    const unit = rate < 1 ? "hour" : "day";
    const value = rate < 1 ? rate * 24 : rate;
    const labels = this.messages.units[unit];
    const label = Math.abs(value - 1) < Number.EPSILON ? labels.one : labels.other;
    return `${this.formatNumber(value, rate < 1 ? 2 : 0)} ${label}/${this.messages.units.secondShort}`;
  }

  private nextTimeRate(rate: number): number {
    const currentIndex = TIME_RATES.findIndex((candidate) => Math.abs(candidate - rate) < 1e-9);
    return TIME_RATES[(currentIndex + 1) % TIME_RATES.length];
  }

  private textureSourceLabel(bodyId: BodyId): string {
    if (bodyId === "sun") return this.messages.texture.sun;
    if (!hasObservationSurface(bodyId)) return this.messages.texture.procedural;
    return bodyId === "phobos" || bodyId === "deimos"
      ? this.messages.texture.nasaModel
      : this.messages.texture.nasa;
  }

  private query<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing interface element: ${selector}`);
    return element;
  }
}
