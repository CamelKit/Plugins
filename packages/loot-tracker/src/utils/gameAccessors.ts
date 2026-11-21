export function dist(x1: number, z1: number, x2: number, z2: number): number {
  const dx = x1 - x2;
  const dz = z1 - z2;
  return Math.sqrt(dx * dx + dz * dz);
}

export class GameAccessors {
  constructor(private readonly getGameHooks: () => any) {}

  get gm(): any {
    return this.getGameHooks()?.GameManager?.Instance ?? (window as any).gm ?? null;
  }

  get em(): any {
    return this.getGameHooks()?.EntityManager?.Instance ?? (window as any).em ?? this.gm?.entities ?? null;
  }

  getPlayerPosition(): { x: number; z: number; floor: number } | null {
    const gm = this.gm;
    if (!gm) return null;
    return {
      x: gm.playerX ?? 0,
      z: gm.playerZ ?? 0,
      floor: gm.currentFloor ?? 0,
    };
  }

  getNpcPosition(entityId: number): { x: number; z: number } | null {
    const em = this.em;
    if (!em) return null;

    const sprite = em.npcSprites?.get(entityId);
    if (sprite?.position) {
      return { x: sprite.position.x, z: sprite.position.z };
    }

    const target = em.npcTargets?.get(entityId);
    if (target && typeof target.x === 'number') {
      return { x: target.x, z: target.z };
    }

    return null;
  }

  getItemDef(itemId: number): any {
    const em = this.em;
    return (
      (document as any).highlite?.gameHooks?.ItemDefinitionManager?._itemDefMap?.get(itemId) ??
      em?.itemDefsCache?.get(itemId) ??
      this.gm?.itemDefsCache?.get(itemId) ??
      null
    );
  }

  getItemIconUrl(itemId: number): string {
    const origin =
      typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')
        ? window.location.origin
        : 'https://memoriesofmagic.com';

    const def = this.getItemDef(itemId);
    if (def?.icon) {
      return `${origin}/items/${def.icon}`;
    }
    return `${origin}/items/3d/${itemId}.png`;
  }

  getItemFallbackIconUrl(itemId: number): string {
    const origin =
      typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')
        ? window.location.origin
        : 'https://memoriesofmagic.com';
    return `${origin}/items/3d/${itemId}.png`;
  }
}

