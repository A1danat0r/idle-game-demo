import { describe, expect, it } from 'vitest';
import {
  ENEMIES,
  ENEMY_BY_ID,
  NODES,
  NODE_BY_ID,
  RECIPES,
  RECIPE_BY_ID,
  SKILL_PRICES,
  XP_CAP,
  XP_TABLE,
  expectedCoinValue,
  expectedDropValue,
  hitChance,
  hitsPerKill,
  levelForXp,
  playerHitChance,
  playerMaxHp,
} from '../src/content';
import { FOREST_FOX_LEVEL } from '../src/provisional';
import { reportHtml } from '../src/ui';
import {
  SAVE_KEY,
  UNREADABLE_SAVE_KEY,
  actionSeconds,
  advanceOpenTab,
  buyShop,
  buySkill,
  creditOffline,
  deserialize,
  importSave,
  loadAndCredit,
  maxHp,
  newGame,
  resumeCombat,
  sell,
  serialize,
  setFood,
  buyNode,
  shopStock,
  simulate,
  startCombat,
  startGather,
  startProduce,
  stepCompletion,
  unequip,
  tabLockDecision,
  writeSave,
  type StorageLike,
} from '../src/engine';

class Mem implements StorageLike {
  map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const HOUR = 3_600_000;

/** Spec section 2.1 rows: id, seconds, XP. */
const TABLE: [string, number, number][] = [
  ['mat.wood.pine', 2.6, 42],
  ['mat.tree.resin', 3.0, 48],
  ['mat.wood.maple', 3.1, 50],
  ['mat.wood.oak', 3.3, 77],
  ['mat.fish.minnow', 3.2, 51],
  ['mat.fish.river_shrimp', 3.6, 58],
  ['mat.fish.perch', 3.9, 63],
  ['mat.fish.trout', 4.1, 95],
  ['mat.fish.carp', 4.4, 102],
  ['mat.ore.copper', 2.9, 46],
  ['mat.ore.tin', 3.0, 48],
  ['mat.stone.limestone', 3.3, 53],
  ['mat.mineral.rock_salt', 3.5, 56],
  ['mat.gem.jade', 3.7, 86],
  ['mat.ore.iron', 3.8, 88],
  ['mat.mineral.pottery_clay', 3.9, 91],
  ['recipe.food.roast_hare', 2.2, 35],
  ['recipe.mat.fuel.charcoal', 2.3, 37],
  ['recipe.food.roast_minnows', 2.4, 38],
  ['recipe.food.cooked_shrimp', 2.5, 40],
  ['recipe.food.shrimp_berry_bowl', 2.7, 43],
  ['recipe.food.roast_perch', 2.7, 43],
  ['recipe.food.mutton_herb_stew', 2.9, 46],
  ['recipe.food.tortoise_herb_soup', 2.9, 46],
  ['recipe.mat.farm.fish_meal', 3.3, 77],
  ['recipe.food.roast_trout', 2.9, 67],
  ['recipe.food.baked_carp', 3.0, 70],
  ['recipe.mat.food.fish_stock', 3.2, 74],
  ['recipe.mat.head.bronze_arrow', 3.4, 27],
  ['recipe.gear.melee.bronze_sword', 3.6, 29],
  ['recipe.gear.armour.bronze_body', 3.7, 30],
  ['recipe.gear.shield.bronze', 3.8, 30],
  ['recipe.mat.bar.bronze', 3.9, 31],
  ['recipe.gear.melee.bronze_dagger', 3.5, 28],
  ['recipe.tool.woodcutting.bronze_axe', 3.6, 29],
  ['recipe.gear.melee.bronze_mace', 3.8, 30],
  ['recipe.ammo.thrown.bronze_knife', 3.5, 28],
  ['recipe.gear.melee.bronze_spear', 3.9, 31],
  ['recipe.tool.mining.bronze_pickaxe', 4.0, 32],
  ['recipe.mat.head.bronze_bolt', 3.6, 29],
  ['recipe.mat.wire.bronze', 3.6, 29],
  ['recipe.ammo.thrown.bronze_javelin', 3.8, 30],
  ['recipe.mat.fitting.bronze_hinge', 3.9, 31],
  ['recipe.mat.fitting.bronze_nail', 4.0, 32],
  ['recipe.mat.fitting.iron', 4.4, 51],
  ['recipe.mat.head.iron_arrow', 4.5, 52],
  ['recipe.gear.melee.iron_sword', 4.6, 53],
  ['recipe.gear.armour.iron_body', 4.8, 56],
  ['recipe.mat.bar.iron', 4.9, 57],
  ['recipe.gear.melee.iron_dagger', 4.4, 51],
  ['recipe.tool.woodcutting.iron_axe', 4.6, 53],
  ['recipe.ammo.thrown.iron_knife', 4.5, 52],
  ['recipe.gear.melee.iron_spear', 4.9, 57],
  ['recipe.tool.mining.iron_pickaxe', 5.0, 58],
  ['recipe.mat.head.iron_bolt', 4.5, 52],
  ['recipe.ammo.thrown.iron_javelin', 4.8, 56],
];

describe('xp and prices', () => {
  it('matches the E1 table anchors and the level cap', () => {
    expect(XP_TABLE[1]).toBe(0);
    expect(XP_TABLE[10]).toBe(13726);
    expect(XP_TABLE[20]).toBe(43272);
    expect(XP_TABLE[22]).toBe(52054);
    expect(XP_TABLE[30]).toBe(102301);
    expect(XP_CAP).toBe(102301);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(1137)).toBe(1);
    expect(levelForXp(1138)).toBe(2);
    expect(levelForXp(43272)).toBe(20);
    expect(levelForXp(102300)).toBe(29);
    expect(levelForXp(102301)).toBe(30);
  });

  it('uses the SC1 ratio through slot 17 and the demo prices', () => {
    const ratio = (132690 / 750) ** (1 / 16);
    const rounded = Array.from({ length: 17 }, (_, k) => Math.round(750 * ratio ** k));
    expect(SKILL_PRICES).toEqual(rounded);
    expect(SKILL_PRICES.slice(0, 7)).toEqual([750, 1036, 1432, 1979, 2735, 3780, 5224]);
    expect(SKILL_PRICES[16]).toBe(132690);
  });

  it('charges the next purchase and refuses a short balance', () => {
    const state = newGame(0);
    state.coins = 749;
    expect(buySkill(state, 'Fishing')).toBe(false);
    state.coins = 750;
    expect(buySkill(state, 'Fishing')).toBe(true);
    expect(state.coins).toBe(0);
    expect(state.purchaseCount).toBe(1);
    expect(buySkill(state, 'Fishing')).toBe(false);
    state.coins = 1036;
    expect(buySkill(state, 'Cooking')).toBe(true);
    expect(state.purchaseCount).toBe(2);
  });
});

