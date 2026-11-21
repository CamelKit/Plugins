import type { EngagedTarget, PendingKill } from '../types';
import { dist, GameAccessors } from '../utils/gameAccessors';
import { SessionStore } from '../services/SessionStore';
import { WikiTelemetryService } from '../services/WikiTelemetry';

export interface CombatTrackerOptions {
  accessors: GameAccessors;
  sessionStore: SessionStore;
  telemetry: WikiTelemetryService;
  getMatchDistance: () => number;
  getDropWindowSeconds: () => number;
  onSessionUpdated: () => void;
}

export class CombatTracker {
  private engagedTargets = new Map<number, EngagedTarget>();
  private recentlyKilledEntities = new Set<number>();
  private killedEntityTimestamps = new Map<number, number>();
  private pendingKills: PendingKill[] = [];
  private seenGroundItemIds = new Set<number>();

  constructor(private readonly opts: CombatTrackerOptions) {}

  clearPendingKills(): void {
    this.pendingKills = [];
  }

  tick(): void {
    const gm = this.opts.accessors.gm;
    const em = this.opts.accessors.em;
    if (!gm || !em) return;

    const now = Date.now();
    const playerPos = this.opts.accessors.getPlayerPosition();

    // 1. Resolve active combat target (handles melee, ranged, and magic targeting)
    let targetId = -1;
    try {
      if (typeof gm.currentLocalNpcCombatTargetId === 'function') {
        targetId = gm.currentLocalNpcCombatTargetId() | 0;
      } else if (gm.magicTargetId >= 0) {
        targetId = gm.magicTargetId | 0;
      } else if (gm.combatTargetId >= 0) {
        targetId = gm.combatTargetId | 0;
      } else if (gm.localNpcCombatEngagementTargetId >= 0) {
        targetId = gm.localNpcCombatEngagementTargetId | 0;
      }
    } catch {
      // ignore
    }

    // 2. Track engaged monster
    if (targetId > 0) {
      const defId = em.npcDefs?.get(targetId) ?? -1;
      const def = em.npcDefsCache?.get(defId);
      const pos = this.opts.accessors.getNpcPosition(targetId);
      const name = def?.name ?? `NPC #${defId > 0 ? defId : targetId}`;
      const combatLevel = def?.combatLevel ?? 0;
      const floor = gm.currentFloor ?? 0;

      this.engagedTargets.set(targetId, {
        entityId: targetId,
        defId,
        name,
        combatLevel,
        x: pos?.x ?? playerPos?.x ?? 0,
        z: pos?.z ?? playerPos?.z ?? 0,
        floor,
        lastEngaged: now,
      });
    }

    // Update positions of known engaged targets while they remain alive
    for (const [id, engaged] of this.engagedTargets) {
      if (em.npcDefs?.has(id) || em.npcSprites?.has(id)) {
        const pos = this.opts.accessors.getNpcPosition(id);
        if (pos) {
          engaged.x = pos.x;
          engaged.z = pos.z;
        }
      }
    }

    // 3. Detect despawned/killed targets (Signal B)
    const maxKillDist = 12;
    for (const [id, engaged] of this.engagedTargets) {
      const isAlive = em.npcDefs?.has(id) || em.npcSprites?.has(id);
      if (!isAlive) {
        if (!this.recentlyKilledEntities.has(id)) {
          const timeSinceEngaged = now - engaged.lastEngaged;
          const distToPlayer = playerPos ? dist(engaged.x, engaged.z, playerPos.x, playerPos.z) : 0;
          if (timeSinceEngaged < 10000 && distToPlayer <= maxKillDist) {
            this.handleNpcKilled(engaged);
          }
        }
        this.engagedTargets.delete(id);
      }
    }

    // 4. Prune recently killed entity TTL
    for (const [id, deathTime] of this.killedEntityTimestamps) {
      if (now - deathTime > 15000) {
        this.killedEntityTimestamps.delete(id);
        this.recentlyKilledEntities.delete(id);
      }
    }

    // 5. Finalize pending kills whose drop window has elapsed
    const dropWindowMs = (Number(this.opts.getDropWindowSeconds()) || 8) * 1000;
    for (let i = this.pendingKills.length - 1; i >= 0; i--) {
      const kill = this.pendingKills[i];
      if (now - kill.deathTime > dropWindowMs) {
        kill.finalized = true;
        this.opts.telemetry.enqueue(kill);
        this.pendingKills.splice(i, 1);
      }
    }

    // 6. Backup polling for ground items in case hook missed anything
    this.pollGroundItems();
  }

