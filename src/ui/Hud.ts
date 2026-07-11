import { BODIES, BODY_BY_ID, type BodyId, type CelestialBody } from "../data/bodies";
import { getBodyCopy, getMessages, type Locale, type LocaleSelection, type Messages } from "../i18n";
import type { CameraMode, LoadingStage } from "../render/SolarSystem";
import { textureSourceUrl } from "../render/textures";

export interface HudActions {
  selectBody: (bodyId: BodyId) => void;
  overview: () => void;
  toggleTour: () => void;
  cinematic: () => void;
  flight: () => void;
  approach: () => void;
  setTimeRate: (rate: number) => void;
  resetDate: () => void;
  changeLocale: (locale: Locale) => void;
}

export class Hud {
  private readonly root: HTMLElement;
  private readonly locale: Locale;
  private readonly formatLocale: string;
  private readonly messages: Messages;
  private actions: HudActions | null = null;
  private timeRate = 1 / 24;
  private resumeTimeRate = 1 / 24;
  private selectedBodyId: BodyId = "sun";
  private loaderDismissed = false;
  private hasInitialSelection = false;
  private cameraMode: CameraMode = "overview";
  private panelReturnFocus: HTMLElement | null = null;
  private readonly compactUi = window.matchMedia(
    "(max-width: 720px), (pointer: coarse) and (max-width: 840px), (orientation: landscape) and (max-height: 520px)",
  ).matches;

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
      }, 380);
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
    this.query<HTMLElement>("#detail-distance").textContent = body.id === "sun"
      ? this.messages.format.solarSystemCenter
      : body.id === "moon"
        ? this.messages.format.fromEarth(`${this.formatNumber(384_400, 0)} km`)
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
    if (this.compactUi && (mode === "tour" || mode === "cinematic")) this.closePanel("details");
  }

  setDate(date: Date, rate: number): void {
    if (rate > 0) this.resumeTimeRate = rate;
    this.timeRate = rate;
    this.query<HTMLElement>("#simulation-date").textContent = new Intl.DateTimeFormat(this.formatLocale, {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    this.query<HTMLElement>("#rate-label").textContent = this.formatRate(rate);
    const playButton = this.query<HTMLButtonElement>("#play-button");
    playButton.textContent = rate === 0 ? this.messages.hud.resume : this.messages.hud.pause;
    const select = this.query<HTMLSelectElement>("#time-rate");
    const option = Array.from(select.options).find((item) => Number(item.value) === rate);
    if (option) select.value = String(rate);
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
      ? this.messages.texture.nasa
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
        <canvas id="space-canvas" class="space-canvas" aria-label="${m.hud.canvasAria}"></canvas>

        <div id="loading-screen" class="loading-screen" role="progressbar" aria-label="${m.hud.loadingAria}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="loading-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="loading-copy">
            <p>${m.hud.atlasEyebrow}</p>
            <h1>${m.hud.atlasTitle}</h1>
            <div class="loading-meta"><span id="loading-status">${m.hud.loadingInitial}</span><span id="loading-value">0%</span></div>
            <div class="loading-track"><span id="loading-progress"></span></div>
            <small>${m.hud.loadingNote}</small>
          </div>
        </div>

        <header class="top-bar" aria-label="${m.hud.sceneStatusAria}">
          <div class="brand-lockup">
            <p>ORBITAL ATLAS</p>
            <div><strong>${m.hud.solarSystem}</strong><span>/</span><span id="current-body-name">${sunCopy.name}</span></div>
          </div>
          <div class="status-cluster">
            <button id="scale-button" class="status-item status-button" type="button" aria-expanded="false" aria-controls="scale-note">
              <span>${m.hud.scale}</span><strong>${m.hud.readableCompression}</strong>
            </button>
            <button id="language-button" class="status-item status-button language-button" type="button" aria-label="${m.hud.switchLanguageAria}">
              <span>${m.hud.language}</span><strong lang="${this.locale === "en" ? "zh-Hans" : "en"}">${m.hud.switchLanguageValue}</strong>
            </button>
            <div class="status-item" aria-label="${m.hud.simulationDateAria}"><span>${m.hud.simulationUtc}</span><strong id="simulation-date">----</strong></div>
            <div class="status-item status-fps"><span>${m.hud.rendering}</span><strong id="fps-value">-- FPS</strong></div>
          </div>
          <div id="scale-note" class="scale-note" hidden>${m.hud.scaleNote}</div>
        </header>

        <div id="panel-scrim" class="panel-scrim" aria-hidden="true"></div>

        <section id="catalog-panel" class="catalog-panel" role="dialog" aria-modal="${String(this.compactUi)}" aria-hidden="true" aria-labelledby="catalog-title" inert>
          <div class="panel-heading">
            <div><p>${m.hud.catalogEyebrow}</p><h2 id="catalog-title">${m.hud.catalogTitle}</h2></div>
            <button class="icon-text-button" type="button" data-close-panel="catalog" aria-label="${m.hud.closeCatalogAria}">${m.hud.close}</button>
          </div>
          <div class="catalog-grid">
            ${BODIES.map((body) => {
              const copy = getBodyCopy(this.locale, body);
              const secondary = this.locale === "zh-Hans" ? body.englishName : m.kinds[body.kind];
              const catalogValue = body.id === "sun"
                ? this.locale === "zh-Hans" ? m.hud.catalogStar : m.hud.catalogCenter
                : body.id === "moon"
                  ? this.locale === "zh-Hans" ? m.hud.catalogMoon : `${this.formatNumber(384_400, 0)} km`
                  : `${this.formatNumber(body.semiMajorAxisAu, 2)} AU`;
              return `
              <button class="catalog-item" type="button" data-body-id="${body.id}" style="--body-color:${body.accent}">
                <span class="body-orb" aria-hidden="true"></span>
                <span><strong>${copy.name}</strong><small>${secondary}</small></span>
                <em>${catalogValue}</em>
              </button>
            `;
            }).join("")}
          </div>
          <p class="catalog-footnote">${m.hud.catalogFootnote}</p>
        </section>

        <aside id="details-panel" class="details-panel" role="dialog" aria-modal="${String(this.compactUi)}" aria-hidden="true" aria-labelledby="details-name" inert>
          <div class="details-accent" aria-hidden="true"></div>
          <div class="panel-heading details-heading">
            <div><p id="details-english">${this.locale === "zh-Hans" ? sun.englishName : m.hud.profileEyebrow}</p><h2 id="details-name">${sunCopy.name}</h2></div>
            <button class="icon-text-button" type="button" data-close-panel="details" aria-label="${m.hud.closeDetailsAria}">${m.hud.close}</button>
          </div>
          <p id="details-kind" class="body-kind">${m.kinds[sun.kind]}</p>
          <p id="details-description" class="details-description"></p>
          <dl class="body-facts">
            <div><dt>${m.hud.averageRadius}</dt><dd id="detail-radius"></dd></div>
            <div><dt>${m.hud.orbitalDistance}</dt><dd id="detail-distance"></dd></div>
            <div><dt>${m.hud.orbitalPeriod}</dt><dd id="detail-orbit"></dd></div>
            <div><dt>${m.hud.rotationPeriod}</dt><dd id="detail-rotation"></dd></div>
            <div><dt>${m.hud.axialTilt}</dt><dd id="detail-tilt"></dd></div>
            <div><dt>${m.hud.orbitalInclination}</dt><dd id="detail-inclination"></dd></div>
            <div class="fact-wide"><dt>${m.hud.temperature}</dt><dd id="detail-temperature"></dd></div>
          </dl>
          <div class="source-note"><span>${m.hud.surfaceSource}</span><strong id="texture-source">${m.texture.procedural}</strong></div>
          <div class="details-actions">
            <button id="approach-button" class="primary-button" type="button">${m.hud.approach}</button>
            <button id="overview-detail-button" class="secondary-button" type="button">${m.hud.returnOverview}</button>
          </div>
        </aside>

        <div class="bottom-controls" role="group" aria-label="${m.hud.controlsAria}">
          <button id="catalog-button" class="control-button" type="button" aria-expanded="false" aria-controls="catalog-panel">${m.hud.bodies}</button>
          <button class="control-button" type="button" data-camera-mode="overview" aria-pressed="true">${m.hud.overview}</button>
          <span class="control-separator" aria-hidden="true"></span>
          <button id="play-button" class="control-button control-primary" type="button">${m.hud.pause}</button>
          <label class="rate-control"><span class="sr-only">${m.hud.timeRate}</span><select id="time-rate">
            <option value="0.000011574074">${m.hud.realTime}</option>
            <option value="0.041666666667" selected>${m.hud.oneHourPerSecond}</option>
            <option value="1">${m.hud.oneDayPerSecond}</option>
            <option value="7">${m.hud.sevenDaysPerSecond}</option>
            <option value="30">${m.hud.thirtyDaysPerSecond}</option>
          </select></label>
          <button id="reset-date" class="control-button control-date" type="button" aria-label="${m.hud.resetDateAria}"><span id="rate-label">${m.hud.oneHourPerSecond}</span></button>
          <span class="control-separator mode-separator" aria-hidden="true"></span>
          <button id="tour-button" class="control-button mode-control" type="button" data-camera-mode="tour" aria-pressed="false">${this.compactUi ? m.hud.tour : m.hud.guidedTour}</button>
          <button id="cinematic-button" class="control-button mode-control" type="button" data-camera-mode="cinematic" aria-pressed="false">${m.hud.cinematic}</button>
          <button id="flight-button" class="control-button mode-control" type="button" data-camera-mode="flight" aria-pressed="false">${m.hud.freeFlight}</button>
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
      const closeButton = target.closest<HTMLButtonElement>("[data-close-panel]");
      if (closeButton?.dataset.closePanel) {
        this.closePanel(closeButton.dataset.closePanel as "catalog" | "details");
        return;
      }
      if (target.closest("#catalog-button")) this.toggleCatalog();
      else if (target.closest("#overview-detail-button")) {
        this.actions?.overview();
        this.closePanel("details");
      }
      else if (target.closest("[data-camera-mode='overview']")) this.actions?.overview();
      else if (target.closest("#play-button")) this.actions?.setTimeRate(this.timeRate === 0 ? this.resumeTimeRate : 0);
      else if (target.closest("#reset-date")) this.actions?.resetDate();
      else if (target.closest("#tour-button")) this.actions?.toggleTour();
      else if (target.closest("#cinematic-button")) this.actions?.cinematic();
      else if (target.closest("#flight-button")) this.actions?.flight();
      else if (target.closest("#approach-button")) {
        this.actions?.approach();
        if (this.compactUi) this.closePanel("details");
      }
      else if (target.closest("#scale-button")) this.toggleScaleNote();
      else if (target.closest("#language-button")) this.actions?.changeLocale(this.locale === "en" ? "zh-Hans" : "en");
    });

    this.query<HTMLSelectElement>("#time-rate").addEventListener("change", (event) => {
      const select = event.currentTarget;
      if (select instanceof HTMLSelectElement) this.actions?.setTimeRate(Number(select.value));
    });

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.closeOpenPanel()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    });
  }

  private toggleCatalog(): void {
    const panel = this.query<HTMLElement>("#catalog-panel");
    const open = !panel.classList.contains("is-open");
    if (open) this.openPanel("catalog", this.query<HTMLButtonElement>("#catalog-button"));
    else this.closePanel("catalog");
  }

  private openPanel(panelName: "catalog" | "details", returnFocus: HTMLElement): void {
    const otherPanel = panelName === "catalog" ? "details" : "catalog";
    this.closePanel(otherPanel, false);
    const panel = this.query<HTMLElement>(`#${panelName}-panel`);
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    panel.inert = false;
    this.panelReturnFocus = returnFocus;
    if (panelName === "catalog") this.query<HTMLButtonElement>("#catalog-button").setAttribute("aria-expanded", "true");
    this.syncPanelState();
    window.setTimeout(() => {
      if (panel.classList.contains("is-open")) {
        panel.querySelector<HTMLButtonElement>("[data-close-panel]")?.focus({ preventScroll: true });
      }
    }, 380);
  }

  private closePanel(panelName: "catalog" | "details", restoreFocus = true): void {
    const panel = this.query<HTMLElement>(`#${panelName}-panel`);
    const wasOpen = panel.classList.contains("is-open");
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    panel.inert = true;
    if (panelName === "catalog") this.query<HTMLButtonElement>("#catalog-button").setAttribute("aria-expanded", "false");
    this.syncPanelState();
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
    if (this.query<HTMLElement>("#catalog-panel").classList.contains("is-open")) {
      this.closePanel("catalog");
      return true;
    }
    return false;
  }

  private syncPanelState(): void {
    const open = Boolean(this.root.querySelector(".catalog-panel.is-open, .details-panel.is-open"));
    this.query<HTMLElement>(".experience-shell").classList.toggle("has-open-panel", open);
    this.query<HTMLElement>("#panel-scrim").setAttribute("aria-hidden", String(!open));
    if (this.compactUi) {
      this.query<HTMLElement>(".top-bar").inert = open;
      this.query<HTMLElement>(".bottom-controls").inert = open;
    }
    if (open) this.query<HTMLElement>("#interaction-hint").classList.remove("is-visible");
  }

  private toggleScaleNote(): void {
    const button = this.query<HTMLButtonElement>("#scale-button");
    const note = this.query<HTMLElement>("#scale-note");
    const open = note.hidden;
    note.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }

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

  private textureSourceLabel(bodyId: BodyId): string {
    if (bodyId === "sun") return this.messages.texture.sun;
    if (!textureSourceUrl(bodyId)) return this.messages.texture.procedural;
    return this.messages.texture.nasa;
  }

  private query<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing interface element: ${selector}`);
    return element;
  }
}