describe('actions', () => {
  it('has the demo content counts', () => {
    expect(NODES).toHaveLength(16);
    expect(RECIPES.filter((recipe) => recipe.skill === 'Cooking')).toHaveLength(12);
    expect(RECIPES.filter((recipe) => recipe.skill === 'Smithing')).toHaveLength(28);
    expect(ENEMIES).toHaveLength(11);
    expect(TABLE).toHaveLength(56);
  });

  it('uses the section 2.1 time and XP for every action', () => {
    for (const [id, seconds, xp] of TABLE) {
      const node = NODE_BY_ID[id];
      const recipe = RECIPE_BY_ID[id];
      const action = node ?? recipe;
      expect(action, id).toBeTruthy();
      expect(action!.seconds).toBe(seconds);
      expect(action!.xp).toBe(xp);
    }
  });

  it('reproduces those times from the Q1-A formula', () => {
    const base: Record<string, number> = { Woodcutting: 2.6, Fishing: 3.2, Mining: 2.9, Cooking: 2.2, Smithing: 3.4 };
    const easy = [57696, 83659];
    const standard = [28848, 41830];
    const actions = [
      ...NODES.map((node) => ({ id: node.id, skill: node.skill, level: node.level, units: 1 })),
      ...RECIPES.map((recipe) => ({
        id: recipe.id,
        skill: recipe.skill,
        level: recipe.level,
        units: recipe.inputs.reduce((sum, input) => sum + input.qty, 0),
      })),
    ];
    for (const skill of Object.keys(base)) {
      const mine = actions.filter((action) => action.skill === skill).sort((a, b) => a.level - b.level || a.units - b.units || a.id.localeCompare(b.id));
      for (const level of [...new Set(mine.map((action) => action.level))]) {
        const used = new Set<number>();
        for (const action of mine.filter((row) => row.level === level)) {
          let time = Math.round(base[skill] * (1 + 0.015 * (level - 1)) * (1 + 0.05 * (action.units - 1)) * 10) / 10;
          while (used.has(time)) time = Math.round((time + 0.1) * 10) / 10;
          used.add(time);
          const rate = (skill === 'Smithing' ? standard : easy)[level <= 19 ? 0 : 1];
          const xp = Math.round((rate * time) / 3600);
          const found = TABLE.find((row) => row[0] === action.id)!;
          expect(found[1], action.id).toBe(time);
          expect(found[2], action.id).toBe(xp);
        }
      }
    }
  });

  it('applies the exact tool product and leaves other skills alone', () => {
    const state = newGame(0);
    expect(actionSeconds(state, 'mat.wood.pine')).toBeCloseTo(2.6, 10);
    state.bank['tool.woodcutting.bronze_axe'] = 1;
    expect(actionSeconds(state, 'mat.wood.pine')).toBeCloseTo(2.6 * 0.937, 10);
    expect(actionSeconds(state, 'mat.fish.minnow')).toBeCloseTo(3.2, 10);
    expect(actionSeconds(state, 'recipe.mat.fuel.charcoal')).toBeCloseTo(2.3, 10);
    expect(actionSeconds(state, 'recipe.mat.bar.bronze')).toBeCloseTo(3.9, 10);
    state.bank['tool.woodcutting.iron_axe'] = 1;
    expect(actionSeconds(state, 'mat.wood.pine')).toBeCloseTo(2.6 * 0.937 ** 2, 10);
    state.bank['tool.mining.bronze_pickaxe'] = 1;
    expect(actionSeconds(state, 'mat.ore.iron')).toBeCloseTo(3.8 * 0.937, 10);
    state.bank['tool.mining.iron_pickaxe'] = 1;
    expect(actionSeconds(state, 'mat.ore.copper')).toBeCloseTo(2.9 * 0.877969, 8);
  });

  it('runs 100 pine actions at the stated time, then faster with an axe, and stops XP at the cap', () => {
    const state = newGame(0);
    startGather(state, 'mat.wood.pine');
    simulate(state, 100 * 2600);
    expect(state.stats.actions).toBe(100);
    expect(state.bank['mat.wood.pine']).toBe(100);
    expect(state.xp.Woodcutting).toBe(4200);
    state.bank['tool.woodcutting.bronze_axe'] = 1;
    const before = state.stats.actions;
    simulate(state, 100 * 2.6 * 0.937 * 1000);
    expect(state.stats.actions - before).toBe(100);
    expect(state.xp.Woodcutting).toBe(8400);
    state.xp.Woodcutting = XP_CAP;
    const items = state.bank['mat.wood.pine']!;
    simulate(state, 2600);
    expect(state.xp.Woodcutting).toBe(XP_CAP);
    expect(state.bank['mat.wood.pine']).toBe(items + 1);
  });

  it('stops production when inputs run out and keeps the completed outputs', () => {
    const state = newGame(0);
    state.owned.push('Cooking');
    state.xp.Cooking = 0;
    state.bank['mat.meat.hare'] = 3;
    startProduce(state, 'recipe.food.roast_hare');
    simulate(state, HOUR);
    expect(state.stats.actions).toBe(3);
    expect(state.bank['mat.meat.hare']).toBeUndefined();
    expect(state.bank['food.roast_hare']).toBe(3);
    expect(state.xp.Cooking).toBe(105);
    expect(state.activity).toBeNull();
  });

});

