import { describe, expect, it } from 'vitest';
import { TOOL_TIME_FACTOR, XP_TABLE } from '../src/content';
import {
  actionSeconds,
  deserialize,
  dismantleBuilding,
  moveBuilding,
  newGame,
  placeBuilding,
  serialize,
  setSkillLevel,
  startProduce,
  stopActivity,
  stepCompletion,
  storeBuilding,
  type Save,
} from '../src/engine';
import { runReferenceRoute } from '../src/route';
import { mainHtml, type View } from '../src/ui';
import { openYardTiles } from '../src/yard';

const PINE = 'activity.construction.pine_work_area';
const FOUNDATION = 'activity.construction.stone_foundation';
const OAK = 'activity.construction.oak_workshop';
const RACKS = 'activity.construction.supply_racks';
const FORGE = 'activity.construction.forge_extension';
const BOW = 'recipe.gear.ranged.pine_shortbow';

function builder(level: number): Save {
  const state = newGame(0);
  setSkillLevel(state, 'Construction', level);
  return state;
}

function landScreen(state: Save): string {
  const view: View = {
    tab: 'skill',
    skill: 'Construction',
    land: true,
    filter: 'all',
    selected: null,
    area: 'Meadow verge',
    style: null,
    message: '',
  };
  return mainHtml(state, view, 0);
}

function withoutLand(state: Save): Save {
  return loadLand(state, undefined);
}

function loadLand(state: Save, land: unknown): Save {
  const raw = JSON.parse(serialize(state)) as Record<string, unknown>;
  delete raw.yardNote;
  if (land === undefined) delete raw.land;
  else raw.land = land;
  const loaded = deserialize(JSON.stringify(raw));
  if (!loaded) throw new Error('save did not load');
  return loaded;
}

