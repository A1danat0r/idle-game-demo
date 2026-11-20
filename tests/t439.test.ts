import { describe, expect, it } from 'vitest';
import {
  ITEMS,
  NODES,
  RECIPES,
  XP_CAP,
  XP_TABLE,
  countedName,
  itemName,
} from '../src/content';
import {
  EXPEDITION_MS,
  SAVE_KEY,
  advanceOpenTab,
  creditOffline,
  deserialize,
  expeditionPreview,
  loadAndCredit,
  newGame,
  returnExpedition,
  sell,
  serialize,
  setFood,
  setSkillLevel,
  simulate,
  startCombat,
  startExpedition,
  startProduce,
  stepCompletion,
  type FloatNote,
  type Save,
  type StorageLike,
} from '../src/engine';
import { mainHtml, reportHtml, type View } from '../src/ui';

const MEAL = 'food.trout_mushroom_meal';
const RECIPE = 'recipe.food.trout_mushroom_meal';
const FITTING = 'activity.exploration.fitting_appraisal';
const TROUT = 'mat.fish.trout';
const MUSHROOM = 'mat.fungi.mushroom';
const [QUARTER, HOUR, EIGHT] = EXPEDITION_MS;

/** Top-level save keys on this tree. This build adds none. */
const SAVE_KEYS = [
  'activity',
  'bank',
  'buildings',
  'buildingsEver',
  'coins',
  'combat',
  'combatScale',
  'enemyKills',
  'enemyMastery',
  'equipped',
  'expedition',
  'foodSlot',
  'glimmer',
  'hp',
  'land',
  'lastCredited',
  'markRanks',
  'mastery',
  'nodes',
  'owned',
  'pauseCause',
  'paused',
  'plots',
  'plotsBought',
  'progressMs',
  'purchaseCount',
  'regenMs',
  'rngState',
  'saveFormat',
  'shop',
  'stats',
  'xp',
];

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
  const start = html.lastIndexOf('<div class="row', at);
  const next = html.indexOf('<div class="row', at + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

function cook(level: number): Save {
  const state = newGame(0);
  setSkillLevel(state, 'Cooking', level);
  return state;
}

function explorer(level: number): Save {
  const state = newGame(0);
  setSkillLevel(state, 'Exploration', level);
  return state;
}

function memory(initial: string): StorageLike {
  let raw: string | null = initial;
  return {
    getItem: (key) => (key === SAVE_KEY ? raw : null),
    setItem: (key, value) => {
      if (key === SAVE_KEY) raw = value;
    },
    removeItem: (key) => {
      if (key === SAVE_KEY) raw = null;
    },
  };
}

describe('Trout-and-mushroom meal and Fitting appraisal', () => {
  it('T1 locks the cooking row at 19 and opens it at 20', () => {
    const low = cook(19);
    const locked = rowHtml(mainHtml(low, view('Cooking'), 0), 'Trout-and-mushroom meal');
    expect(locked).toContain('Lv 20');
    expect(locked).not.toContain('Coming later');
    expect(startProduce(low, RECIPE)).toBe(false);

    const ready = cook(20);
    ready.bank[TROUT] = 1;
    ready.bank[MUSHROOM] = 1;
    const open = rowHtml(mainHtml(ready, view('Cooking'), 0), 'Trout-and-mushroom meal');
    expect(open).not.toContain('Coming later');
    expect(open).not.toContain('Lv 20');
    expect(open).toContain('1 Raw trout, 1 Meadow mushroom → 2');
    expect(open).toContain('3.3s · 77 XP · sells 9');
    expect(open).toContain('heals 150');
    expect(open).toContain(`data-recipe="${RECIPE}"`);
    expect(open).not.toContain('disabled');

    const missing = cook(20);
    const row = rowHtml(mainHtml(missing, view('Cooking'), 0), 'Trout-and-mushroom meal');
    expect(row).toContain('Needs raw trout (Fishing)');
    expect(row).toContain('disabled');
    expect(row).toContain('Start');
    expect(row).not.toContain('data-recipe');
    expect(startProduce(missing, RECIPE)).toBe(false);
  });

  it('T2 spends both inputs when the craft completes and pays 2 meals, 77 XP and 33 MXP', () => {
    const state = cook(20);
    state.bank[TROUT] = 1;
    state.bank[MUSHROOM] = 1;
    const xp = state.xp.Cooking ?? 0;
    expect(startProduce(state, RECIPE)).toBe(true);
    expect(state.bank[TROUT]).toBe(1);
    expect(state.bank[MUSHROOM]).toBe(1);
    expect(state.bank[MEAL] ?? 0).toBe(0);
    const step = stepCompletion(state);
    expect(step.ms).toBe(3300);
    expect(step.type).toBe('action');
    expect(state.bank[TROUT] ?? 0).toBe(0);
    expect(state.bank[MUSHROOM] ?? 0).toBe(0);
    expect(state.bank[MEAL]).toBe(2);
    expect(state.xp.Cooking).toBe(xp + 77);
    expect(state.mastery[RECIPE]).toBe(33);
  });

  it('T3 heals 150 from the food slot and sells for 9', () => {
    let healed = false;
    for (let seed = 1; seed < 40 && !healed; seed += 1) {
      const state = newGame(0, seed);
      setSkillLevel(state, 'Strength', 1);
      setSkillLevel(state, 'Attack', 1);
      setSkillLevel(state, 'Hitpoints', 40);
      state.hp = 460;
      state.bank[MEAL] = 1;
      expect(setFood(state, MEAL)).toBe(true);
      expect(startCombat(state, 'meadow.hare', 'Strength')).toBe(true);
      const notes: FloatNote[] = [];
      simulate(state, 1200, undefined, { notes });
      if (state.stats.foodEaten !== 1) continue;
      expect(state.bank[MEAL] ?? 0).toBe(0);
      expect(state.hp).toBe(600);
      expect(notes).toContainEqual({ kind: 'heal', amount: 150 });
      healed = true;
    }
    expect(healed).toBe(true);

    const one = newGame(0);
    one.bank[MEAL] = 1;
    expect(sell(one, MEAL, 1)).toBe(true);
    expect(one.coins).toBe(9);
    expect(one.bank[MEAL] ?? 0).toBe(0);

    const two = newGame(0);
    two.bank[MEAL] = 2;
    expect(sell(two, MEAL, 2)).toBe(true);
    expect(two.coins).toBe(18);
    expect(two.bank[MEAL] ?? 0).toBe(0);
  });

  it('T4 gates Fitting appraisal on level 30 and on one meal', () => {
    const low = explorer(29);
    const locked = rowHtml(mainHtml(low, view('Exploration'), 0), 'Fitting appraisal');
    expect(locked).toContain('aria-label="Locked"');
    expect(locked).toContain('Lv 30');
    expect(locked).not.toContain('Pack and go');
    expect(startExpedition(low, FITTING, QUARTER, 0)).toBe(false);

    const bare = explorer(30);
    const blocked = rowHtml(mainHtml(bare, view('Exploration'), 0), 'Fitting appraisal');
    expect(blocked).not.toContain('aria-label="Locked"');
    expect(blocked).toContain('Needs trout-and-mushroom meal (Cooking)');
    expect(blocked).toContain('disabled');
    expect(blocked).toContain('Pack and go');
    expect(blocked).not.toContain('data-pack=');
    expect(startExpedition(bare, FITTING, QUARTER, 0)).toBe(false);

    const stocked = explorer(30);
    stocked.bank[MEAL] = 1;
    const open = rowHtml(mainHtml(stocked, view('Exploration'), 0), 'Fitting appraisal');
    expect(open).toContain('Packs 1 Trout-and-mushroom meal');
    expect(open).toContain('Haul 10,505 XP');
    expect(open).toContain(`data-pack="${FITTING}"`);
    expect(open).not.toContain('disabled');
    expect(startExpedition(stocked, FITTING, QUARTER, 0)).toBe(true);
  });

  it('T5 packs one meal for any length and pays the fitting haul', () => {
    for (const duration of [QUARTER, HOUR, EIGHT]) {
      const state = explorer(30);
      state.bank[MEAL] = 4;
      const before = { ...state.bank };
      expect(startExpedition(state, FITTING, duration, 0)).toBe(true);
      expect(state.bank[MEAL]).toBe(3);
      expect(returnExpedition(state)).toBe(true);
      expect(state.bank[MEAL]).toBe(3);
      expect(state.xp.Exploration).toBe(XP_TABLE[30]);
      for (const id of Object.keys(state.bank)) {
        if (id === MEAL) continue;
        expect(state.bank[id]).toBe(before[id]);
      }
    }

    const quarter = explorer(30);
    quarter.bank[MEAL] = 1;
    expect(startExpedition(quarter, FITTING, QUARTER, 0)).toBe(true);
    creditOffline(quarter, QUARTER);
    expect(quarter.bank[MEAL] ?? 0).toBe(0);
    expect(quarter.xp.Exploration).toBe(XP_TABLE[30] + 10505);
    expect(quarter.mastery[FITTING]).toBe(8977);
    const quarterPreview = expeditionPreview(explorer(30), FITTING, QUARTER);
    expect(quarterPreview).toMatchObject({ ticks: 191, xp: 10505, mxp: 8977, items: [] });

    const hour = explorer(30);
    hour.bank[MEAL] = 1;
    expect(startExpedition(hour, FITTING, HOUR, 0)).toBe(true);
    const hourPreview = expeditionPreview(explorer(30), FITTING, HOUR);
    creditOffline(hour, HOUR);
    expect(hourPreview).toMatchObject({ ticks: 765, xp: 42075, items: [] });
    expect(hour.xp.Exploration).toBe(XP_TABLE[30] + 42075);

    const day = explorer(30);
    day.bank[MEAL] = 1;
    const dayPreview = expeditionPreview(day, FITTING, EIGHT);
    expect(startExpedition(day, FITTING, EIGHT, 0)).toBe(true);
    creditOffline(day, EIGHT);
    // 6,127 × 55 = 336,985 before the level cap. A trip that can start is already level 30, so the cap pays the room.
    expect(dayPreview.ticks).toBe(6127);
    expect(dayPreview.ticks * 55).toBe(336985);
    expect(dayPreview.xp).toBe(XP_CAP - XP_TABLE[30]);
    expect(dayPreview.items).toEqual([]);
    expect(day.xp.Exploration).toBe(XP_CAP);
    expect(Object.keys(day.bank).includes(MEAL)).toBe(false);
  });

  it('T6 toasts the itemless haul in play and shows only the sheet after catch-up', () => {
    const live = explorer(30);
    live.bank[MEAL] = 1;
    expect(startExpedition(live, FITTING, QUARTER, 0)).toBe(true);
    const notes: FloatNote[] = [];
    for (let t = 4_000; t < QUARTER; t += 4_000) advanceOpenTab(live, t, 5_000, []);
    expect(advanceOpenTab(live, QUARTER, 5_000, notes)).toBeNull();
    expect(notes).toContainEqual({ kind: 'toast', text: 'Fitting appraisal is back: 10,505 XP' });
    expect(live.expedition).toBeNull();

    const away = explorer(30);
    away.bank[MEAL] = 1;
    expect(startExpedition(away, FITTING, QUARTER, 0)).toBe(true);
    const quiet: FloatNote[] = [];
    const report = advanceOpenTab(away, QUARTER, 5_000, quiet);
    expect(quiet).toEqual([]);
    expect(report).not.toBeNull();
    const html = reportHtml(report!);
    const xp = html.slice(html.indexOf('<dt>XP</dt>'), html.indexOf('<dt>Levels</dt>'));
    const gained = html.slice(html.indexOf('<dt>Gained</dt>'), html.indexOf('<dt>Consumed</dt>'));
    expect(xp).toContain('Exploration 10,505');
    expect(gained).toContain('none');
    expect(html).not.toContain('is back');
  });

  it('T7 pluralizes this meal and leaves Fish meal alone', () => {
    expect(countedName(1, MEAL)).toBe('1 Trout-and-mushroom meal');
    expect(countedName(2, MEAL)).toBe('2 Trout-and-mushroom meals');
    expect(countedName(1, 'mat.farm.fish_meal')).toBe('1 Fish meal');
    expect(countedName(2, 'mat.farm.fish_meal')).toBe('2 Fish meal');
    expect(itemName('mat.farm.fish_meal')).toBe('Fish meal');

    const state = newGame(0);
    const bank = { ...view(null), tab: 'inventory' as const };
    state.bank[MEAL] = 1;
    expect(mainHtml(state, bank, 0)).toContain('>Trout-and-mushroom meal<');
    state.bank[MEAL] = 2;
    state.bank['mat.farm.fish_meal'] = 2;
    const html = mainHtml(state, bank, 0);
    expect(html).toContain('>Trout-and-mushroom meals<');
    expect(html).toContain('>Fish meal<');
    expect(html).not.toContain('Fish meals');
  });

  it('T8 keeps save format 4 and reloads a banked meal and a packed trip', () => {
    expect(Object.keys(JSON.parse(serialize(newGame(0)))).sort()).toEqual(SAVE_KEYS);
    expect(newGame(0).saveFormat).toBe(4);

    const old = JSON.parse(serialize(newGame(0))) as Record<string, unknown>;
    delete old.expedition;
    old.bank = { [MEAL]: 2 };
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded).not.toBeNull();
    expect(loaded!.saveFormat).toBe(4);
    expect(loaded!.bank[MEAL]).toBe(2);
    expect(loaded!.expedition).toBeNull();
    expect(loaded!.mastery[RECIPE] ?? 0).toBe(0);
    expect(Object.keys(JSON.parse(serialize(loaded!))).sort()).toEqual(SAVE_KEYS);

    const packed = explorer(30);
    packed.bank[MEAL] = 2;
    packed.lastCredited = 5_000;
    expect(startExpedition(packed, FITTING, QUARTER, 5_000)).toBe(true);
    expect(Object.keys(JSON.parse(serialize(packed))).sort()).toEqual(SAVE_KEYS);
    const kept = loadAndCredit(memory(serialize(packed)), 5_000);
    expect(kept.status).toBe('ok');
    expect(kept.state.saveFormat).toBe(4);
    expect(kept.state.bank[MEAL]).toBe(1);
    expect(kept.state.expedition).toEqual({ routeId: FITTING, startedAt: 5_000, durationMs: QUARTER, creditedMs: 0 });
    const again = deserialize(serialize(kept.state));
    expect(again?.bank[MEAL]).toBe(1);
    expect(again?.expedition?.routeId).toBe(FITTING);
    expect(Object.keys(JSON.parse(serialize(again!))).filter((key) => !SAVE_KEYS.includes(key))).toEqual(['savedAt']);
  });

  it('T9 recounts the shipped rows on this tree', () => {
    const nodes = NODES.filter((node) => (node.skill === 'Foraging' || node.skill === 'Exploration') && node.level <= 30);
    const recipes = RECIPES.filter((recipe) =>
      ['Farming', 'Crafting', 'Alchemy', 'Construction', 'Enchanting', 'Exploration'].includes(recipe.skill) && recipe.level <= 30,
    );
    // The meal is Cooking, and its recipe id was already in the list, so this level-30 total does not move.
    expect(nodes).toHaveLength(18);
    expect(recipes).toHaveLength(132);
    expect(nodes.length + recipes.length).toBe(150);
    expect(RECIPES).toHaveLength(249);
    expect(RECIPES.filter((recipe) => recipe.level <= 40 && !recipe.comingLater)).toHaveLength(40 + 131 + 76 + 2 - 6 + 4 + 1);
    expect(RECIPES.filter((recipe) => recipe.skill === 'Cooking' && recipe.level <= 30 && !recipe.comingLater)).toHaveLength(13);
  });

  it('T10 leaves every other recipe, sell, heal and route figure where it was', async () => {
    const bread = RECIPES.find((recipe) => recipe.id === 'recipe.food.wheat_bread');
    const ration = RECIPES.find((recipe) => recipe.id === 'recipe.food.salmon_wheat_ration');
    expect(bread).toMatchObject({ comingLater: true, locked: 'Coming later', seconds: 0, xp: 0 });
    expect(ration).toMatchObject({ locked: 'Needs wheat bread (coming later)', level: 40 });
    expect(ITEMS['food.wheat_bread'].sell).toBe(2);
    expect(ITEMS['food.wheat_bread'].heal).toBe(200);
    expect(ITEMS['food.salmon_wheat_ration'].heal).toBe(250);
    const fitting = RECIPES.find((recipe) => recipe.id === FITTING);
    expect(fitting).toMatchObject({
      seconds: 4.7,
      xp: 55,
      level: 30,
      inputs: [{ id: MEAL, qty: 1 }],
      outputs: [],
    });
    expect(fitting?.locked).toBeUndefined();
    expect(fitting?.comingLater).toBeUndefined();

    const rest = RECIPES.filter((recipe) => recipe.id !== RECIPE).map((recipe) => ({
      id: recipe.id,
      skill: recipe.skill,
      level: recipe.level,
      seconds: recipe.seconds,
      xp: recipe.xp,
      inputs: recipe.inputs,
      outputs: recipe.outputs,
      locked: recipe.id === FITTING ? null : (recipe.locked ?? null),
      comingLater: recipe.comingLater ?? false,
      oneTime: recipe.oneTime ?? false,
      rebuildFee: recipe.rebuildFee ?? null,
      tool: recipe.tool ?? null,
      requiresBuilding: recipe.requiresBuilding ?? null,
    }));
    const sells = Object.entries(ITEMS)
      .map(([id, item]) => [id, id === MEAL ? null : item.sell, item.heal ?? null, item.name])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const nodes = NODES.map((node) => [node.id, node.seconds, node.xp, node.level, node.cost]);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ rest, sells, nodes })));
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    expect(hash).toBe('e5da6cbfc31d771a75ded96bc205b7bb90e5d6ba24f66ebc455f7065e4df02c1');
  });
});
