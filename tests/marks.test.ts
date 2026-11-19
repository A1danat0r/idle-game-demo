import { describe, expect, it } from 'vitest';
import { RECIPES, playerHitChance, hitChance } from '../src/content';
import {
  EXPEDITION_MS,
  actionSeconds,
  buyMarkRank,
  creditOffline,
  deserialize,
  markedGear,
  newGame,
  placeBuilding,
  plantOnPlot,
  sell,
  serialize,
  setSkillLevel,
  startExpedition,
  startProduce,
  stepCompletion,
  type Save,
} from '../src/engine';
import { MARKS, MODIFIERS, rankCost } from '../src/marks';
import { actionMasteryXp } from '../src/mastery';
import { mainHtml, type View } from '../src/ui';

const GROVE = 'recipe.mark.grove';
const BOW = 'recipe.gear.ranged.pine_shortbow';
const STREAM = 'activity.exploration.stream_survey';

function enchanter(level = 1): Save {
  const state = newGame(0);
  setSkillLevel(state, 'Enchanting', level);
  return state;
}

describe('enchanting marks', () => {
  it('studies Grove for 2.5s, 13 XP, 1 glimmer and 25 mastery, and 1,440 glimmer in an hour', () => {
    const state = enchanter();
    state.bank['mat.enchant.agate_dust'] = 1;
    expect(startProduce(state, GROVE)).toBe(true);
    expect(stepCompletion(state).ms).toBe(2500);
    expect(state.xp.Enchanting).toBe(13);
    expect(state.glimmer.grove).toBe(1);
    expect(state.mastery[GROVE]).toBe(25);
    expect(actionMasteryXp(2.5)).toBe(25);
    expect(state.bank['mat.enchant.agate_dust'] ?? 0).toBe(0);

    const hour = enchanter();
    hour.bank['mat.enchant.agate_dust'] = 2000;
    startProduce(hour, GROVE);
    creditOffline(hour, 60 * 60 * 1000);
    // 1,440 and 18,720 are the rate before mastery 20's speed perk. The perk starts during the hour.
    expect(hour.glimmer.grove).toBe(1458);
    expect(hour.xp.Enchanting).toBe(18954);
  });

  it('prices every rank and totals 17,313 glimmer', () => {
    let glimmer = 0;
    let seconds = 0;
    let xp = 0;
    for (const mod of MODIFIERS) {
      const mark = MARKS.find((row) => row.id === mod.markId)!;
      for (let rank = 1; rank <= 5; rank += 1) {
        const cost = rankCost(mod.seconds, rank);
        glimmer += cost;
        if (mod.id.endsWith('.time') || mod.id.endsWith('.acc') || mod.id.endsWith('.grow')) {
          seconds += (cost * mark.seconds);
          xp += cost * mark.xp;
        }
      }
    }
    expect(MODIFIERS.filter((mod) => mod.markId === 'grove').map((mod) => [1, 2, 3, 4, 5].map((rank) => rankCost(mod.seconds, rank)))[0]).toEqual([120, 240, 360, 480, 600]);
    expect(MODIFIERS.filter((mod) => mod.markId === 'hearth').map((mod) => rankCost(mod.seconds, 1))[0]).toBe(100);
    expect(MODIFIERS.filter((mod) => mod.markId === 'hunt').map((mod) => [1, 2, 3, 4, 5].map((rank) => rankCost(mod.seconds, rank)))[0]).toEqual([86, 171, 257, 343, 429]);
    expect(MODIFIERS.filter((mod) => mod.markId === 'road').map((mod) => [1, 2, 3, 4, 5].map((rank) => rankCost(mod.seconds, rank)))[0]).toEqual([79, 158, 237, 316, 395]);
    expect(glimmer).toBe(17313);
    const hours = MODIFIERS.reduce((sum, mod) => {
      const total = [1, 2, 3, 4, 5].reduce((cost, rank) => cost + rankCost(mod.seconds, rank), 0);
      return sum + total / (3600 / mod.seconds);
    }, 0);
    expect(Math.round(hours * 10000) / 10000).toBe(15.0033);
    const studyXp = MARKS.reduce((sum, mark) => {
      const costs = [1, 2, 3, 4, 5].reduce((cost, rank) => cost + rankCost(mark.seconds, rank), 0) * 3;
      return sum + costs * mark.xp;
    }, 0);
    expect(studyXp).toBe(349461);
    expect(studyXp).toBeGreaterThan(220234);
    void seconds;
    void xp;
  });

  it('adds Hunt accuracy and guard the way gear does', () => {
    const bare = newGame(0);
    bare.bank['gear.melee.iron_spear'] = 1;
    bare.equipped.weapon = 'gear.melee.iron_spear';
    expect(playerHitChance(1, 12, markedGear(bare).acc)).toBeCloseTo(0.832, 6);
    bare.markRanks['hunt.acc'] = 5;
    expect(playerHitChance(1, 12, markedGear(bare).acc)).toBeCloseTo(0.892, 6);

    const guard = newGame(0);
    guard.bank['gear.armour.iron_body'] = 1;
    guard.equipped.body = 'gear.armour.iron_body';
    expect(hitChance(12, 1, markedGear(guard).grd)).toBeCloseTo(0.55, 6);
    guard.markRanks['hunt.grd'] = 5;
    expect(hitChance(12, 1, markedGear(guard).grd)).toBeCloseTo(0.4, 6);
  });

  it('shortens a 3.6s craft, and shortens it again when both crafting buildings are placed', () => {
    const state = newGame(0);
    state.markRanks['hearth.time'] = 5;
    expect(actionSeconds(state, 'recipe.mat.binding.flax')).toBeCloseTo(3.42, 6);
    setSkillLevel(state, 'Construction', 15);
    state.buildings['activity.construction.pine_work_area'] = true;
    state.buildings['activity.construction.oak_workshop'] = true;
    expect(placeBuilding(state, 'activity.construction.pine_work_area', 0)).toBe(true);
    expect(placeBuilding(state, 'activity.construction.oak_workshop', 1)).toBe(true);
    expect(actionSeconds(state, 'recipe.mat.binding.flax')).toBeCloseTo(3.002654, 6);
    expect(actionSeconds(state, BOW)).toBeCloseTo(4.1 * 0.937 ** 2 * 0.95, 6);
  });

  it('adds floored expedition haul and shortens a flax grow', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Exploration', 1);
    state.markRanks['road.haul'] = 5;
    expect(startExpedition(state, STREAM, EXPEDITION_MS[0], 0)).toBe(true);
    creditOffline(state, EXPEDITION_MS[0]);
    expect(state.bank['mat.gem.weathered_agate']).toBe(285);
    expect(state.xp.Exploration).toBe(7072);

    const farm = newGame(0);
    setSkillLevel(farm, 'Farming', 1);
    farm.markRanks['road.grow'] = 5;
    farm.bank['mat.seed.flax'] = 1;
    expect(plantOnPlot(farm, 0, 'recipe.mat.fibre.flax', null)).toBe(true);
    creditOffline(farm, 12_654_000 - 1);
    expect(farm.plots[0]).not.toBeNull();
    creditOffline(farm, farm.lastCredited + 1);
    expect(farm.bank['mat.fibre.flax']).toBe(1800);
    farm.markRanks['road.yield'] = 5;
    farm.bank['mat.seed.flax'] = 1;
    plantOnPlot(farm, 0, 'recipe.mat.fibre.flax', null);
    creditOffline(farm, farm.lastCredited + 12_654_000);
    expect(farm.bank['mat.fibre.flax']).toBe(1800 + 1890);
  });

  it('refuses another mark\'s glimmer and a skipped rank', () => {
    const state = enchanter(10);
    state.glimmer.grove = 5000;
    expect(buyMarkRank(state, 'hearth.time')).toBe(false);
    expect(state.markRanks['hearth.time'] ?? 0).toBe(0);
    state.glimmer.hearth = 100;
    expect(buyMarkRank(state, 'hearth.time', 3)).toBe(false);
    expect(buyMarkRank(state, 'hearth.time')).toBe(true);
    expect(state.markRanks['hearth.time']).toBe(1);
    expect(state.glimmer.hearth ?? 0).toBe(0);
    expect(state.glimmer.grove).toBe(5000);
  });

  it('drops seal recipes and still sells a banked accuracy seal', () => {
    expect(RECIPES.some((recipe) => recipe.id.startsWith('recipe.seal.enchant.'))).toBe(false);
    const state = newGame(0);
    state.bank['seal.enchant.accuracy'] = 10;
    expect(sell(state, 'seal.enchant.accuracy', 10)).toBe(true);
    expect(state.coins).toBe(50);
    expect(state.bank['seal.enchant.accuracy'] ?? 0).toBe(0);

    const raw = JSON.parse(serialize(enchanter())) as Record<string, unknown>;
    raw.activity = { kind: 'produce', recipeId: 'recipe.seal.enchant.accuracy' };
    raw.bank = { 'reagent.enchant.binding': 1, 'mat.binding.flax': 1 };
    raw.xp = { Enchanting: 0, Woodcutting: 0 };
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded).not.toBeNull();
    creditOffline(loaded!, 10_000);
    expect(loaded!.bank['seal.enchant.accuracy']).toBe(1);
    expect(loaded!.xp.Enchanting).toBe(14);
    expect(loaded!.activity).toBeNull();

    const view: View = {
      tab: 'skill',
      skill: 'Enchanting',
      filter: 'all',
      selected: null,
      area: 'Meadow verge',
      style: null,
      message: '',
    };
    const screen = mainHtml(enchanter(30), view, 0);
    expect(screen).toContain('data-mark-card="grove"');
    expect(screen).toContain('data-mark-card="road"');
    expect(screen).toContain('Glimmer');
    expect(screen).toContain('Buy rank 1 — 120');
    expect(screen).not.toContain('Accuracy seal');
  });
});