describe('player hit chance', () => {
  it('matches the section 5 table and both clamps', () => {
    expect(playerHitChance(1, 1)).toBeCloseTo(0.88, 10);
    expect(playerHitChance(1, 10)).toBeCloseTo(0.772, 10);
    expect(playerHitChance(1, 12)).toBeCloseTo(0.748, 10);
    expect(playerHitChance(11, 1)).toBeCloseTo(1, 10);
    expect(playerHitChance(11, 10)).toBeCloseTo(0.892, 10);
    expect(playerHitChance(11, 12)).toBeCloseTo(0.868, 10);
    expect(playerHitChance(30, 1)).toBe(1);
    expect(playerHitChance(30, 10)).toBe(1);
    expect(playerHitChance(30, 12)).toBe(1);
    expect(playerHitChance(1, 33)).toBe(0.5);
    expect(playerHitChance(1, 100)).toBe(0.5);
  });

  it('reads the enemy level the spec defines, and does not invent one for the fox', () => {
    expect(ENEMY_BY_ID['meadow.beetle'].level).toBe(1);
    expect(ENEMY_BY_ID['wood.jay'].level).toBe(10);
    expect(ENEMY_BY_ID['wood.poacher'].level).toBe(12);
    expect(ENEMY_BY_ID['wood.fox'].level).toBe(FOREST_FOX_LEVEL);
    expect(ENEMY_BY_ID['wood.fox'].hp).toBe(5 * (FOREST_FOX_LEVEL + 2));
  });

  it('deals no damage and grants no XP on a miss, and still pays 120 when the kill lands', () => {
    let missed = false;
    for (let seed = 1; seed < 80 && !missed; seed++) {
      const state = combatReady(1, seed, 1);
      startCombat(state, 'meadow.beetle', 'Strength');
      simulate(state, 2400);
      if (state.stats.playerMisses !== 1) continue;
      expect(state.xp.Strength).toBe(0);
      expect(state.xp.Hitpoints).toBe(0);
      expect(state.combat?.enemyHp).toBe(15);
      expect(state.combat?.hitsLanded).toBe(0);
      expect(state.combat?.swings).toBe(1);
      let guard = 0;
      while (state.stats.kills < 1 && !state.paused && guard++ < 40) simulate(state, 2400);
      expect(state.stats.kills).toBe(1);
      expect(state.stats.playerHits).toBe(5);
      expect(state.stats.playerMisses).toBeGreaterThan(0);
      expect(state.xp.Strength).toBe(120);
      expect(state.xp.Hitpoints).toBe(24);
      missed = true;
    }
    expect(missed).toBe(true);
  });
});

