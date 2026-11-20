import { describe, expect, it } from 'vitest';
import { CAP40_NODES, CAP40_RECIPES } from '../src/cap40';
import {
  ITEMS,
  LEVEL_CAP,
  NODES,
  RECIPES,
  XP_CAP,
  XP_TABLE,
} from '../src/content';
import { addXp, equip, newGame, startProduce, stepCompletion } from '../src/engine';
import { MASTERY_CAP, masteryLevel, masteryThreshold } from '../src/mastery';
import { mainHtml, type View } from '../src/ui';

describe('demo skill cap 40', () => {
  it('stops skill XP at level 40 and keeps paying items', () => {
    expect(LEVEL_CAP).toBe(40);
    expect(XP_TABLE[40]).toBe(220234);
    expect(XP_TABLE[40] - XP_TABLE[30]).toBe(117933);
    expect(XP_TABLE[40] - XP_TABLE[39]).toBe(15788);
    const state = newGame(0);
    state.xp.Woodcutting = XP_CAP;
    expect(addXp(state, 'Woodcutting', 42)).toBe(0);
    expect(state.xp.Woodcutting).toBe(XP_CAP);
    state.activity = { kind: 'gather', nodeId: 'mat.wood.pine' };
    state.progressMs = 0;
    stepCompletion(state);
    expect(state.bank['mat.wood.pine']).toBe(1);
    expect(state.xp.Woodcutting).toBe(XP_CAP);
  });

  it('adds the gap nodes, the 31–40 rows, and both sickles', () => {
    expect(CAP40_NODES).toHaveLength(16);
    expect(CAP40_RECIPES).toHaveLength(76);
    expect(CAP40_NODES.length + CAP40_RECIPES.length).toBe(92);
    expect(NODES).toHaveLength(50);
    expect(RECIPES.filter((recipe) => !recipe.comingLater)).toHaveLength(40 + 131 + 76 + 2 - 6 + 4 + 1);
    for (const [id, seconds, xp, cost] of [
      ['mat.fish.eel', 4.6, 107, 6750],
      ['mat.crystal.quartz', 4.2, 98, 6750],
      ['mat.tree.bark_strip', 3.7, 86, 6750],
      ['mat.wood.willow_rods', 3.8, 88, 6750],
    ] as const) {
      expect(NODES.find((node) => node.id === id)).toMatchObject({ seconds, xp, cost, level: 30 });
      expect(ITEMS[id].sell).toBe(10);
    }
    expect(NODES.find((node) => node.id === 'mat.fuel.coal')).toMatchObject({ level: 40, seconds: 4.6, xp: 185, cost: 12000 });
    expect(NODES.find((node) => node.id === 'mat.fruit.plum')?.cost).toBe(8168);
    expect(RECIPES.find((recipe) => recipe.id === 'recipe.tool.foraging.bronze_sickle')).toMatchObject({
      skill: 'Smithing',
      level: 2,
      seconds: 3.6,
      xp: 29,
      inputs: [{ id: 'mat.bar.bronze', qty: 1 }, { id: 'mat.binding.flax', qty: 1 }],
    });
    expect(RECIPES.find((recipe) => recipe.id === 'recipe.tool.foraging.iron_sickle')).toMatchObject({
      level: 21,
      seconds: 4.6,
      xp: 53,
      inputs: [{ id: 'mat.bar.iron', qty: 1 }, { id: 'mat.binding.flax', qty: 1 }],
    });
    expect(ITEMS['tool.foraging.bronze_sickle'].sell).toBe(9);
    expect(ITEMS['tool.foraging.iron_sickle'].sell).toBe(32);
    const forge = RECIPES.find((recipe) => recipe.id === 'activity.construction.forge_extension');
    expect(forge).toMatchObject({
      seconds: 6.8,
      xp: 18126,
      rebuildFee: 1126,
      requiresBuilding: 'activity.construction.stone_foundation',
      inputs: [{ id: 'con.kit.hearth_block', qty: 3 }],
    });
  });

  it('shows Quarry and Undercroft rows and keeps their actions disabled', () => {
    const locked = RECIPES.filter((recipe) => recipe.locked?.includes('Quarry'));
    expect(locked).toHaveLength(21);
    expect(locked.filter((recipe) => recipe.locked?.includes('Quarry approaches'))).toHaveLength(8);
    expect(locked.filter((recipe) => recipe.locked?.includes('Quarry Undercroft'))).toHaveLength(13);
    const state = newGame(0);
    state.owned.push('Smithing', 'Crafting');
    state.xp.Smithing = XP_TABLE[40];
    state.xp.Crafting = XP_TABLE[40];
    state.bank['mat.bar.iron'] = 10;
    state.bank['mat.binding.flax'] = 10;
    state.bank['mat.combat.horn'] = 10;
    expect(startProduce(state, 'recipe.gear.melee.horn_hafted_mace')).toBe(false);
    const view: View = {
      tab: 'skill',
      skill: 'Smithing',
      filter: 'all',
      selected: null,
      area: 'Meadow verge',
      style: null,
      message: '',
    };
    const html = mainHtml(state, view, 0);
    expect(html).toContain('Needs ram horn (Quarry approaches)');
    expect(html).toContain('Needs Undercroft iron (Quarry Undercroft)');
    expect(html).toContain('disabled');
  });

  it('shows mastery up to 40 and keeps MXP past 114,027', () => {
    expect(MASTERY_CAP).toBe(40);
    expect(masteryThreshold(31)).toBe(67472);
    expect(masteryThreshold(40)).toBe(114027);
    expect(masteryLevel(114027)).toBe(40);
    expect(masteryLevel(114028)).toBe(40);
    const state = newGame(0);
    state.mastery['mat.wood.pine'] = 114027;
    state.activity = { kind: 'gather', nodeId: 'mat.wood.pine' };
    stepCompletion(state);
    expect(state.mastery['mat.wood.pine']).toBeGreaterThan(114027);
    expect(masteryLevel(state.mastery['mat.wood.pine'])).toBe(40);
  });

  it('lets a Magic focus share the weapon slot with a shield, and a bow clears the shield', () => {
    const state = newGame(0);
    state.bank['gear.magic.pine_focus'] = 1;
    state.bank['gear.shield.bronze'] = 1;
    state.bank['gear.ranged.pine_shortbow'] = 1;
    expect(equip(state, 'gear.shield.bronze')).toBe(true);
    expect(equip(state, 'gear.magic.pine_focus')).toBe(true);
    expect(state.equipped).toMatchObject({ weapon: 'gear.magic.pine_focus', shield: 'gear.shield.bronze' });
    expect(equip(state, 'gear.ranged.pine_shortbow')).toBe(true);
    expect(state.equipped.shield).toBeNull();
    expect(state.equipped.weapon).toBe('gear.ranged.pine_shortbow');
    expect(equip(state, 'gear.shield.bronze')).toBe(true);
    expect(state.equipped.weapon).toBeNull();
    expect(state.equipped.shield).toBe('gear.shield.bronze');
  });
});
