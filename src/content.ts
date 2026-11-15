import { CAP40_ITEMS, CAP40_NODES, CAP40_RECIPES } from './cap40';
import { T310_SELLS } from './sells';
import { SLICE_ITEMS, SLICE_RECIPES } from './slice';

/**
 * Paid node cost. Lv-1 nodes are free. The level gate is unchanged:
 * a node can be bought only once its level is reached.
 * round(3000 × (level/20)²).
 */
export function nodeCost(level: number): number {
  if (level <= 1) return 0;
  return Math.round(3000 * (level / 20) ** 2);
}

/** Cumulative XP required to be each level. Level 1 is 0. Index 0 is unused. */
export const XP_TABLE: readonly number[] = [
  0, 0, 1138, 2358, 3665, 5065, 6567, 8175, 9899, 11747, 13726, 15848, 18122, 20559, 23170, 25968,
  28967, 32181, 35626, 39317, 43272, 47511, 52054, 56922, 62139, 67730, 73722, 80143, 87024, 94398,
  102301, 110770, 119846, 129572, 139996, 151166, 163136, 175965, 189713, 204446,
  220234,
];

/** E1 cumulative XP for level 40. Past this, the action still produces items and coins. */
export const XP_CAP = XP_TABLE[40];
export const LEVEL_CAP = 40;

/**
 * Skill purchase k (1-based) is index k-1.
 * SC(1) = 750. SC(k) = round(750 × 1.3819300421 × 1.6^(k−2)) for k ≥ 2.
 * The demo buys the first 7. Later slots are the same rule and are not purchased.
 */
export const SKILL_PRICES: readonly number[] = [
  750, 1036, 1658, 2653, 4245, 6792, 10868, 17389, 27822, 44515, 71224, 113959, 182334, 291734,
  466774, 746839, 1194943,
];

/**
 * Purchases the demo can make. Woodcutting and Hitpoints are never purchases.
 * The seven current paid skills plus the nine new ones.
 */
export const DEMO_PURCHASE_SLOTS = 16;

