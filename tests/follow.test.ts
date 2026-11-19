import { describe, expect, it } from 'vitest';
import {
  ITEMS,
  NODES,
  RECIPES,
  SKILL_IDS,
  TOOL_TIME_FACTOR,
  XP_TABLE,
  actionTitle,
  isFood,
  countedName,
  itemName,
  SINGULAR_NAMES,
  nodeCost,
} from '../src/content';
import {
  actionSeconds,
  advanceOpenTab,
  cancelPlot,
  deserialize,
  dismantleBuilding,
  dismantleRefund,
  newGame,
  placeBuilding,
  serialize,
  setSkillLevel,
  simulate,
  plantOnPlot,
  startProduce,
  stepCompletion,
} from '../src/engine';
import { mainHtml, renderKey, type View } from '../src/ui';

function view(skill: View['skill']): View {
  return {
    tab: 'skill',
    skill,
    filter: 'all',
    selected: null,
    area: 'Meadow verge',
    style: null,
    message: '',
  };
}

function rowHtml(html: string, title: string): string {
  const at = html.indexOf(`<b>${title}</b>`);
  expect(at, title).toBeGreaterThanOrEqual(0);
  const start = html.lastIndexOf('<div class="row', at);
  const next = html.indexOf('<div class="row', at);
  return html.slice(start, next === -1 ? undefined : next);
}

