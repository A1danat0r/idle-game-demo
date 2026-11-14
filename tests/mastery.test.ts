import { describe, expect, it } from 'vitest';
import { ENEMIES, ITEMS, NODE_BY_ID, NODES, RECIPES, XP_TABLE, expectedCoinValue, expectedDropValue } from '../src/content';
import {
  advanceOpenTab,
  creditOffline,
  deserialize,
  newGame,
  sell,
  serialize,
  startCombat,
  startGather,
  startProduce,
  stepCompletion,
  type FloatNote,
} from '../src/engine';
import {
  MASTERY_CAP,
  actionMasteryXp,
  actionXpMultiplier,
  enemyLootFactor,
  globalXpBonus,
  masteryLevel,
  masteryThreshold,
  masteryTrackForItem,
  sellMultiplier,
} from '../src/mastery';

describe('check 19 mastery', () => {
  it('uses the Deep curve and stops the shown level at 30', () => {
    expect(masteryThreshold(1)).toBe(0);
    expect(masteryThreshold(2)).toBe(75);
    expect(masteryThreshold(10)).toBe(6_072);
    expect(masteryThreshold(20)).toBe(27_064);
    expect(masteryThreshold(30)).toBe(63_049);
    expect(masteryLevel(6_071)).toBe(9);
    expect(masteryLevel(6_072)).toBe(10);
    expect(masteryLevel(63_049)).toBe(30);
    expect(masteryLevel(63_050)).toBe(MASTERY_CAP);
    expect(NODES).toHaveLength(16);
    expect(RECIPES).toHaveLength(40);
    const outputs = new Map<string, string>();
    for (const recipe of RECIPES) {
      for (const output of recipe.outputs) {
        expect(outputs.has(output.id)).toBe(false);
        outputs.set(output.id, recipe.id);
        expect(NODE_BY_ID[output.id]).toBeUndefined();
      }
    }
  });

  it('gives pine 26 MXP and an iron bar 49, with the level 10, 20 and 30 perks', () => {
    expect(actionMasteryXp(NODE_BY_ID['mat.wood.pine'].seconds)).toBe(26);
    expect(actionMasteryXp(4.9)).toBe(49);

    const state = newGame(0);
    startGather(state, 'mat.wood.pine');
    const notes: FloatNote[] = [];
    advanceOpenTab(state, 2600, 5000, notes);
    expect(state.mastery['mat.wood.pine']).toBe(26);
    expect(notes.some((note) => note.kind === 'toast')).toBe(false);
    expect(state.xp.Woodcutting).toBe(42);

    state.mastery['mat.wood.pine'] = 6_072 - 26;
    advanceOpenTab(state, state.lastCredited + 2600, 5000, notes);
    expect(masteryLevel(state.mastery['mat.wood.pine'])).toBe(10);
    expect(sellMultiplier(state.mastery, 'mat.wood.pine')).toBeCloseTo(1.05);
    expect(notes.some((note) => note.kind === 'toast' && note.text === 'Pine logs mastery 10: sell value +5%')).toBe(true);
    state.bank['mat.wood.pine'] = 1;
    state.coins = 0;
    expect(sell(state, 'mat.wood.pine', 1)).toBe(true);
    expect(state.coins).toBeCloseTo(1.05);

    state.mastery['mat.wood.pine'] = 27_064;
    expect(state.activity?.kind).toBe('gather');
    const before = state.stats.actions;
    const started = state.lastCredited;
    advanceOpenTab(state, started + Math.round(2.6 * 0.95 * 1000), 5000, []);
    expect(state.stats.actions).toBe(before + 1);

    state.mastery['mat.wood.pine'] = 63_049 - 26;
    const xpBefore = state.xp.Woodcutting ?? 0;
    const levelNotes: FloatNote[] = [];
    advanceOpenTab(state, state.lastCredited + Math.round(2.6 * 0.95 * 1000), 5000, levelNotes);
    expect(masteryLevel(state.mastery['mat.wood.pine'])).toBe(30);
    expect(state.mastery['mat.wood.pine']).toBeGreaterThanOrEqual(63_049);
    expect(actionXpMultiplier(state.mastery, 'mat.wood.pine', 'Woodcutting')).toBeCloseTo(1.08);
    expect(globalXpBonus(state.mastery, 'Woodcutting')).toBeCloseTo(0.03);
    expect(state.xp.Woodcutting).toBeCloseTo(xpBefore + 42);
    expect(levelNotes.some((note) => note.kind === 'toast' && note.text === 'Pine logs mastery 30: +5% XP')).toBe(true);
    expect(levelNotes.some((note) => note.kind === 'toast' && note.text === '+3% Woodcutting XP')).toBe(true);
    const shown = state.xp.Woodcutting ?? 0;
    advanceOpenTab(state, state.lastCredited + Math.round(2.6 * 0.95 * 1000), 5000, []);
    expect(state.xp.Woodcutting).toBeCloseTo(shown + 42 * 1.08);
    expect(state.mastery['mat.wood.pine']).toBeGreaterThan(63_049);

    const smith = newGame(0);
    smith.owned.push('Smithing');
    smith.xp.Smithing = XP_TABLE[20];
    smith.bank['mat.ore.iron'] = 2;
    smith.bank['mat.fuel.charcoal'] = 1;
    expect(startProduce(smith, 'recipe.mat.bar.iron')).toBe(true);
    advanceOpenTab(smith, 4900, 5000, []);
    expect(smith.mastery['recipe.mat.bar.iron']).toBe(49);
  });

  it('adds 102 MXP per Thorn beetle kill and +10% loot after the 619th', () => {
    const enemy = ENEMIES.find((row) => row.id === 'meadow.beetle');
    expect(enemy).toBeTruthy();
    const base = expectedCoinValue(enemy!) + expectedDropValue(enemy!.drops);
    const state = newGame(0, 1);
    state.owned.push('Strength', 'Attack', 'Defence', 'Hitpoints');
    state.xp.Attack = XP_TABLE[30];
    state.xp.Defence = XP_TABLE[30];
    state.hp = 70;
    state.enemyMastery['meadow.beetle'] = 618 * 102;
    expect(masteryLevel(state.enemyMastery['meadow.beetle'])).toBe(29);
    expect(enemyLootFactor(state.enemyMastery, 'meadow.beetle')).toBe(1);
    state.enemyKills['meadow.beetle'] = 1;
    expect(startCombat(state, 'meadow.beetle', 'Strength')).toBe(true);
    const coinsBefore = state.coins;
    let guard = 0;
    while (state.stats.kills < 1 && guard++ < 40) stepCompletion(state, { expectedLoot: true });
    expect(state.stats.kills).toBe(1);
    expect(state.enemyMastery['meadow.beetle']).toBe(619 * 102);
    expect(masteryLevel(state.enemyMastery['meadow.beetle'])).toBe(30);
    expect(state.coins - coinsBefore).toBeCloseTo(base);
    const boostedBefore = state.coins;
    while (state.stats.kills < 2 && guard++ < 80) stepCompletion(state, { expectedLoot: true });
    expect(state.stats.kills).toBe(2);
    expect(state.coins - boostedBefore).toBeCloseTo(base * 1.1);
  });

  it('keeps both maps through a save and adds mastery during offline catch-up', () => {
    const state = newGame(0);
    state.mastery['mat.wood.pine'] = 100;
    state.enemyMastery['meadow.beetle'] = 204;
    const loaded = deserialize(serialize(state));
    expect(loaded?.saveFormat).toBe(3);
    expect(loaded?.mastery).toEqual({ 'mat.wood.pine': 100 });
    expect(loaded?.enemyMastery).toEqual({ 'meadow.beetle': 204 });

    const away = newGame(0);
    startGather(away, 'mat.wood.pine');
    const report = creditOffline(away, 60_000);
    expect(report.actions).toBeGreaterThan(1);
    expect(away.mastery['mat.wood.pine']).toBe(report.actions * 26);
    expect(report.masteryLevels.some((row) => row.id === 'mat.wood.pine' && row.after > row.before)).toBe(true);
  });

  it('loads a format-1 save with empty mastery maps', () => {
    const raw = JSON.stringify({
      saveFormat: 1,
      coins: 12,
      xp: { Woodcutting: 80 },
      owned: ['Woodcutting'],
      purchaseCount: 0,
      nodes: [],
      bank: { 'gear.melee.bronze_sword': 1, 'mat.wood.pine': 3 },
      equipped: { weapon: 'gear.melee.bronze_sword', body: null, shield: null },
      activity: null,
      progressMs: 0,
      hp: 12,
      paused: false,
      combat: null,
      foodSlot: null,
      shop: {},
      lastCredited: 0,
      rngState: 3,
      regenMs: 0,
      stats: {
        actions: 4,
        kills: 0,
        pauses: 0,
        foodEaten: 0,
        coinsFromKills: 0,
        coinsFromSales: 0,
        lootValue: 0,
        killsByEnemy: {},
        pauseAtKill: [],
        playerSwings: 0,
        playerHits: 0,
        playerMisses: 0,
        enemyHits: 0,
      },
    });
    const loaded = deserialize(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.saveFormat).toBe(3);
    expect(loaded!.mastery).toEqual({});
    expect(loaded!.enemyMastery).toEqual({});
    expect(loaded!.xp.Woodcutting).toBe(80);
    expect(loaded!.bank['mat.wood.pine']).toBe(3);
    expect(masteryTrackForItem('mat.wood.pine')).toBe('mat.wood.pine');
    expect(ITEMS['mat.wood.pine'].sell).toBe(1);
  });
});
