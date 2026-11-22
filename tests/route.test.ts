import { describe, expect, it } from 'vitest';
import { bestBarRecipe, formatRouteResult, runReferenceRoute } from '../src/route';
import { newGame, skillLevel } from '../src/engine';
import { NODE_BY_ID, XP_TABLE } from '../src/content';
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

  it('plays the section 4 route with gathering stepped at unlock', () => {
    const result = runReferenceRoute({ seed: 1, expectedLoot: true });
    console.log(formatRouteResult(result));
    const second = result.purchases[0];
    const third = result.purchases[1];
    expect(second.skill).toBe('Cooking');
    expect(second.atHours).toBe(0.74);
    expect(third.skill).toBe('Mining');
    expect(third.atHours).toBe(1.24);
    const needed = routeNeed(result);
    expect(needed).toBe(41_878);
    expect(Math.round((result.elapsedMs / 3_600_000) * 1_000_000) / 1_000_000).toBe(39.257123);
    expect(result.elapsedHours).toBe(39.26);
    expect(Math.round(result.earned)).toBe(93_484);
    expect(Math.round(result.earned) - needed).toBe(51_606);
    expect(Math.round(result.grindHours * 1_000_000) / 1_000_000).toBe(0.522573);
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
    expect(result.levels.Woodcutting).toBe(22);
    expect(result.levels.Mining).toBe(33);
    expect(result.levels.Fishing).toBe(30);
    expect(result.levels.Cooking).toBe(30);
    expect(result.levels.Attack).toBe(30);
    expect(result.levels.Strength).toBe(30);
    expect(result.levels.Defence).toBe(30);
    expect(result.levels.Smithing).toBe(30);
    expect(result.levels.Hitpoints).toBe(23);
    expect(result.kills).toBe(2559);
    expect(masteryLevel(result.state.mastery['mat.wood.pine'] ?? 0)).toBe(40);
    expect(masteryLevel(result.state.enemyMastery['meadow.beetle'] ?? 0)).toBe(40);
    expect(result.nodes.map((node) => node.id)).toEqual([
      'mat.wood.maple',
      'mat.mineral.rock_salt',
      'mat.ore.iron',
      'mat.wood.oak',
      'mat.fish.river_shrimp',
      'mat.fish.perch',
      'mat.fish.trout',
    ]);
  });

  it('plays the meadow coin grind on the same stepped route', () => {
    const result = runReferenceRoute({ seed: 1, expectedLoot: true, meadowGrind: true });
    console.log(formatRouteResult(result));
    expect(result.purchases[0]?.atHours).toBe(0.74);
    expect(result.purchases[1]?.atHours).toBe(1.24);
    const needed = routeNeed(result);
    expect(needed).toBe(41_878);
    expect(Math.round((result.elapsedMs / 3_600_000) * 1_000_000) / 1_000_000).toBe(39.138366);
    expect(result.elapsedHours).toBe(39.14);
    expect(Math.round(result.earned)).toBe(92_002);
    expect(Math.round(result.earned) - needed).toBe(50_124);
    expect(Math.round(result.grindHours * 1_000_000) / 1_000_000).toBe(1.424667);
    expect(result.kills).toBe(2555);
    expect(result.levels.Hitpoints).toBe(23);
    expect(result.levels.Woodcutting).toBe(22);
  });

  it('finishes seed 5, including a pause during the ladder climb', () => {
    const meadow = runReferenceRoute({ seed: 5, expectedLoot: true, meadowGrind: true });
    expect(meadow.kills).toBeGreaterThan(0);
    expect(meadow.levels.Strength).toBe(30);
    const pine = runReferenceRoute({ seed: 5, expectedLoot: true });
    expect(pine.kills).toBeGreaterThan(0);
    expect(pine.levels.Strength).toBe(30);
  });
});

function routeNeed(result: { purchases: { price?: number }[]; nodes: { id?: string }[] }): number {
  return (
    result.purchases.reduce((sum, event) => sum + (event.price ?? 0), 0) +
    result.nodes.reduce((sum, event) => sum + (NODE_BY_ID[event.id ?? '']?.cost ?? 0), 0)
  );
}
