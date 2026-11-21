import { Plugin, SettingsTypes, PanelManager } from '@camelkit/core';
import { version as packageVersion } from '../package.json';
import { GameAccessors } from './utils/gameAccessors';
import { SessionStore } from './services/SessionStore';
import { WikiTelemetryService } from './services/WikiTelemetry';
import { CombatTracker } from './engine/CombatTracker';
import { LootTrackerPanel } from './ui/LootTrackerPanel';

export default class LootTrackerPlugin extends Plugin {
  pluginName = 'Loot Tracker';
  author = 'CamelKit';
  version =
    typeof __PLUGIN_VERSION__ !== 'undefined'
      ? __PLUGIN_VERSION__
      : typeof __CAMELKIT_VERSION__ !== 'undefined'
        ? __CAMELKIT_VERSION__
        : packageVersion;

  private panelManager = new PanelManager();
  private menuIconElement: HTMLElement | null = null;

  private engineTimer: ReturnType<typeof setInterval> | null = null;
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;

  private readonly accessors = new GameAccessors(() => this.gameHooks);
  private readonly sessionStore = new SessionStore(() => this.data);
  private readonly telemetry: WikiTelemetryService;
  private readonly combatTracker: CombatTracker;
  private readonly panel: LootTrackerPanel;

  constructor() {
    super();

    this.settings.enable = {
      text: 'Enable Loot Tracker',
      type: SettingsTypes.checkbox,
      value: true,
      callback: () => this.onToggleEnabled(),
    };

    this.settings.submitToWiki = {
      text: 'Contribute Anonymous Drops to Wiki',
      type: SettingsTypes.checkbox,
      value: true,
      callback: () => {
        this.telemetry.syncStatus = this.settings.submitToWiki.value ? 'pending' : 'opted_out';
        this.panel.render();
      },
    };

    this.settings.matchDistance = {
      text: 'Loot Matching Radius (Tiles)',
      type: SettingsTypes.range,
      value: 3,
      min: 1,
      max: 8,
      callback: () => {},
    };

    this.settings.dropWindowSeconds = {
      text: 'Loot Matching Window (Seconds)',
      type: SettingsTypes.range,
      value: 8,
      min: 3,
      max: 20,
      callback: () => {},
    };

    this.settings.telemetryEndpoint = {
      text: 'Wiki Telemetry URL',
      type: SettingsTypes.text,
      value: 'https://api.camelkit.dev/telemetry/drops',
      callback: () => {},
    };

    this.settings.resetSessionOnLogin = {
      text: 'Reset Session On Login',
      type: SettingsTypes.checkbox,
      value: false,
      callback: () => {},
    };

    this.telemetry = new WikiTelemetryService({
      isEnabled: () => Boolean(this.settings.submitToWiki?.value),
      getEndpoint: () => String(this.settings.telemetryEndpoint?.value || 'https://api.camelkit.dev/telemetry/drops'),
      getPluginVersion: () => this.version,
      onStatusChange: () => this.panel.updateSyncBadge(),
    });

    this.combatTracker = new CombatTracker({
      accessors: this.accessors,
      sessionStore: this.sessionStore,
      telemetry: this.telemetry,
      getMatchDistance: () => Number(this.settings.matchDistance?.value) || 3,
      getDropWindowSeconds: () => Number(this.settings.dropWindowSeconds?.value) || 8,
      onSessionUpdated: () => this.panel.render(),
    });

    this.panel = new LootTrackerPanel({
      accessors: this.accessors,
      sessionStore: this.sessionStore,
      telemetry: this.telemetry,
      isWikiOptIn: () => Boolean(this.settings.submitToWiki?.value),
      onResetRequested: () => this.resetSession(),
    });
  }

  init(): void {
    this.sessionStore.ensureData();
    if (this.settings.resetSessionOnLogin?.value) {
      this.resetSession();
    }
  }

  start(): void {
    this.info('start() called');
    this.sessionStore.ensureData();

    try {
      this.panelManager.removeMenuItem('📦');
    } catch {
      // ignore
    }

    try {
      const [iconEl, panelEl] = this.panelManager.requestMenuItem('📦', 'Loot Tracker');
      this.menuIconElement = iconEl;
      this.panel.setContainer(panelEl);
      if (this.menuIconElement) {
        this.menuIconElement.title = 'Loot Tracker';
      }
    } catch (e) {
      this.warn('Failed to register sidebar menu item:', e);
    }

    this.startEngine();
    this.panel.render();
    this.info('Loot Tracker started.');
  }

  stop(): void {
    this.stopEngine();

    if (this.telemetry.queueLength > 0 && this.settings.submitToWiki?.value) {
      void this.telemetry.flush();
    }

    try {
      this.panelManager.removeMenuItem('📦');
    } catch {
      // ignore
    }

    this.menuIconElement = null;
    this.panel.setContainer(null);
    this.info('Loot Tracker stopped.');
  }

  public resetSession(): void {
    this.sessionStore.resetSession();
    this.combatTracker.clearPendingKills();
    this.panel.render();
  }

  private onToggleEnabled(): void {
    if (this.settings.enable.value) {
      this.start();
    } else {
      this.stop();
    }
  }

  private startEngine(): void {
    this.stopEngine();
    this.engineTimer = setInterval(() => this.combatTracker.tick(), 120);
    this.telemetryTimer = setInterval(() => void this.telemetry.flush(), 45000);
  }

  private stopEngine(): void {
    if (this.engineTimer) {
      clearInterval(this.engineTimer);
      this.engineTimer = null;
    }
    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
      this.telemetryTimer = null;
    }
  }

  /**
   * Hook: Intercepts when the game initiates NPC death sequence
   */
  EntityManager_startNpcDeathSequence(entityId: any, _sprite: any, _options: any): void {
    this.combatTracker.onEntityDeath(entityId | 0);
  }

  /**
   * Hook: Intercepts when an entity death effect begins
   */
  EntityManager_startEntityDeathEffect(entityId: any, _options: any): void {
    this.combatTracker.onEntityDeath(entityId | 0);
  }

  /**
   * Hook: Intercepts ground item creation
   */
  EntityManager_createGroundItem(id: any, itemId: any, quantity: any, x: any, z: any, floor: any, _y: any): void {
    this.combatTracker.correlateGroundItem(
      id | 0,
      itemId | 0,
      quantity | 0 || 1,
      Number(x) || 0,
      Number(z) || 0,
      floor | 0
    );
  }
}
