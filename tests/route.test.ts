import { describe, expect, it } from 'vitest';
import { bestBarRecipe, formatRouteResult, runReferenceRoute } from '../src/route';
import { newGame, skillLevel } from '../src/engine';
import { XP_TABLE } from '../src/content';

describe('reference route', () => {
  it('picks the spec section 4 smithing recipes', () => {
    const state = newGame(0);
    state.owned.push('Smithing');
    state.xp.Smithing = 0;
    expect(bestBarRecipe(state, 'bronze').id).toBe('recipe.mat.head.bronze_arrow');
    state.xp.Smithing = XP_TABLE[2];
    expect(bestBarRecipe(state, 'bronze').id).toBe('recipe.gear.melee.bronze_dagger');
    state.xp.Smithing = XP_TABLE[3];
    expect(bestBarRecipe(state, 'bronze').id).toBe('recipe.ammo.thrown.bronze_knife');
    state.xp.Smithing = XP_TABLE[4];
    expect(bestBarRecipe(state, 'bronze').id).toBe('recipe.mat.head.bronze_bolt');
    state.xp.Smithing = XP_TABLE[10];
    expect(bestBarRecipe(state, 'bronze').id).toBe('recipe.mat.fitting.bronze_nail');
    state.xp.Smithing = XP_TABLE[20];
    expect(bestBarRecipe(state, 'iron').id).toBe('recipe.mat.head.iron_arrow');
    expect(skillLevel(state, 'Smithing')).toBe(20);
  });

  it('plays the section 4 route inside the binding bands', () => {
    const result = runReferenceRoute({ seed: 1, expectedLoot: true });
    console.log(formatRouteResult(result));
    const second = result.purchases[0];
    const third = result.purchases[1];
    expect(second.skill).toBe('Cooking');
    expect(second.atHours).toBeGreaterThanOrEqual(0.513);
    expect(second.atHours).toBeLessThanOrEqual(0.567);
    expect(third.skill).toBe('Mining');
    expect(third.atHours).toBeGreaterThanOrEqual(1.197);
    expect(third.atHours).toBeLessThanOrEqual(1.323);
    expect(result.elapsedHours).toBeGreaterThanOrEqual(16.967);
    expect(result.elapsedHours).toBeLessThanOrEqual(18.753);
    expect(result.earned).toBeGreaterThanOrEqual(31730);
    expect(result.earned).toBeLessThanOrEqual(35070);
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
    expect(result.nodes.map((node) => node.id).sort()).toEqual(
      ['mat.fish.trout', 'mat.ore.iron', 'mat.wood.oak'].sort(),
    );
  });
});