  onEntityDeath(entityId: number): void {
    const id = entityId | 0;
    if (id <= 0) return;
    const engaged = this.engagedTargets.get(id);
    if (engaged && !this.recentlyKilledEntities.has(id)) {
      this.handleNpcKilled(engaged);
      this.engagedTargets.delete(id);
    }
  }

  correlateGroundItem(
    groundId: number,
    itemId: number,
    qty: number,
    x: number,
    z: number,
    floor: number
  ): void {
    if (itemId <= 0) return;
    if (groundId > 0 && this.seenGroundItemIds.has(groundId)) return;
    if (groundId > 0) this.seenGroundItemIds.add(groundId);

    const now = Date.now();
    const maxDist = Number(this.opts.getMatchDistance()) || 3;
    const dropWindowMs = (Number(this.opts.getDropWindowSeconds()) || 8) * 1000;

    let bestKill: PendingKill | null = null;
    let bestDist = Infinity;

    for (const kill of this.pendingKills) {
      if (kill.finalized) continue;
      if (kill.floor !== floor) continue;
      if (now - kill.deathTime > dropWindowMs) continue;

      const d = dist(kill.x, kill.z, x, z);
      if (d <= maxDist && d < bestDist) {
        bestDist = d;
        bestKill = kill;
      }
    }

    if (bestKill) {
      const itemDef = this.opts.accessors.getItemDef(itemId);
      const name = itemDef?.name ?? `Item #${itemId}`;
      const unitValue = itemDef?.value ?? itemDef?.shopPrice ?? 0;
      const totalVal = unitValue * qty;

      bestKill.drops.push({
        itemId,
        name,
        quantity: qty,
        value: totalVal,
      });

      this.opts.sessionStore.recordDrop(
        bestKill.npcName,
        bestKill.npcDefId,
        bestKill.combatLevel,
        itemId,
        name,
        qty,
        totalVal
      );
      this.opts.onSessionUpdated();
    }
  }

  private pollGroundItems(): void {
    const em = this.opts.accessors.em;
    const ground = em?.groundItems;
    if (!ground) return;

    for (const [, gi] of ground) {
      const gid = gi.id | 0;
      if (gid > 0 && !this.seenGroundItemIds.has(gid)) {
        this.correlateGroundItem(gid, gi.itemId | 0, gi.quantity | 0 || 1, gi.x || 0, gi.z || 0, gi.floor | 0);
      }
    }
  }

  private handleNpcKilled(engaged: EngagedTarget): void {
    const now = Date.now();
    this.recentlyKilledEntities.add(engaged.entityId);
    this.killedEntityTimestamps.set(engaged.entityId, now);

    const killId = `${engaged.entityId}_${now}`;
    const pending: PendingKill = {
      killId,
      entityId: engaged.entityId,
      npcDefId: engaged.defId,
      npcName: engaged.name,
      combatLevel: engaged.combatLevel,
      deathTime: now,
      x: engaged.x,
      z: engaged.z,
      floor: engaged.floor,
      drops: [],
      finalized: false,
    };
    this.pendingKills.push(pending);

    this.opts.sessionStore.recordKill(engaged.name, engaged.defId, engaged.combatLevel);
    this.opts.onSessionUpdated();
  }
}

