import { describe, expect, it } from 'vitest';
import { OFFLINE_CAP_MS, SHOP_PRICE, XP_CAP, XP_TABLE } from '../src/content';
import {
  SAVE_KEY,
  UNREADABLE_SAVE_KEY,
  advanceOpenTab,
  buyShop,
  buySkill,
  confirmAccountReset,
  creditOffline,
  deserialize,
  loadAndCredit,
  newGame,
  sell,
  serialize,
  startCombat,
  stepCompletion,
  writeSave,
  type StorageLike,
} from '../src/engine';
import { masteryThreshold } from '../src/mastery';
import { DEV_STORAGE_KEY, SILENT_GAP_MS } from '../src/provisional';
import { deriveProfileStats, formatPlayed, formatSavedAt } from '../src/profile';
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
    state.stats.kills = 99;
    state.enemyKills['meadow.hare'] = 12;
    state.enemyKills['meadow.rat'] = 2;
    state.enemyMastery['meadow.hare'] = masteryThreshold(40);
    state.mastery['mat.wood.pine'] = masteryThreshold(40);
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
    expect(loaded.state.stats.timePlayed).toBe(0);
    expect(loaded.state.stats.coinsEarned).toBe(0);
    expect(loaded.state.stats.coinsSpent).toBe(0);
    expect(loaded.state.saveFormat).toBe(4);
    expect(loaded.state.buildings).toEqual({});
  });

  it('resets when the Debug switch has never been set', () => {
    const storage = new Mem();
    const played = newGame(5_000);
    played.stats.timePlayed = 60_000;
    played.stats.coinsEarned = 12;
    played.stats.coinsSpent = 4;
    played.lastCredited = 5_000;
    played.activity = { kind: 'gather', nodeId: 'mat.wood.pine' };
    storage.setItem(SAVE_KEY, serialize(played));
    expect(storage.getItem(DEV_STORAGE_KEY)).toBeNull();
    expect(confirmAccountReset(storage, true)).toBe(true);
    expect(storage.getItem(DEV_STORAGE_KEY)).toBeNull();
    const loaded = loadAndCredit(storage, 5_000 + 3_600_000);
    expect(loaded.report).toBeNull();
    expect(loaded.state.stats.timePlayed).toBe(0);
    expect(loaded.state.stats.coinsEarned).toBe(0);
    expect(loaded.state.stats.coinsSpent).toBe(0);
    expect(loaded.state.saveFormat).toBe(4);
    expect(loaded.state.buildings).toEqual({});
    expect(loaded.state.lastCredited).toBe(5_000 + 3_600_000);
  });
});