describe('construction, crops, names, heals, and coming-later rows', () => {
  it('stops a one-time build and charges the rebuild fee on the next start', () => {
    const state = newGame(0);
    state.owned.push('Construction');
    state.xp.Construction = 0;
    state.bank['mat.wood.pine'] = 20;
    state.coins = 451;
    expect(startProduce(state, 'activity.construction.pine_work_area')).toBe(true);
    stepCompletion(state);
    expect(state.activity).toBeNull();
    expect(state.buildings['activity.construction.pine_work_area']).toBe(true);
    simulate(state, 120_000);
    expect(state.bank['mat.wood.pine']).toBe(15);
    expect(state.coins).toBe(451);

    const html = mainHtml(state, view('Construction'), 0);
    const row = rowHtml(html, 'Build pine work area');
    expect(row).toContain('Rebuild');
    expect(row).toContain('451');
    expect(row).toContain('In store');
    expect(row).toContain('0 XP');
    expect(row).not.toContain('7212');

    state.coins = 0;
    expect(startProduce(state, 'activity.construction.pine_work_area')).toBe(false);
    expect(state.bank['mat.wood.pine']).toBe(15);

    state.coins = 626;
    state.xp.Construction = XP_TABLE[20];
    state.bank['con.kit.oak_bench'] = 6;
    expect(startProduce(state, 'activity.construction.oak_workshop')).toBe(true);
    stepCompletion(state);
    expect(state.activity).toBeNull();
    expect(state.coins).toBe(626);
    expect(state.xp.Construction).toBe(XP_TABLE[20] + 10458);
    expect(startProduce(state, 'activity.construction.oak_workshop')).toBe(true);
    expect(state.coins).toBe(0);
    stepCompletion(state);
    expect(state.xp.Construction).toBe(XP_TABLE[20] + 10458);
    expect(state.activity).toBeNull();

    state.bank['mat.wood.oak'] = 9;
    state.bank['mat.fitting.iron'] = 6;
    expect(startProduce(state, 'activity.construction.practice_workshop_assembly')).toBe(true);
    stepCompletion(state);
    expect(state.activity?.kind).toBe('produce');
    const before = state.xp.Construction;
    stepCompletion(state);
    expect(state.activity?.kind).toBe('produce');
    expect(state.xp.Construction).toBeGreaterThan(before);
  });

  it('rounds node cost from the exact product and prices wild plums at 8,168', () => {
    expect(nodeCost(33)).toBe(8168);
    expect(nodeCost(23)).toBe(3968);
    expect(Math.round(3000 * (33 / 20) ** 2)).toBe(8167);
    expect(NODES.find((node) => node.id === 'mat.fruit.plum')?.cost).toBe(8168);
  });

  it('cancels a crop with no refund, XP, or mastery, and does not replant', () => {
    const state = newGame(0);
    state.owned.push('Farming');
    state.xp.Farming = 0;
    state.bank['mat.seed.flax'] = 1;
    expect(plantOnPlot(state, 0, 'recipe.mat.fibre.flax', null)).toBe(true);
    const screen = view('Farming');
    const planted = mainHtml(state, screen, 0);
    expect(planted).toContain('data-cancel-plot');
    expect(planted).toContain('Growing');
    expect(planted).toContain('Cancelling returns nothing');
    const growing = renderKey(state, screen);
    const left = state.plots[0]?.remainingMs ?? 0;
    if (state.plots[0]) state.plots[0].remainingMs = Math.max(0, left - 400);
    expect(renderKey(state, screen)).toBe(growing);
    if (state.plots[0]) state.plots[0].remainingMs = left;
    cancelPlot(state, 0);
    expect(renderKey(state, screen)).not.toBe(growing);
    const cleared = mainHtml(state, screen, 0);
    expect(cleared).not.toContain('data-cancel-plot');
    expect(cleared).not.toContain('Growing');
    expect(state.plots[0]).toBeNull();
    expect(state.bank['mat.seed.flax'] ?? 0).toBe(0);
    expect(state.bank['mat.fibre.flax'] ?? 0).toBe(0);
    expect(state.xp.Farming).toBe(0);
    expect(state.mastery['recipe.mat.fibre.flax'] ?? 0).toBe(0);

    state.bank['mat.seed.flax'] = 2;
    plantOnPlot(state, 0, 'recipe.mat.fibre.flax', null);
    const duration = state.plots[0]?.remainingMs ?? 0;
    advanceOpenTab(state, duration, 5_000, []);
    expect(state.plots[0]).toBeNull();
    expect(state.bank['mat.seed.flax']).toBe(1);
    expect(state.bank['mat.fibre.flax']).toBe(1800);
  });

  it('names Exploration rows so no skill shows the same title twice', () => {
    expect(itemName('mat.gem.weathered_agate')).toBe('Weathered agate');
    expect(itemName('mat.relic.weathered_slate')).toBe('Weathered slate');
    expect(actionTitle(RECIPES.find((recipe) => recipe.id === 'activity.exploration.stream_survey')!)).toBe('Stream survey');
    expect(actionTitle(RECIPES.find((recipe) => recipe.id === 'activity.exploration.riverbank_branch_agate')!)).toBe('Riverbank branch — agate');
    expect(actionTitle(RECIPES.find((recipe) => recipe.id === 'activity.exploration.shallow_ruin')!)).toBe('Shallow ruin');
    expect(actionTitle(RECIPES.find((recipe) => recipe.id === 'activity.exploration.riverbank_branch_slate')!)).toBe('Riverbank branch — slate');
    expect(actionTitle(RECIPES.find((recipe) => recipe.id === 'activity.exploration.fitting_appraisal')!)).toBe('Fitting appraisal');

    const state = newGame(0);
    state.owned.push('Exploration');
    state.xp.Exploration = XP_TABLE[40];
    const html = mainHtml(state, view('Exploration'), 0);
    expect(html).toContain('Stream survey');
    expect(html).toContain('Riverbank branch — agate');
    expect(html).toContain('Shallow ruin');
    expect(html).toContain('Riverbank branch — slate');
    expect(html).toContain('Needs trout-and-mushroom meal (coming later)');

    for (const skill of SKILL_IDS) {
      const titles = [
        ...NODES.filter((node) => node.skill === skill).map((node) => itemName(node.id)),
        ...RECIPES.filter((recipe) => recipe.skill === skill).map((recipe) => actionTitle(recipe)),
      ];
      const seen = new Set<string>();
      for (const title of titles) {
        expect(seen.has(title), `${skill}: ${title}`).toBe(false);
        seen.add(title);
      }
    }
  });

  it('heals the new foods, including the two that are only in the bank', () => {
    expect(ITEMS['food.perch_wheat_cakes'].heal).toBe(200);
    expect(ITEMS['food.carp_garlic_bake'].heal).toBe(210);
    expect(ITEMS['food.garlic_mushroom_skillet'].heal).toBe(220);
    expect(ITEMS['food.boiled_crayfish'].heal).toBe(220);
    expect(ITEMS['food.root_vegetable_pottage'].heal).toBe(220);
    expect(ITEMS['food.plum_tart'].heal).toBe(230);
    expect(ITEMS['food.crayfish_turnip_pot'].heal).toBe(240);
    expect(ITEMS['food.mutton_turnip_hotpot'].heal).toBe(250);
    expect(ITEMS['food.salmon_wheat_ration'].heal).toBe(250);
    expect(ITEMS['food.wheat_bread'].heal).toBe(200);
    expect(ITEMS['food.trout_mushroom_meal'].heal).toBe(150);
    expect(ITEMS['food.roast_hare'].heal).toBe(50);
    expect(ITEMS['mat.food.cured_boar'].heal).toBeUndefined();
    expect(isFood('food.wheat_bread')).toBe(true);
    expect(isFood('food.trout_mushroom_meal')).toBe(true);
    expect(isFood('mat.food.cured_boar')).toBe(false);
  });

  it('shows wheat bread and the trout meal as Coming later, and locks what needs them', () => {
    const state = newGame(0);
    state.owned.push('Cooking', 'Exploration');
    state.xp.Cooking = XP_TABLE[40];
    state.xp.Exploration = XP_TABLE[40];
    state.bank['mat.grain.wheat'] = 4;
    state.bank['mat.fish.trout'] = 2;
    state.bank['mat.fungi.mushroom'] = 2;
    state.bank['food.wheat_bread'] = 1;
    state.bank['food.trout_mushroom_meal'] = 1;
    state.bank['mat.fish.salmon'] = 1;
    expect(startProduce(state, 'recipe.food.wheat_bread')).toBe(false);
    expect(startProduce(state, 'recipe.food.trout_mushroom_meal')).toBe(false);
    expect(startProduce(state, 'recipe.food.salmon_wheat_ration')).toBe(false);
    expect(startProduce(state, 'activity.exploration.fitting_appraisal')).toBe(false);
    expect(state.bank['mat.grain.wheat']).toBe(4);
    expect(state.bank['food.wheat_bread']).toBe(1);

    const cooking = mainHtml(state, view('Cooking'), 0);
    for (const title of ['Wheat bread', 'Trout-and-mushroom meal']) {
      const row = rowHtml(cooking, title);
      expect(row).toContain('Coming later');
      expect(row).not.toContain('XP');
      expect(row).not.toContain('Start');
      expect(row).not.toContain('data-recipe');
    }
    expect(cooking.match(/Coming later/g)).toHaveLength(2);
    const ration = rowHtml(cooking, 'Salmon-and-wheat ration');
    expect(ration).toContain('Needs wheat bread (coming later)');
    expect(ration).toContain('disabled');
    expect(ration).toContain('XP');

    const exploration = mainHtml(state, view('Exploration'), 0);
    const fitting = rowHtml(exploration, 'Fitting appraisal');
    expect(fitting).toContain('Needs trout-and-mushroom meal (coming later)');
    expect(fitting).toContain('aria-label="Locked"');
    expect(fitting).not.toContain('Haul');
    expect(fitting).not.toContain('XP');
    expect(fitting).not.toContain('Pack and go');
  });

  it('dismantles a built structure for half its kits, rounded down, and drops the step', () => {
    const state = newGame(0);
    state.owned.push('Construction', 'Crafting', 'Cooking', 'Smithing', 'Alchemy');
    setSkillLevel(state, 'Construction', 35);
    const constructionXp = state.xp.Construction;
    state.coins = 80;
    state.buildings['activity.construction.oak_workshop'] = true;
    state.buildings['activity.construction.pine_work_area'] = true;
    state.buildings['activity.construction.supply_racks'] = true;
    state.buildings['activity.construction.stone_foundation'] = true;
    state.buildings['activity.construction.forge_extension'] = true;
    expect(placeBuilding(state, 'activity.construction.pine_work_area', 0)).toBe(true);
    expect(placeBuilding(state, 'activity.construction.stone_foundation', 1)).toBe(true);
    expect(placeBuilding(state, 'activity.construction.oak_workshop', 2)).toBe(true);
    expect(placeBuilding(state, 'activity.construction.forge_extension', 3)).toBe(true);
    const focus = 'recipe.gear.magic.pine_focus';
    const base = RECIPES.find((recipe) => recipe.id === focus)!.seconds;
    expect(actionSeconds(state, focus)).toBeCloseTo(base * TOOL_TIME_FACTOR ** 2);
    expect(dismantleRefund('activity.construction.oak_workshop')).toEqual([{ id: 'con.kit.oak_bench', qty: 1 }]);
    expect(dismantleBuilding(state, 'activity.construction.oak_workshop')).toBe(true);
    expect(state.bank['con.kit.oak_bench']).toBe(1);
    expect(state.buildings['activity.construction.oak_workshop']).toBeUndefined();
    expect(state.xp.Construction).toBe(constructionXp);
    expect(state.coins).toBe(80);
    expect(actionSeconds(state, focus)).toBeCloseTo(base * TOOL_TIME_FACTOR);

    expect(dismantleRefund('activity.construction.supply_racks')).toEqual([{ id: 'con.kit.pine_frame', qty: 2 }]);
    expect(dismantleBuilding(state, 'activity.construction.supply_racks')).toBe(true);
    expect(state.bank['con.kit.pine_frame']).toBe(2);
    expect(state.bank['mat.wire.bronze'] ?? 0).toBe(0);
    expect(state.bank['con.mat.roof_tiles'] ?? 0).toBe(0);

    state.bank['mat.wood.pine'] = 0;
    expect(dismantleRefund('activity.construction.pine_work_area')).toEqual([]);
    expect(dismantleBuilding(state, 'activity.construction.pine_work_area')).toBe(true);
    expect(state.bank['mat.wood.pine'] ?? 0).toBe(0);
    expect(actionSeconds(state, focus)).toBeCloseTo(base);

    const cook = 'recipe.food.roast_hare';
    const cookBase = RECIPES.find((recipe) => recipe.id === cook)!.seconds;
    expect(actionSeconds(state, cook)).toBeCloseTo(cookBase * TOOL_TIME_FACTOR);
    expect(dismantleBuilding(state, 'activity.construction.stone_foundation')).toBe(true);
    expect(state.buildings['activity.construction.forge_extension']).toBe(true);
    expect(actionSeconds(state, cook)).toBeCloseTo(cookBase);
    const smith = 'recipe.mat.bar.bronze';
    const smithBase = RECIPES.find((recipe) => recipe.id === smith)!.seconds;
    expect(actionSeconds(state, smith)).toBeCloseTo(smithBase * TOOL_TIME_FACTOR);
    expect(dismantleRefund('activity.construction.forge_extension')).toEqual([{ id: 'con.kit.hearth_block', qty: 1 }]);
    expect(dismantleBuilding(state, 'activity.construction.forge_extension')).toBe(true);
    expect(state.bank['con.kit.hearth_block']).toBe(1);
    expect(actionSeconds(state, smith)).toBeCloseTo(smithBase);

    expect(dismantleBuilding(state, 'activity.construction.practice_workshop_assembly')).toBe(false);
    expect(dismantleBuilding(state, 'activity.construction.oak_workshop')).toBe(false);
    state.buildings['activity.construction.oak_workshop'] = true;
    state.activity = { kind: 'produce', recipeId: 'activity.construction.oak_workshop' };
    expect(dismantleBuilding(state, 'activity.construction.oak_workshop')).toBe(false);
    expect(state.buildings['activity.construction.oak_workshop']).toBe(true);

    const shown = newGame(0);
    shown.owned.push('Construction');
    shown.xp.Construction = XP_TABLE[30];
    shown.coins = 626;
    shown.buildings['activity.construction.oak_workshop'] = true;
    shown.buildings['activity.construction.supply_racks'] = true;
    const html = mainHtml(shown, view('Construction'), 0);
    const row = rowHtml(html, 'Build oak workshop');
    expect(row).toContain('Dismantle');
    expect(row).toContain('returns 1 Oak bench kit');
    expect(row).toContain('Rebuild');
    expect(rowHtml(html, 'Build supply racks')).toContain('returns 2 Pine frame kits');
    expect(countedName(2, 'con.kit.pine_frame')).toBe('2 Pine frame kits');
    expect(countedName(4, 'con.kit.pine_frame')).toBe('4 Pine frame kits');
    expect(countedName(1, 'con.kit.pine_frame')).toBe('1 Pine frame kit');
    expect(countedName(5, 'mat.wood.pine')).toBe('5 Pine logs');
    expect(countedName(4, 'mat.fibre.flax')).toBe('4 Flax fibre');
    expect(countedName(3, 'mat.bar.bronze')).toBe('3 Bronze bars');
    expect(`Returned ${countedName(2, 'con.kit.pine_frame')}.`).toBe('Returned 2 Pine frame kits.');
    expect(rowHtml(html, 'Build supply racks')).toContain('4 Pine frame kits, 4 Bronze wire, 6 Fired roof tiles');
    expect(rowHtml(html, 'Build supply racks')).not.toContain('4 Pine frame kit,');
  });

  it('pluralizes countable recipe amounts and leaves logs and fibre alone', () => {
    expect(countedName(4, 'con.kit.pine_frame')).toBe('4 Pine frame kits');
    expect(countedName(5, 'mat.wood.pine')).toBe('5 Pine logs');
    expect(countedName(4, 'mat.fibre.flax')).toBe('4 Flax fibre');
    for (const recipe of RECIPES) {
      for (const stack of [...recipe.inputs, ...recipe.outputs]) {
        const name = itemName(stack.id);
        const line = countedName(stack.qty, stack.id);
        if (stack.qty > 1 && (name.endsWith('logs') || name.endsWith('fibre'))) {
          expect(line).toBe(`${stack.qty} ${name}`);
        }
        if (name.endsWith(' kit') && stack.qty > 1) expect(line).toBe(`${stack.qty} ${name}s`);
      }
    }
  });

  it('uses a singular display name at qty 1 and keeps the catalogue name above 1', () => {
    const samples = ['mat.wood.pine', 'mat.fitting.iron', 'mat.seed.potato', 'mat.wood.ash'];
    for (const id of samples) {
      expect(countedName(1, id)).toBe(`1 ${SINGULAR_NAMES[id]}`);
      expect(countedName(2, id)).toBe(`2 ${itemName(id)}`);
      expect(itemName(id)).not.toBe(SINGULAR_NAMES[id]);
    }
    expect(countedName(1, 'mat.wood.pine')).toBe('1 Pine log');
    expect(countedName(5, 'mat.wood.pine')).toBe('5 Pine logs');
    expect(countedName(1, 'mat.fitting.iron')).toBe('1 Iron fitting');
    expect(countedName(2, 'mat.fitting.iron')).toBe('2 Iron fittings');
    expect(countedName(1, 'mat.seed.potato')).toBe('1 Seed potato');
    expect(countedName(2, 'mat.seed.potato')).toBe('2 Seed potatoes');
    expect(countedName(1, 'mat.fibre.flax')).toBe('1 Flax fibre');
    expect(countedName(4, 'mat.fibre.flax')).toBe('4 Flax fibre');
    expect(countedName(1, 'gear.feet.leather_boots')).toBe('1 Leather boots');
    expect(countedName(2, 'gear.feet.leather_boots')).toBe('2 Leather boots');
    expect(countedName(1, 'gear.magic.pine_focus')).toBe('1 Pine focus');
    expect(countedName(2, 'gear.magic.pine_focus')).toBe('2 Pine focus');
    const missing = Object.keys(SINGULAR_NAMES).filter((id) => !ITEMS[id]);
    expect(missing).toEqual([]);
  });

  it('charges the rebuild fee and no XP after a dismantle', () => {
    const state = newGame(0);
    state.owned.push('Construction');
    state.xp.Construction = 0;
    state.coins = 451;
    state.bank['mat.wood.pine'] = 10;
    expect(startProduce(state, 'activity.construction.pine_work_area')).toBe(true);
    stepCompletion(state);
    expect(state.xp.Construction).toBe(7212);
    expect(state.coins).toBe(451);
    expect(state.bank['mat.wood.pine']).toBe(5);
    expect(dismantleBuilding(state, 'activity.construction.pine_work_area')).toBe(true);
    expect(state.buildings['activity.construction.pine_work_area']).toBeUndefined();
    expect(state.buildingsEver['activity.construction.pine_work_area']).toBe(true);
    expect(state.xp.Construction).toBe(7212);
    expect(state.bank['mat.wood.pine']).toBe(5);

    expect(startProduce(state, 'activity.construction.pine_work_area')).toBe(true);
    expect(state.coins).toBe(0);
    stepCompletion(state);
    expect(state.bank['mat.wood.pine'] ?? 0).toBe(0);
    expect(state.xp.Construction).toBe(7212);
    expect(state.buildings['activity.construction.pine_work_area']).toBe(true);

    const html = mainHtml(state, view('Construction'), 0);
    dismantleBuilding(state, 'activity.construction.pine_work_area');
    const after = mainHtml(state, view('Construction'), 0);
    const row = rowHtml(after, 'Build pine work area');
    expect(row).toContain('Rebuild');
    expect(row).toContain('451');
    expect(row).not.toContain('Dismantle');
    expect(row).not.toContain('7212');
    expect(html).toContain('In store');

    const old = JSON.parse(serialize(newGame(0)));
    old.saveFormat = 4;
    delete old.buildingsEver;
    old.buildings = { 'activity.construction.oak_workshop': true };
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded?.saveFormat).toBe(4);
    expect(loaded?.buildings['activity.construction.oak_workshop']).toBe(true);
    expect(loaded?.buildingsEver['activity.construction.oak_workshop']).toBe(true);
    const kept = deserialize(serialize(state));
    expect(kept?.buildings['activity.construction.pine_work_area']).toBeUndefined();
    expect(kept?.buildingsEver['activity.construction.pine_work_area']).toBe(true);
  });
});
