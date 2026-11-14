import { describe, expect, it } from 'vitest';
import { bestBarRecipe, formatRouteResult, runReferenceRoute } from '../src/route';
import { newGame, skillLevel } from '../src/engine';
import { XP_TABLE } from '../src/content';
import { masteryLevel } from '../src/mastery';

describe('reference route', () => {
  it('picks the spec section 4 smithing recipes', () => {
    const state = newGame(0);
    state.owned.push('Smithing');
    state.xp.Smithing = 0;
    expect(bestBarRecipe(state, 'bronze').id).toBe('recipe.mat.head.bronze_arrow');
    state.xp.Smithing = XP_TABLE[2];
    expect(bestBarRecipe(state, 'bronze').id).toBe('recipe.gear.melee.bronze_dagger');
    state.xp.Smithing = XP_TABLE[3];
    expect(bestBarRecipe(state, 'bronze').id).toBe('recipe.gear.melee.bronze_dagger');
    state.xp.Smithing = XP_TABLE[4];
    expect(bestBarRecipe(state, 'bronze').id).toBe('recipe.mat.head.bronze_bolt');
    state.xp.Smithing = XP_TABLE[10];
    expect(bestBarRecipe(state, 'bronze').id).toBe('recipe.mat.fitting.bronze_nail');
    state.xp.Smithing = XP_TABLE[20];
    expect(bestBarRecipe(state, 'iron').id).toBe('recipe.mat.head.iron_arrow');
    expect(skillLevel(state, 'Smithing')).toBe(20);
    state.xp.Smithing = XP_TABLE[22];
    expect(bestBarRecipe(state, 'iron').id).toBe('recipe.ammo.thrown.iron_knife');
  });

  it('plays the section 4 route inside the binding bands', () => {
    const result = runReferenceRoute({ seed: 1, expectedLoot: true });
    console.log(formatRouteResult(result));
    const second = result.purchases[0];
    const third = result.purchases[1];
    expect(second.skill).toBe('Cooking');
    expect(second.atHours).toBeGreaterThanOrEqual(0.494);
    expect(second.atHours).toBeLessThanOrEqual(0.546);
    expect(third.skill).toBe('Mining');
    expect(third.atHours).toBeGreaterThanOrEqual(1.149);
    expect(third.atHours).toBeLessThanOrEqual(1.27);
    expect(result.elapsedHours).toBeGreaterThanOrEqual(16.626);
    expect(result.elapsedHours).toBeLessThanOrEqual(20.458);
    expect(result.earned).toBeGreaterThanOrEqual(49_105);
    expect(result.earned).toBeLessThanOrEqual(59_148);
    const needed =
      result.purchases.reduce((sum, event) => sum + (event.price ?? 0), 0) +
      result.nodes.length * 3000;
    expect(needed).toBe(37002);
    expect(result.purchases.map((event) => event.skill)).toEqual([
      'Cooking',
      'Mining',
      'Smithing',
      'Strength',
      'Defence',
      'Attack',
      'Fishing',
    ]);
    expect(result.state.equipped.weapon).toBe('gear.melee.iron_spear');
    expect(result.state.equipped.body).toBeNull();
    expect(result.state.equipped.shield).toBeNull();
    expect(result.levels.Woodcutting).toBe(30);
    expect(result.levels.Fishing).toBe(30);
    expect(result.levels.Cooking).toBe(30);
    expect(result.levels.Attack).toBe(30);
    expect(result.levels.Strength).toBe(30);
    expect(result.levels.Defence).toBe(30);
    expect(result.levels.Mining).toBe(30);
    expect(result.levels.Smithing).toBe(30);
    expect(result.levels.Hitpoints).toBeGreaterThanOrEqual(22);
    expect(result.levels.Hitpoints).toBeLessThanOrEqual(24);
    expect(result.kills).toBe(2559);
    expect(masteryLevel(result.state.mastery['mat.wood.pine'] ?? 0)).toBe(30);
    expect(masteryLevel(result.state.enemyMastery['meadow.beetle'] ?? 0)).toBe(30);
    expect(result.nodes.map((node) => node.id).sort()).toEqual(
      ['mat.fish.trout', 'mat.ore.iron', 'mat.wood.oak'].sort(),
    );
  });

  it('plays the meadow coin grind inside the same bands', () => {
    const result = runReferenceRoute({ seed: 1, expectedLoot: true, meadowGrind: true });
    console.log(formatRouteResult(result));
    expect(result.elapsedHours).toBeGreaterThanOrEqual(16.626);
    expect(result.elapsedHours).toBeLessThanOrEqual(20.458);
    expect(result.earned).toBeGreaterThanOrEqual(49_105);
    expect(result.earned).toBeLessThanOrEqual(59_148);
    expect(result.kills).toBe(2559);
    expect(result.levels.Hitpoints).toBe(23);
    const needed =
      result.purchases.reduce((sum, event) => sum + (event.price ?? 0), 0) +
      result.nodes.length * 3000;
    expect(needed).toBe(37002);
  });
});