export const SKILL_IDS = [
  'Woodcutting',
  'Fishing',
  'Cooking',
  'Attack',
  'Strength',
  'Defence',
  'Ranged',
  'Magic',
  'Mining',
  'Smithing',
  'Foraging',
  'Farming',
  'Crafting',
  'Alchemy',
  'Construction',
  'Enchanting',
  'Exploration',
  'Hitpoints',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const COMBAT_STYLES = ['Attack', 'Strength', 'Defence', 'Ranged', 'Magic'] as const;
export type CombatStyle = (typeof COMBAT_STYLES)[number];

/**
 * Skills grouped at the top of the Skills screen.
 * Attack, Strength and Defence are the fight styles. Hitpoints is granted with the
 * first of those and is neither a gathering nor a production skill.
 */
export const COMBAT_SKILLS = ['Attack', 'Strength', 'Defence', 'Ranged', 'Magic', 'Hitpoints'] as const;

export const GATHER_SKILLS = ['Woodcutting', 'Fishing', 'Mining', 'Foraging', 'Farming', 'Exploration'] as const;
export const PRODUCE_SKILLS = ['Cooking', 'Smithing', 'Crafting', 'Alchemy', 'Construction', 'Enchanting'] as const;

/** Six tabs, with the new skills grouped inside the existing three lists. */
export const SKILL_GROUPS = [
  { name: 'Combat', skills: COMBAT_SKILLS },
  { name: 'Gathering', skills: GATHER_SKILLS },
  { name: 'Production', skills: PRODUCE_SKILLS },
] as const;

export function isCombatStyle(skill: SkillId): skill is CombatStyle {
  return (COMBAT_STYLES as readonly string[]).includes(skill);
}

/** Thrown weapons and bows occupy the weapon slot. A focus does too: it is one-handed, not the shield. */
export function weaponFitsStyle(itemId: string, style: CombatStyle): boolean {
  if (style === 'Ranged') return itemId.startsWith('gear.ranged.') || itemId.startsWith('ammo.thrown.');
  if (style === 'Magic') return itemId.startsWith('gear.magic.');
  return itemId.startsWith('gear.melee.');
}

/** Buying any fight style grants Hitpoints. Ranged and Magic are fight styles even before their weapons are in. */
export function grantsHitpoints(skill: SkillId): boolean {
  return skill === 'Attack' || skill === 'Strength' || skill === 'Defence' || skill === 'Ranged' || skill === 'Magic';
}

export type ItemKind = 'material' | 'food' | 'gear' | 'tool' | 'ammo';

export interface ItemDef {
  id: string;
  name: string;
  sell: number;
  kind: ItemKind;
  /** Heal amount for auto-eat foods. */
  heal?: number;
  /** Weapon Accuracy. Added to Attack in player hit chance. */
  acc?: number;
  /** Weapon Power. Added to Strength in hits per kill. */
  pow?: number;
  /** Body or shield Guard. Added to Defence in enemy hit chance. */
  grd?: number;
  icon: IconName;
}

export type IconName =
  | 'log'
  | 'ore'
  | 'fish'
  | 'meat'
  | 'herb'
  | 'berry'
  | 'hide'
  | 'food'
  | 'sword'
  | 'bow'
  | 'staff'
  | 'shield'
  | 'body'
  | 'bar'
  | 'gem'
  | 'stone'
  | 'axe'
  | 'pick'
  | 'coin'
  | 'ammo'
  | 'part'
  | 'moss'
  | 'idle';

export const ITEMS: Record<string, ItemDef> = {};

function item(def: ItemDef): ItemDef {
  ITEMS[def.id] = def;
  return def;
}

export interface Stack {
  id: string;
  qty: number;
}

export interface NodeDef {
  id: string;
  skill: 'Woodcutting' | 'Fishing' | 'Mining' | 'Foraging' | 'Exploration';
  level: number;
  seconds: number;
  xp: number;
  /** Free at level 1. Otherwise nodeCost(level). */
  cost: number;
}

export interface RecipeDef {
  id: string;
  skill: 'Woodcutting' | 'Cooking' | 'Smithing' | 'Crafting' | 'Alchemy' | 'Construction' | 'Enchanting' | 'Farming' | 'Exploration';
  level: number;
  seconds: number;
  xp: number;
  inputs: Stack[];
  outputs: Stack[];
  /** Tool recipes are reusable. The output is not consumed by gathering. */
  tool?: { skill: 'Woodcutting' | 'Mining' | 'Fishing' | 'Foraging'; tier: number };
  /** One-time Construction build. A later completion is a rebuild. */
  oneTime?: boolean;
  /** Coins charged to rebuild a one-time structure. No XP on a rebuild. */
  rebuildFee?: number;
  /** Visible row whose action stays disabled. The copy names the missing area or input. */
  locked?: string;
  /** One-time building that must already be complete. */
  requiresBuilding?: string;
}

export interface DropDef {
  itemId: string;
  /** Odds numerator / denominator, rolled independently. */
  num: number;
  den: number;
  qty: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  area: 'Meadow verge' | 'Woodland edge';
  level: number;
  hp: number;
  maxHit: number;
  drops: DropDef[];
  /** Inclusive coin range, or null when the enemy drops no coins. */
  coins: { min: number; max: number } | null;
}

export const AREAS = ['Meadow verge', 'Woodland edge'] as const;

function node(
  id: string,
  skill: NodeDef['skill'],
  level: number,
  seconds: number,
  xp: number,
): NodeDef {
  return { id, skill, level, seconds, xp, cost: nodeCost(level) };
}

export const NODES: NodeDef[] = [
  node('mat.wood.pine', 'Woodcutting', 1, 2.6, 42),
  node('mat.tree.resin', 'Woodcutting', 10, 3.0, 48),
  node('mat.wood.maple', 'Woodcutting', 10, 3.1, 50),
  node('mat.wood.oak', 'Woodcutting', 20, 3.3, 77),
  node('mat.fish.minnow', 'Fishing', 1, 3.2, 51),
  node('mat.fish.river_shrimp', 'Fishing', 10, 3.6, 58),
  node('mat.fish.perch', 'Fishing', 15, 3.9, 63),
  node('mat.fish.trout', 'Fishing', 20, 4.1, 95),
  node('mat.fish.carp', 'Fishing', 25, 4.4, 102),
  node('mat.ore.copper', 'Mining', 1, 2.9, 46),
  node('mat.ore.tin', 'Mining', 1, 3.0, 48),
  node('mat.stone.limestone', 'Mining', 10, 3.3, 53),
  node('mat.mineral.rock_salt', 'Mining', 15, 3.5, 56),
  node('mat.gem.jade', 'Mining', 20, 3.7, 86),
  node('mat.ore.iron', 'Mining', 20, 3.8, 88),
  node('mat.mineral.pottery_clay', 'Mining', 25, 3.9, 91),
  node('mat.herb.meadow', 'Foraging', 1, 2.8, 45),
  node('mat.reagent.spell_moss', 'Foraging', 1, 2.9, 46),
  node('mat.seed.flax', 'Foraging', 1, 3.0, 48),
  node('mat.seed.potato', 'Foraging', 5, 3.0, 48),
  node('mat.cutting.meadow_herb', 'Foraging', 10, 3.2, 51),
  node('mat.fruit.berries', 'Foraging', 10, 3.3, 53),
  node('mat.seed.carrot', 'Foraging', 12, 3.3, 53),
  node('mat.fruit.crabapple', 'Foraging', 15, 3.4, 54),
  node('mat.forage.wild_wax_comb', 'Foraging', 20, 3.6, 84),
  node('mat.fungi.mushroom', 'Foraging', 20, 3.7, 86),
  node('mat.seed.cotton', 'Foraging', 20, 3.8, 88),
  node('mat.plant.cattail', 'Foraging', 22, 3.7, 86),
  node('mat.seed.onion', 'Foraging', 25, 3.8, 88),
  node('mat.spawn.mushroom', 'Foraging', 25, 3.9, 91),
  node('mat.herb.bitterroot', 'Foraging', 30, 4.0, 93),
  node('mat.seed.wheat', 'Foraging', 30, 4.1, 95),
  node('mat.gem.weathered_agate', 'Exploration', 1, 3.4, 27),
  node('mat.relic.weathered_slate', 'Exploration', 10, 3.8, 30),
  ...CAP40_NODES.map((row): NodeDef => ({
    id: row.id,
    skill: row.skill as NodeDef['skill'],
    level: row.level,
    seconds: row.seconds,
    xp: row.xp,
    cost: row.cost,
  })),
];

export const NODE_BY_ID: Record<string, NodeDef> = Object.fromEntries(NODES.map((n) => [n.id, n]));

function recipe(
  id: string,
  skill: RecipeDef['skill'],
  level: number,
  seconds: number,
  xp: number,
  inputs: Stack[],
  outputs: Stack[],
  tool?: RecipeDef['tool'],
): RecipeDef {
  return { id, skill, level, seconds, xp, inputs, outputs, tool };
}

export const RECIPES: RecipeDef[] = [
  recipe('recipe.food.roast_hare', 'Cooking', 1, 2.2, 35, [{ id: 'mat.meat.hare', qty: 1 }], [{ id: 'food.roast_hare', qty: 1 }]),
  recipe('recipe.food.roast_minnows', 'Cooking', 1, 2.4, 38, [{ id: 'mat.fish.minnow', qty: 2 }], [{ id: 'food.roast_minnows', qty: 1 }]),
  recipe('recipe.mat.fuel.charcoal', 'Cooking', 1, 2.3, 37, [{ id: 'mat.wood.pine', qty: 1 }], [{ id: 'mat.fuel.charcoal', qty: 2 }]),
  recipe('recipe.food.cooked_shrimp', 'Cooking', 10, 2.5, 40, [{ id: 'mat.fish.river_shrimp', qty: 1 }], [{ id: 'food.cooked_shrimp', qty: 1 }]),
  recipe('recipe.food.shrimp_berry_bowl', 'Cooking', 10, 2.7, 43, [{ id: 'mat.fish.river_shrimp', qty: 2 }, { id: 'mat.berry.meadow', qty: 1 }], [{ id: 'food.shrimp_berry_bowl', qty: 1 }]),
  recipe('recipe.food.mutton_herb_stew', 'Cooking', 15, 2.9, 46, [{ id: 'mat.meat.mutton', qty: 2 }, { id: 'mat.herb.meadow', qty: 1 }], [{ id: 'food.mutton_herb_stew', qty: 2 }]),
  recipe('recipe.food.roast_perch', 'Cooking', 15, 2.7, 43, [{ id: 'mat.fish.perch', qty: 1 }], [{ id: 'food.roast_perch', qty: 1 }]),
  recipe('recipe.food.tortoise_herb_soup', 'Cooking', 18, 2.9, 46, [{ id: 'mat.meat.tortoise', qty: 1 }, { id: 'mat.herb.meadow', qty: 1 }], [{ id: 'food.tortoise_herb_soup', qty: 2 }]),
  recipe('recipe.mat.farm.fish_meal', 'Cooking', 20, 3.3, 77, [{ id: 'mat.fish.minnow', qty: 3 }, { id: 'mat.fuel.charcoal', qty: 1 }], [{ id: 'mat.farm.fish_meal', qty: 2 }]),
  recipe('recipe.food.roast_trout', 'Cooking', 22, 2.9, 67, [{ id: 'mat.fish.trout', qty: 1 }], [{ id: 'food.roast_trout', qty: 1 }]),
  recipe('recipe.food.baked_carp', 'Cooking', 25, 3.0, 70, [{ id: 'mat.fish.carp', qty: 1 }], [{ id: 'food.baked_carp', qty: 1 }]),
  recipe('recipe.mat.food.fish_stock', 'Cooking', 26, 3.2, 74, [{ id: 'mat.fish.perch', qty: 2 }], [{ id: 'mat.food.fish_stock', qty: 2 }]),
  recipe('recipe.gear.armour.bronze_body', 'Smithing', 1, 3.7, 30, [{ id: 'mat.bar.bronze', qty: 3 }], [{ id: 'gear.armour.bronze_body', qty: 1 }]),
  recipe('recipe.gear.melee.bronze_sword', 'Smithing', 1, 3.6, 29, [{ id: 'mat.bar.bronze', qty: 2 }], [{ id: 'gear.melee.bronze_sword', qty: 1 }]),
  recipe('recipe.gear.shield.bronze', 'Smithing', 1, 3.8, 30, [{ id: 'mat.bar.bronze', qty: 2 }, { id: 'mat.wood.pine', qty: 1 }], [{ id: 'gear.shield.bronze', qty: 1 }]),
  recipe('recipe.mat.bar.bronze', 'Smithing', 1, 3.9, 31, [{ id: 'mat.ore.copper', qty: 1 }, { id: 'mat.ore.tin', qty: 1 }, { id: 'mat.fuel.charcoal', qty: 1 }], [{ id: 'mat.bar.bronze', qty: 1 }]),
  recipe('recipe.mat.head.bronze_arrow', 'Smithing', 1, 3.4, 27, [{ id: 'mat.bar.bronze', qty: 1 }], [{ id: 'mat.head.bronze_arrow', qty: 10 }]),
  recipe('recipe.gear.melee.bronze_dagger', 'Smithing', 2, 3.5, 28, [{ id: 'mat.bar.bronze', qty: 1 }], [{ id: 'gear.melee.bronze_dagger', qty: 1 }]),
  recipe('recipe.gear.melee.bronze_mace', 'Smithing', 2, 3.8, 30, [{ id: 'mat.bar.bronze', qty: 2 }, { id: 'mat.wood.pine', qty: 1 }], [{ id: 'gear.melee.bronze_mace', qty: 1 }]),
  recipe('recipe.tool.woodcutting.bronze_axe', 'Smithing', 2, 3.6, 29, [{ id: 'mat.bar.bronze', qty: 1 }, { id: 'mat.wood.pine', qty: 1 }], [{ id: 'tool.woodcutting.bronze_axe', qty: 1 }], { skill: 'Woodcutting', tier: 1 }),
  recipe('recipe.ammo.thrown.bronze_knife', 'Smithing', 3, 3.5, 28, [{ id: 'mat.bar.bronze', qty: 1 }], [{ id: 'ammo.thrown.bronze_knife', qty: 8 }]),
  recipe('recipe.gear.melee.bronze_spear', 'Smithing', 3, 3.9, 31, [{ id: 'mat.bar.bronze', qty: 2 }, { id: 'mat.wood.pine', qty: 1 }], [{ id: 'gear.melee.bronze_spear', qty: 1 }]),
  recipe('recipe.tool.mining.bronze_pickaxe', 'Smithing', 3, 4.0, 32, [{ id: 'mat.bar.bronze', qty: 2 }, { id: 'mat.wood.pine', qty: 1 }], [{ id: 'tool.mining.bronze_pickaxe', qty: 1 }], { skill: 'Mining', tier: 1 }),
  recipe('recipe.mat.head.bronze_bolt', 'Smithing', 4, 3.6, 29, [{ id: 'mat.bar.bronze', qty: 1 }], [{ id: 'mat.head.bronze_bolt', qty: 10 }]),
  recipe('recipe.ammo.thrown.bronze_javelin', 'Smithing', 5, 3.8, 30, [{ id: 'mat.bar.bronze', qty: 1 }, { id: 'mat.wood.pine', qty: 1 }], [{ id: 'ammo.thrown.bronze_javelin', qty: 5 }]),
  recipe('recipe.mat.wire.bronze', 'Smithing', 5, 3.6, 29, [{ id: 'mat.bar.bronze', qty: 1 }], [{ id: 'mat.wire.bronze', qty: 4 }]),
  recipe('recipe.mat.fitting.bronze_hinge', 'Smithing', 10, 3.9, 31, [{ id: 'mat.bar.bronze', qty: 1 }], [{ id: 'mat.fitting.bronze_hinge', qty: 2 }]),
  recipe('recipe.mat.fitting.bronze_nail', 'Smithing', 10, 4.0, 32, [{ id: 'mat.bar.bronze', qty: 1 }], [{ id: 'mat.fitting.bronze_nail', qty: 10 }]),
  recipe('recipe.gear.armour.iron_body', 'Smithing', 20, 4.8, 56, [{ id: 'mat.bar.iron', qty: 3 }], [{ id: 'gear.armour.iron_body', qty: 1 }]),
  recipe('recipe.gear.melee.iron_sword', 'Smithing', 20, 4.6, 53, [{ id: 'mat.bar.iron', qty: 2 }], [{ id: 'gear.melee.iron_sword', qty: 1 }]),
  recipe('recipe.mat.bar.iron', 'Smithing', 20, 4.9, 57, [{ id: 'mat.ore.iron', qty: 2 }, { id: 'mat.fuel.charcoal', qty: 1 }], [{ id: 'mat.bar.iron', qty: 1 }]),
  recipe('recipe.mat.fitting.iron', 'Smithing', 20, 4.4, 51, [{ id: 'mat.bar.iron', qty: 1 }], [{ id: 'mat.fitting.iron', qty: 4 }]),
  recipe('recipe.mat.head.iron_arrow', 'Smithing', 20, 4.5, 52, [{ id: 'mat.bar.iron', qty: 1 }], [{ id: 'mat.head.iron_arrow', qty: 10 }]),
  recipe('recipe.gear.melee.iron_dagger', 'Smithing', 21, 4.4, 51, [{ id: 'mat.bar.iron', qty: 1 }], [{ id: 'gear.melee.iron_dagger', qty: 1 }]),
  recipe('recipe.tool.woodcutting.iron_axe', 'Smithing', 21, 4.6, 53, [{ id: 'mat.bar.iron', qty: 1 }, { id: 'mat.wood.oak', qty: 1 }], [{ id: 'tool.woodcutting.iron_axe', qty: 1 }], { skill: 'Woodcutting', tier: 2 }),
  recipe('recipe.ammo.thrown.iron_knife', 'Smithing', 22, 4.5, 52, [{ id: 'mat.bar.iron', qty: 1 }], [{ id: 'ammo.thrown.iron_knife', qty: 8 }]),
  recipe('recipe.gear.melee.iron_spear', 'Smithing', 22, 4.9, 57, [{ id: 'mat.bar.iron', qty: 2 }, { id: 'mat.wood.oak', qty: 1 }], [{ id: 'gear.melee.iron_spear', qty: 1 }]),
  recipe('recipe.tool.mining.iron_pickaxe', 'Smithing', 22, 5.0, 58, [{ id: 'mat.bar.iron', qty: 2 }, { id: 'mat.wood.oak', qty: 1 }], [{ id: 'tool.mining.iron_pickaxe', qty: 1 }], { skill: 'Mining', tier: 2 }),
  recipe('recipe.mat.head.iron_bolt', 'Smithing', 23, 4.5, 52, [{ id: 'mat.bar.iron', qty: 1 }], [{ id: 'mat.head.iron_bolt', qty: 10 }]),
  recipe('recipe.ammo.thrown.iron_javelin', 'Smithing', 24, 4.8, 56, [{ id: 'mat.bar.iron', qty: 1 }, { id: 'mat.wood.oak', qty: 1 }], [{ id: 'ammo.thrown.iron_javelin', qty: 5 }]),
  ...SLICE_RECIPES.map((row): RecipeDef => ({
    id: row.id,
    skill: row.skill as RecipeDef['skill'],
    level: row.level,
    seconds: row.seconds,
    xp: row.xp,
    inputs: row.inputs,
    outputs: row.outputs,
    oneTime: row.oneTime,
    rebuildFee: row.rebuildFee,
  })),
  ...CAP40_RECIPES.map((row): RecipeDef => ({
    id: row.id,
    skill: row.skill as RecipeDef['skill'],
    level: row.level,
    seconds: row.seconds,
    xp: row.xp,
    inputs: row.inputs,
    outputs: row.outputs,
    oneTime: row.oneTime,
    rebuildFee: row.rebuildFee,
    locked: row.locked,
    requiresBuilding: row.requiresBuilding,
  })),
];

export const RECIPE_BY_ID: Record<string, RecipeDef> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export const TOOL_TIER: Record<string, { skill: 'Woodcutting' | 'Mining' | 'Fishing' | 'Foraging'; tier: number }> = {
  'tool.woodcutting.bronze_axe': { skill: 'Woodcutting', tier: 1 },
  'tool.woodcutting.iron_axe': { skill: 'Woodcutting', tier: 2 },
  'tool.mining.bronze_pickaxe': { skill: 'Mining', tier: 1 },
  'tool.mining.iron_pickaxe': { skill: 'Mining', tier: 2 },
  'tool.fishing.bronze_rod': { skill: 'Fishing', tier: 1 },
  'tool.fishing.iron_rod': { skill: 'Fishing', tier: 2 },
  'tool.foraging.bronze_sickle': { skill: 'Foraging', tier: 1 },
  'tool.foraging.iron_sickle': { skill: 'Foraging', tier: 2 },
};

/** One ×0.937 step per completed building, on the skill the spec names. */
export const BUILDING_STEPS: Record<string, SkillId[]> = {
  'activity.construction.pine_work_area': ['Crafting'],
  'activity.construction.stone_foundation': ['Cooking'],
  'activity.construction.oak_workshop': ['Crafting'],
  'activity.construction.supply_racks': ['Alchemy'],
  'activity.construction.forge_extension': ['Smithing'],
};

/** Catalogue tool factor, approved at t252. Each tier multiplies action time. */
export const TOOL_TIME_FACTOR = 0.937;

export const SHOP_ITEMS = ['mat.meat.hare', 'mat.meat.mutton', 'mat.meat.tortoise'] as const;
export const SHOP_PRICE = 48;
export const SHOP_DAILY_LIMIT = 25;
export const SHOP_WINDOW_MS = 24 * 60 * 60 * 1000;

export const ATTACK_INTERVAL_MS = 2400;
export const KILL_PAUSE_MS = 3000;
export const ENEMY_FIRST_ATTACK_MS = 1200;
export const REGEN_MS = 6000;
/** HP restored on each regen tick. ×10 scale; heals and regen are not varied. */
export const REGEN_HP = 10;
/** Health and the pre-variance damage roll are each ×10, with their own rounding. */
export const COMBAT_HP_SCALE = 10;
/** Every landed hit is multiplied by a factor in [1 − spread, 1 + spread]. */
export const DAMAGE_SPREAD = 0.05;
export const AUTO_EAT_FRACTION = 0.5;
export const OFFLINE_CAP_MS = 24 * 60 * 60 * 1000;

export const STYLE_XP_PER_KILL = 120;
export const HITPOINTS_XP_PER_KILL = 24;

export function enemyMaxHp(level: number): number {
  return COMBAT_HP_SCALE * 5 * (level + 2);
}
export function enemyMaxHit(level: number): number {
  return COMBAT_HP_SCALE * (1 + Math.floor(level / 4));
}
/** Half up, for positive damage. The §5.1 default rounding. */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}
/** Base player damage for one landed hit. `enemyHp` is already on the ×10 scale. */
export function playerBaseDamage(enemyHp: number, hits: number): number {
  return roundHalfUp(enemyHp / hits);
}
/** round(base × f) with f drawn from [0.95, 1.05). `unit` is in [0, 1). */
export function variedDamage(base: number, unit: number): number {
  const factor = 1 - DAMAGE_SPREAD + unit * (DAMAGE_SPREAD * 2);
  return roundHalfUp(base * factor);
}
/** Upper end of the pre-scale roll: uniform integer 1..this, then × {@link COMBAT_HP_SCALE}. */
export function enemyDamageRollMax(maxHit: number): number {
  return Math.max(1, Math.round(maxHit / COMBAT_HP_SCALE));
}
/**
 * Expected damage of one landed enemy hit.
 * Same roll the combat engine uses: 10 × uniform{1..old max hit}, then the 5% factor, half up.
 */