describe('combat', () => {
  it('uses the strength hits table, 120 style XP, and 24 Hitpoints XP', () => {
    expect(hitsPerKill(1, 1)).toBe(5);
    expect(hitsPerKill(10, 1)).toBe(5);
    expect(hitsPerKill(11, 1)).toBe(4);
    expect(hitsPerKill(21, 1)).toBe(3);
    expect(hitsPerKill(30, 1)).toBe(3);
    expect(hitsPerKill(19, 10)).toBe(5);
    expect(hitsPerKill(20, 10)).toBe(4);
    expect(hitsPerKill(30, 10)).toBe(3);
    expect(hitsPerKill(21, 12)).toBe(5);
    expect(hitsPerKill(22, 12)).toBe(4);
    expect(hitsPerKill(30, 12)).toBe(4);
    const state = combatReady(1);
    startCombat(state, 'meadow.beetle', 'Strength');
    expect(state.combat?.hitsPerKill).toBe(5);
    simulate(state, 2400);
    expect(state.xp.Strength).toBe(24);
    expect(state.xp.Hitpoints).toBe(4.8);
    simulate(state, 15000 - 2400);
    expect(state.stats.kills).toBe(1);
    expect(state.xp.Strength).toBe(120);
    expect(state.xp.Hitpoints).toBe(24);
    expect(state.combat?.hitsLanded).toBe(0);
    expect(state.progressMs).toBe(0);
  });

  it('shortens the kill when Strength is 21 and keeps XP at 120', () => {
    const state = combatReady(21);
    startCombat(state, 'meadow.beetle', 'Strength');
    expect(state.combat?.hitsPerKill).toBe(3);
    simulate(state, 3 * 2400 + 3000);
    expect(state.stats.kills).toBe(1);
    expect(state.xp.Strength).toBeCloseTo(XP_TABLE[21] + 120, 5);
    expect(state.xp.Hitpoints).toBe(24);
  });

  it('pauses on a killing blow before eating, and auto-eats only at or under half', () => {
    let seed = 1;
    for (; seed < 40; seed++) {
      const trial = combatReady(1, seed);
      trial.hp = 1;
      trial.bank['food.roast_hare'] = 5;
      setFood(trial, 'food.roast_hare');
      startCombat(trial, 'meadow.hare', 'Strength');
      simulate(trial, 1200);
      if (trial.paused) {
        expect(trial.hp).toBe(0);
        expect(trial.bank['food.roast_hare']).toBe(5);
        expect(trial.stats.kills).toBe(0);
        expect(trial.stats.pauses).toBe(1);
        expect(trial.stats.pauseAtKill).toEqual([0]);
        break;
      }
    }
    expect(seed).toBeLessThan(40);

    const eat = combatReady(1, 1);
    eat.hp = 7;
    eat.bank['food.roast_hare'] = 2;
    setFood(eat, 'food.roast_hare');
    let ate = false;
    for (let s = 1; s < 80 && !ate; s++) {
      const trial = combatReady(1, s);
      trial.hp = 7;
      trial.bank['food.roast_hare'] = 2;
      setFood(trial, 'food.roast_hare');
      startCombat(trial, 'meadow.hare', 'Strength');
      simulate(trial, 1200);
      if (trial.stats.foodEaten === 1) {
        expect(trial.hp).toBe(11);
        expect(trial.paused).toBe(false);
        expect(trial.bank['food.roast_hare']).toBe(1);
        ate = true;
      }
    }
    expect(ate).toBe(true);

    const full = combatReady(1, 1);
    full.hp = 6;
    full.bank['food.baked_carp'] = 1;
    setFood(full, 'food.baked_carp');
    let capped = false;
    for (let s = 1; s < 80 && !capped; s++) {
      const trial = combatReady(1, s);
      trial.hp = 7;
      trial.bank['food.baked_carp'] = 1;
      setFood(trial, 'food.baked_carp');
      startCombat(trial, 'meadow.hare', 'Strength');
      simulate(trial, 1200);
      if (trial.stats.foodEaten === 1) {
        expect(trial.hp).toBe(maxHp(trial));
        expect(trial.hp).toBeLessThanOrEqual(12);
        capped = true;
      }
    }
    expect(capped).toBe(true);
  });

  it('keeps finished loot and partial XP, and resumes onto a fresh enemy', () => {
    let found = false;
    for (let seed = 1; seed < 60 && !found; seed++) {
      const state = combatReady(1, seed);
      state.hp = 1;
      startCombat(state, 'meadow.hare', 'Strength');
      simulate(state, 1200);
      if (!state.paused) continue;
      const xp = state.xp.Strength ?? 0;
      expect(xp).toBe(0);
      resumeCombat(state);
      expect(state.paused).toBe(false);
      expect(state.hp).toBe(0);
      expect(state.combat?.hitsLanded).toBe(0);
      expect(state.combat?.enemyHp).toBe(15);
      found = true;
    }
    expect(found).toBe(true);
    expect(hitChance(1, 1)).toBeCloseTo(0.4, 10);
    expect(hitChance(12, 1)).toBeCloseTo(0.73, 10);
    expect(playerMaxHp(1)).toBe(12);
    expect(playerMaxHp(7)).toBe(24);
    expect(playerMaxHp(23)).toBe(56);
    expect(ENEMY_BY_ID['meadow.hare'].hp).toBe(15);
    expect(ENEMY_BY_ID['wood.poacher'].hp).toBe(70);
    expect(ENEMY_BY_ID['wood.poacher'].maxHit).toBe(4);
  });

  it('pays the poacher 3-9 and lands loot near the catalogue value', () => {
    const kills = 1000;
    const lootEv = expectedDropValue(ENEMY_BY_ID['wood.poacher'].drops);
    expect(lootEv).toBeCloseTo(6.5, 5);
    expect(expectedCoinValue(ENEMY_BY_ID['wood.poacher'])).toBe(6);
    expect(expectedDropValue(ENEMY_BY_ID['meadow.beetle'].drops)).toBeCloseTo(6.25, 5);
    const ratios: number[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const focused = combatReady(30, seed);
      focused.xp.Defence = XP_TABLE[30];
      focused.xp.Hitpoints = XP_TABLE[30];
      focused.hp = playerMaxHp(30);
      startCombat(focused, 'wood.poacher', 'Attack');
      let guard = 0;
      while (focused.stats.kills < kills && !focused.paused && guard++ < kills + 5) {
        simulate(focused, 4 * 2400 + 3000);
      }
      expect(focused.paused).toBe(false);
      expect(focused.stats.kills).toBe(kills);
      if (seed === 1) {
        const mean = focused.stats.coinsFromKills / kills;
        expect(mean).toBeGreaterThan(5.7);
        expect(mean).toBeLessThan(6.3);
      }
      ratios.push(focused.stats.lootValue / kills / lootEv);
    }
    const meanRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
    expect(meanRatio).toBeGreaterThan(0.9);
    expect(meanRatio).toBeLessThan(1.1);
  });
});

