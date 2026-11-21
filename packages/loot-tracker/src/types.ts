export interface DropItem {
  itemId: number;
  name: string;
  quantity: number;
  value: number;
}

export interface PendingKill {
  killId: string;
  entityId: number;
  npcDefId: number;
  npcName: string;
  combatLevel: number;
  deathTime: number;
  x: number;
  z: number;
  floor: number;
  drops: DropItem[];
  finalized: boolean;
}

export interface EngagedTarget {
  entityId: number;
  defId: number;
  name: string;
  combatLevel: number;
  x: number;
  z: number;
  floor: number;
  lastEngaged: number;
}

export interface MonsterDropSummary {
  itemId: number;
  name: string;
  quantity: number;
  totalValue: number;
}

export interface MonsterSessionEntry {
  npcDefId: number;
  npcName: string;
  combatLevel: number;
  killCount: number;
  totalValue: number;
  drops: { [itemId: number]: MonsterDropSummary };
}

export interface SessionData {
  startTime: number;
  totalKills: number;
  totalValue: number;
  monsters: { [key: string]: MonsterSessionEntry };
}

export interface TelemetryEvent {
  npcDefId: number;
  npcName: string;
  combatLevel: number;
  drops: Array<{ itemId: number; itemName?: string; quantity: number }>;
  timestamp: number;
}

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'opted_out';

declare global {
  const __PLUGIN_VERSION__: string | undefined;
  const __CAMELKIT_VERSION__: string | undefined;
}

