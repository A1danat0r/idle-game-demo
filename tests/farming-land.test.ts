import { describe, expect, it } from 'vitest';
import {
  ITEMS,
  NODE_BY_ID,
  RECIPES,
  XP_TABLE,
  levelForXp,
} from '../src/content';
import {
  SAVE_FORMAT,
  advanceOpenTab,
  buyPlot,
  creditOffline,
  deserialize,
  newGame,
  plantOnPlot,
  serialize,
  setSkillLevel,
  startGather,
  startProduce,
  stepCompletion,
  type Save,
} from '../src/engine';
import { activityNextLine } from '../src/milestones';
import { actionMasteryXp, masteryThreshold } from '../src/mastery';
import { HARVEST_FACTOR, plotGrowMs } from '../src/plots';
import { runReferenceRoute } from '../src/route';
import { TAB_IDS, mainHtml, tabsHtml, type View } from '../src/ui';

function farmer(level = 1): Save {
  const state = newGame(0);
  setSkillLevel(state, 'Farming', level);
  return state;
}

function screen(skill: View['skill'], land = false): View {
  return {
    tab: 'skill',
    skill,
    filter: 'all',
    land,
    selected: null,
    area: 'Meadow verge',
    style: null,
    message: '',
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

describe('farming plots and the land screen', () => {
  it('harvests flax after 13,320s for 1,800 fibre, 26,550 XP and 16,650 MXP, then empties the plot', () => {
    const state = farmer();
    state.bank['mat.seed.flax'] = 1;
    expect(startProduce(state, 'recipe.mat.fibre.flax')).toBe(false);
    expect(state.bank['mat.seed.flax']).toBe(1);
    expect(plantOnPlot(state, 0, 'recipe.mat.fibre.flax', null)).toBe(true);
    expect(state.activity).toBeNull();
    expect(state.plots[0]?.remainingMs).toBe(13_320_000);
    expect(state.bank['mat.seed.flax'] ?? 0).toBe(0);
    advanceOpenTab(state, 13_320_000, 5_000, []);
    expect(state.bank['mat.fibre.flax']).toBe(1800);
    expect(state.xp.Farming).toBe(26550);
    expect(state.mastery['recipe.mat.fibre.flax']).toBe(16650);
    expect(state.plots[0]).toBeNull();
    expect(JSON.stringify(state)).not.toContain('autoReplant');
  });

  it('takes a fresh farming save to the flax harvest levels', () => {
    const state = farmer();
    const levels: number[] = [];
    for (let harvest = 1; harvest <= 7; harvest += 1) {
      state.bank['mat.seed.flax'] = 1;
      expect(plantOnPlot(state, 0, 'recipe.mat.fibre.flax', null)).toBe(true);
      creditOffline(state, state.lastCredited + 13_320_000);
      levels.push(levelForXp(state.xp.Farming ?? 0));
    }
    // Spec list 15/22/26/30/33/35/37 is the pre-perk sum, 7 × 26,550 = 185,850, which is level 37.
    // Harvests 5–7 include mastery 30's +5% XP, so the seventh lands at 189,832.5, level 38.
    expect(levelForXp(7 * 26550)).toBe(37);
    expect(levels).toEqual([15, 22, 26, 30, 33, 35, 38]);
    expect(state.xp.Farming).toBe(189_832.5);
    expect(Math.ceil(masteryThreshold(40) / actionMasteryXp(3.7 * HARVEST_FACTOR))).toBe(7);
  });

  it('sells plot 2 only at Farming 5 with 188 coins, and the seven paid plots cost 26,252', () => {
    const early = farmer(4);
    early.coins = 10_000;
    expect(buyPlot(early)).toBe(false);
    expect(early.plotsBought).toBe(0);

    const poor = farmer(5);
    poor.coins = 187;
    expect(buyPlot(poor)).toBe(false);
    expect(poor.coins).toBe(187);
    poor.coins = 188;
    expect(buyPlot(poor)).toBe(true);
    expect(poor.plotsBought).toBe(1);
    expect(poor.plots).toHaveLength(2);
    expect(poor.coins).toBe(0);

    const state = farmer(35);
    state.coins = 26_252;
    let spent = 0;
    while (state.plotsBought < 7) {
      const before = state.coins;
      expect(buyPlot(state)).toBe(true);
      spent += before - state.coins;
    }
    expect(spent).toBe(26_252);
    expect(state.coins).toBe(0);
    expect(buyPlot(state)).toBe(false);
    setSkillLevel(state, 'Farming', 1);
    expect(state.plotsBought).toBe(7);
    expect(state.plots).toHaveLength(8);
  });

  it('harvests each of 8 plots once across 30h away and still credits the selected activity for 8h', () => {
    const state = farmer(35);
    state.coins = 26_252;
    while (state.plotsBought < 7) buyPlot(state);
    setSkillLevel(state, 'Farming', 1);
    state.bank['mat.seed.flax'] = 8;
    for (let index = 0; index < 8; index += 1) {
      expect(plantOnPlot(state, index, 'recipe.mat.fibre.flax', null)).toBe(true);
    }
    startGather(state, 'mat.wood.pine');

    const twin = newGame(0);
    startGather(twin, 'mat.wood.pine');

    const report = creditOffline(state, 30 * 60 * 60 * 1000);
    creditOffline(twin, 8 * 60 * 60 * 1000);
    expect(report.creditedMs).toBe(8 * 60 * 60 * 1000);
    expect(report.capped).toBe(true);
    expect(state.bank['mat.fibre.flax']).toBe(16_200);
    // 8 × 26,550 = 212,400 before perks. Harvests 5–7 include mastery 30's +5% XP,
    // and harvest 8 also includes the +3% global bonus from maxing the flax track.
    expect(8 * 26550).toBe(212_400);
    expect(state.xp.Farming).toBe(218_506.5);
    expect(state.plots.every((plot) => plot == null)).toBe(true);
    expect(report.plotHarvests).toHaveLength(8);
    expect(report.plotHarvests?.[0]).toBe('Plot 1: Flax fibre ×1,800');
    expect(report.plotHarvests?.[7]).toBe('Plot 8: Flax fibre ×3,600');
    expect(state.bank['mat.wood.pine']).toBe(twin.bank['mat.wood.pine']);
    expect(state.stats.actions).toBe(twin.stats.actions + 8);
  });

  it('matches the old one-plot flax rate when a full field is replanted on time', () => {
    const grow = 3.7 * 3600;
    const perPlot = 1800 * 3600 / grow;
    const perField = 8 * perPlot;
    const xpField = 8 * 26550 * 3600 / grow;
    expect(round3(perPlot)).toBe(486.486);
    expect(round3(1800 * 3600 / grow)).toBe(round3((4 * 3600) / 3.7 / 8));
    expect(round3(perField)).toBe(3891.892);
    expect(round3(xpField)).toBe(57405.405);
    expect(round3(perField)).toBe(round3((4 * 3600) / 3.7));
    expect(round3(xpField)).toBe(round3((59 * 3600) / 3.7));
  });

  it('scales every shipped crop by the Farming C table', () => {
    const expected: Record<string, { growH: number; xp: number; mxp: number; coins: number; sell: number }> = {
      'recipe.mat.fibre.flax': { growH: 3.7, xp: 26550, mxp: 16650, coins: 1800, sell: 1 },
      'recipe.mat.crop.potato': { growH: 3.9, xp: 28350, mxp: 17550, coins: 1800, sell: 1 },
      'recipe.farm.meadow_herb': { growH: 4.2, xp: 30150, mxp: 18900, coins: 1800, sell: 1 },
      'recipe.mat.crop.carrot': { growH: 4.3, xp: 31050, mxp: 19350, coins: 3600, sell: 2 },
      'recipe.mat.fibre.cotton': { growH: 4.8, xp: 50400, mxp: 21600, coins: 5400, sell: 3 },
      'recipe.farm.onion': { growH: 5, xp: 52200, mxp: 22500, coins: 5400, sell: 3 },
      'recipe.mat.grain.wheat': { growH: 5.3, xp: 55350, mxp: 23850, coins: 7200, sell: 4 },
      'recipe.farm.mushroom.log_route': { growH: 5.6, xp: 58500, mxp: 25200, coins: 10800, sell: 6 },
      'recipe.mat.crop.garlic': { growH: 5.4, xp: 56250, mxp: 24300, coins: 9000, sell: 5 },
      'recipe.farm.turnip': { growH: 5.6, xp: 58500, mxp: 25200, coins: 9000, sell: 5 },
      'recipe.mat.fibre.hemp': { growH: 5.9, xp: 107100, mxp: 26550, coins: 10800, sell: 6 },
    };
    for (const [id, row] of Object.entries(expected)) {
      const recipe = RECIPES.find((item) => item.id === id);
      expect(recipe, id).toBeTruthy();
      const growSeconds = Math.round(recipe!.seconds * 3600);
      const produce = Math.round(recipe!.outputs[0].qty * HARVEST_FACTOR);
      const xp = Math.round(recipe!.xp * HARVEST_FACTOR);
      const mxp = Math.round(10 * recipe!.seconds * HARVEST_FACTOR);
      const sell = ITEMS[recipe!.outputs[0].id].sell;
      expect(recipe!.seconds).toBe(row.growH);
      expect(growSeconds / 3600).toBeCloseTo(row.growH, 4);
      expect(produce).toBe(1800);
      expect(xp).toBe(row.xp);
      expect(mxp).toBe(row.mxp);
      expect(sell).toBe(row.sell);
      expect(produce * sell).toBe(row.coins);
      expect(round3(produce * 3600 / growSeconds)).toBe(round3(1800 * 3600 / (row.growH * 3600)));
    }
  });

  it('applies compost to yield only, and bone compost to yield and grow time', () => {
    const mix = farmer();
    mix.bank['mat.herb.meadow'] = 2;
    expect(startProduce(mix, 'recipe.farm.compost')).toBe(true);
    expect(stepCompletion(mix).ms).toBe(3900);
    expect(mix.bank['mat.farm.compost']).toBe(1);
    expect(mix.xp.Farming).toBe(63);
    expect(ITEMS['mat.farm.compost'].sell).toBe(3);

    const bone = farmer(10);
    bone.bank['mat.bone.ordinary'] = 1;
    bone.bank['mat.farm.compost'] = 1;
    expect(startProduce(bone, 'recipe.farm.bone_compost')).toBe(true);
    expect(stepCompletion(bone).ms).toBe(4400);
    expect(bone.xp.Farming).toBe(XP_TABLE[10] + 71);
    expect(bone.bank['mat.farm.bone_compost']).toBe(1);
    expect(ITEMS['mat.farm.bone_compost'].sell).toBe(6);

    const composted = farmer();
    composted.bank['mat.seed.flax'] = 1;
    composted.bank['mat.farm.compost'] = 1;
    expect(plantOnPlot(composted, 0, 'recipe.mat.fibre.flax', 'compost')).toBe(true);
    expect(composted.plots[0]?.remainingMs).toBe(13_320_000);
    creditOffline(composted, 13_320_000);
    expect(composted.bank['mat.fibre.flax']).toBe(2250);
    expect(composted.xp.Farming).toBe(26550);
    expect(composted.mastery['recipe.mat.fibre.flax']).toBe(16650);

    const boned = farmer();
    boned.bank['mat.seed.flax'] = 1;
    boned.bank['mat.farm.bone_compost'] = 1;
    expect(plantOnPlot(boned, 0, 'recipe.mat.fibre.flax', 'bone')).toBe(true);
    expect(boned.plots[0]?.remainingMs).toBe(12_480_840);
    expect(plotGrowMs(3.7, 'bone') / 1000).toBe(12480.84);
    creditOffline(boned, 12_480_840);
    expect(boned.bank['mat.fibre.flax']).toBe(2250);
    expect(round3(2250 * 3600 / 12480.84)).toBe(648.995);
    expect(Math.round((3600 / 12480.84) * 100000) / 100000).toBe(0.28844);

    const short = farmer();
    short.bank['mat.herb.meadow'] = 2;
    startProduce(short, 'recipe.farm.compost');
    const stopped = creditOffline(short, 60 * 60 * 1000);
    expect(short.bank['mat.farm.compost']).toBe(1);
    expect(short.activity).toBeNull();
    expect(stopped.stopped).toBe('inputs');
  });

  it('loads an old 3.7s flax plot onto plot 1 and pays the old output', () => {
    const growing = legacyPlot({ recipeId: 'recipe.mat.fibre.flax', remainingMs: 3700, ready: false });
    expect(growing.saveFormat).toBe(4);
    expect(growing.plots[0]).toMatchObject({ recipeId: 'recipe.mat.fibre.flax', remainingMs: 3700, compost: null, legacy: true });
    expect(Object.keys(growing.plots[0] ?? {}).sort()).toEqual(['compost', 'legacy', 'recipeId', 'remainingMs']);
    expect(growing.bank['mat.fibre.flax'] ?? 0).toBe(0);
    creditOffline(growing, 3700);
    expect(growing.bank['mat.fibre.flax']).toBe(4);
    expect(growing.xp.Farming).toBe(59);
    expect(growing.mastery['recipe.mat.fibre.flax']).toBe(37);
    expect(growing.plots[0]).toBeNull();

    const ready = legacyPlot({ recipeId: 'recipe.mat.fibre.flax', remainingMs: 0, ready: true });
    expect(ready.bank['mat.fibre.flax']).toBe(4);
    expect(ready.xp.Farming).toBe(59);
    expect(ready.plots[0]).toBeNull();
    expect(SAVE_FORMAT).toBe(4);
  });

  it('shows the land regions, mirrors plot cards, and keeps six tabs', () => {
    expect(TAB_IDS).toHaveLength(6);
    const state = farmer(5);
    state.coins = 188;
    state.bank['mat.seed.flax'] = 1;
    state.bank['mat.herb.meadow'] = 2;
    const land = mainHtml(state, screen('Farming', true), 0);
    expect(land).toContain('Fields');
    expect(land).toContain('Yard');
    expect(land).toContain('Coming later');
    expect(land.match(/data-yard-tile=/g)).toHaveLength(9);
    expect(land).toContain('data-plot-card="0"');
    expect(land).toContain('data-plot-card="7"');
    expect(land).toContain('Farming 5');
    expect(land).toContain('188');
    expect(land).toContain('data-buy-plot');
    expect(tabsHtml(screen('Farming', true))).not.toContain('>Land<');

    const activity = mainHtml(state, screen('Farming'), 0);
    expect(activity).toContain('data-activity-plots');
    expect(activity).toContain('data-plot-card="0"');
    expect(activity).toContain('data-open-land');
    expect(activity).toContain('data-plant="recipe.mat.fibre.flax"');
    expect(activity).not.toContain('data-recipe="recipe.mat.fibre.flax"');
    expect(activity).toContain('data-recipe="recipe.farm.compost"');

    setSkillLevel(state, 'Construction', 1);
    const construction = mainHtml(state, screen('Construction'), 0);
    expect(construction).toContain('data-open-land');
    expect(construction).not.toContain('data-plot-card');

    plantOnPlot(state, 0, 'recipe.mat.fibre.flax', null);
    const growing = mainHtml(state, screen('Farming'), 0);
    expect(growing).toContain('Growing');
    expect(growing).toContain('data-plot-left="0"');
    state.plots[0]!.remainingMs = 0;
    state.plots[0]!.ready = true;
    const harvestable = mainHtml(state, screen('Farming'), 0);
    expect(harvestable).toContain('Ready');
    expect(harvestable).not.toContain('Growing');
  });

  it('puts plot unlocks in the Farming next row and follows the planted crop', () => {
    const state = farmer();
    state.bank['mat.herb.meadow'] = 4;
    state.bank['mat.seed.flax'] = 1;
    startProduce(state, 'recipe.farm.compost');
    expect(activityNextLine(state)).toContain('Potatoes and plot 2 at Farming 5');
    plantOnPlot(state, 0, 'recipe.mat.fibre.flax', null);
    const line = activityNextLine(state);
    expect(line).toContain('Potatoes and plot 2 at Farming 5');
    expect(line).toContain('Flax fibre mastery');
    expect(line).toContain('harvests');
  });

  it('snapshots the mastery speed perk when a crop is planted', () => {
    const state = farmer();
    state.bank['mat.seed.flax'] = 3;
    state.bank['mat.farm.bone_compost'] = 1;
    state.mastery['recipe.mat.fibre.flax'] = masteryThreshold(20) - 1;
    expect(plantOnPlot(state, 0, 'recipe.mat.fibre.flax', null)).toBe(true);
    expect(state.plots[0]?.remainingMs).toBe(13_320_000);
    expect(Object.keys(state.plots[0] ?? {}).sort()).toEqual(['compost', 'recipeId', 'remainingMs']);
    state.plots[0] = null;
    state.mastery['recipe.mat.fibre.flax'] = masteryThreshold(20);
    expect(plantOnPlot(state, 0, 'recipe.mat.fibre.flax', null)).toBe(true);
    const sped = state.plots[0] as { remainingMs: number } | null;
    expect(sped?.remainingMs).toBe(12_654_000);
    expect(plotGrowMs(3.7, null, 0.05) / 1000).toBe(12654);
    const saved = JSON.parse(serialize(state)) as { plots: Record<string, unknown>[] };
    expect(Object.keys(saved.plots[0]).sort()).toEqual(['compost', 'recipeId', 'remainingMs']);
    saved.plots[0].ready = true;
    const held = deserialize(JSON.stringify(saved));
    expect(Object.keys(held?.plots[0] ?? {}).sort()).toEqual(['compost', 'ready', 'recipeId', 'remainingMs']);
    expect(plantOnPlot(state, 0, 'recipe.mat.fibre.flax', 'bone')).toBe(false);
    state.plots[0] = null;
    expect(plantOnPlot(state, 0, 'recipe.mat.fibre.flax', 'bone')).toBe(true);
    const boned = state.plots[0] as { remainingMs: number } | null;
    expect(boned?.remainingMs).toBe(11_856_800);
    expect(plotGrowMs(3.7, 'bone', 0.05) / 1000).toBe(11856.8);
  });

  it('rates a full flax field at 4,096.728 fibre/h once mastery 20 shortens the grow', () => {
    const state = farmer(35);
    state.coins = 26_252;
    while (state.plotsBought < 7) buyPlot(state);
    state.bank['mat.seed.flax'] = 8;
    state.mastery['recipe.mat.fibre.flax'] = masteryThreshold(20);
    for (let index = 0; index < 8; index += 1) {
      expect(plantOnPlot(state, index, 'recipe.mat.fibre.flax', null)).toBe(true);
    }
    const hours = (state.plots[0]?.remainingMs ?? 0) / 1000 / 3600;
    expect(round3(hours)).toBe(3.515);
    expect(round3((8 * 1800) / hours)).toBe(4096.728);
    expect(round3(1800 / hours)).toBe(512.091);
    expect(round3((3600 / (3.7 * 0.95)) * 4)).toBe(4096.728);
    expect(round3((8 * 1800) / 3.7)).toBe(3891.892);
  });

  it('times seven replanted flax harvests at 24.975 h once plantings 3 to 7 take the speed step', () => {
    const state = farmer();
    const grows: number[] = [];
    for (let harvest = 0; harvest < 7; harvest += 1) {
      state.bank['mat.seed.flax'] = 1;
      expect(plantOnPlot(state, 0, 'recipe.mat.fibre.flax', null)).toBe(true);
      const ms = state.plots[0]?.remainingMs ?? 0;
      grows.push(ms);
      creditOffline(state, state.lastCredited + ms);
    }
    expect(grows.slice(0, 2)).toEqual([13_320_000, 13_320_000]);
    expect(grows.slice(2)).toEqual([12_654_000, 12_654_000, 12_654_000, 12_654_000, 12_654_000]);
    expect(round3(grows.reduce((sum, ms) => sum + ms, 0) / 3_600_000)).toBe(24.975);
    expect(round3((7 * 13_320) / 3600)).toBe(25.9);
    expect(state.xp.Farming).toBe(189_832.5);
    expect(levelForXp(state.xp.Farming ?? 0)).toBe(38);
    expect(levelForXp(7 * 26550)).toBe(37);
    expect(state.mastery['recipe.mat.fibre.flax']).toBe(7 * 16650);
    expect(Math.floor(86_400 / 12_654)).toBe(6);
  });

  it('leaves the official routes on the falloff autoplay figures', () => {
    const route = runReferenceRoute({ seed: 1, expectedLoot: true });
    expect(route.purchases.map((event) => event.skill)).not.toContain('Farming');
    expect(route.elapsedHours).toBe(39.26);
    expect(routeNeed(route)).toBe(41_878);
    const meadow = runReferenceRoute({ seed: 1, expectedLoot: true, meadowGrind: true });
    expect(meadow.elapsedHours).toBe(39.14);
    expect(routeNeed(meadow)).toBe(41_878);
  });
});

function routeNeed(result: { purchases: { price?: number }[]; nodes: { id?: string }[] }): number {
  return (
    result.purchases.reduce((sum, event) => sum + (event.price ?? 0), 0) +
    result.nodes.reduce((sum, event) => sum + (NODE_BY_ID[event.id ?? '']?.cost ?? 0), 0)
  );
}

function legacyPlot(plot: { recipeId: string; remainingMs: number; ready: boolean }): Save {
  const state = newGame(0);
  state.owned.push('Farming');
  state.xp.Farming = 0;
  const raw = JSON.parse(serialize(state)) as Record<string, unknown>;
  delete raw.plots;
  delete raw.plotsBought;
  raw.plot = plot;
  raw.saveFormat = 4;
  const loaded = deserialize(JSON.stringify(raw));
  if (!loaded) throw new Error('legacy save did not load');
  return loaded;
}