export function expectedEnemyHitDamage(maxHit: number): number {
  const rolls = enemyDamageRollMax(maxHit);
  let sum = 0;
  for (let roll = 1; roll <= rolls; roll += 1) sum += expectedVariedDamage(COMBAT_HP_SCALE * roll);
  return sum / rolls;
}

function expectedVariedDamage(base: number): number {
  const lo = (1 - DAMAGE_SPREAD) * base;
  const hi = (1 + DAMAGE_SPREAD) * base;
  const span = hi - lo;
  if (span <= 0) return roundHalfUp(base);
  let mean = 0;
  for (let hit = Math.floor(lo) - 1; hit <= Math.ceil(hi) + 1; hit += 1) {
    const left = Math.max(lo, hit - 0.5);
    const right = Math.min(hi, hit + 0.5);
    if (right > left) mean += hit * ((right - left) / span);
  }
  return mean;
}
/** Hits per kill. Power is added to Strength. The result is locked when a kill starts. */
export function hitsPerKill(strength: number, enemyLevel: number, power = 0): number {
  const steps = Math.max(0, Math.floor((strength + power - enemyLevel) / 10));
  return Math.max(3, 5 - steps);
}
/**
 * Expected landed hits once each hit is varied. From §5.1. The base count is the
 * Strength table; a kill takes that many hits or one more.
 */
