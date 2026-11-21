import type { PendingKill, SyncStatus, TelemetryEvent } from '../types';

export interface WikiTelemetryConfig {
  isEnabled: () => boolean;
  getEndpoint: () => string;
  getPluginVersion: () => string;
  onStatusChange: () => void;
}

export class WikiTelemetryService {
  private telemetryQueue: TelemetryEvent[] = [];
  public syncStatus: SyncStatus = 'pending';
  public lastSyncTime = 0;

  constructor(private readonly config: WikiTelemetryConfig) {}

  get queueLength(): number {
    return this.telemetryQueue.length;
  }

  enqueue(kill: PendingKill): void {
    if (!this.config.isEnabled()) return;

    this.telemetryQueue.push({
      npcDefId: kill.npcDefId,
      npcName: kill.npcName,
      combatLevel: kill.combatLevel,
      drops: kill.drops.map((d) => ({ itemId: d.itemId, itemName: d.name, quantity: d.quantity })),
      timestamp: Math.floor(kill.deathTime / 1000),
    });

    if (this.telemetryQueue.length >= 10) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.config.isEnabled() || this.telemetryQueue.length === 0) {
      return;
    }

    const toSend = [...this.telemetryQueue];
    this.telemetryQueue = [];

    const endpoint = String(this.config.getEndpoint() || 'https://api.camelkit.dev/telemetry/drops');

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: 'CamelKit',
          version: this.config.getPluginVersion(),
          events: toSend,
        }),
      });

      if (resp.ok) {
        this.lastSyncTime = Date.now();
        this.syncStatus = 'synced';
      } else {
        this.syncStatus = 'offline';
        this.telemetryQueue = [...toSend.slice(-50), ...this.telemetryQueue];
      }
    } catch {
      this.syncStatus = 'offline';
      this.telemetryQueue = [...toSend.slice(-50), ...this.telemetryQueue];
    }

    this.config.onStatusChange();
  }
}

