/** Approved. Level-1 nodes are free. Every other demo node costs this once, and only after the skill reaches the node's level. */
export const NODE_PRICE = 1500;

/** Cumulative XP required to be each level. Level 1 is 0. Index 0 is unused. */
export const XP_TABLE: readonly number[] = [
  0, 0, 1138, 2358, 3665, 5065, 6567, 8175, 9899, 11747, 13726, 15848, 18122, 20559, 23170, 25968,
  28967, 32181, 35626, 39317, 43272, 47511, 52054, 56922, 62139, 67730, 73722, 80143, 87024, 94398,
  102301,
];

export const XP_CAP = XP_TABLE[30];
export const LEVEL_CAP = 30;

/** SC1 prices. Slot k (1-based) is index k-1. Ratio (132690/750)^(1/16). */
export const SKILL_PRICES: readonly number[] = [
  750, 1036, 1432, 1979, 2735, 3780, 5224, 7219, 9976, 13786, 19051, 26327, 36383, 50278, 69481,
  96018, 132690,
];

/** Purchases the demo can make. Woodcutting and Hitpoints are never purchases. */
export const DEMO_PURCHASE_SLOTS = 7;

export const SKILL_IDS = [
  'Woodcutting',
  'Fishing',
  'Cooking',
  'Attack',
  'Strength',
  'Defence',
  'Mining',
  'Smithing',
  'Hitpoints',
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const COMBAT_STYLES = ['Attack', 'Strength', 'Defence'] as const;
export type CombatStyle = (typeof COMBAT_STYLES)[number];

export const GATHER_SKILLS = ['Woodcutting', 'Fishing', 'Mining'] as const;
export const PRODUCE_SKILLS = ['Cooking', 'Smithing'] as const;

export function isCombatStyle(skill: SkillId): skill is CombatStyle {
  return skill === 'Attack' || skill === 'Strength' || skill === 'Defence';
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
  | 'moss';

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
  skill: 'Woodcutting' | 'Fishing' | 'Mining';
  level: number;
  seconds: number;
  xp: number;
  /** Free when level is 1. Otherwise NODE_PRICE. */
  cost: number;
}

export interface RecipeDef {
  id: string;
  skill: 'Cooking' | 'Smithing';
  level: number;
  seconds: number;
  xp: number;
  inputs: Stack[];
  outputs: Stack[];
  /** Tool recipes are reusable. The output is not consumed by gathering. */
  tool?: { skill: 'Woodcutting' | 'Mining'; tier: number };
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
  return { id, skill, level, seconds, xp, cost: level <= 1 ? 0 : NODE_PRICE };
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
];

export const RECIPE_BY_ID: Record<string, RecipeDef> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export const TOOL_TIER: Record<string, { skill: 'Woodcutting' | 'Mining'; tier: number }> = {
  'tool.woodcutting.bronze_axe': { skill: 'Woodcutting', tier: 1 },
  'tool.woodcutting.iron_axe': { skill: 'Woodcutting', tier: 2 },
  'tool.mining.bronze_pickaxe': { skill: 'Mining', tier: 1 },
  'tool.mining.iron_pickaxe': { skill: 'Mining', tier: 2 },
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
export const AUTO_EAT_FRACTION = 0.5;
export const OFFLINE_CAP_MS = 24 * 60 * 60 * 1000;

export const STYLE_XP_PER_KILL = 120;
export const HITPOINTS_XP_PER_KILL = 24;

export function enemyMaxHp(level: number): number {
  return 5 * (level + 2);
}
export function enemyMaxHit(level: number): number {
  return 1 + Math.floor(level / 4);
}
/** Hits per kill. Power is added to Strength. The result is locked when a kill starts. */
export function hitsPerKill(strength: number, enemyLevel: number, power = 0): number {
  const steps = Math.max(0, Math.floor((strength + power - enemyLevel) / 10));
  return Math.max(3, 5 - steps);
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
  return 10 + 2 * hitpointsLevel;
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
    { itemId: 'mat.hide.basic', num: 1, den: 3, qty: 1 },
    { itemId: 'mat.meat.hare', num: 1, den: 2, qty: 1 },
  ], null),
  enemy('meadow.rat', 'Field rat', 'Meadow verge', 1, [
    { itemId: 'mat.hide.basic', num: 1, den: 3, qty: 3 },
  ], null),
  enemy('meadow.ram', 'Meadow ram', 'Meadow verge', 1, [
    { itemId: 'mat.herb.meadow', num: 1, den: 4, qty: 8 },
    { itemId: 'mat.hide.basic', num: 1, den: 3, qty: 1 },
    { itemId: 'mat.meat.mutton', num: 1, den: 2, qty: 1 },
  ], null),
  enemy('meadow.moss', 'Moss crawler', 'Meadow verge', 1, [
    { itemId: 'mat.moss.spell', num: 1, den: 4, qty: 24 },
  ], null),
  enemy('meadow.beetle', 'Thorn beetle', 'Meadow verge', 1, [
    { itemId: 'mat.ore.copper', num: 1, den: 4, qty: 5 },
    { itemId: 'mat.ore.tin', num: 1, den: 4, qty: 5 },
    { itemId: 'mat.herb.meadow', num: 1, den: 4, qty: 5 },
    { itemId: 'mat.seed.flax', num: 1, den: 4, qty: 5 },
    { itemId: 'mat.part.beetle_carapace', num: 1, den: 8, qty: 1 },
  ], null),
  enemy('wood.jay', 'Berry jay', 'Woodland edge', 10, [
    { itemId: 'mat.seed.flax', num: 1, den: 4, qty: 12 },
    { itemId: 'mat.berry.meadow', num: 1, den: 4, qty: 12 },
  ], null),
  // Level 8 is approved. HP 50 and max hit 3 follow HP = 5 × (level + 2) and max hit = 1 + floor(level/4).
  enemy('wood.fox', 'Forest fox', 'Woodland edge', 8, [
    { itemId: 'mat.hide.basic', num: 1, den: 3, qty: 3 },
  ], null),
  enemy('wood.grub', 'Resin grub', 'Woodland edge', 10, [
    { itemId: 'mat.tree.resin', num: 1, den: 4, qty: 8 },
    { itemId: 'mat.moss.spell', num: 1, den: 4, qty: 8 },
    { itemId: 'mat.wax.grub', num: 1, den: 8, qty: 1 },
  ], null),
  enemy('wood.tortoise', 'Root tortoise', 'Woodland edge', 10, [
    { itemId: 'mat.herb.meadow', num: 1, den: 4, qty: 8 },
    { itemId: 'mat.herb.meadow_cuttings', num: 1, den: 4, qty: 8 },
    { itemId: 'mat.meat.tortoise', num: 1, den: 2, qty: 1 },
  ], null),
  enemy('wood.boar', 'Wild boar', 'Woodland edge', 10, [
    { itemId: 'mat.berry.meadow', num: 1, den: 4, qty: 6 },
    { itemId: 'mat.hide.basic', num: 1, den: 3, qty: 1 },
    { itemId: 'mat.meat.boar', num: 1, den: 2, qty: 1 },
    { itemId: 'mat.hide.thick', num: 1, den: 3, qty: 1 },
  ], null),
  enemy('wood.poacher', 'Hedge poacher', 'Woodland edge', 12, [
    { itemId: 'mat.herb.meadow', num: 1, den: 4, qty: 6 },
    { itemId: 'mat.berry.meadow', num: 1, den: 4, qty: 6 },
    { itemId: 'mat.hide.basic', num: 1, den: 3, qty: 1 },
    { itemId: 'mat.meat.boar', num: 1, den: 2, qty: 1 },
  ], { min: 3, max: 9 }),
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

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
  { id: 'food.roast_hare', name: 'Roast hare', sell: 4, heal: 5 },
  { id: 'food.roast_minnows', name: 'Roast minnows', sell: 2, heal: 5 },
  { id: 'food.cooked_shrimp', name: 'Cooked river shrimp', sell: 1, heal: 10 },
  { id: 'food.shrimp_berry_bowl', name: 'Shrimp-and-berry bowl', sell: 3, heal: 10 },
  { id: 'food.mutton_herb_stew', name: 'Mutton-and-herb stew', sell: 5, heal: 12 },
  { id: 'food.roast_perch', name: 'Roast perch', sell: 1, heal: 12 },
  { id: 'food.tortoise_herb_soup', name: 'Tortoise-and-herb soup', sell: 3, heal: 14 },
  { id: 'food.roast_trout', name: 'Roast trout', sell: 1, heal: 16 },
  { id: 'food.baked_carp', name: 'Baked carp', sell: 1, heal: 17 },
];