const EXPECTED_LANDED: Record<string, number> = {
  '1:5': 5.3951,
  '1:4': 4.1455,
  '1:3': 3.424,
  '2:5': 5.429,
  '2:4': 4.432,
  '2:3': 3.3361,
  '3:5': 5.439,
  '3:4': 4.2565,
  '3:3': 3.5448,
  '5:5': 5.4568,
  '5:4': 4.3172,
  '5:3': 3.4049,
  '8:5': 5.4703,
  '8:4': 4.4734,
  '8:3': 3.4329,
  '9:5': 5.4727,
  '9:4': 4.3815,
  '9:3': 3.5205,
  '10:5': 5.4752,
  '10:4': 4.4777,
  '10:3': 3.4813,
  '11:5': 5.4769,
  '11:4': 4.3991,
  '11:3': 3.4483,
  '12:5': 5.4787,
  '12:4': 4.481,
  '12:3': 3.5161,
  '14:5': 5.4813,
  '14:4': 4.4834,
  '14:3': 3.4579,
};
export function expectedLandedHits(enemyLevel: number, baseHits: number): number {
  return EXPECTED_LANDED[`${enemyLevel}:${baseHits}`] ?? baseHits;
}
/** Enemy hit chance. Guard from body and shield is added to Defence. */
export function hitChance(enemyLevel: number, defence: number, guard = 0): number {
  return Math.min(0.9, Math.max(0.05, 0.4 + 0.03 * (enemyLevel - (defence + guard))));
}

