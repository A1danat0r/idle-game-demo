import { RECIPE_BY_ID } from './content';

/** Per harvest = today's per-action produce, XP, and mastery XP × 3,600 ÷ 8. */
export const HARVEST_FACTOR = 3600 / 8;
/** Grow time = the shipped action seconds × 3,600. */
export const GROW_SCALE = 3600;
/** Bone compost shortens one grow. The same factor as a tool or building step. */
export const BONE_GROW_FACTOR = 0.937;

export const PLOT_COUNT = 8;
export const COMPOST_ITEM_ID = 'mat.farm.compost';
export const BONE_COMPOST_ITEM_ID = 'mat.farm.bone_compost';
export const COMPOST_RECIPES = ['recipe.farm.compost', 'recipe.farm.bone_compost'] as const;

export type CompostKind = 'compost' | 'bone' | null;

/** Interim until compost-on-replant is answered. Replant passes this and nothing else. */
export const AUTO_REPLANT_COMPOST = false;

/** Skill-slot 9 price. No Farming level gate. */
export const AUTO_REPLANT_COST = 27_822;

/** Paid plots 2–8. round(750 × (level / 10)²). Plot 1 is free with Farming. */
export const PLOT_GATES: readonly { plot: number; level: number; cost: number }[] = [
  { plot: 2, level: 5, cost: 188 },
  { plot: 3, level: 10, cost: 750 },
  { plot: 4, level: 15, cost: 1688 },
  { plot: 5, level: 20, cost: 3000 },
  { plot: 6, level: 25, cost: 4688 },
  { plot: 7, level: 30, cost: 6750 },
  { plot: 8, level: 35, cost: 9188 },
];

/** A Farming recipe that is planted on a plot. Compost mixing stays a selected action. */
export function isPlotCrop(recipeId: string): boolean {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe || recipe.skill !== 'Farming') return false;
  return !(COMPOST_RECIPES as readonly string[]).includes(recipeId);
}

/**
 * Wall-clock grow for one planting.
 * Base is the shipped seconds × 3,600. The mastery speed step (0.05 once that
 * recipe is mastery 20+) is snapshotted at planting. Bone compost then ×0.937.
 * MXP does not use this shorter time.
 */
export function plotGrowMs(actionSeconds: number, compost: CompostKind, speed = 0): number {
  let seconds = actionSeconds * GROW_SCALE * (1 - speed);
  if (compost === 'bone') seconds *= BONE_GROW_FACTOR;
  return (Math.round(seconds * 100) / 100) * 1000;
}

/** Produce from one harvest. Compost and bone compost both multiply yield by 1.25. */
export function harvestProduce(baseQty: number, compost: CompostKind): number {
  const scaled = Math.round(baseQty * HARVEST_FACTOR);
  if (compost === 'compost' || compost === 'bone') return Math.round(scaled * 1.25);
  return scaled;
}

export function harvestXp(baseXp: number): number {
  return Math.round(baseXp * HARVEST_FACTOR);
}
