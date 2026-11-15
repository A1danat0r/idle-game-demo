import { describe, expect, it } from 'vitest';
import { XP_TABLE } from '../src/content';
import {
  SAVE_KEY,
  UNREADABLE_SAVE_KEY,
  confirmAccountReset,
  loadAndCredit,
  newGame,
  serialize,
  type StorageLike,
} from '../src/engine';
import { masteryThreshold } from '../src/mastery';
import { DEV_STORAGE_KEY } from '../src/provisional';
import { deriveProfileStats } from '../src/profile';
import { mainHtml, type View } from '../src/ui';

class Mem implements StorageLike {
  map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const profileView = (resetConfirm = false): View => ({
  tab: 'profile',
  skill: 'Woodcutting',
  filter: 'all',
  selected: null,
  area: 'Meadow verge',
  style: null,
  message: '',
  resetConfirm,
});

describe('profile stats', () => {
  it('derives level, XP, coins, kills, ladder, and mastery from the save', () => {
    const fresh = deriveProfileStats(newGame(0));
    expect(fresh.totalLevel).toBe(1);
    expect(fresh.totalXp).toBe(0);
    expect(fresh.coins).toBe(0);
    expect(fresh.coinsFromKills).toBe(0);
    expect(fresh.coinsFromSales).toBe(0);
    expect(fresh.kills).toBe(0);
    expect(fresh.killsByEnemy).toEqual([]);
    expect(fresh.ladderOpen).toBe('Burrowing hare');
    expect(fresh.enemiesMastered).toBe(0);
    expect(fresh.nodesMastered).toBe(0);

    const state = newGame(0);
    state.xp.Woodcutting = 10;
    state.xp.Fishing = XP_TABLE[2];
    state.coins = 1200;
    state.stats.coinsFromKills = 80;
    state.stats.coinsFromSales = 40;
    state.stats.kills = 14;
    state.enemyKills['meadow.hare'] = 12;
    state.enemyKills['meadow.rat'] = 2;
    state.enemyMastery['meadow.hare'] = masteryThreshold(30);
    state.mastery['mat.wood.pine'] = masteryThreshold(30);
    state.mastery['recipe.mat.bar.bronze'] = masteryThreshold(30);
    const stats = deriveProfileStats(state);
    expect(stats.totalLevel).toBe(1 + 2);
    expect(stats.totalXp).toBe(10 + XP_TABLE[2]);
    expect(stats.coins).toBe(1200);
    expect(stats.coinsFromKills).toBe(80);
    expect(stats.coinsFromSales).toBe(40);
    expect(stats.kills).toBe(14);
    expect(stats.killsByEnemy).toEqual([
      { id: 'meadow.hare', name: 'Burrowing hare', kills: 12 },
      { id: 'meadow.rat', name: 'Field rat', kills: 2 },
    ]);
    expect(stats.ladderOpen).toBe('Field rat');
    expect(stats.enemiesMastered).toBe(1);
    expect(stats.nodesMastered).toBe(1);

    state.enemyKills['meadow.beetle'] = 1;
    expect(deriveProfileStats(state).ladderOpen).toBe('Thorn beetle');

    const html = mainHtml(state, profileView(), 0);
    expect(html).toContain('Total level');
    expect(html).toContain('1,200');
    expect(html).toContain('Burrowing hare');
    expect(html).toContain('Field rat');
    expect(html).toContain('Thorn beetle');
    expect(html).toContain('data-reset-ask');
    expect(html).not.toContain('data-reset-confirm');
    const asking = mainHtml(state, profileView(true), 0);
    expect(asking).toContain('data-reset-confirm');
    expect(asking).toContain('data-reset-cancel');
    expect(asking).not.toContain('data-reset-ask');
  });
});

describe('account reset', () => {
  it('clears the save and grants no offline time, and keeps the Debug switch', () => {
    const storage = new Mem();
    const played = newGame(1_000);
    played.coins = 500;
    played.xp.Woodcutting = 4000;
    played.activity = { kind: 'gather', nodeId: 'mat.wood.pine' };
    played.lastCredited = 1_000;
    played.stats.kills = 9;
    played.enemyKills['meadow.hare'] = 9;
    storage.setItem(SAVE_KEY, serialize(played));
    storage.setItem(UNREADABLE_SAVE_KEY, 'old');
    storage.setItem(DEV_STORAGE_KEY, '1');

    expect(confirmAccountReset(storage, false)).toBe(false);
    expect(storage.getItem(SAVE_KEY)).toBe(serialize(played));
    expect(storage.getItem(UNREADABLE_SAVE_KEY)).toBe('old');
    expect(storage.getItem(DEV_STORAGE_KEY)).toBe('1');

    expect(confirmAccountReset(storage, true)).toBe(true);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(storage.getItem(UNREADABLE_SAVE_KEY)).toBeNull();
    expect(storage.getItem(DEV_STORAGE_KEY)).toBe('1');

    const later = 1_000 + 24 * 60 * 60 * 1000;
    const loaded = loadAndCredit(storage, later);
    expect(loaded.status).toBe('new');
    expect(loaded.report).toBeNull();
    expect(loaded.state.xp.Woodcutting).toBe(0);
    expect(loaded.state.coins).toBe(0);
    expect(loaded.state.stats.kills).toBe(0);
    expect(loaded.state.activity).toBeNull();
    expect(loaded.state.lastCredited).toBe(later);
    expect(loaded.state.enemyKills).toEqual({});
  });
});