describe('save, offline, shop', () => {
  it('round-trips every saved field', () => {
    const state = newGame(1_000);
    state.coins = 1234;
    state.xp.Woodcutting = 5000;
    state.owned.push('Mining', 'Hitpoints');
    state.xp.Mining = 10;
    state.xp.Hitpoints = 4.8;
    state.purchaseCount = 1;
    state.nodes.push('mat.ore.iron');
    state.bank['mat.wood.pine'] = 12;
    state.bank['tool.mining.bronze_pickaxe'] = 1;
    state.equipped.body = 'gear.armour.bronze_body';
    state.activity = { kind: 'gather', nodeId: 'mat.wood.pine' };
    state.progressMs = 1200;
    state.hp = 9;
    state.paused = false;
    state.foodSlot = null;
    state.shop['mat.meat.hare'] = { bought: 4, windowStart: 50 };
    state.lastCredited = 1_000;
    state.rngState = 99;
    state.regenMs = 2500;
    state.stats.kills = 3;
    state.stats.lootValue = 8;
    const copy = deserialize(serialize(state));
    expect(copy).toEqual(state);
  });

  it('starts a new game from a corrupt save and does not overwrite a readable one', () => {
    const storage = new Mem();
    const good = newGame(0);
    good.coins = 444;
    good.xp.Woodcutting = 80;
    writeSave(storage, good);
    const readable = storage.getItem(SAVE_KEY)!;
    storage.setItem(SAVE_KEY, '{not json');
    const corrupt = loadAndCredit(storage, 5_000);
    expect(corrupt.status).toBe('corrupt');
    expect(corrupt.state.coins).toBe(0);
    expect(corrupt.state.xp.Woodcutting).toBe(0);
    expect(storage.getItem(SAVE_KEY)).toBe('{not json');
    expect(storage.getItem(UNREADABLE_SAVE_KEY)).toBe('{not json');
    storage.setItem(SAVE_KEY, readable);
    storage.map.delete(UNREADABLE_SAVE_KEY);
    const again = loadAndCredit(storage, 5_000);
    expect(again.status).toBe('ok');
    expect(again.state.coins).toBe(444);
    expect(deserialize(storage.getItem(SAVE_KEY)!)?.xp.Woodcutting).toBeGreaterThan(0);
    expect(importSave('nope')).toBeNull();
    expect(importSave(readable)?.coins).toBe(444);
  });

  it('credits 24h of a 30h gap, nothing when the clock runs backwards, and never twice', () => {
    const state = newGame(0);
    startGather(state, 'mat.wood.pine');
    const now = 30 * HOUR;
    const report = creditOffline(state, now);
    expect(report.capped).toBe(true);
    expect(report.creditedMs).toBe(24 * HOUR);
    expect(report.awayMs).toBe(30 * HOUR);
    expect(report.actions).toBe(Math.floor((24 * HOUR) / 2600));
    expect(state.bank['mat.wood.pine']).toBe(report.actions);
    expect(state.xp.Woodcutting).toBe(XP_CAP);
    expect(state.lastCredited).toBe(now);
    expect(report.stopped).toBe('window');
    expect(report.activity).toContain('Pine');
    const again = creditOffline(state, now);
    expect(again.creditedMs).toBe(0);
    expect(again.actions).toBe(0);
    const xp = state.xp.Woodcutting;
    state.lastCredited = now + 10_000;
    const back = creditOffline(state, now);
    expect(back.backwards).toBe(true);
    expect(back.creditedMs).toBe(0);
    expect(state.xp.Woodcutting).toBe(xp);
    expect(state.lastCredited).toBe(now);
    // The reset moves the last-credited time to now, so the next forward window is credited.
    const after = creditOffline(state, now + 30_000);
    expect(after.creditedMs).toBe(30_000);
    expect(after.actions).toBeLessThan(20);
  });

  it('restocks each shop meat 24h after that meat\'s counter starts', () => {
    const state = newGame(0);
    state.coins = 48 * 26;
    const start = 1_000_000;
    for (let i = 0; i < 25; i++) expect(buyShop(state, 'mat.meat.hare', start)).toBe(true);
    expect(buyShop(state, 'mat.meat.hare', start + 1000)).toBe(false);
    expect(shopStock(state, 'mat.meat.hare', start + 24 * HOUR - 1)).toBe(0);
    expect(shopStock(state, 'mat.meat.mutton', start)).toBe(25);
    expect(buyShop(state, 'mat.meat.hare', start + 24 * HOUR)).toBe(true);
    expect(state.shop['mat.meat.hare'].bought).toBe(1);
    expect(state.shop['mat.meat.hare'].windowStart).toBe(start + 24 * HOUR);
    expect(state.bank['mat.meat.hare']).toBe(26);
    expect(sell(state, 'mat.meat.hare', 1)).toBe(true);
    expect(state.coins).toBeGreaterThan(0);
  });

  it('blocks a second tab while the lock is fresh', () => {
    expect(tabLockDecision(null, 'a', 1000, 4000)).toBe('primary');
    expect(tabLockDecision({ id: 'a', beat: 1000 }, 'a', 2000, 4000)).toBe('primary');
    expect(tabLockDecision({ id: 'b', beat: 1000 }, 'a', 2000, 4000)).toBe('blocked');
    expect(tabLockDecision({ id: 'b', beat: 1000 }, 'a', 5000, 4000)).toBe('primary');
  });
});

