import { describe, expect, it } from 'vitest';
import {
  COMBAT_HP_SCALE,
  ENEMY_BY_ID,
  ITEMS,
  REGEN_HP,
  XP_TABLE,
  playerBaseDamage,
  playerMaxHp,
  roundHalfUp,
} from '../src/content';
import {
  creditOffline,
  deserialize,
  newGame,
  simulate,
  startCombat,
  startGather,
  type FloatNote,
} from '../src/engine';
import { activityHtml, headerHtml, reportHtml, type View } from '../src/ui';
import { masteryThreshold } from '../src/mastery';

const blankView = (): View => ({
  tab: 'skills',
  skill: 'Woodcutting',
  filter: 'all',
  selected: null,
  area: 'Meadow verge',
  style: null,
  message: '',
});

describe('check 20 ×10 combat values', () => {
  it('scales HP, max hit, heals and regen by 10, with its own damage rounding', () => {
    expect(ENEMY_BY_ID['meadow.hare'].hp).toBe(150);
    expect(ENEMY_BY_ID['wood.fox'].hp).toBe(500);
    expect(ENEMY_BY_ID['wood.jay'].hp).toBe(600);
    expect(ENEMY_BY_ID['wood.poacher'].hp).toBe(700);
    expect(ENEMY_BY_ID['meadow.hare'].maxHit).toBe(10);
    expect(ENEMY_BY_ID['wood.fox'].maxHit).toBe(30);
    expect(ENEMY_BY_ID['wood.poacher'].maxHit).toBe(40);
    expect(playerMaxHp(1)).toBe(120);
    expect(playerMaxHp(7)).toBe(240);
    expect(playerMaxHp(23)).toBe(560);
    expect(playerMaxHp(30)).toBe(700);
    expect(REGEN_HP).toBe(10);
    expect(ITEMS['food.roast_minnows'].heal).toBe(50);
    expect(ITEMS['food.cooked_shrimp'].heal).toBe(100);
    expect(ITEMS['food.roast_perch'].heal).toBe(120);
    expect(ITEMS['food.tortoise_herb_soup'].heal).toBe(140);
    expect(ITEMS['food.roast_trout'].heal).toBe(160);
    expect(ITEMS['food.baked_carp'].heal).toBe(170);
    expect(playerBaseDamage(150, 5)).toBe(30);
    expect(playerBaseDamage(150, 4)).toBe(38);
    expect(playerBaseDamage(150, 3)).toBe(50);
    expect(playerBaseDamage(500, 3)).toBe(167);
    expect(playerBaseDamage(700, 3)).toBe(233);
    expect(roundHalfUp(37.5)).toBe(38);
    expect(COMBAT_HP_SCALE).toBe(10);
  });
});

describe('check 21 variance', () => {
  it('keeps 1,000 seeded hits inside the bounds and near the base', () => {
    const state = newGame(0, 21);
    state.owned.push('Strength', 'Attack', 'Hitpoints');
    state.xp.Attack = XP_TABLE[30];
    state.xp.Strength = 0;
    state.hp = playerMaxHp(30);
    state.xp.Hitpoints = XP_TABLE[30];
    startCombat(state, 'meadow.beetle', 'Attack');
    const amounts: number[] = [];
    let guard = 0;
    while (amounts.length < 1000 && guard++ < 4000) {
      const notes: FloatNote[] = [];
      simulate(state, 2400, undefined, { notes });
      const hit = notes.find((note) => note.kind === 'player-hit');
      if (!hit || hit.kind !== 'player-hit') continue;
      expect(Number.isInteger(hit.amount)).toBe(true);
      expect(hit.amount).toBeGreaterThanOrEqual(roundHalfUp(0.95 * 30));
      expect(hit.amount).toBeLessThanOrEqual(roundHalfUp(1.05 * 30));
      amounts.push(hit.amount);
    }
    expect(amounts).toHaveLength(1000);
    const mean = amounts.reduce((sum, n) => sum + n, 0) / amounts.length;
    expect(Math.abs(mean - 30) / 30).toBeLessThan(0.01);
  });

  it('lands 5 or 6 hits on every Meadow kill at base 5', () => {
    const state = newGame(0, 4);
    state.owned.push('Strength', 'Attack', 'Hitpoints');
    state.xp.Attack = XP_TABLE[30];
    state.xp.Strength = 0;
    state.hp = playerMaxHp(1);
    startCombat(state, 'meadow.beetle', 'Attack');
    for (let kill = 0; kill < 40; kill += 1) {
      const hits = state.stats.playerHits;
      let guard = 0;
      while (state.stats.kills < kill + 1 && guard++ < 20) simulate(state, 2400);
      const landed = state.stats.playerHits - hits;
      expect(landed === 5 || landed === 6).toBe(true);
    }
  });
});