describe('construction yard', () => {
  it('opens one tile at Construction 1 and applies the crafting step only while the pine work area is placed', () => {
    const state = builder(1);
    expect(openYardTiles(1)).toBe(1);
    state.bank['mat.wood.pine'] = 5;
    expect(startProduce(state, PINE)).toBe(true);
    stepCompletion(state);
    expect(state.buildings[PINE]).toBe(true);
    expect(Object.values(state.land)).not.toContain(PINE);
    expect(actionSeconds(state, BOW)).toBeCloseTo(4.1);
    expect(placeBuilding(state, PINE, 0)).toBe(true);
    expect(actionSeconds(state, BOW)).toBeCloseTo(4.1 * 0.937);
    expect(storeBuilding(state, 0)).toBe(true);
    expect(actionSeconds(state, BOW)).toBeCloseTo(4.1);
    expect(state.land[0]).toBeUndefined();
  });

  it('stacks both crafting buildings while they are placed', () => {
    const state = builder(15);
    state.buildings[PINE] = true;
    state.buildings[OAK] = true;
    expect(placeBuilding(state, PINE, 0)).toBe(true);
    expect(placeBuilding(state, OAK, 1)).toBe(true);
    expect(actionSeconds(state, BOW)).toBeCloseTo(4.1 * TOOL_TIME_FACTOR ** 2);
    expect(actionSeconds(state, BOW)).toBeCloseTo(3.599673, 5);
  });

  it('keeps only one step at Construction 14 when pine and the foundation are both built', () => {
    const state = builder(14);
    state.buildings[PINE] = true;
    state.buildings[FOUNDATION] = true;
    const loaded = withoutLand(state);
    expect(openYardTiles(14)).toBe(1);
    expect(loaded.land['0']).toBe(PINE);
    expect(Object.values(loaded.land)).not.toContain(FOUNDATION);
    expect(actionSeconds(loaded, BOW)).toBeCloseTo(4.1 * 0.937);
    expect(actionSeconds(loaded, 'recipe.food.roast_hare')).toBeCloseTo(2.2);
    expect(loaded.yardNote).toContain('1 tile');
    expect(loaded.yardNote).toContain('Stone foundation');
  });

  it('migrates a Construction 40 save onto 4 tiles and leaves the forge in the store', () => {
    const state = builder(40);
    for (const id of [PINE, FOUNDATION, OAK, RACKS, FORGE]) {
      state.buildings[id] = true;
      state.buildingsEver[id] = true;
    }
    const loaded = withoutLand(state);
    expect(openYardTiles(40)).toBe(4);
    expect(loaded.land['0']).toBe(PINE);
    expect(loaded.land['1']).toBe(FOUNDATION);
    expect(loaded.land['2']).toBe(OAK);
    expect(loaded.land['3']).toBe(RACKS);
    expect(Object.values(loaded.land)).not.toContain(FORGE);
    expect(actionSeconds(loaded, 'recipe.mat.bar.bronze')).toBeCloseTo(3.9);
    expect(loaded.yardNote).toBe('Your yard has 4 tiles; Steel forge extension is in the store.');
    expect(loaded.buildings[FORGE]).toBe(true);
    expect(loaded.buildingsEver[FORGE]).toBe(true);
    expect(loaded.saveFormat).toBe(4);
  });

  it('rebuilds a forge from the store when the foundation is stored, and keeps a rebuilt pine on its tile', () => {
    const stored = builder(40);
    stored.buildings[FOUNDATION] = true;
    stored.buildingsEver[FOUNDATION] = true;
    stored.buildings[FORGE] = true;
    stored.buildingsEver[FORGE] = true;
    stored.bank['con.kit.hearth_block'] = 3;
    stored.coins = 1126;
    expect(Object.values(stored.land)).not.toContain(FOUNDATION);
    expect(startProduce(stored, FORGE)).toBe(true);
    expect(stored.coins).toBe(0);
    expect(stored.activity).toEqual({ kind: 'produce', recipeId: FORGE });

    const pine = builder(1);
    pine.bank['mat.wood.pine'] = 10;
    pine.coins = 451;
    expect(startProduce(pine, PINE)).toBe(true);
    stepCompletion(pine);
    expect(placeBuilding(pine, PINE, 0)).toBe(true);
    const xp = pine.xp.Construction;
    pine.bank['mat.wood.pine'] = 5;
    expect(startProduce(pine, PINE)).toBe(true);
    expect(pine.coins).toBe(0);
    stepCompletion(pine);
    expect(pine.xp.Construction).toBe(xp);
    expect(pine.bank['mat.wood.pine'] ?? 0).toBe(0);
    expect(pine.land['0']).toBe(PINE);
  });

  it('dismantles a placed oak workshop, frees the tile, and rebuilds for 626', () => {
    const state = builder(20);
    state.buildings[OAK] = true;
    state.buildingsEver[OAK] = true;
    expect(placeBuilding(state, OAK, 0)).toBe(true);
    state.coins = 626;
    state.bank['con.kit.oak_bench'] = 0;
    expect(dismantleBuilding(state, OAK)).toBe(true);
    expect(state.bank['con.kit.oak_bench']).toBe(1);
    expect(state.land['0']).toBeUndefined();
    expect(state.buildings[OAK]).toBeUndefined();
    expect(state.buildingsEver[OAK]).toBe(true);
    state.bank['con.kit.oak_bench'] = 3;
    expect(startProduce(state, OAK)).toBe(true);
    expect(state.coins).toBe(0);
    expect(state.activity?.kind).toBe('produce');
  });

  it('changes no coins, XP, or items when a building is placed, moved, or stored', () => {
    const state = builder(15);
    state.buildings[PINE] = true;
    state.buildings[OAK] = true;
    state.coins = 40;
    state.bank['mat.wood.pine'] = 3;
    const xp = state.xp.Construction;
    expect(placeBuilding(state, PINE, 0)).toBe(true);
    expect(moveBuilding(state, 0, 1)).toBe(true);
    expect(storeBuilding(state, 1)).toBe(true);
    expect(state.coins).toBe(40);
    expect(state.xp.Construction).toBe(xp);
    expect(state.bank['mat.wood.pine']).toBe(3);
    expect(placeBuilding(state, PINE, 8)).toBe(false);
    expect(placeBuilding(state, 'activity.construction.practice_workshop_assembly', 0)).toBe(false);
    expect(placeBuilding(state, PINE, 0)).toBe(true);
    state.activity = { kind: 'produce', recipeId: PINE };
    expect(moveBuilding(state, 0, 1)).toBe(false);
    expect(storeBuilding(state, 0)).toBe(false);
    expect(dismantleBuilding(state, PINE)).toBe(false);
  });

  it('labels later tiles with their gate and keeps Coming later on the five that never open', () => {
    const closed = (level: number) => landScreen(builder(level));
    for (const level of [35, 40]) {
      const land = closed(level);
      expect(land.match(/Coming later/g)).toHaveLength(5);
      expect(land).not.toContain('Construction 15');
      expect(land).not.toContain('Construction 25');
      expect(land).not.toContain('Construction 35');
    }
    const early = closed(14);
    expect(early).toContain('data-yard-tile="1"><small>Construction 15</small>');
    expect(early).toContain('data-yard-tile="2"><small>Construction 25</small>');
    expect(early).toContain('data-yard-tile="3"><small>Construction 35</small>');
  });

  it('refuses to place the building that is being rebuilt and still places the others', () => {
    const state = builder(15);
    state.buildings[PINE] = true;
    state.buildings[FOUNDATION] = true;
    state.activity = { kind: 'produce', recipeId: PINE };
    const before = { ...state.land };
    expect(placeBuilding(state, PINE, 0)).toBe(false);
    expect(state.land).toEqual(before);
    expect(placeBuilding(state, FOUNDATION, 1)).toBe(true);
    stopActivity(state);
    expect(placeBuilding(state, PINE, 0)).toBe(true);
  });

  it('keeps an explicit empty yard empty and migrates land null like a missing key', () => {
    const state = builder(40);
    for (const id of [PINE, FOUNDATION, OAK, RACKS, FORGE]) {
      state.buildings[id] = true;
      state.buildingsEver[id] = true;
    }
    const empty = loadLand(state, {});
    expect(empty.land).toEqual({});
    expect(empty.yardNote).toBeUndefined();
    expect(actionSeconds(empty, BOW)).toBeCloseTo(4.1);
    const again = deserialize(serialize(empty));
    if (!again) throw new Error('save did not load');
    expect(again.land).toEqual({});
    expect(again.yardNote).toBeUndefined();
    expect(actionSeconds(again, BOW)).toBeCloseTo(4.1);

    const migrated = loadLand(state, null);
    expect(migrated.land['0']).toBe(PINE);
    expect(migrated.land['1']).toBe(FOUNDATION);
    expect(migrated.land['2']).toBe(OAK);
    expect(migrated.land['3']).toBe(RACKS);
    expect(migrated.yardNote).toBe('Your yard has 4 tiles; Steel forge extension is in the store.');
  });

  it('shows open tiles, locked tiles, the store, and Placed or In store', () => {
    const state = builder(1);
    state.buildings[PINE] = true;
    const land = landScreen(state);
    expect(land.match(/data-yard-tile=/g)).toHaveLength(9);
    expect(land).toContain('Empty');
    expect(land).toContain('Construction 15');
    expect(land).toContain('Coming later');
    expect(land).toContain('data-yard-arm');
    expect(land).toContain('Pine work area');
    const activity = mainHtml(state, { ...blankView(), skill: 'Construction', tab: 'skill' }, 0);
    expect(activity).toContain('In store');
    expect(placeBuilding(state, PINE, 0)).toBe(true);
    const placed = mainHtml(state, { ...blankView(), skill: 'Construction', tab: 'skill' }, 0);
    expect(placed).toContain('Placed');
    const yard = landScreen(state);
    expect(yard).toContain('Crafting ×0.937');
    expect(yard).toContain('The store is empty.');
  });

  it('leaves the official routes and their 37,002 coin need where the repo has them', () => {
    const route = runReferenceRoute({ seed: 1, expectedLoot: true });
    expect(route.purchases.map((event) => event.skill)).not.toContain('Construction');
    expect(route.elapsedHours).toBe(20.42);
    expect(routeNeed(route)).toBe(37002);
    expect(route.state.buildings[PINE]).toBeUndefined();
    const meadow = runReferenceRoute({ seed: 1, expectedLoot: true, meadowGrind: true });
    expect(meadow.elapsedHours).toBe(18.76);
    expect(routeNeed(meadow)).toBe(37002);
    expect(XP_TABLE[40]).toBe(220234);
  });
});

function blankView(): View {
  return {
    tab: 'skill',
    skill: 'Construction',
    filter: 'all',
    selected: null,
    area: 'Meadow verge',
    style: null,
    message: '',
  };
}

function routeNeed(result: { purchases: { price?: number }[]; nodes: unknown[] }): number {
  return result.purchases.reduce((sum, event) => sum + (event.price ?? 0), 0) + result.nodes.length * 3000;
}
