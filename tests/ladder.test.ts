import { describe, expect, it } from 'vitest';
import {
  ENEMY_BY_ID,
  XP_TABLE,
  enemyUnlocked,
  expectedCoinValue,
  expectedDropValue,
  lockLine,
  playerMaxHp,
} from '../src/content';
import {
  deserialize,
  newGame,
  simulate,
  startCombat,
  stopActivity,
  stepCompletion,
} from '../src/engine';
import { ENEMY_MASTERY_XP } from '../src/mastery';
import { ladderFoodFree } from '../src/route';
import { ENEMY_SPRITES, enemyFigure } from '../src/sprites';
import { mainHtml, type View } from '../src/ui';

function fighter(seed = 1) {
  const state = newGame(0, seed);
  state.owned.push('Strength', 'Attack', 'Defence', 'Hitpoints');
  state.xp.Attack = XP_TABLE[30];
  state.xp.Defence = XP_TABLE[1];
  state.xp.Hitpoints = XP_TABLE[30];
  state.hp = playerMaxHp(30);
  return state;
}

function combatView(area: View['area'], selected: string): View {
  return {
    tab: 'combat',
    skill: 'Woodcutting',
    filter: 'all',
    selected,
    area,
    style: 'Strength',
    message: '',
  };
}

describe('check 26 meadow ladder', () => {
  it('lets a fresh save fight only the hare, then opens each rung after 12 kills', () => {
    const state = fighter();
    expect(startCombat(state, 'meadow.hare', 'Strength')).toBe(true);
    for (const id of ['meadow.rat', 'meadow.ram', 'meadow.moss', 'meadow.beetle', 'wood.fox']) {
      expect(startCombat(state, id, 'Strength'), id).toBe(false);
      expect(enemyUnlocked(state.enemyKills, id), id).toBe(false);
    }
    const locked = mainHtml(state, combatView('Meadow verge', 'meadow.rat'), 0);
    expect(locked).toContain('Kill 12 burrowing hares to unlock (0/12)');
    expect(locked).not.toContain('data-fight="meadow.rat"');
    const wood = mainHtml(state, combatView('Woodland edge', 'wood.fox'), 0);
    expect(wood).toContain('Kill the Thorn beetle to open Woodland edge.');
    expect(wood).not.toContain('data-fight=');

    stopActivity(state);
    startCombat(state, 'meadow.hare', 'Strength');
    while (state.stats.kills < 11) stepCompletion(state);
    expect(state.enemyKills['meadow.hare']).toBe(11);
    startCombat(state, 'meadow.hare', 'Strength');
    simulate(state, 2400);
    stopActivity(state);
    expect(state.enemyKills['meadow.hare']).toBe(11);
    expect(enemyUnlocked(state.enemyKills, 'meadow.rat')).toBe(false);

    startCombat(state, 'meadow.hare', 'Strength');
    stepCompletion(state);
    expect(state.enemyKills['meadow.hare']).toBe(12);
    expect(startCombat(state, 'meadow.rat', 'Strength')).toBe(true);
    expect(startCombat(state, 'meadow.ram', 'Strength')).toBe(false);

    state.enemyKills['meadow.rat'] = 12;
    expect(enemyUnlocked(state.enemyKills, 'meadow.ram')).toBe(true);
    state.enemyKills['meadow.ram'] = 12;
    expect(enemyUnlocked(state.enemyKills, 'meadow.moss')).toBe(true);
    state.enemyKills['meadow.moss'] = 12;
    expect(enemyUnlocked(state.enemyKills, 'meadow.beetle')).toBe(true);
    expect(enemyUnlocked(state.enemyKills, 'wood.fox')).toBe(false);
  });
});

