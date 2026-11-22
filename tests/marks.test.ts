import { describe, expect, it } from 'vitest';
import { RECIPE_BY_ID, RECIPES, playerHitChance, hitChance } from '../src/content';
import {
  EXPEDITION_MS,
  actionSeconds,
  advanceOpenTab,
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
import { MARKS, MODIFIERS, hearthAppliesToRecipe, rankCost } from '../src/marks';
import { actionMasteryXp, masteryThreshold } from '../src/mastery';
import { mainHtml, plotCountdown, type View } from '../src/ui';

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
    // Falloff cuts the hour from 18,954 to 17,407. Glimmer is unchanged.
    expect(hour.glimmer.grove).toBe(1458);
    expect(hour.xp.Enchanting).toBe(17407);
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

    const high = enchanter(21);
    high.activity = { kind: 'produce', recipeId: 'recipe.seal.enchant.accuracy' };
    high.bank['reagent.enchant.binding'] = 1;
    high.bank['mat.binding.flax'] = 1;
    const before = high.xp.Enchanting ?? 0;
    creditOffline(high, high.lastCredited + 10_000);
    expect((high.xp.Enchanting ?? 0) - before).toBeCloseTo(0.14, 4);
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

  it('stops a selected seal when the clock goes backwards, and still finishes 60s under the old numbers', () => {
    const state = enchanter();
    state.activity = { kind: 'produce', recipeId: 'recipe.seal.enchant.accuracy' };
    state.progressMs = 1000;
    state.bank['reagent.enchant.binding'] = 30;
    state.bank['mat.binding.flax'] = 30;
    const bank = { ...state.bank };
    const report = creditOffline(state, state.lastCredited - 5000);
    expect(report.stopped).toBe('backwards');
    expect(state.activity).toBeNull();
    expect(state.progressMs).toBe(0);
    expect(state.bank).toEqual(bank);
    advanceOpenTab(state, state.lastCredited + 20_000, 60_000);
    expect(state.bank['seal.enchant.accuracy'] ?? 0).toBe(0);
    expect(state.bank['reagent.enchant.binding']).toBe(30);
    expect(state.bank['mat.binding.flax']).toBe(30);

    const forward = enchanter();
    forward.activity = { kind: 'produce', recipeId: 'recipe.seal.enchant.accuracy' };
    forward.bank['reagent.enchant.binding'] = 30;
    forward.bank['mat.binding.flax'] = 30;
    creditOffline(forward, forward.lastCredited + 60_000);
    expect(forward.bank['seal.enchant.accuracy']).toBe(22);
    expect(forward.activity).toBeNull();
  });

  it('applies Hearth only to production and the three construction kits', () => {
    const recipe = (id: string) => {
      const found = RECIPE_BY_ID[id];
      if (!found) throw new Error(id);
      return found;
    };
    expect(hearthAppliesToRecipe(recipe('recipe.con.kit.pine_frame'))).toBe(true);
    expect(hearthAppliesToRecipe(recipe('recipe.con.kit.oak_bench'))).toBe(true);
    expect(hearthAppliesToRecipe(recipe('recipe.con.kit.hearth_block'))).toBe(true);
    for (const id of [
      'recipe.con.mat.dressed_limestone',
      'recipe.con.mat.roof_tiles',
      'recipe.con.mat.clay_mortar',
      'activity.construction.practice_workshop_assembly',
      'activity.construction.pine_work_area',
      'activity.construction.stone_foundation',
      'activity.construction.oak_workshop',
      'activity.construction.supply_racks',
      'activity.construction.forge_extension',
    ]) {
      expect(hearthAppliesToRecipe(recipe(id))).toBe(false);
    }

    const state = newGame(0);
    setSkillLevel(state, 'Construction', 1);
    state.markRanks['hearth.xp'] = 5;
    state.markRanks['hearth.free'] = 5;
    state.bank['mat.wood.pine'] = 5;
    expect(startProduce(state, 'activity.construction.pine_work_area')).toBe(true);
    stepCompletion(state);
    expect(state.xp.Construction).toBe(7212);
    expect(state.bank['mat.wood.pine'] ?? 0).toBe(0);
  });

  it('rounds Road yield half up once, after compost', () => {
    expect(flaxYield(1, true)).toBe(2273);
    expect(flaxYield(3, true)).toBe(2318);
    expect(flaxYield(5, true)).toBe(2363);
    expect(flaxYield(1, false)).toBe(1818);
    expect(flaxYield(5, false)).toBe(1890);
    expect(flaxYield(1, true, 7)).toBe(4546);
  });

  it('keeps Road grow as a live rate on the stored remaining time', () => {
    const mastered = newGame(0);
    setSkillLevel(mastered, 'Farming', 1);
    mastered.mastery['recipe.mat.fibre.flax'] = masteryThreshold(20);
    mastered.markRanks['road.grow'] = 5;
    mastered.bank['mat.seed.flax'] = 1;
    expect(plantOnPlot(mastered, 0, 'recipe.mat.fibre.flax', null)).toBe(true);
    expect(mastered.plots[0]?.remainingMs).toBe(12_654_000);
    creditOffline(mastered, 12_021_300 - 1);
    expect(mastered.plots[0]).not.toBeNull();
    creditOffline(mastered, mastered.lastCredited + 1);
    expect(mastered.bank['mat.fibre.flax']).toBe(1800);

    const boned = newGame(0);
    setSkillLevel(boned, 'Farming', 1);
    boned.mastery['recipe.mat.fibre.flax'] = masteryThreshold(20);
    boned.markRanks['road.grow'] = 5;
    boned.bank['mat.seed.flax'] = 1;
    boned.bank['mat.farm.bone_compost'] = 1;
    expect(plantOnPlot(boned, 0, 'recipe.mat.fibre.flax', 'bone')).toBe(true);
    expect(boned.plots[0]?.remainingMs).toBe(11_856_800);
    creditOffline(boned, 11_263_960);
    expect(boned.bank['mat.fibre.flax']).toBe(2250);
    expect(boned.plots[0]).toBeNull();

    const growing = newGame(0);
    setSkillLevel(growing, 'Farming', 1);
    growing.bank['mat.seed.flax'] = 1;
    growing.glimmer.road = 2000;
    expect(plantOnPlot(growing, 0, 'recipe.mat.fibre.flax', null)).toBe(true);
    creditOffline(growing, 3_600_000);
    for (let rank = 0; rank < 5; rank += 1) expect(buyMarkRank(growing, 'road.grow')).toBe(true);
    expect(growing.plots[0]?.remainingMs).toBe(9_720_000);
    const view: View = {
      tab: 'skill',
      skill: 'Farming',
      filter: 'all',
      selected: null,
      area: 'Meadow verge',
      style: null,
      message: '',
    };
    expect(mainHtml(growing, view, 0)).toContain(plotCountdown(9_234_000));
    creditOffline(growing, growing.lastCredited + 9_234_000);
    expect(growing.bank['mat.fibre.flax']).toBe(1800);
    expect(growing.plots[0]).toBeNull();
  });
});

function flaxYield(rank: number, compost: boolean, rngState?: number): number {
  const state = newGame(0);
  setSkillLevel(state, 'Farming', 1);
  if (rngState != null) state.rngState = rngState;
  if (rngState != null) state.mastery['recipe.mat.fibre.flax'] = masteryThreshold(40);
  state.markRanks['road.yield'] = rank;
  state.bank['mat.seed.flax'] = 1;
  if (compost) state.bank['mat.farm.compost'] = 1;
  expect(plantOnPlot(state, 0, 'recipe.mat.fibre.flax', compost ? 'compost' : null)).toBe(true);
  creditOffline(state, 13_320_000);
  return state.bank['mat.fibre.flax'] ?? 0;
}
