import type { SessionData } from '../types';

export class SessionStore {
  constructor(private readonly getDataStore: () => Record<string, any>) {}

  ensureData(): void {
    const data = this.getDataStore();
    if (!data.session || typeof data.session !== 'object') {
      data.session = {
        startTime: Date.now(),
        totalKills: 0,
        totalValue: 0,
        monsters: {},
      };
    }
    if (!data.collapsed || typeof data.collapsed !== 'object') {
      data.collapsed = {};
    }
  }

  getSession(): SessionData {
    this.ensureData();
    return this.getDataStore().session as SessionData;
  }

  isCollapsed(npcName: string): boolean {
    this.ensureData();
    return Boolean(this.getDataStore().collapsed?.[npcName]);
  }

  toggleCollapsed(npcName: string): void {
    this.ensureData();
    const data = this.getDataStore();
    data.collapsed[npcName] = !data.collapsed[npcName];
  }

  resetSession(): void {
    const data = this.getDataStore();
    data.session = {
      startTime: Date.now(),
      totalKills: 0,
      totalValue: 0,
      monsters: {},
    };
  }

  recordKill(npcName: string, npcDefId: number, combatLevel: number): void {
    const session = this.getSession();
    session.totalKills += 1;

    const key = npcName;
    if (!session.monsters[key]) {
      session.monsters[key] = {
        npcDefId,
        npcName,
        combatLevel,
        killCount: 0,
        totalValue: 0,
        drops: {},
      };
    }
    session.monsters[key].killCount += 1;
  }

  recordDrop(
    npcName: string,
    npcDefId: number,
    combatLevel: number,
    itemId: number,
    itemName: string,
    quantity: number,
    totalValue: number
  ): void {
    const session = this.getSession();
    session.totalValue += totalValue;

    const key = npcName;
    if (!session.monsters[key]) {
      session.monsters[key] = {
        npcDefId,
        npcName,
        combatLevel,
        killCount: 1,
        totalValue: 0,
        drops: {},
      };
    }

    const entry = session.monsters[key];
    entry.totalValue += totalValue;

    if (!entry.drops[itemId]) {
      entry.drops[itemId] = {
        itemId,
        name: itemName,
        quantity: 0,
        totalValue: 0,
      };
    }
    entry.drops[itemId].quantity += quantity;
    entry.drops[itemId].totalValue += totalValue;
  }
}