function combatReady(strengthLevel: number, seed = 1, attackLevel = 30) {
  const state = newGame(0, seed);
  state.owned.push('Strength', 'Attack', 'Defence', 'Hitpoints');
  state.xp.Strength = XP_TABLE[strengthLevel];
  state.xp.Attack = XP_TABLE[attackLevel];
  state.xp.Defence = 0;
  state.xp.Hitpoints = 0;
  state.hp = 12;
  return state;
}

describe('approved combat details', () => {
  it('attacks once per swing, including misses, and not during the pause', () => {
    const state = combatReady(1, 1, 1);
    startCombat(state, 'meadow.beetle', 'Strength');
    let guard = 0;
    while (state.combat?.phase === 'fight' && !state.paused && guard++ < 40) simulate(state, 2400);
    expect(state.combat?.phase).toBe('pause');
    expect(state.combat?.swings).toBeGreaterThanOrEqual(5);
    expect(state.combat?.enemyAttacks).toBe(state.combat?.swings);
    const attacks = state.combat?.enemyAttacks;
    simulate(state, 2000);
    expect(state.combat?.phase).toBe('pause');
    expect(state.combat?.enemyAttacks).toBe(attacks);
  });

  it('lands every swing at Attack 30 and takes 15s for five hits', () => {
    const state = combatReady(1, 1, 30);
    startCombat(state, 'meadow.beetle', 'Strength');
    const step = stepCompletion(state);
    expect(step.type).toBe('kill');
    expect(step.ms).toBe(5 * 2400 + 3000);
    expect(state.stats.playerMisses).toBe(0);
    expect(state.stats.playerHits).toBe(5);
    expect(state.stats.playerSwings).toBe(5);
  });

  it('measures hit rates within 0.03 and the Attack 1 kill cycle within 3%', () => {
    const cases: [number, string, number][] = [
      [1, 'meadow.beetle', 0.88],
      [1, 'wood.jay', 0.772],
      [1, 'wood.poacher', 0.748],
      [30, 'meadow.beetle', 1],
      [30, 'wood.poacher', 1],
    ];
    for (const [attack, enemyId, expected] of cases) {
      const state = combatReady(1, 5, attack);
      state.xp.Defence = XP_TABLE[30];
      state.xp.Hitpoints = XP_TABLE[30];
      state.hp = 70;
      startCombat(state, enemyId, 'Strength');
      let guard = 0;
      while (state.stats.playerSwings < 1000 && !state.paused && guard++ < 6000) simulate(state, 2400);
      const rate = state.stats.playerHits / state.stats.playerSwings;
      expect(Math.abs(rate - expected), `${attack} ${enemyId}`).toBeLessThanOrEqual(0.03);
      if (expected === 1) expect(state.stats.playerMisses).toBe(0);
    }
    const timed = combatReady(1, 9, 1);
    timed.xp.Defence = XP_TABLE[30];
    timed.xp.Hitpoints = XP_TABLE[30];
    timed.hp = 70;
    startCombat(timed, 'meadow.beetle', 'Defence');
    let total = 0;
    for (let i = 0; i < 200; i++) {
      const step = stepCompletion(timed);
      expect(step.type).toBe('kill');
      total += step.ms;
    }
    const mean = total / 200 / 1000;
    expect(mean).toBeGreaterThan(16.64 * 0.97);
    expect(mean).toBeLessThan(16.64 * 1.03);
  });

  it('refuses to fight without a weapon and keeps landed XP when you switch away', () => {
    const state = combatReady(1, 2, 30);
    unequip(state, 'weapon');
    expect(startCombat(state, 'meadow.hare', 'Strength')).toBe(false);
    state.equipped.weapon = 'gear.melee.bronze_sword';
    startCombat(state, 'meadow.hare', 'Strength');
    simulate(state, 2400);
    expect(state.xp.Strength).toBe(24);
    const bank = { ...state.bank };
    startGather(state, 'mat.wood.pine');
    expect(state.activity?.kind).toBe('gather');
    expect(state.xp.Strength).toBe(24);
    expect(state.stats.kills).toBe(0);
    expect(state.bank).toEqual(bank);
  });

  it('refuses a paid node below its level and takes no coins', () => {
    const state = newGame(0);
    state.owned.push('Fishing');
    state.xp.Fishing = XP_TABLE[9];
    state.coins = 1500;
    expect(buyNode(state, 'mat.fish.river_shrimp')).toBe(false);
    expect(state.coins).toBe(1500);
    expect(state.nodes).not.toContain('mat.fish.river_shrimp');
    state.xp.Fishing = XP_TABLE[10];
    expect(buyNode(state, 'mat.fish.river_shrimp')).toBe(true);
    expect(state.coins).toBe(0);
  });
});

