import { describe, expect, it } from 'vitest';
import { ENEMIES, NODES, RECIPES, XP_TABLE } from '../src/content';
import {
  advanceOpenTab,
  creditOffline,
  newGame,
  startCombat,
  simulate,
  startProduce,
  stepCompletion,
} from '../src/engine';
import { mainHtml, type View } from '../src/ui';

function farmer() {
  const state = newGame(0);
  state.owned.push('Farming', 'Construction', 'Ranged', 'Magic', 'Hitpoints', 'Attack', 'Strength');
  state.xp.Farming = 0;
  state.xp.Construction = 0;
  state.xp.Ranged = 0;
  state.xp.Magic = 0;
  state.xp.Attack = XP_TABLE[30];
  state.xp.Strength = XP_TABLE[30];
  state.xp.Hitpoints = XP_TABLE[30];
  state.hp = 700;
  state.enemyKills['meadow.beetle'] = 1;
  state.enemyKills['wood.poacher'] = 1;
  return state;
}

describe('B2 production, farming, and combat styles', () => {
  it('ships 149 actions through level 30 before the cap-40 rows', () => {
    const nodes = NODES.filter((node) => (node.skill === 'Foraging' || node.skill === 'Exploration') && node.level <= 30);
    const recipes = RECIPES.filter((recipe) =>
      ['Farming', 'Crafting', 'Alchemy', 'Construction', 'Enchanting', 'Exploration'].includes(recipe.skill) && recipe.level <= 30,
    );
    expect(nodes).toHaveLength(18);
    expect(recipes).toHaveLength(131);
    expect(nodes.length + recipes.length).toBe(149);
    expect(ENEMIES).toHaveLength(11);
  });

  it('grows a crop beside another activity and caps offline growth at 24h', () => {
    const state = farmer();
    state.bank['mat.seed.flax'] = 1;
    expect(startProduce(state, 'recipe.mat.fibre.flax')).toBe(true);
    expect(state.activity).toBeNull();
    expect(state.plot?.recipeId).toBe('recipe.mat.fibre.flax');
    const duration = state.plot?.remainingMs ?? 0;
    advanceOpenTab(state, duration, 5_000, []);
    expect(state.bank['mat.fibre.flax']).toBe(4);
    expect(state.xp.Farming).toBeGreaterThan(0);
    expect(state.plot).toBeNull();

    const away = farmer();
    away.bank['mat.seed.flax'] = 1;
    startProduce(away, 'recipe.mat.fibre.flax');
    const long = away.plot!;
    long.remainingMs = 30 * 60 * 60 * 1000;
    creditOffline(away, 30 * 60 * 60 * 1000);
    expect(away.plot?.remainingMs).toBe(6 * 60 * 60 * 1000);
    expect(away.bank['mat.fibre.flax'] ?? 0).toBe(0);
  });

  it('pays the construction lump once and charges the rebuild fee after that', () => {
    const state = farmer();
    state.bank['mat.wood.pine'] = 20;
    state.coins = 451;
    expect(startProduce(state, 'activity.construction.pine_work_area')).toBe(true);
    const step = stepCompletion(state);
    expect(step.type).toBe('action');
    expect(state.buildings['activity.construction.pine_work_area']).toBe(true);
    expect(state.activity).toBeNull();
    expect(state.bank['mat.wood.pine']).toBe(15);
    expect(state.xp.Construction).toBe(7212);
    expect(state.coins).toBe(451);
    simulate(state, 60_000);
    expect(state.bank['mat.wood.pine']).toBe(15);
    expect(state.xp.Construction).toBe(7212);
    expect(state.coins).toBe(451);
    state.bank['mat.wood.pine'] = 20;
    expect(startProduce(state, 'activity.construction.pine_work_area')).toBe(true);
    expect(state.coins).toBe(0);
    stepCompletion(state);
    expect(state.xp.Construction).toBe(7212);
  });

  it('trains Ranged and Magic for 120 style XP when the catalogue slot is worn', () => {
    const ranged = farmer();
    ranged.bank['ammo.thrown.bronze_knife'] = 8;
    ranged.equipped.weapon = 'ammo.thrown.bronze_knife';
    ranged.xp.Defence = XP_TABLE[30];
    ranged.xp.Hitpoints = 0;
    ranged.hp = 700;
    expect(startCombat(ranged, 'meadow.hare', 'Ranged')).toBe(true);
    stepCompletion(ranged);
    expect(ranged.xp.Ranged).toBe(120);
    expect(ranged.xp.Hitpoints).toBe(24);

    const magic = farmer();
    expect(startCombat(magic, 'meadow.hare', 'Magic')).toBe(false);
    magic.bank['gear.magic.pine_focus'] = 1;
    magic.equipped.weapon = 'gear.magic.pine_focus';
    expect(startCombat(magic, 'meadow.hare', 'Magic')).toBe(true);
    stepCompletion(magic);
    expect(magic.xp.Magic).toBe(120);

    const view: View = {
      tab: 'skill',
      skill: 'Crafting',
      filter: 'all',
      selected: null,
      area: 'Meadow verge',
      style: null,
      message: '',
    };
    const crafter = farmer();
    crafter.owned.push('Crafting');
    crafter.xp.Crafting = 0;
    const html = mainHtml(crafter, view, 0);
    expect(html).toContain('Needs flax fibre (Farming)');
    expect(html).toContain('disabled');
  });
});
