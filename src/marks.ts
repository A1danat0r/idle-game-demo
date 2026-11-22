/**
 * Display names for the placeholder words live only in MARK_TEXT.
 * Aidan has not named "ley marks" or "glimmer" yet.
 */
export const MARK_TEXT = {
  group: 'Ley marks',
  glimmer: 'Glimmer',
} as const;

export interface MarkDef {
  id: string;
  name: string;
  level: number;
  seconds: number;
  xp: number;
  inputs: { id: string; qty: number }[];
}

export interface ModifierDef {
  id: string;
  markId: string;
  name: string;
  seconds: number;
}

export const MARKS: readonly MarkDef[] = [
  { id: 'grove', name: 'Grove', level: 1, seconds: 2.5, xp: 13, inputs: [{ id: 'mat.enchant.agate_dust', qty: 1 }] },
  { id: 'hearth', name: 'Hearth', level: 10, seconds: 3.0, xp: 16, inputs: [{ id: 'reagent.enchant.binding', qty: 1 }] },
  { id: 'hunt', name: 'Hunt', level: 20, seconds: 3.5, xp: 27, inputs: [{ id: 'reagent.enchant.binding', qty: 1 }, { id: 'mat.binding.flax', qty: 1 }] },
  { id: 'road', name: 'Road', level: 30, seconds: 3.8, xp: 29, inputs: [{ id: 'mat.enchant.agate_dust', qty: 1 }, { id: 'mat.relic.weathered_slate', qty: 1 }] },
];

export const MODIFIERS: readonly ModifierDef[] = [
  { id: 'grove.time', markId: 'grove', name: 'Gathering time', seconds: 2.5 },
  { id: 'grove.sell', markId: 'grove', name: 'Gathering sell', seconds: 2.5 },
  { id: 'grove.forage', markId: 'grove', name: 'Foraging second roll', seconds: 2.5 },
  { id: 'hearth.time', markId: 'hearth', name: 'Production time', seconds: 3.0 },
  { id: 'hearth.xp', markId: 'hearth', name: 'Production XP', seconds: 3.0 },
  { id: 'hearth.free', markId: 'hearth', name: 'Inputs kept', seconds: 3.0 },
  { id: 'hunt.acc', markId: 'hunt', name: 'Accuracy', seconds: 3.5 },
  { id: 'hunt.pow', markId: 'hunt', name: 'Power', seconds: 3.5 },
  { id: 'hunt.grd', markId: 'hunt', name: 'Guard', seconds: 3.5 },
  { id: 'road.grow', markId: 'road', name: 'Farming grow', seconds: 3.8 },
  { id: 'road.yield', markId: 'road', name: 'Farming yield', seconds: 3.8 },
  { id: 'road.haul', markId: 'road', name: 'Expedition haul', seconds: 3.8 },
];

export const MARK_BY_ID: Record<string, MarkDef> = Object.fromEntries(MARKS.map((mark) => [mark.id, mark]));
export const MODIFIER_BY_ID: Record<string, ModifierDef> = Object.fromEntries(MODIFIERS.map((mod) => [mod.id, mod]));

export function markRecipeId(markId: string): string {
  return `recipe.mark.${markId}`;
}

export function markIdFromRecipe(recipeId: string): string | null {
  if (!recipeId.startsWith('recipe.mark.')) return null;
  const id = recipeId.slice('recipe.mark.'.length);
  return MARK_BY_ID[id] ? id : null;
}

/** round(300 × rank ÷ study seconds). Rank is 1–5. */
export function rankCost(studySeconds: number, rank: number): number {
  return Math.round((300 * rank) / studySeconds);
}

export function modifiersFor(markId: string): ModifierDef[] {
  return MODIFIERS.filter((mod) => mod.markId === markId);
}

const GATHERING = new Set(['Woodcutting', 'Fishing', 'Mining', 'Foraging']);
const PRODUCTION = new Set(['Cooking', 'Smithing', 'Crafting', 'Alchemy']);

export function isGatheringSkill(skill: string): boolean {
  return GATHERING.has(skill);
}

export function hearthAppliesToRecipe(recipe: { skill: string; outputs: { id: string }[] }): boolean {
  if (PRODUCTION.has(recipe.skill)) return true;
  return recipe.skill === 'Construction' && recipe.outputs.some((output) => output.id.startsWith('con.kit.'));
}

/** Seal recipes retired from the shipped tables. Kept so one old catch-up can still resolve them. */
export const RETIRED_SEALS: Record<string, { id: string; level: number; seconds: number; xp: number; inputs: { id: string; qty: number }[]; outputs: { id: string; qty: number }[] }> = {
  'recipe.seal.enchant.accuracy': { id: 'recipe.seal.enchant.accuracy', level: 1, seconds: 2.7, xp: 14, inputs: [{ id: 'reagent.enchant.binding', qty: 1 }, { id: 'mat.binding.flax', qty: 1 }], outputs: [{ id: 'seal.enchant.accuracy', qty: 1 }] },
  'recipe.seal.enchant.guard': { id: 'recipe.seal.enchant.guard', level: 10, seconds: 3.0, xp: 16, inputs: [{ id: 'reagent.enchant.binding', qty: 1 }, { id: 'mat.relic.weathered_slate', qty: 1 }], outputs: [{ id: 'seal.enchant.guard', qty: 1 }] },
  'recipe.seal.enchant.ward': { id: 'recipe.seal.enchant.ward', level: 12, seconds: 3.2, xp: 17, inputs: [{ id: 'reagent.enchant.binding', qty: 1 }, { id: 'mat.enchant.agate_dust', qty: 1 }, { id: 'mat.reagent.spell_moss', qty: 1 }], outputs: [{ id: 'seal.enchant.ward', qty: 1 }] },
  'recipe.seal.enchant.steady_cast': { id: 'recipe.seal.enchant.steady_cast', level: 20, seconds: 3.5, xp: 27, inputs: [{ id: 'reagent.enchant.binding', qty: 1 }, { id: 'mat.tree.resin', qty: 1 }, { id: 'mat.enchant.agate_dust', qty: 1 }], outputs: [{ id: 'seal.enchant.steady_cast', qty: 1 }] },
  'recipe.seal.enchant.alignment': { id: 'recipe.seal.enchant.alignment', level: 30, seconds: 3.8, xp: 29, inputs: [{ id: 'mat.crystal.quartz', qty: 1 }, { id: 'reagent.enchant.binding', qty: 1 }], outputs: [{ id: 'seal.enchant.alignment', qty: 1 }] },
  'recipe.seal.enchant.scorch': { id: 'recipe.seal.enchant.scorch', level: 40, seconds: 4.4, xp: 59, inputs: [{ id: 'mat.herb.emberleaf', qty: 1 }, { id: 'mat.fuel.charcoal', qty: 1 }, { id: 'reagent.enchant.binding', qty: 1 }], outputs: [{ id: 'seal.enchant.scorch', qty: 1 }] },
};

export function retiredSeal(id: string) {
  return RETIRED_SEALS[id] ?? null;
}