describe('node price helper', () => {
  it('refuses a node below its level and charges 1,500 once', () => {
    const state = newGame(0);
    state.coins = 5000;
    expect(buyNode(state, 'mat.wood.maple')).toBe(false);
    state.xp.Woodcutting = XP_TABLE[10];
    expect(buyNode(state, 'mat.wood.maple')).toBe(true);
    expect(state.coins).toBe(3500);
    expect(buyNode(state, 'mat.wood.oak')).toBe(false);
    expect(NODE_BY_ID['mat.wood.pine'].cost).toBe(0);
    expect(NODE_BY_ID['mat.ore.iron'].cost).toBe(1500);
  });
});

describe('open-tab clock and catch-up display', () => {
  it('resets a backwards clock and then keeps gathering', () => {
    const state = newGame(1_000_000);
    startGather(state, 'mat.wood.pine');
    const actions = state.stats.actions;
    const rewound = advanceOpenTab(state, 1_000_000 - 3_600_000, 5_000);
    expect(rewound?.backwards).toBe(true);
    expect(rewound?.creditedMs).toBe(0);
    expect(state.lastCredited).toBe(1_000_000 - 3_600_000);
    expect(state.stats.actions).toBe(actions);
    advanceOpenTab(state, state.lastCredited + 12_000, 5_000);
    expect(state.stats.actions).toBeGreaterThan(actions);
    expect(state.bank['mat.wood.pine']).toBe(state.stats.actions);
  });

  it('shows catch-up XP rounded down', () => {
    const html = reportHtml({
      awayMs: 60_000,
      creditedMs: 60_000,
      capped: false,
      backwards: false,
      activity: 'Combat · Thorn beetle',
      actions: 0,
      kills: 1,
      xpGained: { Strength: 48, Hitpoints: 9.6 },
      levelsBefore: { Strength: 1, Hitpoints: 1 },
      levelsAfter: { Strength: 1, Hitpoints: 1 },
      itemsGained: {},
      itemsConsumed: {},
      coinsGained: 0,
      foodEaten: 0,
      stopped: 'window',
    });
    expect(html).toContain('Strength 48, Hitpoints 9');
    expect(html).not.toContain('9.6');
  });
});