function addItems(): void {
  const mats: { id: string; name: string; sell: number; icon: IconName }[] = [
    { id: 'mat.wood.pine', name: 'Pine logs', sell: 1, icon: 'log' },
    { id: 'mat.tree.resin', name: 'Resin', sell: 1, icon: 'log' },
    { id: 'mat.wood.maple', name: 'Maple logs', sell: 1, icon: 'log' },
    { id: 'mat.wood.oak', name: 'Oak logs', sell: 1, icon: 'log' },
    { id: 'mat.fish.minnow', name: 'Raw minnows', sell: 1, icon: 'fish' },
    { id: 'mat.fish.river_shrimp', name: 'Raw river shrimp', sell: 1, icon: 'fish' },
    { id: 'mat.fish.perch', name: 'Raw perch', sell: 1, icon: 'fish' },
    { id: 'mat.fish.trout', name: 'Raw trout', sell: 1, icon: 'fish' },
    { id: 'mat.fish.carp', name: 'Raw carp', sell: 1, icon: 'fish' },
    { id: 'mat.ore.copper', name: 'Copper ore', sell: 1, icon: 'ore' },
    { id: 'mat.ore.tin', name: 'Tin ore', sell: 1, icon: 'ore' },
    { id: 'mat.stone.limestone', name: 'Limestone', sell: 1, icon: 'stone' },
    { id: 'mat.mineral.rock_salt', name: 'Rock salt', sell: 1, icon: 'stone' },
    { id: 'mat.gem.jade', name: 'Rough jade', sell: 1, icon: 'gem' },
    { id: 'mat.ore.iron', name: 'Iron ore', sell: 1, icon: 'ore' },
    { id: 'mat.mineral.pottery_clay', name: 'Pottery clay', sell: 1, icon: 'stone' },
    { id: 'mat.fuel.charcoal', name: 'Charcoal', sell: 1, icon: 'stone' },
    { id: 'mat.farm.fish_meal', name: 'Fish meal', sell: 2, icon: 'food' },
    { id: 'mat.food.fish_stock', name: 'Fish stock', sell: 1, icon: 'food' },
    { id: 'mat.bar.bronze', name: 'Bronze bar', sell: 3, icon: 'bar' },
    { id: 'mat.bar.iron', name: 'Iron bar', sell: 3, icon: 'bar' },
    { id: 'mat.head.bronze_arrow', name: 'Bronze arrowheads', sell: 1, icon: 'ammo' },
    { id: 'mat.head.bronze_bolt', name: 'Bronze bolt tips', sell: 1, icon: 'ammo' },
    { id: 'mat.wire.bronze', name: 'Bronze wire', sell: 1, icon: 'bar' },
    { id: 'mat.fitting.bronze_hinge', name: 'Bronze hinges', sell: 2, icon: 'bar' },
    { id: 'mat.fitting.bronze_nail', name: 'Bronze nails', sell: 1, icon: 'bar' },
    { id: 'mat.fitting.iron', name: 'Iron fittings', sell: 1, icon: 'bar' },
    { id: 'mat.head.iron_arrow', name: 'Iron arrowheads', sell: 1, icon: 'ammo' },
    { id: 'mat.head.iron_bolt', name: 'Iron bolt tips', sell: 1, icon: 'ammo' },
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
  ];
  for (const row of mats) item({ ...row, kind: 'material' });
  for (const food of FOODS) item({ ...food, kind: 'food', icon: 'food' });
  const gear: { id: string; name: string; sell: number; icon: IconName; acc: number; pow: number; grd: number }[] = [
    { id: 'gear.armour.bronze_body', name: 'Bronze body armour', sell: 10, icon: 'body', acc: 0, pow: 0, grd: 3 },
    { id: 'gear.armour.iron_body', name: 'Iron body armour', sell: 10, icon: 'body', acc: 0, pow: 0, grd: 6 },
    { id: 'gear.melee.bronze_sword', name: 'Bronze sword', sell: 7, icon: 'sword', acc: 2, pow: 2, grd: 0 },
    { id: 'gear.melee.iron_sword', name: 'Iron sword', sell: 7, icon: 'sword', acc: 6, pow: 6, grd: 0 },
    { id: 'gear.melee.bronze_dagger', name: 'Bronze dagger', sell: 3, icon: 'sword', acc: 5, pow: 0, grd: 0 },
    { id: 'gear.melee.iron_dagger', name: 'Iron dagger', sell: 3, icon: 'sword', acc: 10, pow: 0, grd: 0 },
    { id: 'gear.melee.bronze_mace', name: 'Bronze mace', sell: 8, icon: 'sword', acc: 0, pow: 5, grd: 0 },
    { id: 'gear.melee.bronze_spear', name: 'Bronze spear', sell: 8, icon: 'sword', acc: 3, pow: 3, grd: 0 },
    { id: 'gear.melee.iron_spear', name: 'Iron spear', sell: 8, icon: 'sword', acc: 7, pow: 7, grd: 0 },
    { id: 'gear.shield.bronze', name: 'Bronze shield', sell: 8, icon: 'shield', acc: 0, pow: 0, grd: 2 },
  ];
  for (const row of gear) item({ ...row, kind: 'gear' });
  const tools: { id: string; name: string; sell: number; icon: IconName }[] = [
    { id: 'tool.woodcutting.bronze_axe', name: 'Bronze axe', sell: 4, icon: 'axe' },
    { id: 'tool.woodcutting.iron_axe', name: 'Iron axe', sell: 4, icon: 'axe' },
    { id: 'tool.mining.bronze_pickaxe', name: 'Bronze pickaxe', sell: 8, icon: 'pick' },
    { id: 'tool.mining.iron_pickaxe', name: 'Iron pickaxe', sell: 8, icon: 'pick' },
  ];
  for (const row of tools) item({ ...row, kind: 'tool' });
  const ammo: { id: string; name: string; sell: number }[] = [
    { id: 'ammo.thrown.bronze_knife', name: 'Bronze throwing knives', sell: 1 },
    { id: 'ammo.thrown.bronze_javelin', name: 'Bronze javelins', sell: 1 },
    { id: 'ammo.thrown.iron_knife', name: 'Iron throwing knives', sell: 1 },
    { id: 'ammo.thrown.iron_javelin', name: 'Iron javelins', sell: 1 },
  ];
  for (const row of ammo) item({ ...row, kind: 'ammo', icon: 'ammo' });
}

addItems();

export function isFood(id: string): boolean {
  return ITEMS[id]?.kind === 'food';
}

export function itemName(id: string): string {
  return ITEMS[id]?.name ?? id;
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

export function skillPrice(purchaseIndex: number): number | null {
  if (purchaseIndex < 0 || purchaseIndex >= DEMO_PURCHASE_SLOTS) return null;
  return SKILL_PRICES[purchaseIndex];
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
  Hitpoints: 'Hitpoints',
};