describe('check 23 shown damage', () => {
  it('shows the rolled whole number, including when it is the HP removed', () => {
    const state = newGame(0, 3);
    state.owned.push('Attack', 'Strength', 'Hitpoints');
    state.xp.Attack = XP_TABLE[30];
    state.hp = 200;
    startCombat(state, 'meadow.beetle', 'Strength');
    const notes: FloatNote[] = [];
    const before = state.combat?.enemyHp ?? 0;
    simulate(state, 2400, undefined, { notes });
    const hit = notes.find((note) => note.kind === 'player-hit');
    expect(hit && hit.kind === 'player-hit').toBe(true);
    if (!hit || hit.kind !== 'player-hit') return;
    expect(hit.amount).toBe(before - (state.combat?.enemyHp ?? 0));
    expect(Number.isInteger(hit.amount)).toBe(true);
  });
});

describe('old-save HP migration', () => {
  it('multiplies current HP by 10 and restarts an in-progress kill at full HP', () => {
    const raw = JSON.stringify({
      saveFormat: 2,
      coins: 4,
      xp: { Woodcutting: 0, Hitpoints: 0, Strength: 0 },
      owned: ['Woodcutting', 'Strength', 'Hitpoints'],
      purchaseCount: 0,
      nodes: [],
      bank: { 'gear.melee.bronze_sword': 1 },
      equipped: { weapon: 'gear.melee.bronze_sword', body: null, shield: null },
      activity: { kind: 'combat', enemyId: 'meadow.beetle', style: 'Strength' },
      progressMs: 800,
      hp: 9,
      paused: false,
      combat: {
        phase: 'fight',
        hitsPerKill: 5,
        hitsLanded: 2,
        swings: 2,
        enemyAttacks: 2,
        enemyHp: 7,
        enemyMaxHp: 15,
        killAtMs: null,
      },
      foodSlot: null,
      shop: {},
      lastCredited: 0,
      rngState: 1,
      regenMs: 0,
      mastery: {},
      enemyMastery: {},
      stats: {
        actions: 0, kills: 0, pauses: 0, foodEaten: 0, coinsFromKills: 0, coinsFromSales: 0,
        lootValue: 0, killsByEnemy: {}, pauseAtKill: [], playerSwings: 0, playerHits: 0, playerMisses: 0, enemyHits: 0,
      },
    });
    const loaded = deserialize(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.saveFormat).toBe(2);
    expect(loaded!.combatScale).toBe(10);
    expect(loaded!.hp).toBe(90);
    expect(loaded!.combat?.enemyHp).toBe(150);
    expect(loaded!.combat?.enemyMaxHp).toBe(150);
    expect(loaded!.combat?.hitsLanded).toBe(0);
    expect(loaded!.progressMs).toBe(0);
    const again = deserialize(JSON.stringify(loaded));
    expect(again?.hp).toBe(90);
    expect(again?.combat?.enemyHp).toBe(150);
  });
});

describe('check 24 number formatting', () => {
  it('floors the balance, trims timer zeros, and includes the sell perk in coins per hour', () => {
    const state = newGame(0);
    state.coins = 749.5;
    expect(headerHtml(state, false)).toContain('749');
    expect(headerHtml(state, false)).not.toContain('750');
    const report = reportHtml({
      awayMs: 1000,
      creditedMs: 1000,
      capped: false,
      backwards: false,
      activity: 'Woodcutting',
      actions: 1,
      kills: 0,
      xpGained: {},
      levelsBefore: {},
      levelsAfter: {},
      itemsGained: {},
      itemsConsumed: {},
      coinsGained: 10.9,
      foodEaten: 0,
      stopped: 'window',
      masteryLevels: [],
      perksUnlocked: [],
    });
    expect(report).toContain('>10<');
    expect(report).not.toContain('>11<');

    state.mastery['mat.wood.pine'] = masteryThreshold(20);
    startGather(state, 'mat.wood.pine');
    const bar = activityHtml(state);
    expect(bar).toContain('2.47s');
    expect(bar).not.toContain('2.470');
    expect(bar).toContain('1,530');

    state.bank['tool.woodcutting.bronze_axe'] = 1;
    expect(activityHtml(state)).toContain('2.314s');
    state.bank['tool.woodcutting.iron_axe'] = 1;
    expect(activityHtml(state)).toContain('2.169s');
    expect(activityHtml(state)).toContain('1,743');
    expect(blankView().tab).toBe('skills');
  });
});

describe('check 25 loot bonus', () => {
  it('starts the beetle coin bonus on the 620th kill', () => {
    const state = newGame(0, 11);
    state.owned.push('Strength', 'Attack', 'Hitpoints');
    state.xp.Attack = XP_TABLE[30];
    state.hp = playerMaxHp(30);
    state.xp.Hitpoints = XP_TABLE[30];
    state.enemyMastery['meadow.beetle'] = 618 * 102;
    startCombat(state, 'meadow.beetle', 'Strength');
    const before = state.coins;
    let guard = 0;
    while (state.stats.kills < 1 && guard++ < 30) simulate(state, 2400, undefined, { expectedLoot: true });
    const first = state.coins - before;
    const base = first;
    expect(state.enemyMastery['meadow.beetle']).toBe(619 * 102);
    const mid = state.coins;
    while (state.stats.kills < 2 && guard++ < 60) simulate(state, 2400, undefined, { expectedLoot: true });
    const second = state.coins - mid;
    expect(second).toBeCloseTo(base * 1.1, 5);
    expect(creditOffline(newGame(0), 0).actions).toBe(0);
  });
});