describe('profile rules', () => {
  it('caps each displayed skill level at 40 and includes Hitpoints', () => {
    const state = newGame(0);
    state.xp.Woodcutting = XP_CAP + 50_000;
    state.xp.Hitpoints = XP_TABLE[10];
    const stats = deriveProfileStats(state);
    expect(stats.totalLevel).toBe(40 + 10);
  });

  it('counts kills from enemyKills when the stats log disagrees', () => {
    const state = newGame(0);
    state.stats.kills = 40;
    state.enemyKills['meadow.hare'] = 2;
    expect(deriveProfileStats(state).kills).toBe(2);
    expect(deriveProfileStats(state).killsByEnemy).toEqual([{ id: 'meadow.hare', name: 'Burrowing hare', kills: 2 }]);
  });

  it('credits tick time and caps offline time at 24 hours', () => {
    const online = newGame(1_000);
    online.lastCredited = 1_000;
    advanceOpenTab(online, 1_000 + 2_000, SILENT_GAP_MS);
    expect(online.stats.timePlayed).toBe(2_000);
    expect(formatPlayed(3 * 3_600_000 + 12 * 60_000)).toBe('3h 12m');
    expect(formatPlayed(45 * 60_000)).toBe('45m');

    const away = newGame(0);
    away.lastCredited = 0;
    away.activity = { kind: 'gather', nodeId: 'mat.wood.pine' };
    const report = creditOffline(away, OFFLINE_CAP_MS + 5 * 3_600_000);
    expect(report.creditedMs).toBe(OFFLINE_CAP_MS);
    expect(away.stats.timePlayed).toBe(OFFLINE_CAP_MS);
  });

  it('counts coins earned and spent in play, and ignores a direct coin edit', () => {
    const state = newGame(0);
    state.coins = 5_000;
    expect(buySkill(state, 'Fishing')).toBe(true);
    expect(state.stats.coinsSpent).toBe(750);
    expect(state.stats.coinsEarned).toBe(0);
    state.bank['mat.wood.pine'] = 4;
    expect(state.stats.coinsFromSales).toBe(0);
    expect(sell(state, 'mat.wood.pine', 4)).toBe(true);
    expect(state.stats.coinsFromSales).toBe(4);
    expect(state.stats.coinsEarned).toBe(4);
    state.coins = 9_999;
    expect(state.stats.coinsEarned).toBe(4);
    expect(state.stats.coinsSpent).toBe(750);
    state.coins = 100;
    expect(buyShop(state, 'mat.meat.hare', 0)).toBe(true);
    expect(state.stats.coinsSpent).toBe(750 + SHOP_PRICE);
    expect(state.stats.coinsEarned).toBe(4);
  });

  it('adds mastery bonus coins to lifetime earnings, not to coins from kills', () => {
    const state = newGame(0, 1);
    state.owned.push('Strength', 'Attack', 'Hitpoints');
    state.xp.Attack = XP_TABLE[30];
    state.hp = 700;
    state.enemyKills['meadow.hare'] = 12;
    state.enemyKills['meadow.rat'] = 12;
    state.enemyKills['meadow.ram'] = 12;
    state.enemyKills['meadow.moss'] = 12;
    state.enemyMastery['meadow.beetle'] = masteryThreshold(40);
    startCombat(state, 'meadow.beetle', 'Attack');
    const before = state.coins;
    const step = stepCompletion(state);
    expect(step.type).toBe('kill');
    const gained = state.coins - before;
    expect(gained).toBeGreaterThan(state.stats.coinsFromKills);
    expect(state.stats.coinsEarned).toBeCloseTo(gained, 5);
    expect(state.stats.coinsFromKills).toBeGreaterThan(0);
  });

  it('leaves hare kill coins at 0 because a hare drops items, not coins', () => {
    const state = newGame(0, 2);
    state.owned.push('Strength', 'Attack', 'Hitpoints');
    state.xp.Attack = XP_TABLE[30];
    state.hp = 700;
    startCombat(state, 'meadow.hare', 'Attack');
    expect(stepCompletion(state).type).toBe('kill');
    expect(stepCompletion(state).type).toBe('kill');
    expect(state.enemyKills['meadow.hare']).toBe(2);
    expect(state.stats.kills).toBe(2);
    expect(state.stats.coinsFromKills).toBe(0);
    expect(state.stats.coinsEarned).toBe(0);
  });

  it('shows unknown for an old save and a local time after a write', () => {
    const old = deserialize(JSON.stringify({ ...bare(3), stats: { actions: 0, kills: 0, pauses: 0, foodEaten: 0, coinsFromKills: 0, coinsFromSales: 0, lootValue: 0, killsByEnemy: {}, pauseAtKill: [], playerSwings: 0, playerHits: 0, playerMisses: 0, enemyHits: 0 } }));
    expect(old?.stats.timePlayed).toBe(0);
    expect(old?.stats.coinsEarned).toBe(0);
    expect(old?.stats.coinsSpent).toBe(0);
    expect(formatSavedAt(old?.savedAt)).toBe('unknown');
    const storage = new Mem();
    const fresh = newGame(0);
    writeSave(storage, fresh);
    const stamped = deserialize(storage.getItem(SAVE_KEY)!);
    expect(stamped?.savedAt).toEqual(fresh.savedAt);
    expect(formatSavedAt(stamped?.savedAt)).toBe(new Date(fresh.savedAt!).toLocaleString());
    expect(formatSavedAt(stamped?.savedAt)).not.toBe('unknown');
  });
});

function bare(format: number) {
  return {
    saveFormat: format,
    coins: 0,
    xp: { Woodcutting: 0 },
    owned: ['Woodcutting'],
    purchaseCount: 0,
    nodes: [],
    bank: { 'gear.melee.bronze_sword': 1 },
    equipped: { weapon: 'gear.melee.bronze_sword', body: null, shield: null },
    activity: null,
    progressMs: 0,
    hp: 120,
    paused: false,
    combat: null,
    foodSlot: null,
    shop: {},
    lastCredited: 0,
    rngState: 1,
    regenMs: 0,
    combatScale: 10,
    mastery: {},
    enemyMastery: {},
    enemyKills: {},
  };
}