describe('check 27 woodland gate', () => {
  it('opens every woodland enemy on the first completed beetle kill', () => {
    const state = fighter();
    state.enemyKills['meadow.hare'] = 12;
    state.enemyKills['meadow.rat'] = 12;
    state.enemyKills['meadow.ram'] = 12;
    state.enemyKills['meadow.moss'] = 12;
    expect(startCombat(state, 'meadow.beetle', 'Strength')).toBe(true);
    simulate(state, 2400);
    stopActivity(state);
    expect(state.stats.kills).toBe(0);
    expect(enemyUnlocked(state.enemyKills, 'wood.jay')).toBe(false);
    startCombat(state, 'meadow.beetle', 'Strength');
    stepCompletion(state);
    expect(state.enemyKills['meadow.beetle']).toBe(1);
    for (const id of ['wood.jay', 'wood.fox', 'wood.grub', 'wood.tortoise', 'wood.boar', 'wood.poacher']) {
      expect(enemyUnlocked(state.enemyKills, id), id).toBe(true);
    }
    expect(startCombat(state, 'meadow.hare', 'Strength')).toBe(true);
  });
});

describe('check 28 save migration', () => {
  it('stores kill counts on format 3 and derives them from older saves', () => {
    const fresh = newGame(0);
    expect(fresh.saveFormat).toBe(3);
    expect(fresh.enemyKills).toEqual({});
    expect(enemyUnlocked(fresh.enemyKills, 'meadow.hare')).toBe(true);
    expect(enemyUnlocked(fresh.enemyKills, 'meadow.rat')).toBe(false);

    const format2 = deserialize(JSON.stringify(baseSave(2, { 'meadow.beetle': 619 * ENEMY_MASTERY_XP })));
    expect(format2?.saveFormat).toBe(3);
    expect(format2?.enemyKills['meadow.beetle']).toBe(619);
    for (const id of ['meadow.hare', 'meadow.rat', 'meadow.ram', 'meadow.moss', 'meadow.beetle', 'wood.fox']) {
      expect(enemyUnlocked(format2!.enemyKills, id), id).toBe(true);
    }

    const format1 = deserialize(JSON.stringify(baseSave(1, {})));
    expect(format1?.enemyKills).toEqual({});
    expect(enemyUnlocked(format1!.enemyKills, 'meadow.hare')).toBe(true);
    expect(enemyUnlocked(format1!.enemyKills, 'meadow.rat')).toBe(false);
    expect(enemyUnlocked(format1!.enemyKills, 'wood.fox')).toBe(false);

    const progress = deserialize(JSON.stringify({ ...baseSave(3, {}), enemyKills: { 'meadow.hare': 8 } }));
    expect(progress?.enemyKills['meadow.hare']).toBe(8);
    expect(enemyUnlocked(progress!.enemyKills, 'meadow.rat')).toBe(false);
    expect(lockLine(progress!.enemyKills, 'meadow.rat')).toBe('Kill 12 burrowing hares to unlock (8/12)');

    const hareGate = deserialize(JSON.stringify(baseSave(2, { 'meadow.hare': 12 * ENEMY_MASTERY_XP })));
    expect(hareGate?.enemyKills['meadow.hare']).toBe(12);
    expect(enemyUnlocked(hareGate!.enemyKills, 'meadow.rat')).toBe(true);
    expect(enemyUnlocked(hareGate!.enemyKills, 'meadow.ram')).toBe(false);
    expect(enemyUnlocked(hareGate!.enemyKills, 'wood.fox')).toBe(false);
  });
});