/** Player hit chance. Accuracy is added to Attack. A miss deals no damage and grants no XP. */
export function playerHitChance(attackLevel: number, enemyLevel: number, accuracy = 0): number {
  const raw = 0.88 + 0.012 * ((attackLevel + accuracy) - enemyLevel);
  return Math.min(1, Math.max(0.5, raw));
}
export function playerMaxHp(hitpointsLevel: number): number {
  return 100 + 20 * hitpointsLevel;
}

function enemy(
  id: string,
  name: string,
  area: EnemyDef['area'],
  level: number,
  drops: DropDef[],
  coins: EnemyDef['coins'],
): EnemyDef {
  return { id, name, area, level, hp: enemyMaxHp(level), maxHit: enemyMaxHit(level), drops, coins };
}

export const ENEMIES: EnemyDef[] = [
  enemy('meadow.hare', 'Burrowing hare', 'Meadow verge', 1, [
    { itemId: 'mat.seed.flax', num: 1, den: 4, qty: 8 },
    { itemId: 'mat.meat.hare', num: 1, den: 2, qty: 1 },
    { itemId: 'mat.bone.ordinary', num: 1, den: 4, qty: 1 },
  ], null),
  enemy('meadow.rat', 'Field rat', 'Meadow verge', 2, [
    { itemId: 'mat.hide.basic', num: 1, den: 3, qty: 3 },
    { itemId: 'mat.bone.ordinary', num: 1, den: 4, qty: 1 },
  ], null),
  enemy('meadow.ram', 'Meadow ram', 'Meadow verge', 3, [
    { itemId: 'mat.herb.meadow', num: 1, den: 4, qty: 8 },
    { itemId: 'mat.meat.mutton', num: 1, den: 2, qty: 1 },
    { itemId: 'mat.bone.ordinary', num: 1, den: 4, qty: 1 },
  ], null),
  enemy('meadow.moss', 'Moss crawler', 'Meadow verge', 3, [
    { itemId: 'mat.moss.spell', num: 1, den: 4, qty: 24 },
  ], null),
  enemy('meadow.beetle', 'Thorn beetle', 'Meadow verge', 5, [
    { itemId: 'mat.ore.copper', num: 1, den: 4, qty: 5 },
    { itemId: 'mat.ore.tin', num: 1, den: 4, qty: 5 },
    { itemId: 'mat.part.beetle_carapace', num: 1, den: 8, qty: 1 },
  ], { min: 2, max: 3 }),
  enemy('wood.jay', 'Berry jay', 'Woodland edge', 9, [
    { itemId: 'mat.seed.flax', num: 1, den: 4, qty: 12 },
    { itemId: 'mat.berry.meadow', num: 1, den: 4, qty: 12 },
  ], null),
  enemy('wood.fox', 'Forest fox', 'Woodland edge', 8, [
    { itemId: 'mat.hide.basic', num: 1, den: 3, qty: 3 },
    { itemId: 'mat.bone.ordinary', num: 1, den: 4, qty: 1 },
  ], null),
  enemy('wood.grub', 'Resin grub', 'Woodland edge', 11, [
    { itemId: 'mat.tree.resin', num: 1, den: 4, qty: 8 },
    { itemId: 'mat.moss.spell', num: 1, den: 4, qty: 8 },
    { itemId: 'mat.wax.grub', num: 1, den: 8, qty: 1 },
  ], null),
  enemy('wood.tortoise', 'Root tortoise', 'Woodland edge', 10, [
    { itemId: 'mat.herb.meadow', num: 1, den: 4, qty: 8 },
    { itemId: 'mat.herb.meadow_cuttings', num: 1, den: 4, qty: 8 },
    { itemId: 'mat.meat.tortoise', num: 1, den: 2, qty: 1 },
  ], null),
  enemy('wood.boar', 'Wild boar', 'Woodland edge', 12, [
    { itemId: 'mat.berry.meadow', num: 1, den: 4, qty: 6 },
    { itemId: 'mat.hide.basic', num: 1, den: 3, qty: 1 },
    { itemId: 'mat.meat.boar', num: 1, den: 2, qty: 1 },
    { itemId: 'mat.hide.thick', num: 1, den: 3, qty: 1 },
    { itemId: 'mat.bone.ordinary', num: 1, den: 4, qty: 1 },
  ], null),
  enemy('wood.poacher', 'Hedge poacher', 'Woodland edge', 14, [
    { itemId: 'mat.herb.meadow', num: 1, den: 4, qty: 6 },
    { itemId: 'mat.berry.meadow', num: 1, den: 4, qty: 6 },
    { itemId: 'mat.hide.basic', num: 1, den: 3, qty: 1 },
    { itemId: 'mat.meat.boar', num: 1, den: 2, qty: 1 },
  ], { min: 3, max: 9 }),
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

/** Meadow verge, in unlock order. Twelve completed kills of one rung open the next. */
export const MEADOW_LADDER = ['meadow.hare', 'meadow.rat', 'meadow.ram', 'meadow.moss', 'meadow.beetle'] as const;
/** Woodland edge, in unlock order. Fox is the first fightable rung once the area is open. */
export const WOODLAND_LADDER = ['wood.fox', 'wood.jay', 'wood.tortoise', 'wood.grub', 'wood.boar', 'wood.poacher'] as const;
export const RUNG_KILLS = 12;
/** Locked future-area node. It is not an enemy and has no fight. */
export const TEASER_AREA = '???' as const;
export const TEASER_COPY = 'Kill the Hedge poacher to open ??? (coming later)';

/** Beetle kills, or any Woodland kill, open Woodland edge and the whole Meadow ladder. */
export function woodlandOpen(kills: Record<string, number>): boolean {
  if ((kills['meadow.beetle'] ?? 0) >= 1) return true;
  return ENEMIES.some((enemy) => enemy.area === 'Woodland edge' && (kills[enemy.id] ?? 0) >= 1);
}

/** A completed Hedge poacher kill unlocks every Woodland rung and the future-area teaser. */
export function teaserOpen(kills: Record<string, number>): boolean {
  return (kills['wood.poacher'] ?? 0) >= 1;
}

export function enemyUnlocked(kills: Record<string, number>, id: string): boolean {
  const enemy = ENEMY_BY_ID[id];
  if (!enemy) return false;
  if (enemy.area === 'Woodland edge') {
    if (!woodlandOpen(kills)) return false;
    if (teaserOpen(kills)) return true;
    const index = WOODLAND_LADDER.indexOf(id as (typeof WOODLAND_LADDER)[number]);
    if (index <= 0) return index === 0;
    return (kills[WOODLAND_LADDER[index - 1]] ?? 0) >= RUNG_KILLS;
  }
  if (woodlandOpen(kills)) return true;
  const index = MEADOW_LADDER.indexOf(id as (typeof MEADOW_LADDER)[number]);
  if (index <= 0) return index === 0;
  return (kills[MEADOW_LADDER[index - 1]] ?? 0) >= RUNG_KILLS;
}

function rungPlural(name: string): string {
  const lower = name.toLowerCase();
  return lower.endsWith('fox') ? `${lower}es` : `${lower}s`;
}

/** Copy for a locked rung. Null when the enemy can be fought. */
export function lockLine(kills: Record<string, number>, id: string): string | null {
  if (enemyUnlocked(kills, id)) return null;
  const enemy = ENEMY_BY_ID[id];
  if (!enemy) return null;
  if (enemy.area === 'Woodland edge') {
    if (!woodlandOpen(kills)) return 'Kill the Thorn beetle to open Woodland edge.';
    const index = WOODLAND_LADDER.indexOf(id as (typeof WOODLAND_LADDER)[number]);
    const previous = ENEMY_BY_ID[WOODLAND_LADDER[index - 1]];
    const have = kills[previous.id] ?? 0;
    return `Kill 12 ${rungPlural(previous.name)} to unlock (${have}/${RUNG_KILLS})`;
  }
  const previous = ENEMY_BY_ID[MEADOW_LADDER[MEADOW_LADDER.indexOf(id as (typeof MEADOW_LADDER)[number]) - 1]];
  const have = kills[previous.id] ?? 0;
  return `Kill 12 ${rungPlural(previous.name)} to unlock (${have}/${RUNG_KILLS})`;
}

export function expectedDropValue(drops: DropDef[]): number {
  let total = 0;
  for (const drop of drops) {
    const sell = ITEMS[drop.itemId]?.sell ?? 0;
    total += (drop.num / drop.den) * drop.qty * sell;
  }
  return total;
}

export function expectedCoinValue(enemyDef: EnemyDef): number {
  if (!enemyDef.coins) return 0;
  const { min, max } = enemyDef.coins;
  return (min + max) / 2;
}

const FOODS: { id: string; name: string; sell: number; heal: number }[] = [
  { id: 'food.roast_hare', name: 'Roast hare', sell: 6, heal: 50 },
  { id: 'food.roast_minnows', name: 'Roast minnows', sell: 3, heal: 50 },
  { id: 'food.cooked_shrimp', name: 'Cooked river shrimp', sell: 5, heal: 100 },
  { id: 'food.shrimp_berry_bowl', name: 'Shrimp-and-berry bowl', sell: 11, heal: 100 },
  { id: 'food.mutton_herb_stew', name: 'Mutton-and-herb stew', sell: 7, heal: 120 },
  { id: 'food.roast_perch', name: 'Roast perch', sell: 8, heal: 120 },
  { id: 'food.tortoise_herb_soup', name: 'Tortoise-and-herb soup', sell: 4, heal: 140 },
  { id: 'food.roast_trout', name: 'Roast trout', sell: 9, heal: 160 },
  { id: 'food.baked_carp', name: 'Baked carp', sell: 12, heal: 170 },
];

function addItems(): void {
  const mats: { id: string; name: string; sell: number; icon: IconName }[] = [
    { id: 'mat.wood.pine', name: 'Pine logs', sell: 1, icon: 'log' },
    { id: 'mat.tree.resin', name: 'Resin', sell: 3, icon: 'log' },
    { id: 'mat.wood.maple', name: 'Maple logs', sell: 3, icon: 'log' },
    { id: 'mat.wood.oak', name: 'Oak logs', sell: 6, icon: 'log' },
    { id: 'mat.fish.minnow', name: 'Raw minnows', sell: 1, icon: 'fish' },
    { id: 'mat.fish.river_shrimp', name: 'Raw river shrimp', sell: 3, icon: 'fish' },
    { id: 'mat.fish.perch', name: 'Raw perch', sell: 5, icon: 'fish' },
    { id: 'mat.fish.trout', name: 'Raw trout', sell: 6, icon: 'fish' },
    { id: 'mat.fish.carp', name: 'Raw carp', sell: 8, icon: 'fish' },
    { id: 'mat.ore.copper', name: 'Copper ore', sell: 1, icon: 'ore' },
    { id: 'mat.ore.tin', name: 'Tin ore', sell: 1, icon: 'ore' },
    { id: 'mat.stone.limestone', name: 'Limestone', sell: 3, icon: 'stone' },
    { id: 'mat.mineral.rock_salt', name: 'Rock salt', sell: 5, icon: 'stone' },
    { id: 'mat.gem.jade', name: 'Rough jade', sell: 6, icon: 'gem' },
    { id: 'mat.ore.iron', name: 'Iron ore', sell: 6, icon: 'ore' },
    { id: 'mat.mineral.pottery_clay', name: 'Pottery clay', sell: 8, icon: 'stone' },
    { id: 'mat.fuel.charcoal', name: 'Charcoal', sell: 1, icon: 'stone' },
    { id: 'mat.farm.fish_meal', name: 'Fish meal', sell: 3, icon: 'food' },
    { id: 'mat.food.fish_stock', name: 'Fish stock', sell: 8, icon: 'food' },
    { id: 'mat.bar.bronze', name: 'Bronze bar', sell: 5, icon: 'bar' },
    { id: 'mat.bar.iron', name: 'Iron bar', sell: 20, icon: 'bar' },
    { id: 'mat.head.bronze_arrow', name: 'Bronze arrowheads', sell: 1, icon: 'ammo' },
    { id: 'mat.head.bronze_bolt', name: 'Bronze bolt tips', sell: 1, icon: 'ammo' },
    { id: 'mat.wire.bronze', name: 'Bronze wire', sell: 2, icon: 'bar' },
    { id: 'mat.fitting.bronze_hinge', name: 'Bronze hinges', sell: 4, icon: 'bar' },
    { id: 'mat.fitting.bronze_nail', name: 'Bronze nails', sell: 1, icon: 'bar' },
    { id: 'mat.fitting.iron', name: 'Iron fittings', sell: 8, icon: 'bar' },
    { id: 'mat.head.iron_arrow', name: 'Iron arrowheads', sell: 3, icon: 'ammo' },
    { id: 'mat.head.iron_bolt', name: 'Iron bolt tips', sell: 3, icon: 'ammo' },
    { id: 'mat.meat.hare', name: 'Hare meat', sell: 4, icon: 'meat' },
    { id: 'mat.meat.mutton', name: 'Mutton', sell: 4, icon: 'meat' },
    { id: 'mat.meat.tortoise', name: 'Tortoise meat', sell: 4, icon: 'meat' },
    { id: 'mat.meat.boar', name: 'Boar meat', sell: 3, icon: 'meat' },
    { id: 'mat.seed.flax', name: 'Flax seed', sell: 1, icon: 'herb' },
    { id: 'mat.hide.basic', name: 'Basic hide', sell: 6, icon: 'hide' },
    { id: 'mat.hide.thick', name: 'Thick hide', sell: 4, icon: 'hide' },
    { id: 'mat.herb.meadow', name: 'Meadow herbs', sell: 1, icon: 'herb' },
    { id: 'mat.herb.meadow_cuttings', name: 'Meadow-herb cuttings', sell: 1, icon: 'herb' },
    { id: 'mat.berry.meadow', name: 'Meadow berries', sell: 1, icon: 'berry' },
    { id: 'mat.moss.spell', name: 'Spell moss', sell: 1, icon: 'moss' },
    { id: 'mat.part.beetle_carapace', name: 'Beetle carapace fragments', sell: 10, icon: 'part' },
    { id: 'mat.wax.grub', name: 'Grub wax', sell: 16, icon: 'part' },
    { id: 'mat.bone.ordinary', name: 'Ordinary bones', sell: 1, icon: 'part' },
    { id: 'mat.reagent.spell_moss', name: 'Spell moss', sell: 1, icon: 'moss' },
    { id: 'mat.seed.potato', name: 'Seed potatoes', sell: 2, icon: 'herb' },
    { id: 'mat.cutting.meadow_herb', name: 'Meadow-herb cuttings', sell: 3, icon: 'herb' },
    { id: 'mat.fruit.berries', name: 'Meadow berries', sell: 3, icon: 'berry' },
    { id: 'mat.seed.carrot', name: 'Carrot seed', sell: 4, icon: 'herb' },
    { id: 'mat.fruit.crabapple', name: 'Crabapples', sell: 5, icon: 'berry' },
    { id: 'mat.forage.wild_wax_comb', name: 'Wild wax comb', sell: 6, icon: 'part' },
    { id: 'mat.fungi.mushroom', name: 'Meadow mushrooms', sell: 6, icon: 'herb' },
    { id: 'mat.seed.cotton', name: 'Cotton seed', sell: 7, icon: 'herb' },
    { id: 'mat.plant.cattail', name: 'Cattail', sell: 7, icon: 'herb' },
    { id: 'mat.seed.onion', name: 'Onion sets', sell: 8, icon: 'herb' },
    { id: 'mat.spawn.mushroom', name: 'Mushroom spawn', sell: 8, icon: 'herb' },
    { id: 'mat.herb.bitterroot', name: 'Bitterroot', sell: 10, icon: 'herb' },
    { id: 'mat.seed.wheat', name: 'Wheat seed', sell: 10, icon: 'herb' },
    { id: 'mat.gem.weathered_agate', name: 'Weathered agate', sell: 1, icon: 'gem' },
    { id: 'mat.relic.weathered_slate', name: 'Weathered slate', sell: 3, icon: 'stone' },
  ];
  for (const row of mats) item({ ...row, kind: 'material' });
  for (const food of FOODS) item({ ...food, kind: 'food', icon: 'food' });
  const gear: { id: string; name: string; sell: number; icon: IconName; acc: number; pow: number; grd: number }[] = [
    { id: 'gear.armour.bronze_body', name: 'Bronze body armour', sell: 23, icon: 'body', acc: 0, pow: 0, grd: 3 },
    { id: 'gear.armour.iron_body', name: 'Iron body armour', sell: 90, icon: 'body', acc: 0, pow: 0, grd: 6 },
    { id: 'gear.melee.bronze_sword', name: 'Bronze sword', sell: 15, icon: 'sword', acc: 2, pow: 2, grd: 0 },
    { id: 'gear.melee.iron_sword', name: 'Iron sword', sell: 60, icon: 'sword', acc: 6, pow: 6, grd: 0 },
    { id: 'gear.melee.bronze_dagger', name: 'Bronze dagger', sell: 8, icon: 'sword', acc: 5, pow: 0, grd: 0 },
    { id: 'gear.melee.iron_dagger', name: 'Iron dagger', sell: 30, icon: 'sword', acc: 10, pow: 0, grd: 0 },
    { id: 'gear.melee.bronze_mace', name: 'Bronze mace', sell: 17, icon: 'sword', acc: 0, pow: 5, grd: 0 },
    { id: 'gear.melee.bronze_spear', name: 'Bronze spear', sell: 17, icon: 'sword', acc: 3, pow: 3, grd: 0 },
    { id: 'gear.melee.iron_spear', name: 'Iron spear', sell: 69, icon: 'sword', acc: 7, pow: 7, grd: 0 },
    { id: 'gear.shield.bronze', name: 'Bronze shield', sell: 17, icon: 'shield', acc: 0, pow: 0, grd: 2 },
  ];
  for (const row of gear) item({ ...row, kind: 'gear' });
  const tools: { id: string; name: string; sell: number; icon: IconName }[] = [
    { id: 'tool.woodcutting.bronze_axe', name: 'Bronze axe', sell: 9, icon: 'axe' },
    { id: 'tool.woodcutting.iron_axe', name: 'Iron axe', sell: 39, icon: 'axe' },
    { id: 'tool.mining.bronze_pickaxe', name: 'Bronze pickaxe', sell: 17, icon: 'pick' },
    { id: 'tool.mining.iron_pickaxe', name: 'Iron pickaxe', sell: 69, icon: 'pick' },
    { id: 'tool.fishing.bronze_rod', name: 'Bronze-fitted rod', sell: 5, icon: 'fish' },
    { id: 'tool.fishing.iron_rod', name: 'Iron-fitted rod', sell: 5, icon: 'fish' },
    { id: 'tool.foraging.bronze_sickle', name: 'Bronze sickle', sell: 4, icon: 'axe' },
    { id: 'tool.foraging.iron_sickle', name: 'Iron sickle', sell: 4, icon: 'axe' },
  ];
  for (const row of tools) item({ ...row, kind: 'tool' });
  const ammo: { id: string; name: string; sell: number }[] = [
    { id: 'ammo.thrown.bronze_knife', name: 'Bronze throwing knives', sell: 1 },
    { id: 'ammo.thrown.bronze_javelin', name: 'Bronze javelins', sell: 2 },
    { id: 'ammo.thrown.iron_knife', name: 'Iron throwing knives', sell: 4 },
    { id: 'ammo.thrown.iron_javelin', name: 'Iron javelins', sell: 8 },
  ];
  for (const row of ammo) item({ ...row, kind: 'ammo', icon: 'ammo' });
  for (const row of [...SLICE_ITEMS, ...CAP40_ITEMS]) {
    if (ITEMS[row.id]) continue;
    item({ id: row.id, name: row.name, sell: row.sell, icon: row.icon as IconName, kind: row.kind as ItemKind });
  }
  for (const node of CAP40_NODES) {
    const listed = CAP40_ITEMS.find((row) => row.id === node.id);
    if (listed && ITEMS[node.id]) ITEMS[node.id].sell = listed.sell;
  }
  for (const [id, sell] of Object.entries(T310_SELLS)) {
    if (ITEMS[id]) ITEMS[id].sell = sell;
  }
}

addItems();

export function isFood(id: string): boolean {
  return ITEMS[id]?.kind === 'food';
}

export function itemName(id: string): string {
  return ITEMS[id]?.name ?? id;
}

/** Display names for activities that produce no item. Catalogue names, then the r2 table. */
const ACTION_NAMES: Record<string, string> = {
  'activity.construction.pine_work_area': 'Build pine work area',
  'activity.construction.stone_foundation': 'Build stone foundation',
  'activity.construction.oak_workshop': 'Build oak workshop',
  'activity.construction.practice_workshop_assembly': 'Practice workshop assembly',
  'activity.construction.supply_racks': 'Build supply racks',
  'activity.construction.forge_extension': 'Build steel forge extension',
  'activity.exploration.fitting_appraisal': 'Fitting appraisal',
  'activity.exploration.bridge_approach_survey': 'Bridge approach survey',
};

/** The name shown on a recipe row and in the activity bar. */
export function actionTitle(recipe: { id: string; outputs: { id: string }[] }): string {
  const made = recipe.outputs[0];
  if (made) return itemName(made.id);
  return ACTION_NAMES[recipe.id] ?? recipe.id;
}

export type EquipSlot = 'weapon' | 'body' | 'shield';

export interface EquippedSlots {
  weapon: string | null;
  body: string | null;
  shield: string | null;
}

export interface GearBonus {
  acc: number;
  pow: number;
  grd: number;
}

export const EQUIP_SLOTS: { id: EquipSlot; label: string }[] = [
  { id: 'weapon', label: 'Weapon' },
  { id: 'body', label: 'Body' },
  { id: 'shield', label: 'Shield' },
];

/** Weapons, body armour, and shields are the only equippable demo items. Tools are never equipped. */
export function equipSlotFor(itemId: string): EquipSlot | null {
  if (itemId.startsWith('gear.melee.')) return 'weapon';
  if (itemId.startsWith('gear.ranged.')) return 'weapon';
  if (itemId.startsWith('gear.magic.')) return 'weapon';
  if (itemId.startsWith('ammo.thrown.')) return 'weapon';
  if (itemId.startsWith('gear.shield.')) return 'shield';
  if (itemId.startsWith('gear.armour.')) return 'body';
  return null;
}

export function emptyEquipped(): EquippedSlots {
  return { weapon: null, body: null, shield: null };
}

/** Bonuses from items that are both equipped and still in the bank. One item per slot. */
export function equippedGear(equipped: EquippedSlots, bank: Record<string, number>): GearBonus {
  const total: GearBonus = { acc: 0, pow: 0, grd: 0 };
  for (const slot of EQUIP_SLOTS) {
    const id = equipped[slot.id];
    if (!id || (bank[id] ?? 0) <= 0 || equipSlotFor(id) !== slot.id) continue;
    const item = ITEMS[id];
    total.acc += item?.acc ?? 0;
    total.pow += item?.pow ?? 0;
    total.grd += item?.grd ?? 0;
  }
  return total;
}

/** Item line for Accuracy, Power, or Guard. Empty for anything that is not gear. */
export function gearStatText(id: string): string {
  const item = ITEMS[id];
  const slot = equipSlotFor(id);
  if (!item || !slot) return '';
  if (slot === 'weapon') return `+${item.acc ?? 0} Acc · +${item.pow ?? 0} Pow`;
  return `+${item.grd ?? 0} Grd`;
}

export function levelForXp(xp: number): number {
  let level = 1;
  for (let l = 2; l <= LEVEL_CAP; l++) {
    if (xp + 1e-6 >= XP_TABLE[l]) level = l;
    else break;
  }
  return level;
}

/**
 * The only skill-price lookup. k is 1-based: the next purchase is SC(skills already bought + 1).
 * The free starting roster is not a purchase, so it does not increment k.
 */
export function skillCost(k: number): number | null {
  if (!Number.isInteger(k) || k < 1 || k > SKILL_PRICES.length) return null;
  return SKILL_PRICES[k - 1];
}

export function skillPrice(purchaseIndex: number): number | null {
  if (purchaseIndex < 0 || purchaseIndex >= DEMO_PURCHASE_SLOTS) return null;
  return skillCost(purchaseIndex + 1);
}

export const STARTER_WEAPON = 'gear.melee.bronze_sword';

export const SKILL_SHORT: Record<SkillId, string> = {
  Woodcutting: 'Woodcut',
  Fishing: 'Fishing',
  Cooking: 'Cooking',
  Attack: 'Attack',
  Strength: 'Strength',
  Defence: 'Defence',
  Mining: 'Mining',
  Smithing: 'Smithing',
  Foraging: 'Forage',
  Farming: 'Farming',
  Crafting: 'Crafting',
  Alchemy: 'Alchemy',
  Construction: 'Construct',
  Enchanting: 'Enchant',
  Exploration: 'Explore',
  Ranged: 'Ranged',
  Magic: 'Magic',
  Hitpoints: 'Hitpoints',
};
