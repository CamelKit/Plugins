import { abbreviateValue } from '@camelkit/core';
import type { MonsterDropSummary, MonsterSessionEntry } from '../types';
import { GameAccessors } from '../utils/gameAccessors';
import { SessionStore } from '../services/SessionStore';
import { WikiTelemetryService } from '../services/WikiTelemetry';

export interface LootTrackerPanelOptions {
  accessors: GameAccessors;
  sessionStore: SessionStore;
  telemetry: WikiTelemetryService;
  isWikiOptIn: () => boolean;
  onResetRequested: () => void;
}

export class LootTrackerPanel {
  private container: HTMLElement | null = null;

  constructor(private readonly opts: LootTrackerPanelOptions) {}

  setContainer(el: HTMLElement | null): void {
    this.container = el;
  }

  render(): void {
    if (!this.container) return;

    const session = this.opts.sessionStore.getSession();
    const monsterKeys = Object.keys(session.monsters || {}).sort((a, b) => {
      return session.monsters[b].totalValue - session.monsters[a].totalValue;
    });

    this.container.innerHTML = '';
    Object.assign(this.container.style, {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--theme-background)',
      color: 'var(--theme-text-primary)',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      boxSizing: 'border-box',
      overflow: 'hidden',
    });

    // 1. Header Toolbar
    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '12px',
      background: 'var(--theme-background-mute)',
      borderBottom: '1px solid var(--theme-border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      flexShrink: '0',
    });

    const titleRow = document.createElement('div');
    Object.assign(titleRow.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    });

    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.fontSize = '14px';
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    title.style.gap = '6px';
    title.innerHTML = '<span>📦</span><span>Loot Tracker</span>';

    const syncBadge = document.createElement('span');
    syncBadge.id = 'loot-tracker-sync-badge';
    this.styleSyncBadge(syncBadge);
    titleRow.appendChild(title);
    titleRow.appendChild(syncBadge);
    header.appendChild(titleRow);

    // Stats Row
    const statsRow = document.createElement('div');
    Object.assign(statsRow.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '6px 10px',
      background: 'var(--theme-background-soft)',
      borderRadius: '6px',
      fontSize: '12px',
    });

    const totalKillsNum = Number(session.totalKills) || 0;
    const totalValueNum = Number(session.totalValue) || 0;

    const killsEl = document.createElement('div');
    killsEl.innerHTML = `<span style="color:var(--theme-text-muted)">Kills:</span> <b style="color:var(--theme-accent)">${totalKillsNum.toLocaleString()}</b>`;

    const valEl = document.createElement('div');
    valEl.innerHTML = `<span style="color:var(--theme-text-muted)">Value:</span> <b style="color:#ffd24a">${abbreviateValue(totalValueNum)} gp</b>`;

    const resetBtn = document.createElement('button');
    resetBtn.textContent = '↻ Reset';
    resetBtn.title = 'Clear session loot';
    Object.assign(resetBtn.style, {
      background: 'transparent',
      border: '1px solid var(--theme-border)',
      color: 'var(--theme-text-muted)',
      borderRadius: '4px',
      padding: '2px 8px',
      fontSize: '11px',
      cursor: 'pointer',
    });
    resetBtn.onmouseenter = () => {
      resetBtn.style.color = 'var(--theme-text-primary)';
      resetBtn.style.borderColor = 'var(--theme-divider)';
    };
    resetBtn.onmouseleave = () => {
      resetBtn.style.color = 'var(--theme-text-muted)';
      resetBtn.style.borderColor = 'var(--theme-border)';
    };
    resetBtn.onclick = () => {
      if (confirm('Reset current Loot Tracker session?')) {
        this.opts.onResetRequested();
      }
    };

    statsRow.appendChild(killsEl);
    statsRow.appendChild(valEl);
    statsRow.appendChild(resetBtn);
    header.appendChild(statsRow);
    this.container.appendChild(header);

    // 2. Scrollable Monster List
    const listContainer = document.createElement('div');
    Object.assign(listContainer.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '10px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    if (monsterKeys.length === 0) {
      const emptyBox = document.createElement('div');
      Object.assign(emptyBox.style, {
        padding: '30px 16px',
        textAlign: 'center',
        color: 'var(--theme-text-muted)',
        fontSize: '12px',
        lineHeight: '1.6',
        background: 'var(--theme-background-mute)',
        borderRadius: '8px',
        border: '1px dashed var(--theme-border)',
        margin: '10px 0',
      });
      emptyBox.innerHTML = `
        <div style="font-size:24px;margin-bottom:8px">⚔️</div>
        <div style="font-weight:600;color:var(--theme-text-primary);margin-bottom:4px">No Loot Recorded Yet</div>
        <div>Defeat monsters to track drops, calculate drop rates, and crowdsource data to the EvilQuest Wiki!</div>
      `;
      listContainer.appendChild(emptyBox);
    } else {
      for (const key of monsterKeys) {
        const monster = session.monsters[key];
        const card = this.createMonsterCard(monster);
        listContainer.appendChild(card);
      }
    }

    this.container.appendChild(listContainer);
  }

  updateSyncBadge(): void {
    const badge = this.container?.querySelector<HTMLElement>('#loot-tracker-sync-badge');
    if (badge) {
      this.styleSyncBadge(badge);
    }
  }

  private createMonsterCard(monster: MonsterSessionEntry): HTMLElement {
    const isCollapsed = this.opts.sessionStore.isCollapsed(monster.npcName);

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: 'var(--theme-background-mute)',
      border: '1px solid var(--theme-border)',
      borderRadius: '6px',
      overflow: 'hidden',
      transition: 'border-color 0.15s ease',
    });

    const cardHeader = document.createElement('div');
    Object.assign(cardHeader.style, {
      padding: '8px 10px',
      background: 'var(--theme-background-soft)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      userSelect: 'none',
    });

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '6px';

    const chevron = document.createElement('span');
    chevron.style.fontSize = '10px';
    chevron.style.color = 'var(--theme-text-muted)';
    chevron.textContent = isCollapsed ? '▶' : '▼';

    const nameEl = document.createElement('span');
    nameEl.style.fontWeight = '600';
    nameEl.style.fontSize = '12px';
    nameEl.textContent = monster.npcName;

    const levelBadge = document.createElement('span');
    levelBadge.style.fontSize = '10px';
    levelBadge.style.color = 'var(--theme-text-muted)';
    if (monster.combatLevel > 0) {
      levelBadge.textContent = `(Lvl ${monster.combatLevel})`;
    }

    left.appendChild(chevron);
    left.appendChild(nameEl);
    if (monster.combatLevel > 0) left.appendChild(levelBadge);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '8px';
    right.style.fontSize = '11px';

    const kcBadge = document.createElement('span');
    kcBadge.style.color = 'var(--theme-accent)';
    kcBadge.style.fontWeight = '600';
    kcBadge.textContent = `×${monster.killCount}`;

    const totalValBadge = document.createElement('span');
    totalValBadge.style.color = '#ffd24a';
    totalValBadge.textContent = `${abbreviateValue(monster.totalValue)} gp`;

    right.appendChild(kcBadge);
    right.appendChild(totalValBadge);

    cardHeader.appendChild(left);
    cardHeader.appendChild(right);

    cardHeader.onclick = () => {
      this.opts.sessionStore.toggleCollapsed(monster.npcName);
      this.render();
    };
    card.appendChild(cardHeader);

    if (!isCollapsed) {
      const dropItems = Object.values(monster.drops || {}).sort((a, b) => b.totalValue - a.totalValue);

      const grid = document.createElement('div');
      Object.assign(grid.style, {
        padding: '8px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))',
        gap: '6px',
      });

      if (dropItems.length === 0) {
        const noDrops = document.createElement('div');
        noDrops.style.gridColumn = '1 / -1';
        noDrops.style.fontSize = '11px';
        noDrops.style.color = 'var(--theme-text-muted)';
        noDrops.style.fontStyle = 'italic';
        noDrops.style.padding = '4px';
        noDrops.textContent = 'No item drops observed yet.';
        grid.appendChild(noDrops);
      } else {
        for (const drop of dropItems) {
          const slot = this.createItemSlot(drop, monster.killCount);
          grid.appendChild(slot);
        }
      }
      card.appendChild(grid);
    }

    return card;
  }

  private createItemSlot(drop: MonsterDropSummary, totalKills: number): HTMLElement {
    const slot = document.createElement('div');
    Object.assign(slot.style, {
      position: 'relative',
      width: '42px',
      height: '42px',
      background: 'rgba(0, 0, 0, 0.35)',
      border: '1px solid var(--theme-border)',
      borderRadius: '5px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'default',
    });

    const qty = Number(drop.quantity) || 0;
    const totalVal = Number(drop.totalValue) || 0;
    const dropRatePct = totalKills > 0 ? ((qty / totalKills) * 100).toFixed(1) : '0';
    slot.title = `${drop.name}\nQuantity: ${qty.toLocaleString()}\nTotal Value: ${totalVal.toLocaleString()} gp\nDrop Rate: ${qty}/${totalKills} (${dropRatePct}%)`;

    const img = document.createElement('img');
    const primaryUrl = this.opts.accessors.getItemIconUrl(drop.itemId);
    const fallbackUrl = this.opts.accessors.getItemFallbackIconUrl(drop.itemId);

    img.src = primaryUrl;
    Object.assign(img.style, {
      width: '32px',
      height: '32px',
      objectFit: 'contain',
      imageRendering: 'pixelated',
    });

    img.onerror = () => {
      if (img.src !== fallbackUrl) {
        img.src = fallbackUrl;
      }
    };
    slot.appendChild(img);

    const qtySpan = document.createElement('span');
    qtySpan.textContent = drop.quantity > 9999 ? abbreviateValue(drop.quantity) : String(drop.quantity);
    Object.assign(qtySpan.style, {
      position: 'absolute',
      right: '2px',
      bottom: '1px',
      fontSize: '10px',
      fontWeight: '700',
      color: '#ffffff',
      textShadow: '0 0 3px #000, 1px 1px 2px #000',
      pointerEvents: 'none',
    });
    slot.appendChild(qtySpan);

    return slot;
  }

  private styleSyncBadge(el: HTMLElement): void {
    const optIn = this.opts.isWikiOptIn();
    if (!optIn) {
      el.textContent = '⚪ Local Only';
      el.title = 'Wiki crowdsourcing is disabled in settings';
      Object.assign(el.style, {
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '10px',
        background: 'rgba(255, 255, 255, 0.08)',
        color: 'var(--theme-text-muted)',
      });
      return;
    }

    if (this.opts.telemetry.syncStatus === 'synced') {
      el.textContent = '🟢 Wiki Synced';
      el.title = `Data synced. Last upload: ${new Date(this.opts.telemetry.lastSyncTime).toLocaleTimeString()}`;
      Object.assign(el.style, {
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '10px',
        background: 'rgba(16, 185, 129, 0.15)',
        color: 'var(--theme-success)',
      });
    } else if (this.opts.telemetry.syncStatus === 'offline') {
      el.textContent = '⚠️ Offline Queue';
      el.title = 'Server unreachable; caching telemetry locally';
      Object.assign(el.style, {
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '10px',
        background: 'rgba(239, 68, 68, 0.15)',
        color: 'var(--theme-danger)',
      });
    } else {
      el.textContent = '🟡 Wiki Telemetry';
      el.title = 'Crowdsourcing telemetry active';
      Object.assign(el.style, {
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '10px',
        background: 'rgba(249, 244, 73, 0.15)',
        color: 'var(--theme-accent)',
      });
    }
  }
}