describe('ladder catalogue', () => {
  it('uses the approved meadow stats and keeps the first four rungs food-free', () => {
    expect(ENEMY_BY_ID['meadow.hare']).toMatchObject({ level: 1, hp: 150, maxHit: 10 });
    expect(ENEMY_BY_ID['meadow.rat']).toMatchObject({ level: 2, hp: 200, maxHit: 10 });
    expect(ENEMY_BY_ID['meadow.ram']).toMatchObject({ level: 3, hp: 250, maxHit: 10 });
    expect(ENEMY_BY_ID['meadow.moss']).toMatchObject({ level: 3, hp: 250, maxHit: 10 });
    expect(ENEMY_BY_ID['meadow.beetle']).toMatchObject({ level: 5, hp: 350, maxHit: 20 });
    expect(expectedCoinValue(ENEMY_BY_ID['meadow.beetle'])).toBe(2.5);
    expect(expectedDropValue(ENEMY_BY_ID['meadow.hare'].drops)).toBeCloseTo(4, 5);
    expect(expectedDropValue(ENEMY_BY_ID['meadow.rat'].drops)).toBeCloseTo(6, 5);
    expect(expectedDropValue(ENEMY_BY_ID['meadow.ram'].drops)).toBeCloseTo(4, 5);
    expect(expectedDropValue(ENEMY_BY_ID['meadow.moss'].drops)).toBeCloseTo(6, 5);
    expect(expectedDropValue(ENEMY_BY_ID['meadow.beetle'].drops) + 2.5).toBeCloseTo(6.25, 5);

    const bronze = fighter();
    for (const id of ['meadow.hare', 'meadow.rat', 'meadow.ram', 'meadow.moss']) {
      expect(ladderFoodFree(id, bronze), id).toBe(true);
    }
    expect(ladderFoodFree('meadow.beetle', bronze)).toBe(false);
    const spear = fighter();
    spear.bank['gear.melee.iron_spear'] = 1;
    spear.equipped.weapon = 'gear.melee.iron_spear';
    spear.xp.Strength = XP_TABLE[30];
    spear.xp.Defence = XP_TABLE[7];
    spear.xp.Attack = 0;
    expect(ladderFoodFree('meadow.beetle', spear)).toBe(true);
    spear.xp.Defence = XP_TABLE[6];
    spear.xp.Strength = XP_TABLE[30];
    expect(ladderFoodFree('meadow.beetle', spear)).toBe(false);
  });

  it('pays the beetle 2–3 coins and still kills it in 5 or 6 hits at base 5', () => {
    const state = fighter(3);
    state.enemyKills['meadow.moss'] = 12;
    state.enemyKills['meadow.hare'] = 12;
    state.enemyKills['meadow.rat'] = 12;
    state.enemyKills['meadow.ram'] = 12;
    state.xp.Defence = XP_TABLE[30];
    startCombat(state, 'meadow.beetle', 'Attack');
    for (let kill = 0; kill < 1000; kill += 1) {
      const hits = state.stats.playerHits;
      const step = stepCompletion(state);
      expect(step.type).toBe('kill');
      const landed = state.stats.playerHits - hits;
      expect(landed === 5 || landed === 6).toBe(true);
    }
    const mean = state.stats.coinsFromKills / state.stats.kills;
    expect(Math.abs(mean - 2.5)).toBeLessThanOrEqual(0.15);
  });
});

describe('beetle sprite', () => {
  it('does not look like the moss crawler', () => {
    const moss = enemyFigure('meadow.moss');
    const beetle = enemyFigure('meadow.beetle');
    expect(beetle).not.toBe(moss);
    expect(ENEMY_SPRITES['meadow.beetle'].join('\n')).not.toBe(ENEMY_SPRITES['meadow.moss'].join('\n'));
    for (const green of ['#3e9a4c', '#246632', '#8ed468']) expect(beetle).not.toContain(green);
    expect(beetle).toContain('#8a2434');
    expect(beetle).toContain('#f3e6c4');
    const filled = (rows: readonly string[]) => rows.join('').replaceAll('.', '').length;
    expect(filled(ENEMY_SPRITES['meadow.beetle'])).toBeGreaterThan(filled(ENEMY_SPRITES['meadow.moss']));
  });
});

function baseSave(format: number, enemyMastery: Record<string, number>) {
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
    hp: 12,
    paused: false,
    combat: null,
    foodSlot: null,
    shop: {},
    lastCredited: 0,
    rngState: 1,
    regenMs: 0,
    mastery: {},
    enemyMastery,
    combatScale: 10,
    stats: {
      actions: 0,
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
  };
}
