import {
  ATTACK_INTERVAL_MS,
  AUTO_EAT_FRACTION,
  COMBAT_STYLES,
  ENEMY_BY_ID,
  enemyUnlocked,
  ENEMIES,
  type EnemyDef,
  type EquipSlot,
  type EquippedSlots,
  HITPOINTS_XP_PER_KILL,
  ITEMS,
  KILL_PAUSE_MS,
  LEVEL_CAP,
  NODE_BY_ID,
  NODES,
  HABITATS,
  HABITAT_BY_ID,
  habitatForNode,
  habitatMasteryId,
  type HabitatEntry,
  OFFLINE_CAP_MS,
  RECIPE_BY_ID,
  RECIPES,
  REGEN_HP,
  REGEN_MS,
  COMBAT_HP_SCALE,
  enemyDamageRollMax,
  playerBaseDamage,
  variedDamage,
  SHOP_DAILY_LIMIT,
  SHOP_ITEMS,
  SHOP_PRICE,
  SHOP_WINDOW_MS,
  SKILL_IDS,
  STARTER_WEAPON,
  STYLE_XP_PER_KILL,
  TOOL_TIER,
  TOOL_TIME_FACTOR,
  XP_CAP,
  XP_TABLE,
  emptyEquipped,
  equippedGear,
  equipSlotFor,
  expectedCoinValue,
  expectedDropValue,
  hitChance,
  hitsPerKill,
  playerHitChance,
  isCombatStyle,
  isFood,
  actionTitle,
  countedLabel,
  itemName,
  levelForXp,
  playerMaxHp,
  BUILDING_STEPS,
  grantsHitpoints,
  skillPrice,
  arrowToUse,
  gearLocked,
  isBow,
  isTwoHanded,
  weaponFitsStyle,
  type CombatStyle,
  type SkillId,
} from './content';
import {
  ENEMY_MASTERY_XP,
  actionMasteryXp,
  actionXpMultiplier,
  enemyLootFactor,
  globalBonusLine,
  globalXpBonus,
  levelUpLines,
  masteryLevel,
  masteryPerks,
  sellMultiplier,
  trackName,
} from './mastery';
import { REGEN_BEFORE_ATTACK_ON_TIE } from './provisional';
import {
  AUTO_REPLANT_COST,
  BONE_COMPOST_ITEM_ID,
  COMPOST_ITEM_ID,
  PLOT_GATES,
  HARVEST_FACTOR,
  harvestProduce,
  harvestXp,
  isPlotCrop,
  plotGrowMs,
  type CompostKind,
} from './plots';
import { YARD_BUILDINGS, YARD_NAMES, isYardBuilding, openYardTiles } from './yard';
import {
  MARK_BY_ID,
  MODIFIER_BY_ID,
  hearthAppliesToRecipe,
  isGatheringSkill,
  markIdFromRecipe,
  rankCost,
  retiredSeal,
} from './marks';

export const SAVE_FORMAT = 4;
/** Format 1 has empty mastery. Format 2 has mastery and no kill ladder. Format 3 stores kills and no buildings. */
const SAVE_FORMAT_V1 = 1;
const SAVE_FORMAT_V2 = 2;
const SAVE_FORMAT_V3 = 3;
export const SAVE_KEY = 'idle-game-demo-save';
export const UNREADABLE_SAVE_KEY = 'idle-game-demo-save-unreadable';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type Activity =
  | { kind: 'gather'; nodeId: string }
  | { kind: 'forage'; habitatId: string }
  | { kind: 'produce'; recipeId: string }
  | { kind: 'combat'; enemyId: string; style: CombatStyle };

export interface CombatProgress {
  phase: 'fight' | 'pause';
  hitsPerKill: number;
  hitsLanded: number;
  /** Swings taken this kill, including misses. */
  swings: number;
  enemyAttacks: number;
  enemyHp: number;
  enemyMaxHp: number;
  /** Progress time of the killing blow. The 3s pause runs from here. */
  killAtMs: number | null;
}

export interface ShopCounter {
  bought: number;
  windowStart: number | null;
}

export interface StatsLog {
  actions: number;
  kills: number;
  pauses: number;
  foodEaten: number;
  coinsFromKills: number;
  coinsFromSales: number;
  /** Every coin added by kills, mastery bonuses, or sales. Dev edits are not included. */
  coinsEarned: number;
  /** Coins spent on skills, nodes, and the shop. Dev edits are not included. */
  coinsSpent: number;
  /** Milliseconds of online tick time and offline catch-up that were actually credited. */
  timePlayed: number;
  lootValue: number;
  killsByEnemy: Record<string, number>;
  /** 1-based index of the kill that was in progress when combat paused. */
  pauseAtKill: number[];
  playerSwings: number;
  playerHits: number;
  playerMisses: number;
  enemyHits: number;
}

export interface Save {
  saveFormat: number;
  coins: number;
  xp: Partial<Record<SkillId, number>>;
  owned: SkillId[];
  purchaseCount: number;
  nodes: string[];
  bank: Record<string, number>;
  equipped: EquippedSlots;
  activity: Activity | null;
  progressMs: number;
  hp: number;
  paused: boolean;
  /** Why combat is paused. Absent on saves from before thrown weapons were consumed. */
  pauseCause?: 'hp' | 'knives' | 'javelins' | 'arrows' | null;
  combat: CombatProgress | null;
  foodSlot: string | null;
  shop: Record<string, ShopCounter>;
  lastCredited: number;
  rngState: number;
  regenMs: number;
  stats: StatsLog;
  /** 10 once HP has been moved onto the ×10 scale. Absent on older saves. */
  combatScale: number;
  /** Integer mastery XP per node or recipe. Levels and perks are derived. */
  mastery: Record<string, number>;
  /** Integer mastery XP per enemy. */
  enemyMastery: Record<string, number>;
  /** Completed kills per enemy. Woodland and the meadow ladder are derived from this. */
  enemyKills: Record<string, number>;
  /** Standing Construction structures. Built, not dismantled. The ×0.937 step uses placement, not this map. */
  buildings: Record<string, boolean>;
  /** One-time structures completed at least once. Dismantle clears `buildings` and leaves this set. Format 4. */
  buildingsEver: Record<string, boolean>;
  /**
   * Owned Farming plots, plot 1 first. Null is an empty plot.
   * One entry per owned plot. Missing on older format-4 saves, which used `plot`.
   */
  plots: (PlotState | null)[];
  /** Paid plots bought, 0–7. Plot 1 is free with Farming and is not counted here. */
  plotsBought: number;
  /** Account-wide auto-replant. Missing means not bought. */
  autoReplant?: boolean;
  /** Switch after purchase. Missing while owned means on. Ignored when the unlock is absent. */
  autoReplantOn?: boolean;
  /**
   * Style of the last fight that started. Written only when a fight starts.
   * Missing, unknown, or unowned is not kept, so the chip uses the first owned style.
   */
  combatStyle?: CombatStyle;
  /**
   * The one expedition. Null when none is out.
   * Runs beside the selected activity and the Farming plots. A missing key loads as null.
   */
  expedition: { routeId: string; startedAt: number; durationMs: number; creditedMs: number } | null;
  /** Placed yard buildings, tile index "0"–"8" to activity id. The store is everything built that is absent here. */
  land: Record<string, string>;
  /** Shown once after a save is migrated onto fewer tiles than it has buildings. */
  yardNote?: string;
  /** Glimmer held for each mark. Missing keys are zero. */
  glimmer: Record<string, number>;
  /** Rank of each mark modifier, 0–5. Missing keys are zero. */
  markRanks: Record<string, number>;
  /** Wall-clock time of the last write. Missing on saves from before this field. */
  savedAt?: number;
}

/** Visual notes for the open tab. Offline catch-up does not collect these. */
export type FloatNote =
  | { kind: 'action'; skill: SkillId; xp: number; itemId: string; qty: number }
  | { kind: 'player-hit'; amount: number }
  | { kind: 'enemy-hit'; amount: number }
  | { kind: 'miss'; side: 'player' | 'enemy' }
  | { kind: 'heal'; amount: number }
  | { kind: 'toast'; text: string };

export interface SimOptions {
  /**
   * Spec section 4 method: credit expected loot value instead of rolling.
   * Used by the reference-route script only.
   */
  expectedLoot?: boolean;
  /** Filled only for a short visible-tab step. Never used by offline catch-up. */
  notes?: FloatNote[];
}

export interface Sink {
  actions: number;
  kills: number;
  foodEaten: number;
  coins: number;
  gained: Record<string, number>;
  consumed: Record<string, number>;
  stopped: 'inputs' | 'paused' | null;
}

export interface CatchupReport {
  awayMs: number;
  creditedMs: number;
  capped: boolean;
  backwards: boolean;
  activity: string;
  actions: number;
  kills: number;
  xpGained: Partial<Record<SkillId, number>>;
  levelsBefore: Partial<Record<SkillId, number>>;
  levelsAfter: Partial<Record<SkillId, number>>;
  itemsGained: Record<string, number>;
  itemsConsumed: Record<string, number>;
  coinsGained: number;
  foodEaten: number;
  stopped: 'window' | 'inputs' | 'paused' | 'backwards';
  /** Tracks whose shown mastery level rose during this catch-up. */
  masteryLevels: { id: string; name: string; before: number; after: number }[];
  /** Perk and global-bonus lines unlocked during this catch-up. */
  perksUnlocked: string[];
  /** Set when an expedition was out for this window. Absent or null when none was. */
  expeditionLine?: string | null;
  /** One line per plot that harvested in this window. */
  plotHarvests?: string[];
}

/**
 * One planted or empty-owned Farming plot.
 * `ready` and `legacy` are optional. `legacy` is written only for a crop migrated
 * from the old single plot, and the plot entry is removed when that harvest completes.
 */
export interface PlotState {
  recipeId: string;
  remainingMs: number;
  compost: CompostKind;
  /** Bank was full, so the harvest is waiting. */
  ready?: boolean;
  /** Migrated from the single-plot save. Harvest pays the old per-action output. */
  legacy?: boolean;
}

export function emptyStats(): StatsLog {
  return {
    actions: 0,
    kills: 0,
    pauses: 0,
    foodEaten: 0,
    coinsFromKills: 0,
    coinsFromSales: 0,
    coinsEarned: 0,
    coinsSpent: 0,
    timePlayed: 0,
    lootValue: 0,
    killsByEnemy: {},
    pauseAtKill: [],
    playerSwings: 0,
    playerHits: 0,
    playerMisses: 0,
    enemyHits: 0,
  };
}

export function newGame(now: number, seed = 0x1d1e_5eed): Save {
  const state: Save = {
    saveFormat: SAVE_FORMAT,
    coins: 0,
    xp: { Woodcutting: 0 },
    owned: ['Woodcutting'],
    purchaseCount: 0,
    nodes: [],
    bank: { [STARTER_WEAPON]: 1 },
    equipped: { weapon: STARTER_WEAPON, body: null, shield: null },
    activity: null,
    progressMs: 0,
    hp: playerMaxHp(1),
    combatScale: COMBAT_HP_SCALE,
    paused: false,
    pauseCause: null,
    combat: null,
    foodSlot: null,
    shop: {},
    lastCredited: now,
    rngState: seed >>> 0,
    regenMs: 0,
    stats: emptyStats(),
    mastery: {},
    enemyMastery: {},
    enemyKills: {},
    buildings: {},
    buildingsEver: {},
    plots: [],
    plotsBought: 0,
    expedition: null,
    land: {},
    glimmer: {},
    markRanks: {},
  };
  return state;
}

function markRank(state: Save, modifierId: string): number {
  const rank = state.markRanks?.[modifierId] ?? 0;
  if (!Number.isFinite(rank)) return 0;
  return Math.max(0, Math.min(5, Math.floor(rank)));
}

export function skillLevel(state: Save, skill: SkillId): number {
  const xp = state.xp[skill];
  if (xp == null) return 0;
  return levelForXp(xp);
}

export function formulaLevel(state: Save, skill: 'Strength' | 'Defence' | 'Hitpoints' | 'Attack'): number {
  const xp = state.xp[skill];
  if (xp == null) {
    return 1;
  }
  return levelForXp(xp);
}

export function maxHp(state: Save): number {
  return playerMaxHp(formulaLevel(state, 'Hitpoints'));
}

/**
 * The demo has no bank cap, so a finished crop can always be placed.
 * One function, so a later cap can replace this check alone.
 */
export function bankHasSpace(_state: Save): boolean {
  return true;
}

export function ownsCombatSkill(state: Save): boolean {
  return COMBAT_STYLES.some((skill) => state.owned.includes(skill));
}

export function toolTier(state: Save, skill: 'Woodcutting' | 'Mining' | 'Fishing' | 'Foraging'): number {
  let tier = 0;
  for (const [id, info] of Object.entries(TOOL_TIER)) {
    if (info.skill === skill && (state.bank[id] ?? 0) > 0) tier = Math.max(tier, info.tier);
  }
  return tier;
}

export function actionSeconds(state: Save, id: string): number {
  const node = NODE_BY_ID[id];
  if (node) {
    const tier =
      node.skill === 'Woodcutting' || node.skill === 'Mining' || node.skill === 'Fishing' || node.skill === 'Foraging'
        ? toolTier(state, node.skill)
        : 0;
    const factor = TOOL_TIME_FACTOR ** (tier + buildingSteps(state, node.skill));
    const speed = 1 - masteryPerks(masteryLevel(state.mastery[id] ?? 0)).speed;
    const grove = isGatheringSkill(node.skill) ? 1 - 0.01 * markRank(state, 'grove.time') : 1;
    return node.seconds * factor * speed * grove;
  }
  const retired = retiredSeal(id);
  if (retired) {
    const speed = 1 - masteryPerks(masteryLevel(state.mastery[id] ?? 0)).speed;
    return retired.seconds * speed;
  }
  const recipe = RECIPE_BY_ID[id];
  if (!recipe) return 0;
  const speed = 1 - masteryPerks(masteryLevel(state.mastery[id] ?? 0)).speed;
  const hearth = hearthAppliesToRecipe(recipe) ? 1 - 0.01 * markRank(state, 'hearth.time') : 1;
  return recipe.seconds * TOOL_TIME_FACTOR ** buildingSteps(state, recipe.skill) * speed * hearth;
}

export function markedGear(state: Save): { acc: number; pow: number; grd: number } {
  const gear = equippedGear(state.equipped, state.bank);
  return {
    acc: gear.acc + markRank(state, 'hunt.acc'),
    pow: gear.pow + markRank(state, 'hunt.pow'),
    grd: gear.grd + markRank(state, 'hunt.grd'),
  };
}

function buildingSteps(state: Save, skill: string): number {
  const placed = new Set(Object.values(state.land ?? {}));
  let steps = 0;
  for (const [id, skills] of Object.entries(BUILDING_STEPS)) {
    if (placed.has(id) && skills.includes(skill as SkillId)) steps += 1;
  }
  return steps;
}

function buildingBusy(state: Save, recipeId: string): boolean {
  return state.activity?.kind === 'produce' && state.activity.recipeId === recipeId;
}

export function actionXp(id: string): number {
  return NODE_BY_ID[id]?.xp ?? RECIPE_BY_ID[id]?.xp ?? 0;
}

export function actionDurationMs(state: Save, id: string): number {
  return actionSeconds(state, id) * 1000;
}

/** Acceptance tests pin the base haul by turning the Lv 40 double off. */
let suppressDouble = false;

/** Run `body` with the Lv 40 double-output roll forced off. */
export function withoutOutputDoubles<T>(body: () => T): T {
  const previous = suppressDouble;
  suppressDouble = true;
  try {
    return body();
  } finally {
    suppressDouble = previous;
  }
}

/** Lv 40 mastery: 5% chance to double items. XP and mastery XP stay single. */
function doubledOutput(state: Save, actionId: string): boolean {
  if (masteryLevel(state.mastery[actionId] ?? 0) < 40) return false;
  if (suppressDouble) return false;
  return nextUnit(state) < 0.05;
}

/** Test seam for an expedition's Lv 40 roll. Null uses the live 5% roll. */
let expeditionDoubleRoll: ((state: Save) => boolean) | null = null;

export function setExpeditionDoubleRoll(roll: ((state: Save) => boolean) | null): void {
  expeditionDoubleRoll = roll;
}

function expeditionDoubled(state: Save): boolean {
  if (expeditionDoubleRoll) return expeditionDoubleRoll(state);
  return nextUnit(state) < 0.05;
}

const GATHER_FALLOFF: ReadonlySet<SkillId> = new Set([
  'Woodcutting',
  'Fishing',
  'Mining',
  'Foraging',
  'Exploration',
]);
const PRODUCE_FALLOFF: ReadonlySet<SkillId> = new Set([
  'Cooking',
  'Smithing',
  'Crafting',
  'Alchemy',
  'Construction',
  'Enchanting',
]);

/**
 * Skill-XP multiplier from d = current whole level minus the action level.
 * 1, then 0.5, 0.1, and 0.01. Never zero.
 */
export function xpFalloff(level: number, actionLevel: number): number {
  const d = level - actionLevel;
  if (d <= 9) return 1;
  if (d <= 14) return 0.5;
  if (d <= 19) return 0.1;
  return 0.01;
}

/** Gathering nodes use the node level. Production uses the recipe level. Farming and combat do not. */
export function falloffApplies(skill: SkillId, kind: 'node' | 'recipe'): boolean {
  return (kind === 'node' ? GATHER_FALLOFF : PRODUCE_FALLOFF).has(skill);
}

function roundXp(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function addXp(state: Save, skill: SkillId, amount: number): number {
  const cur = state.xp[skill] ?? 0;
  if (cur >= XP_CAP - 1e-9) return 0;
  const next = Math.min(XP_CAP, roundXp(cur + amount));
  state.xp[skill] = next;
  return roundXp(next - cur);
}

function nextUnit(state: Save): number {
  let a = state.rngState >>> 0;
  a = (a + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  state.rngState = a >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function rollInt(state: Save, min: number, max: number): number {
  const span = max - min + 1;
  return min + Math.floor(nextUnit(state) * span);
}

function rollOdds(state: Save, num: number, den: number): boolean {
  return nextUnit(state) < num / den;
}

function giveItem(state: Save, id: string, qty: number, sink?: Sink): void {
  if (qty <= 0) return;
  state.bank[id] = (state.bank[id] ?? 0) + qty;
  if (sink) sink.gained[id] = (sink.gained[id] ?? 0) + qty;
}

function takeItem(state: Save, id: string, qty: number, sink?: Sink): boolean {
  const have = state.bank[id] ?? 0;
  if (have < qty) return false;
  const left = have - qty;
  if (left === 0) delete state.bank[id];
  else state.bank[id] = left;
  if (sink) sink.consumed[id] = (sink.consumed[id] ?? 0) + qty;
  if ((state.bank[id] ?? 0) === 0) {
    if (state.foodSlot === id) state.foodSlot = null;
    let lostWeapon = false;
    const keepThrown = id.startsWith('ammo.thrown.');
    for (const slot of ['weapon', 'body', 'shield'] as const) {
      if (state.equipped[slot] === id && !keepThrown) {
        state.equipped[slot] = null;
        if (slot === 'weapon') lostWeapon = true;
      }
    }
    if (lostWeapon) abandonCombat(state);
  }
  return true;
}

export function hasInputs(state: Save, recipeId: string): boolean {
  const recipe = RECIPE_BY_ID[recipeId] ?? retiredSeal(recipeId);
  if (!recipe) return false;
  return recipe.inputs.every((input) => (state.bank[input.id] ?? 0) >= input.qty);
}

export function nodeUsable(state: Save, nodeId: string): boolean {
  const node = NODE_BY_ID[nodeId];
  if (!node) return false;
  if (!state.owned.includes(node.skill)) return false;
  if (skillLevel(state, node.skill) < node.level) return false;
  if (node.cost <= 0) return true;
  return state.nodes.includes(nodeId);
}

/** Level reached and, for a paid node, bought. Free Foraging nodes count as bought. */
export function forageEntryReady(state: Save, nodeId: string): boolean {
  const node = NODE_BY_ID[nodeId];
  if (!node || node.skill !== 'Foraging') return false;
  if (!state.owned.includes('Foraging')) return false;
  if (skillLevel(state, 'Foraging') < node.level) return false;
  return node.cost <= 0 || state.nodes.includes(nodeId);
}

/** Entries that can roll: Foraging level met and the node bought. */
export function habitatTable(state: Save, habitatId: string): HabitatEntry[] {
  const habitat = HABITAT_BY_ID[habitatId];
  if (!habitat) return [];
  return habitat.entries.filter((entry) => forageEntryReady(state, entry.nodeId));
}

/**
 * Highest-level entry currently in the table.
 * A level tie keeps the first entry in the habitat list.
 */
export function habitatPace(state: Save, habitatId: string): (typeof NODE_BY_ID)[string] | null {
  const table = habitatTable(state, habitatId);
  if (table.length === 0) return null;
  let pace = NODE_BY_ID[table[0].nodeId];
  for (const entry of table) {
    const node = NODE_BY_ID[entry.nodeId];
    if (node.level > pace.level) pace = node;
  }
  return pace;
}

/** Sickle steps, then the habitat mastery speed perk. Base seconds come from the pace node. */
export function habitatSeconds(state: Save, habitatId: string): number {
  const pace = habitatPace(state, habitatId);
  if (!pace) return 0;
  const factor = TOOL_TIME_FACTOR ** (toolTier(state, 'Foraging') + buildingSteps(state, 'Foraging'));
  const speed = masteryPerks(masteryLevel(state.mastery[habitatMasteryId(habitatId)] ?? 0)).speed;
  return pace.seconds * factor * (1 - speed);
}

/** XP granted by one habitat tick, including the mastery and global bonuses. */
export function habitatTickXp(state: Save, habitatId: string): number {
  const pace = habitatPace(state, habitatId);
  if (!pace) return 0;
  return pace.xp * actionXpMultiplier(state.mastery, habitatMasteryId(habitatId), 'Foraging');
}

export function activityLabel(state: Save): string {
  const activity = state.activity;
  if (!activity) return 'Idle';
  if (state.paused && activity.kind === 'combat') {
    if (state.pauseCause === 'knives') return 'Combat paused – out of throwing knives';
    if (state.pauseCause === 'javelins') return 'Combat paused – out of javelins';
    if (state.pauseCause === 'arrows') return 'Combat paused – out of arrows';
    return 'Combat paused – out of HP';
  }
  if (activity.kind === 'gather') {
    const node = NODE_BY_ID[activity.nodeId];
    return `${node.skill} · ${itemName(activity.nodeId)}`;
  }
  if (activity.kind === 'forage') {
    return `Foraging · ${HABITAT_BY_ID[activity.habitatId]?.name ?? activity.habitatId}`;
  }
  if (activity.kind === 'produce') {
    const recipe = RECIPE_BY_ID[activity.recipeId];
    if (recipe) return `${recipe.skill} · ${actionTitle(recipe)}`;
    if (retiredSeal(activity.recipeId)) return 'Enchanting · retired seal';
    return 'Idle';
  }
  const enemy = ENEMY_BY_ID[activity.enemyId];
  return `Combat · ${enemy.name}`;
}

function beginActivity(state: Save): void {
  state.progressMs = 0;
  state.paused = false;
  state.combat = null;
}

export function startGather(state: Save, nodeId: string): boolean {
  const skill = NODE_BY_ID[nodeId]?.skill;
  if (skill === 'Exploration' || skill === 'Foraging') return false;
  if (!nodeUsable(state, nodeId)) return false;
  const same = state.activity?.kind === 'gather' && state.activity.nodeId === nodeId;
  if (same) return true;
  beginActivity(state);
  state.activity = { kind: 'gather', nodeId };
  return true;
}

/** A habitat with at least one table entry. Selecting it starts the roll, the way a node used to. */
export function startForage(state: Save, habitatId: string): boolean {
  if (!HABITAT_BY_ID[habitatId]) return false;
  if (!state.owned.includes('Foraging')) return false;
  if (habitatTable(state, habitatId).length === 0) return false;
  const same = state.activity?.kind === 'forage' && state.activity.habitatId === habitatId;
  if (same) return true;
  beginActivity(state);
  state.activity = { kind: 'forage', habitatId };
  return true;
}

export function startProduce(state: Save, recipeId: string): boolean {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe) return false;
  if (!state.owned.includes(recipe.skill)) return false;
  if (skillLevel(state, recipe.skill) < recipe.level) return false;
  if (recipe.comingLater || recipe.locked) return false;
  if (recipe.skill === 'Exploration') return false;
  if (recipe.requiresBuilding && !state.buildings[recipe.requiresBuilding]) return false;
  if (isPlotCrop(recipeId)) return false;
  if (!hasInputs(state, recipeId)) return false;
  const same = state.activity?.kind === 'produce' && state.activity.recipeId === recipeId;
  if (same) return true;
  if (recipe.oneTime && structureKnown(state, recipe.id)) {
    const fee = recipe.rebuildFee ?? 0;
    if (state.coins < fee) return false;
    state.coins = roundXp(state.coins - fee);
    noteSpent(state, fee);
  }
  beginActivity(state);
  state.activity = { kind: 'produce', recipeId };
  return true;
}

/** Half of each kit input, rounded down. r2 names kits, not the other materials. */
export function dismantleRefund(recipeId: string): { id: string; qty: number }[] {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe?.oneTime) return [];
  const refund: { id: string; qty: number }[] = [];
  for (const input of recipe.inputs) {
    if (!input.id.startsWith('con.kit.')) continue;
    const qty = Math.floor(input.qty / 2);
    if (qty > 0) refund.push({ id: input.id, qty });
  }
  return refund;
}

/**
 * Remove a built structure. The ×0.937 step stays only while the building flag is set,
 * so clearing the flag removes the step. r2 does not grant XP for this.
 * Returns false when it is not a standing one-time structure, or while that build is running.
 */
export function dismantleBuilding(state: Save, recipeId: string): boolean {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe?.oneTime || !state.buildings[recipe.id]) return false;
  if (buildingBusy(state, recipe.id)) return false;
  for (const refund of dismantleRefund(recipe.id)) giveItem(state, refund.id, refund.qty);
  state.buildingsEver[recipe.id] = true;
  delete state.buildings[recipe.id];
  clearLand(state, recipe.id);
  return true;
}

function clearLand(state: Save, buildingId: string): void {
  if (!state.land) state.land = {};
  for (const [tile, id] of Object.entries(state.land)) {
    if (id === buildingId) delete state.land[tile];
  }
}

function yardLevel(state: Save): number {
  if (!state.owned.includes('Construction')) return 0;
  return skillLevel(state, 'Construction');
}

function tileOpen(state: Save, tile: number): boolean {
  return Number.isInteger(tile) && tile >= 0 && tile < openYardTiles(yardLevel(state));
}

/** Put a stored building on an empty open tile. No coin, XP, or item change. */
export function placeBuilding(state: Save, buildingId: string, tile: number): boolean {
  if (!state.land) state.land = {};
  if (!isYardBuilding(buildingId) || !state.buildings[buildingId]) return false;
  if (buildingBusy(state, buildingId)) return false;
  if (Object.values(state.land).includes(buildingId)) return false;
  if (!tileOpen(state, tile) || state.land[String(tile)]) return false;
  state.land[String(tile)] = buildingId;
  return true;
}

/** Move a placed building onto another empty open tile. */
export function moveBuilding(state: Save, from: number, to: number): boolean {
  if (!state.land) state.land = {};
  const id = state.land[String(from)];
  if (!id || !tileOpen(state, to) || state.land[String(to)]) return false;
  if (buildingBusy(state, id)) return false;
  delete state.land[String(from)];
  state.land[String(to)] = id;
  return true;
}

/** Take a placed building off its tile and into the store. */
export function storeBuilding(state: Save, tile: number): boolean {
  if (!state.land) state.land = {};
  const id = state.land[String(tile)];
  if (!id || buildingBusy(state, id)) return false;
  delete state.land[String(tile)];
  return true;
}

/** True once a one-time structure has been completed, including after it is dismantled. */
function structureKnown(state: Save, recipeId: string): boolean {
  return !!state.buildingsEver[recipeId] || !!state.buildings[recipeId];
}

export function startCombat(state: Save, enemyId: string, style: CombatStyle): boolean {
  if (!ENEMY_BY_ID[enemyId]) return false;
  if (!enemyUnlocked(state.enemyKills, enemyId)) return false;
  if (!ownsCombatSkill(state)) return false;
  if (!state.owned.includes(style) || !isCombatStyle(style)) return false;
  const weapon = state.equipped.weapon;
  if (!weapon || equipSlotFor(weapon) !== 'weapon' || (state.bank[weapon] ?? 0) <= 0) return false;
  if (!weaponFitsStyle(weapon, style)) return false;
  const same =
    state.activity?.kind === 'combat' &&
    state.activity.enemyId === enemyId &&
    state.activity.style === style &&
    !state.paused;
  state.combatStyle = style;
  if (same) return true;
  beginActivity(state);
  state.activity = { kind: 'combat', enemyId, style };
  spawnEnemy(state);
  return true;
}

export function stopActivity(state: Save): void {
  beginActivity(state);
  state.activity = null;
  state.progressMs = 0;
}

function spawnEnemy(state: Save): void {
  const activity = state.activity;
  if (!activity || activity.kind !== 'combat') return;
  const enemy = ENEMY_BY_ID[activity.enemyId];
  const strength = formulaLevel(state, 'Strength');
  const hits = hitsPerKill(strength, enemy.level, markedGear(state).pow);
  state.combat = {
    phase: 'fight',
    hitsPerKill: hits,
    hitsLanded: 0,
    swings: 0,
    enemyAttacks: 0,
    enemyHp: enemy.hp,
    enemyMaxHp: enemy.hp,
    killAtMs: null,
  };
  state.progressMs = 0;
  state.paused = false;
}

export function resumeCombat(state: Save): boolean {
  if (!state.paused || state.activity?.kind !== 'combat') return false;
  const weapon = state.equipped.weapon;
  if (!weapon || (state.bank[weapon] ?? 0) <= 0) return false;
  if (isBow(weapon) && !arrowToUse(state.bank)) return false;
  state.paused = false;
  state.pauseCause = null;
  spawnEnemy(state);
  return true;
}

export function setFood(state: Save, itemId: string | null): boolean {
  if (itemId == null) {
    state.foodSlot = null;
    return true;
  }
  if (!isFood(itemId) || (state.bank[itemId] ?? 0) <= 0) return false;
  state.foodSlot = itemId;
  return true;
}

function noteEarned(state: Save, amount: number): void {
  if (!(amount > 0)) return;
  state.stats.coinsEarned = roundXp(state.stats.coinsEarned + amount);
}

function noteSpent(state: Save, amount: number): void {
  if (!(amount > 0)) return;
  state.stats.coinsSpent = roundXp(state.stats.coinsSpent + amount);
}

function noteTime(state: Save, ms: number): void {
  if (!(ms > 0)) return;
  state.stats.timePlayed += ms;
}

export function buySkill(state: Save, skill: SkillId): boolean {
  if (skill === 'Woodcutting' || skill === 'Hitpoints') return false;
  if (state.owned.includes(skill)) return false;
  const price = skillPrice(state.purchaseCount);
  if (price == null || state.coins < price) return false;
  state.coins = roundXp(state.coins - price);
  noteSpent(state, price);
  state.purchaseCount += 1;
  state.owned.push(skill);
  state.xp[skill] = 0;
  if (grantsHitpoints(skill) && !state.owned.includes('Hitpoints')) {
    state.owned.push('Hitpoints');
    state.xp.Hitpoints = 0;
    state.hp = maxHp(state);
  }
  if (skill === 'Farming') ensureFarmPlots(state);
  return true;
}

export function buyNode(state: Save, nodeId: string): boolean {
  const node = NODE_BY_ID[nodeId];
  if (!node || node.cost <= 0) return false;
  if (state.nodes.includes(nodeId)) return false;
  if (!state.owned.includes(node.skill)) return false;
  if (skillLevel(state, node.skill) < node.level) return false;
  if (state.coins < node.cost) return false;
  state.coins = roundXp(state.coins - node.cost);
  noteSpent(state, node.cost);
  state.nodes.push(nodeId);
  return true;
}

export function sell(state: Save, itemId: string, qty: number): boolean {
  if (!Number.isInteger(qty) || qty <= 0) return false;
  const def = ITEMS[itemId];
  if (!def) return false;
  if (!takeItem(state, itemId, qty)) return false;
  const gathered = isGatheringSkill(NODE_BY_ID[itemId]?.skill ?? '');
  const groveSell = gathered ? 1 + 0.01 * markRank(state, 'grove.sell') : 1;
  const price = def.sell * sellMultiplier(state.mastery, itemId) * groveSell * qty;
  state.coins = roundXp(state.coins + price);
  state.stats.coinsFromSales = roundXp(state.stats.coinsFromSales + price);
  noteEarned(state, price);
  return true;
}

export function shopStock(state: Save, itemId: string, now: number): number {
  const counter = state.shop[itemId];
  if (!counter) return SHOP_DAILY_LIMIT;
  if (counter.windowStart != null && now - counter.windowStart >= SHOP_WINDOW_MS) return SHOP_DAILY_LIMIT;
  return Math.max(0, SHOP_DAILY_LIMIT - counter.bought);
}

export function buyShop(state: Save, itemId: string, now: number): boolean {
  if (!(SHOP_ITEMS as readonly string[]).includes(itemId)) return false;
  if (state.coins < SHOP_PRICE) return false;
  const counter = state.shop[itemId] ?? { bought: 0, windowStart: null };
  if (counter.windowStart != null && now - counter.windowStart >= SHOP_WINDOW_MS) {
    counter.bought = 0;
    counter.windowStart = null;
  }
  if (counter.bought >= SHOP_DAILY_LIMIT) return false;
  counter.bought += 1;
  if (counter.windowStart == null) counter.windowStart = now;
  state.shop[itemId] = counter;
  state.coins = roundXp(state.coins - SHOP_PRICE);
  noteSpent(state, SHOP_PRICE);
  giveItem(state, itemId, 1);
  return true;
}

export function equip(state: Save, itemId: string): boolean {
  const slot = equipSlotFor(itemId);
  if (!slot || (state.bank[itemId] ?? 0) <= 0 || gearLocked(itemId)) return false;
  state.equipped[slot] = itemId;
  if (slot === 'weapon' && isTwoHanded(itemId)) state.equipped.shield = null;
  if (slot === 'shield' && isTwoHanded(state.equipped.weapon ?? '')) state.equipped.weapon = null;
  return true;
}

export function unequip(state: Save, slot: EquipSlot): void {
  if (slot !== 'weapon' && slot !== 'body' && slot !== 'shield') return;
  state.equipped[slot] = null;
  if (slot === 'weapon') abandonCombat(state);
}

/** End the current fight without loot. XP from hits already landed stays. */
function abandonCombat(state: Save): void {
  if (state.activity?.kind !== 'combat') return;
  state.activity = null;
  state.progressMs = 0;
  state.paused = false;
  state.combat = null;
}

function tryEat(state: Save, sink?: Sink, notes?: FloatNote[]): boolean {
  const id = state.foodSlot;
  if (!id || !isFood(id) || (state.bank[id] ?? 0) <= 0) return false;
  const heal = ITEMS[id].heal ?? 0;
  const before = state.hp;
  takeItem(state, id, 1, sink);
  const cap = maxHp(state);
  state.hp = Math.min(cap, state.hp + heal);
  const gained = state.hp - before;
  if (gained > 0) notes?.push({ kind: 'heal', amount: gained });
  state.stats.foodEaten += 1;
  if (sink) sink.foodEaten += 1;
  return true;
}

function grantKillRewards(state: Save, enemy: EnemyDef, sink: Sink | undefined, opts: SimOptions): void {
  state.stats.kills += 1;
  state.stats.killsByEnemy[enemy.id] = (state.stats.killsByEnemy[enemy.id] ?? 0) + 1;
  state.enemyKills[enemy.id] = (state.enemyKills[enemy.id] ?? 0) + 1;
  if (sink) sink.kills += 1;
  // Loot uses the mastery already earned. This kill's MXP is added afterwards.
  const factor = enemyLootFactor(state.enemyMastery, enemy.id);
  if (opts.expectedLoot) {
    const coins = expectedCoinValue(enemy) * factor;
    const loot = expectedDropValue(enemy.drops) * factor;
    state.coins = roundXp(state.coins + coins + loot);
    state.stats.coinsFromKills = roundXp(state.stats.coinsFromKills + coins);
    noteEarned(state, coins + loot);
    state.stats.lootValue = roundXp(state.stats.lootValue + loot);
    if (sink) sink.coins = roundXp(sink.coins + coins + (loot - expectedDropValue(enemy.drops)));
  } else {
    let itemValue = 0;
    for (const drop of enemy.drops) {
      if (rollOdds(state, drop.num, drop.den)) {
        giveItem(state, drop.itemId, drop.qty, sink);
        itemValue += (ITEMS[drop.itemId]?.sell ?? 0) * drop.qty;
      }
    }
    const rolled = enemy.coins ? rollInt(state, enemy.coins.min, enemy.coins.max) : 0;
    const extra = roundXp((rolled + itemValue) * (factor - 1));
    if (rolled > 0) {
      state.coins = roundXp(state.coins + rolled);
      state.stats.coinsFromKills = roundXp(state.stats.coinsFromKills + rolled);
      noteEarned(state, rolled);
      if (sink) sink.coins = roundXp(sink.coins + rolled);
    }
    if (extra > 0) {
      state.coins = roundXp(state.coins + extra);
      noteEarned(state, extra);
      if (sink) sink.coins = roundXp(sink.coins + extra);
    }
    state.stats.lootValue = roundXp(state.stats.lootValue + itemValue * factor);
  }
  grantEnemyMastery(state, enemy.id, opts);
}

function thrownKind(itemId: string): 'knives' | 'javelins' | null {
  if (!itemId.startsWith('ammo.thrown.')) return null;
  if (itemId.includes('javelin')) return 'javelins';
  if (itemId.includes('knife')) return 'knives';
  return null;
}

function markPaused(state: Save, sink?: Sink): void {
  state.hp = 0;
  state.paused = true;
  state.pauseCause = 'hp';
  state.stats.pauses += 1;
  // Completed kills only. A pause during the first fight is 0.
  state.stats.pauseAtKill.push(state.stats.kills);
  if (sink) sink.stopped = 'paused';
}

function enemyAttack(state: Save, sink?: Sink, notes?: FloatNote[]): void {
  const activity = state.activity;
  const combat = state.combat;
  if (!activity || activity.kind !== 'combat' || !combat) return;
  const enemy = ENEMY_BY_ID[activity.enemyId];
  combat.enemyAttacks += 1;
  const chance = hitChance(enemy.level, formulaLevel(state, 'Defence'), markedGear(state).grd);
  if (nextUnit(state) >= chance) {
    notes?.push({ kind: 'miss', side: 'enemy' });
    return;
  }
  state.stats.enemyHits += 1;
  const damage = variedDamage(
    COMBAT_HP_SCALE * rollInt(state, 1, enemyDamageRollMax(enemy.maxHit)),
    nextUnit(state),
  );
  notes?.push({ kind: 'enemy-hit', amount: damage });
  const lethal = state.hp - damage <= 0;
  if (lethal) {
    markPaused(state, sink);
    return;
  }
  state.hp = Math.max(0, state.hp - damage);
  const limit = maxHp(state) * AUTO_EAT_FRACTION;
  while (state.hp <= limit + 1e-9 && tryEat(state, sink, notes)) {
    // Eat until above the threshold or the slot is empty.
  }
  if (state.hp <= 0) markPaused(state, sink);
}

function pauseForAmmo(state: Save, kind: 'knives' | 'javelins' | 'arrows', sink?: Sink): void {
  state.paused = true;
  state.pauseCause = kind;
  state.stats.pauses += 1;
  state.stats.pauseAtKill.push(state.stats.kills);
  if (sink) sink.stopped = 'paused';
}

/** One thrown weapon is used per swing, including a miss. An empty stack does not swing. */
function consumeThrow(state: Save, sink?: Sink): boolean {
  const weapon = state.equipped.weapon;
  if (!weapon) return true;
  const kind = thrownKind(weapon);
  if (!kind) return true;
  if ((state.bank[weapon] ?? 0) <= 0) {
    pauseForAmmo(state, kind, sink);
    return false;
  }
  takeItem(state, weapon, 1, sink);
  return true;
}

/** One arrow per shot, including a miss, while a bow is equipped. An empty bank does not shoot. */
function consumeArrow(state: Save, sink?: Sink): boolean {
  const weapon = state.equipped.weapon;
  if (!weapon || !isBow(weapon)) return true;
  const arrow = arrowToUse(state.bank);
  if (!arrow) {
    pauseForAmmo(state, 'arrows', sink);
    return false;
  }
  takeItem(state, arrow, 1, sink);
  return true;
}

function arrowsSpent(state: Save, sink?: Sink): void {
  if (state.equipped.weapon && isBow(state.equipped.weapon) && !arrowToUse(state.bank)) {
    pauseForAmmo(state, 'arrows', sink);
  }
}

function playerAttack(state: Save, sink: Sink | undefined, opts: SimOptions): void {
  const activity = state.activity;
  const combat = state.combat;
  if (!activity || activity.kind !== 'combat' || !combat || combat.phase !== 'fight') return;
  const thrown = state.equipped.weapon ? thrownKind(state.equipped.weapon) : null;
  if (!consumeThrow(state, sink)) return;
  if (!consumeArrow(state, sink)) return;
  const enemy = ENEMY_BY_ID[activity.enemyId];
  const hits = combat.hitsPerKill;
  combat.swings += 1;
  state.stats.playerSwings += 1;
  const attackLevel = formulaLevel(state, 'Attack');
  const chance = playerHitChance(attackLevel, enemy.level, markedGear(state).acc);
  if (nextUnit(state) >= chance) {
    state.stats.playerMisses += 1;
    opts.notes?.push({ kind: 'miss', side: 'player' });
    if (thrown && (state.bank[state.equipped.weapon ?? ''] ?? 0) <= 0) pauseForAmmo(state, thrown, sink);
    arrowsSpent(state, sink);
    return;
  }
  state.stats.playerHits += 1;
  combat.hitsLanded += 1;
  const rolled = variedDamage(playerBaseDamage(combat.enemyMaxHp, hits), nextUnit(state));
  const removed = Math.min(rolled, combat.enemyHp);
  const styleXp = (STYLE_XP_PER_KILL * removed) / combat.enemyMaxHp;
  const hpXp = (HITPOINTS_XP_PER_KILL * removed) / combat.enemyMaxHp;
  const styleBefore = skillLevel(state, activity.style);
  const hpBefore = state.owned.includes('Hitpoints') ? skillLevel(state, 'Hitpoints') : 0;
  addXp(state, activity.style, styleXp);
  if (state.owned.includes('Hitpoints')) addXp(state, 'Hitpoints', hpXp);
  pushLevelToast(opts.notes, activity.style, styleBefore, skillLevel(state, activity.style));
  if (state.owned.includes('Hitpoints')) pushLevelToast(opts.notes, 'Hitpoints', hpBefore, skillLevel(state, 'Hitpoints'));
  opts.notes?.push({ kind: 'player-hit', amount: rolled });
  combat.enemyHp -= removed;
  if (combat.enemyHp <= 1e-9) {
    combat.enemyHp = 0;
    combat.phase = 'pause';
    combat.killAtMs = state.progressMs;
    grantKillRewards(state, enemy, sink, opts);
  }
  if (thrown && (state.bank[state.equipped.weapon ?? ''] ?? 0) <= 0) pauseForAmmo(state, thrown, sink);
  arrowsSpent(state, sink);
}

function rollWeighted(state: Save, entries: readonly HabitatEntry[]): string {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let mark = nextUnit(state) * total;
  for (const entry of entries) {
    mark -= entry.weight;
    if (mark < 0) return entry.nodeId;
  }
  return entries[entries.length - 1].nodeId;
}

/** One habitat tick: roll one table item, grant its XP, and add habitat mastery. */
function completeForageTick(state: Save, habitatId: string, sink: Sink | undefined, opts: SimOptions): void {
  const table = habitatTable(state, habitatId);
  const pace = habitatPace(state, habitatId);
  if (!pace || table.length === 0) {
    state.activity = null;
    state.progressMs = 0;
    return;
  }
  const itemId = rollWeighted(state, table);
  const track = habitatMasteryId(habitatId);
  const qty = doubledOutput(state, track) ? 2 : 1;
  giveItem(state, itemId, qty, sink);
  const levelBefore = skillLevel(state, 'Foraging');
  const gained = addXp(
    state,
    'Foraging',
    pace.xp * actionXpMultiplier(state.mastery, track, 'Foraging') * xpFalloff(levelBefore, pace.level),
  );
  opts.notes?.push({ kind: 'action', skill: 'Foraging', xp: gained, itemId, qty });
  pushLevelToast(opts.notes, 'Foraging', levelBefore, skillLevel(state, 'Foraging'));
  grantActionMastery(state, track, 'Foraging', pace.seconds, opts);
  state.stats.actions += 1;
  if (sink) sink.actions += 1;
  state.progressMs = 0;
}

function resolveDue(state: Save, sink: Sink | undefined, opts: SimOptions): void {
  const activity = state.activity;
  if (!activity || state.paused) return;
  if (activity.kind === 'forage') {
    completeForageTick(state, activity.habitatId, sink, opts);
    return;
  }
  if (activity.kind === 'gather') {
    const node = NODE_BY_ID[activity.nodeId];
    const qty = doubledOutput(state, node.id) ? 2 : 1;
    giveItem(state, node.id, qty, sink);
    const levelBefore = skillLevel(state, node.skill);
    const gained = addXp(
      state,
      node.skill,
      node.xp * actionXpMultiplier(state.mastery, node.id, node.skill) * xpFalloff(levelBefore, node.level),
    );
    opts.notes?.push({ kind: 'action', skill: node.skill, xp: gained, itemId: node.id, qty });
    pushLevelToast(opts.notes, node.skill, levelBefore, skillLevel(state, node.skill));
    grantActionMastery(state, node.id, node.skill, node.seconds, opts);
    state.stats.actions += 1;
    if (sink) sink.actions += 1;
    state.progressMs = 0;
    return;
  }
  if (activity.kind === 'produce') {
    const retired = retiredSeal(activity.recipeId);
    const recipe = RECIPE_BY_ID[activity.recipeId];
    const active = recipe ?? retired;
    if (!active || !hasInputs(state, active.id)) {
      state.activity = null;
      state.progressMs = 0;
      if (sink) sink.stopped = 'inputs';
      return;
    }
    const keepInputs =
      !!recipe &&
      hearthAppliesToRecipe(recipe) &&
      markRank(state, 'hearth.free') > 0 &&
      nextUnit(state) < markRank(state, 'hearth.free') / 100;
    if (!keepInputs) {
      for (const input of active.inputs) takeItem(state, input.id, input.qty, sink);
    }
    const doubled = doubledOutput(state, active.id);
    for (const made of active.outputs) giveItem(state, made.id, made.qty * (doubled ? 2 : 1), sink);
    const rebuilding = !!recipe?.oneTime && structureKnown(state, recipe.id);
    if (recipe?.oneTime) {
      state.buildingsEver[recipe.id] = true;
      state.buildings[recipe.id] = true;
    }
    const skill = recipe?.skill ?? 'Enchanting';
    const xpFactor = recipe && hearthAppliesToRecipe(recipe) ? 1 + 0.01 * markRank(state, 'hearth.xp') : 1;
    const levelBefore = skillLevel(state, skill);
    const falloff = recipe && falloffApplies(skill, 'recipe') ? xpFalloff(levelBefore, recipe.level) : 1;
    const gained = rebuilding
      ? 0
      : addXp(state, skill, active.xp * actionXpMultiplier(state.mastery, active.id, skill) * xpFactor * falloff);
    pushLevelToast(opts.notes, skill, levelBefore, skillLevel(state, skill));
    grantActionMastery(state, active.id, skill, active.seconds, opts);
    const markId = recipe ? markIdFromRecipe(recipe.id) : null;
    if (markId) {
      if (!state.glimmer) state.glimmer = {};
      state.glimmer[markId] = (state.glimmer[markId] ?? 0) + 1;
    }
    const made = active.outputs[0];
    if (made && recipe) {
      opts.notes?.push({ kind: 'action', skill: recipe.skill, xp: gained, itemId: made.id, qty: made.qty * (doubled ? 2 : 1) });
    }
    state.stats.actions += 1;
    if (sink) sink.actions += 1;
    state.progressMs = 0;
    if (recipe?.oneTime) state.activity = null;
    return;
  }
  const combat = state.combat;
  if (!combat) return;
  if (combat.phase === 'pause') {
    spawnEnemy(state);
    return;
  }
  const nextPlayer = (combat.swings + 1) * ATTACK_INTERVAL_MS;
  const nextEnemy = 1200 + combat.enemyAttacks * ATTACK_INTERVAL_MS;
  if (nextEnemy < nextPlayer - 1e-6) enemyAttack(state, sink, opts.notes);
  else playerAttack(state, sink, opts);
}

function running(state: Save): boolean {
  return state.activity != null && !state.paused;
}

function nextActionIn(state: Save, sink?: Sink): number | null {
  const activity = state.activity;
  if (!activity || state.paused) return null;
  if (activity.kind === 'produce' && state.progressMs <= 1e-9 && !hasInputs(state, activity.recipeId)) {
    state.activity = null;
    state.progressMs = 0;
    if (sink && sink.stopped == null) sink.stopped = 'inputs';
    return null;
  }
  if (activity.kind === 'gather') {
    return Math.max(0, actionDurationMs(state, activity.nodeId) - state.progressMs);
  }
  if (activity.kind === 'forage') {
    const duration = habitatSeconds(state, activity.habitatId) * 1000;
    if (duration <= 0) {
      state.activity = null;
      state.progressMs = 0;
      return null;
    }
    return Math.max(0, duration - state.progressMs);
  }
  if (activity.kind === 'produce') {
    return Math.max(0, actionDurationMs(state, activity.recipeId) - state.progressMs);
  }
  const combat = state.combat;
  if (!combat) return null;
  if (combat.phase === 'pause') {
    const end = (combat.killAtMs ?? state.progressMs) + KILL_PAUSE_MS;
    return Math.max(0, end - state.progressMs);
  }
  const nextPlayer = (combat.swings + 1) * ATTACK_INTERVAL_MS;
  const nextEnemy = 1200 + combat.enemyAttacks * ATTACK_INTERVAL_MS;
  return Math.max(0, Math.min(nextPlayer, nextEnemy) - state.progressMs);
}

export function simulate(state: Save, ms: number, sink?: Sink, opts: SimOptions = {}): void {
  let left = ms;
  let guard = 0;
  while (guard++ < 20_000_000) {
    const regenIn = REGEN_MS - state.regenMs;
    const actIn = nextActionIn(state, sink);
    const due = (actIn != null && actIn <= 1e-6) || regenIn <= 1e-6;
    if (left <= 1e-6 && !due) break;
    let kind: 'regen' | 'action' = 'regen';
    let dt = regenIn;
    if (actIn != null) {
      const tie = Math.abs(actIn - regenIn) <= 1e-6;
      if (tie) {
        if (REGEN_BEFORE_ATTACK_ON_TIE) {
          kind = 'regen';
          dt = regenIn;
        } else {
          kind = 'action';
          dt = actIn;
        }
      } else if (actIn < regenIn) {
        kind = 'action';
        dt = actIn;
      }
    }
    if (dt > left + 1e-6) {
      state.regenMs += left;
      if (running(state)) state.progressMs += left;
      break;
    }
    state.regenMs += dt;
    if (running(state)) state.progressMs += dt;
    left -= dt;
    if (kind === 'regen') {
      state.regenMs = 0;
      const cap = maxHp(state);
      if (state.hp < cap) state.hp = Math.min(cap, state.hp + REGEN_HP);
    } else {
      resolveDue(state, sink, opts);
    }
  }
}

export function stepCompletion(state: Save, opts: SimOptions = {}): { ms: number; type: string } {
  if (state.paused) return { ms: 0, type: 'paused' };
  if (!state.activity) return { ms: 0, type: 'idle' };
  if (state.activity.kind === 'produce' && !hasInputs(state, state.activity.recipeId)) {
    state.activity = null;
    state.progressMs = 0;
    return { ms: 0, type: 'inputs' };
  }
  let ms = 0;
  if (state.activity.kind === 'combat' && state.combat) {
    const killsBefore = state.stats.kills;
    let guard = 0;
    while (guard++ < 200000) {
      if (state.paused) break;
      const spawnedNext =
        state.stats.kills > killsBefore &&
        state.combat?.phase === 'fight' &&
        state.progressMs <= 1e-6 &&
        state.combat.swings === 0;
      if (spawnedNext) break;
      const wait = nextActionIn(state);
      if (wait == null) break;
      simulate(state, wait, undefined, opts);
      ms += wait;
    }
    const type = state.stats.kills > killsBefore ? 'kill' : state.paused ? 'paused' : 'none';
    return { ms, type };
  } else if (state.activity.kind === 'gather') {
    ms = actionDurationMs(state, state.activity.nodeId) - state.progressMs;
  } else if (state.activity.kind === 'forage') {
    ms = habitatSeconds(state, state.activity.habitatId) * 1000 - state.progressMs;
  } else if (state.activity.kind === 'produce') {
    ms = actionDurationMs(state, state.activity.recipeId) - state.progressMs;
  }
  if (ms < 0) ms = 0;
  const kills = state.stats.kills;
  const actions = state.stats.actions;
  simulate(state, ms, undefined, opts);
  const type = state.stats.kills > kills ? 'kill' : state.stats.actions > actions ? 'action' : 'none';
  return { ms, type };
}

function pushLevelToast(notes: FloatNote[] | undefined, skill: string, before: number, after: number): void {
  if (notes && after > before) notes.push({ kind: 'toast', text: `${skill} reached Lv ${after}` });
}

function grantActionMastery(state: Save, id: string, skill: SkillId, baseSeconds: number, opts: SimOptions): void {
  const beforeBonus = globalXpBonus(state.mastery, skill);
  const before = masteryLevel(state.mastery[id] ?? 0);
  state.mastery[id] = (state.mastery[id] ?? 0) + actionMasteryXp(baseSeconds);
  const after = masteryLevel(state.mastery[id]);
  if (!opts.notes || after === before) return;
  const name = trackName(id);
  for (const text of levelUpLines(name, before, after, 'node')) opts.notes.push({ kind: 'toast', text });
  const bonus = globalBonusLine(skill, beforeBonus, globalXpBonus(state.mastery, skill));
  if (bonus) opts.notes.push({ kind: 'toast', text: bonus });
}

function grantEnemyMastery(state: Save, enemyId: string, opts: SimOptions): void {
  const before = masteryLevel(state.enemyMastery[enemyId] ?? 0);
  state.enemyMastery[enemyId] = (state.enemyMastery[enemyId] ?? 0) + ENEMY_MASTERY_XP;
  const after = masteryLevel(state.enemyMastery[enemyId]);
  if (!opts.notes || after === before) return;
  for (const text of levelUpLines(trackName(enemyId), before, after, 'enemy')) opts.notes.push({ kind: 'toast', text });
}

function masteryLevelsOf(state: Save): Record<string, number> {
  const levels: Record<string, number> = {};
  for (const [id, mxp] of Object.entries(state.mastery)) levels[id] = masteryLevel(mxp);
  for (const [id, mxp] of Object.entries(state.enemyMastery)) levels[`enemy:${id}`] = masteryLevel(mxp);
  return levels;
}

function skillBonusOf(state: Save): Partial<Record<SkillId, number>> {
  const bonus: Partial<Record<SkillId, number>> = {};
  for (const skill of SKILL_IDS) bonus[skill] = globalXpBonus(state.mastery, skill);
  return bonus;
}

function masteryGained(
  before: Record<string, number>,
  state: Save,
): { levels: CatchupReport['masteryLevels']; perks: string[] } {
  const after = masteryLevelsOf(state);
  const levels: CatchupReport['masteryLevels'] = [];
  const perks: string[] = [];
  for (const id of Object.keys(after)) {
    const from = before[id] ?? 1;
    const to = after[id];
    if (to <= from) continue;
    const bare = id.startsWith('enemy:') ? id.slice(6) : id;
    const kind = id.startsWith('enemy:') ? 'enemy' : 'node';
    levels.push({ id: bare, name: trackName(bare), before: from, after: to });
    perks.push(...levelUpLines(trackName(bare), from, to, kind));
  }
  return { levels, perks };
}

function bonusLines(before: Partial<Record<SkillId, number>>, state: Save): string[] {
  const lines: string[] = [];
  for (const skill of SKILL_IDS) {
    const line = globalBonusLine(skill, before[skill] ?? 0, globalXpBonus(state.mastery, skill));
    if (line) lines.push(line);
  }
  return lines;
}

function levelsOf(state: Save): Partial<Record<SkillId, number>> {
  const out: Partial<Record<SkillId, number>> = {};
  for (const skill of state.owned) out[skill] = skillLevel(state, skill);
  return out;
}

/**
 * Plot 1 exists once Farming is owned. Paid plots stay even if the level later drops.
 * A longer saved list is kept, so a bought plot is never dropped on load.
 */
export function ensureFarmPlots(state: Save): void {
  if (!Array.isArray(state.plots)) state.plots = [];
  if (!Number.isInteger(state.plotsBought) || state.plotsBought < 0) state.plotsBought = 0;
  if (state.plotsBought > PLOT_GATES.length) state.plotsBought = PLOT_GATES.length;
  if (!state.owned.includes('Farming')) return;
  const implied = Math.min(PLOT_GATES.length, Math.max(0, state.plots.length - 1));
  if (state.plotsBought < implied) state.plotsBought = implied;
  const need = 1 + state.plotsBought;
  while (state.plots.length < need) state.plots.push(null);
}

/** Buy the next paid plot. It needs the Farming level and the coins. Order is fixed by the count. */
export function buyPlot(state: Save): boolean {
  if (!state.owned.includes('Farming')) return false;
  ensureFarmPlots(state);
  const gate = PLOT_GATES[state.plotsBought];
  if (!gate) return false;
  if (skillLevel(state, 'Farming') < gate.level) return false;
  if (state.coins < gate.cost) return false;
  state.coins = roundXp(state.coins - gate.cost);
  noteSpent(state, gate.cost);
  state.plotsBought += 1;
  state.plots.push(null);
  return true;
}

function compostItemId(compost: CompostKind): string | null {
  if (compost === 'bone') return BONE_COMPOST_ITEM_ID;
  if (compost === 'compost') return COMPOST_ITEM_ID;
  return null;
}

/** Required plant inputs, in recipe order. Compost is not required. */
function firstMissingRequiredInput(state: Save, recipeId: string): string | null {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe) return null;
  for (const input of recipe.inputs) {
    if ((state.bank[input.id] ?? 0) < input.qty) return input.id;
  }
  return null;
}

/** Bone compost, then compost, otherwise none. One item, and only when it is in stock. */
function replantCompost(state: Save): CompostKind {
  if ((state.bank[BONE_COMPOST_ITEM_ID] ?? 0) >= 1) return 'bone';
  if ((state.bank[COMPOST_ITEM_ID] ?? 0) >= 1) return 'compost';
  return null;
}

/** Plant on an empty owned plot. This is not the selected activity, and it does not require Farming to be selected. */
export function plantOnPlot(state: Save, index: number, recipeId: string, compost: CompostKind, sink?: Sink): boolean {
  if (!state.owned.includes('Farming')) return false;
  ensureFarmPlots(state);
  if (!Number.isInteger(index) || index < 0 || index >= state.plots.length) return false;
  if (state.plots[index]) return false;
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe || !isPlotCrop(recipeId)) return false;
  if (skillLevel(state, 'Farming') < recipe.level) return false;
  if (firstMissingRequiredInput(state, recipeId)) return false;
  const compostId = compostItemId(compost);
  if (compostId && (state.bank[compostId] ?? 0) < 1) return false;
  for (const input of recipe.inputs) takeItem(state, input.id, input.qty, sink);
  if (compostId) takeItem(state, compostId, 1, sink);
  const speed = masteryPerks(masteryLevel(state.mastery[recipeId] ?? 0)).speed;
  state.plots[index] = { recipeId, remainingMs: plotGrowMs(recipe.seconds, compost, speed), compost };
  return true;
}

/** One-time purchase. No Farming level gate, and it is not refunded. */
export function buyAutoReplant(state: Save): boolean {
  if (state.autoReplant) return false;
  if (state.coins < AUTO_REPLANT_COST) return false;
  state.coins = roundXp(state.coins - AUTO_REPLANT_COST);
  noteSpent(state, AUTO_REPLANT_COST);
  state.autoReplant = true;
  state.autoReplantOn = true;
  return true;
}

/** Flip the account-wide switch. Only available after the unlock is owned. */
export function toggleAutoReplant(state: Save): boolean {
  if (!state.autoReplant) return false;
  state.autoReplantOn = state.autoReplantOn === false;
  return true;
}

/** Drop the crop. No refund, no XP, no mastery. */
export function cancelPlot(state: Save, index: number): void {
  if (!state.plots[index]) return;
  state.plots[index] = null;
}

function harvestPlot(
  state: Save,
  index: number,
  sink?: Sink,
  notes?: FloatNote[],
): { itemId: string; qty: number; replanted: boolean; missing: string | null } | null {
  const plot = state.plots[index];
  if (!plot) return null;
  const recipe = RECIPE_BY_ID[plot.recipeId];
  if (!recipe) {
    state.plots[index] = null;
    return null;
  }
  if (!bankHasSpace(state)) {
    plot.ready = true;
    plot.remainingMs = 0;
    return null;
  }
  const legacy = plot.legacy === true;
  let qtyTotal = 0;
  let itemId = recipe.outputs[0]?.id ?? recipe.id;
  if (legacy) {
    for (const made of recipe.outputs) {
      giveItem(state, made.id, made.qty, sink);
      qtyTotal += made.qty;
      itemId = made.id;
    }
    addXp(state, 'Farming', recipe.xp * actionXpMultiplier(state.mastery, recipe.id, 'Farming'));
    grantActionMastery(state, recipe.id, 'Farming', recipe.seconds, {});
  } else {
    const doubled = doubledOutput(state, recipe.id);
    for (const made of recipe.outputs) {
      const qty = Math.round(harvestProduce(made.qty, plot.compost) * (1 + 0.01 * markRank(state, 'road.yield'))) * (doubled ? 2 : 1);
      giveItem(state, made.id, qty, sink);
      qtyTotal += qty;
      itemId = made.id;
    }
    addXp(state, 'Farming', harvestXp(recipe.xp) * actionXpMultiplier(state.mastery, recipe.id, 'Farming'));
    grantActionMastery(state, recipe.id, 'Farming', recipe.seconds * HARVEST_FACTOR, {});
  }
  state.stats.actions += 1;
  if (sink) sink.actions += 1;
  state.plots[index] = null;
  const again = tryAutoReplant(state, index, plot.recipeId, sink, notes);
  return { itemId, qty: qtyTotal, replanted: again.replanted, missing: again.missing };
}

function replantWanted(state: Save): boolean {
  return state.autoReplant === true && state.autoReplantOn !== false;
}

function tryAutoReplant(
  state: Save,
  index: number,
  recipeId: string,
  sink?: Sink,
  notes?: FloatNote[],
): { replanted: boolean; missing: string | null } {
  if (!replantWanted(state)) return { replanted: false, missing: null };
  const missing = firstMissingRequiredInput(state, recipeId);
  if (missing) {
    notes?.push({ kind: 'toast', text: `Plot ${index + 1} not replanted: no ${countedLabel(1, missing)}` });
    return { replanted: false, missing };
  }
  return { replanted: plantOnPlot(state, index, recipeId, replantCompost(state), sink), missing: null };
}

/** Plots finish in completion order. A tie goes to the lower plot number, and that replant happens before the next harvest. */
function fieldsHarvestToast(totals: Map<string, number>, order: string[], replanted: number): string {
  const items = order.map((id) => `${itemName(id)} ×${grouped(totals.get(id) ?? 0)}`).join(' · ');
  const text = `Fields harvested: ${items}`;
  return replanted > 0 ? `${text} · replanted ${grouped(replanted)}` : text;
}

function growPlots(state: Save, ms: number, sink?: Sink, lines?: string[], notes?: FloatNote[]): void {
  ensureFarmPlots(state);
  const levelBefore = notes ? skillLevel(state, 'Farming') : 0;
  const bonusBefore = notes ? globalXpBonus(state.mastery, 'Farming') : 0;
  const masteryBefore = notes ? masteryLevelsOf(state) : null;
  let left = Math.max(0, ms);
  const held = new Set<number>();
  const totals = new Map<string, number>();
  const order: string[] = [];
  let replanted = 0;
  const plotRows = new Map<number, { itemId: string; qty: number; replanted: number; missing: string | null }>();
  for (let guard = 0; guard < 10_000; guard += 1) {
    let due = -1;
    for (let index = 0; index < state.plots.length; index += 1) {
      if (held.has(index)) continue;
      const plot = state.plots[index];
      if (plot && (plot.ready || plot.remainingMs <= 0)) {
        due = index;
        break;
      }
    }
    if (due >= 0) {
      const before = state.plots[due];
      const harvested = harvestPlot(state, due, sink, notes);
      if (harvested) {
        if (notes) {
          if (!totals.has(harvested.itemId)) order.push(harvested.itemId);
          totals.set(harvested.itemId, (totals.get(harvested.itemId) ?? 0) + harvested.qty);
          if (harvested.replanted) replanted += 1;
        }
        if (lines) {
          const row = plotRows.get(due) ?? { itemId: harvested.itemId, qty: 0, replanted: 0, missing: null };
          row.itemId = harvested.itemId;
          row.qty += harvested.qty;
          if (harvested.replanted) row.replanted += 1;
          if (harvested.missing) row.missing = harvested.missing;
          plotRows.set(due, row);
        }
      }
      if (state.plots[due] === before) held.add(due);
      continue;
    }
    if (left <= 0) break;
    const factor = 1 - 0.01 * markRank(state, 'road.grow');
    let next = Infinity;
    for (const plot of state.plots) {
      if (!plot || plot.ready) continue;
      const wall = factor > 0 ? plot.remainingMs * factor : plot.remainingMs;
      if (wall < next) next = wall;
    }
    if (!Number.isFinite(next)) break;
    const step = Math.min(left, next);
    for (const plot of state.plots) {
      if (!plot || plot.ready) continue;
      plot.remainingMs -= factor > 0 ? step / factor : step;
      if (plot.remainingMs < 1e-4) plot.remainingMs = 0;
    }
    left -= step;
  }
  if (lines) {
    for (const [index, row] of plotRows) {
      let text = `Plot ${index + 1}: ${itemName(row.itemId)} ×${row.qty.toLocaleString('en-US')}`;
      if (row.replanted >= 1) text += ` · replanted ${grouped(row.replanted)}`;
      if (row.missing) text += ` · not replanted: no ${countedLabel(1, row.missing)}`;
      lines.push(text);
    }
  }
  if (notes && order.length > 0) {
    notes.push({ kind: 'toast', text: fieldsHarvestToast(totals, order, replanted) });
    const levelAfter = skillLevel(state, 'Farming');
    if (levelAfter > levelBefore) notes.push({ kind: 'toast', text: `Farming reached Lv ${levelAfter}` });
    if (masteryBefore) {
      for (const perk of masteryGained(masteryBefore, state).perks) notes.push({ kind: 'toast', text: perk });
      const bonus = globalBonusLine('Farming', bonusBefore, globalXpBonus(state.mastery, 'Farming'));
      if (bonus) notes.push({ kind: 'toast', text: bonus });
    }
  }
}

/** 15 min, 1 h, and 8 h. An expedition stores one of these for the whole trip. */
export const EXPEDITION_MS = [15 * 60 * 1000, 60 * 60 * 1000, 8 * 60 * 60 * 1000] as const;

export interface ExplorationRoute {
  id: string;
  level: number;
  seconds: number;
  xp: number;
  inputs: { id: string; qty: number }[];
  outputs: { id: string; qty: number }[];
  cost: number;
  locked?: string;
}

/** Exploration nodes and recipes, level order. Nodes stay ahead of recipes at the same level. */
export function explorationRoutes(): ExplorationRoute[] {
  const nodes = NODES.filter((node) => node.skill === 'Exploration').map((node) => ({
    id: node.id,
    level: node.level,
    seconds: node.seconds,
    xp: node.xp,
    inputs: [],
    outputs: [{ id: node.id, qty: 1 }],
    cost: node.cost,
  }));
  const recipes = RECIPES.filter((recipe) => recipe.skill === 'Exploration').map((recipe) => ({
    id: recipe.id,
    level: recipe.level,
    seconds: recipe.seconds,
    xp: recipe.xp,
    inputs: recipe.inputs,
    outputs: recipe.outputs,
    cost: 0,
    locked: recipe.locked ?? (recipe.comingLater ? 'Coming later' : undefined),
  }));
  return [...nodes, ...recipes].sort((a, b) => a.level - b.level);
}

export function explorationRoute(id: string): ExplorationRoute | null {
  return explorationRoutes().find((route) => route.id === id) ?? null;
}

export function expeditionRouteName(id: string): string {
  const node = NODE_BY_ID[id];
  if (node) return itemName(id);
  const recipe = RECIPE_BY_ID[id];
  return recipe ? actionTitle(recipe) : id;
}

/** Whole minutes and seconds. Minutes are not capped at 59, so an hour is 60:00. */
export function expeditionClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function expeditionRemainingMs(state: Save): number {
  const trip = state.expedition;
  if (!trip) return 0;
  return Math.max(0, trip.durationMs - trip.creditedMs);
}

function expeditionTicks(state: Save, routeId: string, elapsedMs: number): number {
  const tickMs = actionSeconds(state, routeId) * 1000;
  if (!(tickMs > 0) || elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / tickMs);
}

export interface ExpeditionPreview {
  ticks: number;
  items: { id: string; qty: number }[];
  xp: number;
  mxp: number;
}

/** Stored XP for one tick, using the mastery and global bonus before this tick's MXP is added. */
function expeditionTickXp(
  mastery: Record<string, number>,
  routeId: string,
  baseXp: number,
  skillXp: number,
  routeLevel: number,
): number {
  return baseXp * actionXpMultiplier(mastery, routeId, 'Exploration') * xpFalloff(levelForXp(skillXp), routeLevel);
}

/** How much of `amount` the live add-XP path would keep, and the XP total after it. */
function creditSkillXp(current: number, amount: number): { next: number; gained: number } {
  if (current >= XP_CAP - 1e-9) return { next: current, gained: 0 };
  const next = Math.min(XP_CAP, roundXp(current + amount));
  return { next, gained: roundXp(next - current) };
}

/**
 * Haul for a duration. Tick time uses mastery at the call, which is the start of the trip.
 * XP follows §2.7 on each tick, including a mastery-30 or global-bonus change after a tick's MXP.
 * Double-output rolls are not included.
 */
export function expeditionPreview(state: Save, routeId: string, durationMs: number): ExpeditionPreview {
  const route = explorationRoute(routeId);
  const ticks = expeditionTicks(state, routeId, durationMs);
  const mxpEach = actionMasteryXp(route?.seconds ?? 0);
  const mastery = { ...state.mastery };
  let skillXp = state.xp.Exploration ?? 0;
  let xp = 0;
  for (let tick = 0; tick < ticks; tick += 1) {
    const step = creditSkillXp(
      skillXp,
      expeditionTickXp(mastery, routeId, route?.xp ?? 0, skillXp, route?.level ?? 0),
    );
    skillXp = step.next;
    xp = roundXp(xp + step.gained);
    mastery[routeId] = (mastery[routeId] ?? 0) + mxpEach;
  }
  return {
    ticks,
    items: (route?.outputs ?? []).map((output) => ({ id: output.id, qty: output.qty * ticks })),
    xp,
    mxp: ticks * mxpEach,
  };
}

function haulIsEmpty(preview: ExpeditionPreview): boolean {
  return preview.xp <= 1e-9 && preview.items.every((item) => item.qty <= 0);
}

export function startExpedition(state: Save, routeId: string, durationMs: number, now: number): boolean {
  if (!(EXPEDITION_MS as readonly number[]).includes(durationMs)) return false;
  if (state.expedition) return false;
  const route = explorationRoute(routeId);
  if (!route || route.locked) return false;
  if (!state.owned.includes('Exploration')) return false;
  if (skillLevel(state, 'Exploration') < route.level) return false;
  if (route.cost > 0 && !state.nodes.includes(routeId)) return false;
  if (haulIsEmpty(expeditionPreview(state, routeId, durationMs))) return false;
  if (route.inputs.some((input) => (state.bank[input.id] ?? 0) < input.qty)) return false;
  for (const input of route.inputs) takeItem(state, input.id, input.qty);
  state.expedition = { routeId, startedAt: now, durationMs, creditedMs: 0 };
  return true;
}

interface ExpeditionGrant {
  ticks: number;
  xp: number;
  items: Record<string, number>;
}

function grantExpedition(state: Save, routeId: string, elapsedMs: number, sink?: Sink, notes?: FloatNote[]): ExpeditionGrant {
  const route = explorationRoute(routeId);
  const levelBefore = skillLevel(state, 'Exploration');
  const bonusBefore = globalXpBonus(state.mastery, 'Exploration');
  const masteryBefore = masteryLevel(state.mastery[routeId] ?? 0);
  const ticks = expeditionTicks(state, routeId, elapsedMs);
  const items: Record<string, number> = {};
  const outputs = route?.outputs ?? [];
  const mxpEach = actionMasteryXp(route?.seconds ?? 0);
  let xp = 0;
  for (let tick = 0; tick < ticks; tick += 1) {
    const doubled = outputs.length > 0 && masteryLevel(state.mastery[routeId] ?? 0) >= 40 && expeditionDoubled(state);
    for (const output of outputs) {
      const qty = output.qty * (doubled ? 2 : 1);
      giveItem(state, output.id, qty, sink);
      items[output.id] = (items[output.id] ?? 0) + qty;
    }
    xp = roundXp(
      xp +
        addXp(
          state,
          'Exploration',
          expeditionTickXp(state.mastery, routeId, route?.xp ?? 0, state.xp.Exploration ?? 0, route?.level ?? 0),
        ),
    );
    if (route) state.mastery[routeId] = (state.mastery[routeId] ?? 0) + mxpEach;
  }
  const haul = 1 + 0.01 * markRank(state, 'road.haul');
  if (haul !== 1) {
    for (const id of Object.keys(items)) {
      const floored = Math.floor(items[id] * haul);
      const delta = floored - items[id];
      items[id] = floored;
      if (delta !== 0) giveItem(state, id, delta, sink);
    }
  }
  if (route && ticks > 0) {
    state.stats.actions += 1;
    if (sink) sink.actions += 1;
  }
  const text = haulToast(expeditionRouteName(routeId), items, xp);
  if (notes && ticks > 0) {
    if (text) notes.push({ kind: 'toast', text });
    const levelAfter = skillLevel(state, 'Exploration');
    if (levelAfter > levelBefore) notes.push({ kind: 'toast', text: `Exploration reached Lv ${levelAfter}` });
    for (const line of levelUpLines(trackName(routeId), masteryBefore, masteryLevel(state.mastery[routeId] ?? 0), 'node')) {
      notes.push({ kind: 'toast', text: line });
    }
    const bonus = globalBonusLine('Exploration', bonusBefore, globalXpBonus(state.mastery, 'Exploration'));
    if (bonus) notes.push({ kind: 'toast', text: bonus });
  }
  return { ticks, xp, items };
}

/** Credit time toward the trip. The haul is paid only when the stored duration is reached. */
function advanceExpedition(state: Save, ms: number, sink?: Sink, notes?: FloatNote[]): ExpeditionGrant | null {
  const trip = state.expedition;
  if (!trip || ms <= 0) return null;
  const room = Math.max(0, trip.durationMs - trip.creditedMs);
  trip.creditedMs += Math.min(ms, room);
  if (trip.creditedMs + 1e-9 < trip.durationMs) return null;
  const grant = grantExpedition(state, trip.routeId, trip.durationMs, sink, notes);
  state.expedition = null;
  return grant;
}

/** Pay the ticks already credited and end the trip. Inputs are not returned. */
export function returnExpedition(state: Save, notes?: FloatNote[]): boolean {
  const trip = state.expedition;
  if (!trip) return false;
  grantExpedition(state, trip.routeId, trip.creditedMs, undefined, notes);
  state.expedition = null;
  return true;
}

function isLegacyExploration(activity: Activity | null): boolean {
  if (!activity) return false;
  if (activity.kind === 'gather') return NODE_BY_ID[activity.nodeId]?.skill === 'Exploration';
  if (activity.kind === 'produce') return RECIPE_BY_ID[activity.recipeId]?.skill === 'Exploration';
  return false;
}

function stopLegacyExploration(state: Save): void {
  if (!isLegacyExploration(state.activity)) return;
  state.activity = null;
  state.progressMs = 0;
}

function grouped(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function groupCount(value: number): string {
  return Math.floor(value).toLocaleString('en-US');
}

function expeditionItemText(items: Record<string, number>): string {
  const parts = Object.entries(items).filter(([, qty]) => qty > 0);
  if (parts.length === 0) return '';
  return parts.map(([id, qty]) => `${countedLabel(qty, id)} ×${groupCount(qty)}`).join(', ');
}

/** Finished haul, or a trip that is still out. Nothing is listed for a trip that granted nothing yet. */
export function expeditionReportLine(name: string, grant: { ticks: number; items: Record<string, number>; xp: number } | null, leftMs = 0): string {
  if (!grant) return `Expedition: ${name} — out, ${expeditionClock(leftMs)} left`;
  const parts = [`Expedition: ${name}`, `${groupCount(grant.ticks)} ticks`];
  const items = expeditionItemText(grant.items);
  if (items) parts.push(items);
  if (grant.xp > 1e-9) parts.push(`${groupCount(grant.xp)} XP`);
  return `${parts.join(', ')} — finished`;
}

/** Toast for a haul granted while the app is open. Empty when nothing was paid. */
export function haulToast(name: string, items: Record<string, number>, xp: number): string | null {
  const gained = expeditionItemText(items);
  const xpText = xp > 1e-9 ? `${groupCount(xp)} XP` : '';
  const body = [gained, xpText].filter(Boolean).join(' · ');
  if (!body) return null;
  return `${name} is back: ${body}`;
}

function describeExpedition(before: Save['expedition'], grant: ExpeditionGrant | null, after: Save['expedition']): string | null {
  if (!before) return null;
  const name = expeditionRouteName(before.routeId);
  if (grant) return expeditionReportLine(name, grant);
  const duration = after?.durationMs ?? before.durationMs;
  const credited = after?.creditedMs ?? before.creditedMs;
  return expeditionReportLine(name, null, Math.max(0, duration - credited));
}

/**
 * Advance a visible tab to `now`.
 * A backwards clock credits 0 and moves the last-credited time to `now`,
 * so the next positive gap runs immediately instead of waiting for the clock to catch up.
 * Plots and the expedition share that window with the selected activity.
 */
export function advanceOpenTab(
  state: Save,
  now: number,
  silentGapMs: number,
  notes?: FloatNote[],
): CatchupReport | null {
  const gap = now - state.lastCredited;
  if (gap < 0 || gap >= silentGapMs) return creditOffline(state, now);
  if (gap > 0) {
    stopLegacyExploration(state);
    simulate(state, gap, undefined, notes ? { notes } : undefined);
    growPlots(state, gap, undefined, undefined, notes);
    advanceExpedition(state, gap, undefined, notes);
    noteTime(state, gap);
    state.lastCredited = now;
  }
  return null;
}

export function creditOffline(state: Save, now: number): CatchupReport {
  const away = now - state.lastCredited;
  const before = levelsOf(state);
  const xpBefore = { ...state.xp };
  const expBefore = state.expedition ? { ...state.expedition } : null;
  const report: CatchupReport = {
    awayMs: away,
    creditedMs: 0,
    capped: false,
    backwards: false,
    activity: activityLabel(state),
    actions: 0,
    kills: 0,
    xpGained: {},
    levelsBefore: before,
    levelsAfter: before,
    itemsGained: {},
    itemsConsumed: {},
    coinsGained: 0,
    foodEaten: 0,
    stopped: 'window',
    masteryLevels: [],
    perksUnlocked: [],
    expeditionLine: null,
    plotHarvests: [],
  };
  if (away < 0) {
    report.backwards = true;
    report.stopped = 'backwards';
    state.lastCredited = now;
    stopLegacyExploration(state);
    stopRetiredSeal(state);
    report.expeditionLine = describeExpedition(expBefore, null, state.expedition);
    report.levelsAfter = levelsOf(state);
    mergeLegacyItemCounts(report.itemsGained);
    mergeLegacyItemCounts(report.itemsConsumed);
    return report;
  }
  const credited = Math.min(away, OFFLINE_CAP_MS);
  report.creditedMs = credited;
  report.capped = away > OFFLINE_CAP_MS + 1e-6;
  const masteryBefore = masteryLevelsOf(state);
  const bonusBefore = skillBonusOf(state);
  const wasPaused = state.paused;
  const sink: Sink = {
    actions: 0,
    kills: 0,
    foodEaten: 0,
    coins: 0,
    gained: {},
    consumed: {},
    stopped: null,
  };
  const plotHarvests: string[] = [];
  simulate(state, credited, sink);
  growPlots(state, credited, sink, plotHarvests);
  report.plotHarvests = plotHarvests;
  const expeditionGrant = advanceExpedition(state, credited, sink);
  stopLegacyExploration(state);
  report.expeditionLine = describeExpedition(expBefore, expeditionGrant, state.expedition);
  noteTime(state, credited);
  report.actions = sink.actions;
  report.kills = sink.kills;
  report.foodEaten = sink.foodEaten;
  report.coinsGained = sink.coins;
  mergeLegacyItemCounts(sink.gained);
  mergeLegacyItemCounts(sink.consumed);
  report.itemsGained = sink.gained;
  report.itemsConsumed = sink.consumed;
  for (const skill of Object.keys({ ...xpBefore, ...state.xp }) as SkillId[]) {
    const gained = roundXp((state.xp[skill] ?? 0) - (xpBefore[skill] ?? 0));
    if (gained !== 0) report.xpGained[skill] = gained;
  }
  report.levelsAfter = levelsOf(state);
  const gained = masteryGained(masteryBefore, state);
  report.masteryLevels = gained.levels;
  report.perksUnlocked = gained.perks.concat(bonusLines(bonusBefore, state));
  if (sink.stopped) report.stopped = sink.stopped;
  else if (wasPaused || state.paused) report.stopped = 'paused';
  else report.stopped = 'window';
  stopRetiredSeal(state);
  state.lastCredited = now;
  return report;
}

/** A retired seal finishes this catch-up, including a backwards clock, and then stops. */
function stopRetiredSeal(state: Save): void {
  if (state.activity?.kind === 'produce' && retiredSeal(state.activity.recipeId)) {
    state.activity = null;
    state.progressMs = 0;
  }
}

/** Buy the next rank of one modifier with that mark's glimmer. Never spends another mark's glimmer. */
export function buyMarkRank(state: Save, modifierId: string, requested?: number): boolean {
  const mod = MODIFIER_BY_ID[modifierId];
  const mark = mod ? MARK_BY_ID[mod.markId] : null;
  if (!mod || !mark) return false;
  if (!state.glimmer) state.glimmer = {};
  if (!state.markRanks) state.markRanks = {};
  const current = markRank(state, modifierId);
  if (current >= 5) return false;
  const next = current + 1;
  if (requested != null && requested !== next) return false;
  const cost = rankCost(mod.seconds, next);
  if ((state.glimmer[mark.id] ?? 0) < cost) return false;
  state.glimmer[mark.id] -= cost;
  if (state.glimmer[mark.id] === 0) delete state.glimmer[mark.id];
  state.markRanks[modifierId] = next;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Catalogue id kept, demo-only id removed. Counts add onto the survivor.
 * A missing old key is left alone. A zero total is omitted. Mastery is not touched.
 */
const LEGACY_ITEM_IDS: Record<string, string> = {
  'mat.berry.meadow': 'mat.fruit.berries',
  'mat.herb.meadow_cuttings': 'mat.cutting.meadow_herb',
  'mat.moss.spell': 'mat.reagent.spell_moss',
  'mat.part.beetle_carapace': 'mat.combat.beetle_carapace',
  'mat.wax.grub': 'mat.combat.grub_wax',
};

export function mergeLegacyItemCounts(map: Record<string, number>): void {
  for (const [oldId, nextId] of Object.entries(LEGACY_ITEM_IDS)) {
    if (!Object.prototype.hasOwnProperty.call(map, oldId)) continue;
    const total = (map[nextId] ?? 0) + (map[oldId] ?? 0);
    delete map[oldId];
    if (total > 0) map[nextId] = total;
    else delete map[nextId];
  }
}

export function deserialize(raw: string): Save | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (
    parsed.saveFormat !== SAVE_FORMAT &&
    parsed.saveFormat !== SAVE_FORMAT_V1 &&
    parsed.saveFormat !== SAVE_FORMAT_V2 &&
    parsed.saveFormat !== SAVE_FORMAT_V3
  ) {
    return null;
  }
  if (typeof parsed.coins !== 'number' || !Number.isFinite(parsed.coins)) return null;
  if (!isRecord(parsed.xp)) return null;
  if (!Array.isArray(parsed.owned) || !Array.isArray(parsed.nodes)) return null;
  if (!isRecord(parsed.bank)) return null;
  if (typeof parsed.purchaseCount !== 'number') return null;
  if (typeof parsed.lastCredited !== 'number' || !Number.isFinite(parsed.lastCredited)) return null;
  if (typeof parsed.hp !== 'number' || !Number.isFinite(parsed.hp)) return null;
  if (typeof parsed.paused !== 'boolean') return null;
  if (typeof parsed.rngState !== 'number') return null;
  const xp: Save['xp'] = {};
  for (const [key, value] of Object.entries(parsed.xp)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    xp[key as SkillId] = value;
  }
  const bank: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed.bank)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    if (value > 0) bank[key] = value;
  }
  mergeLegacyItemCounts(bank);
  const statsIn = isRecord(parsed.stats) ? parsed.stats : {};
  const stats = emptyStats();
  if (typeof statsIn.actions === 'number') stats.actions = statsIn.actions;
  if (typeof statsIn.kills === 'number') stats.kills = statsIn.kills;
  if (typeof statsIn.pauses === 'number') stats.pauses = statsIn.pauses;
  if (typeof statsIn.foodEaten === 'number') stats.foodEaten = statsIn.foodEaten;
  if (typeof statsIn.coinsFromKills === 'number') stats.coinsFromKills = statsIn.coinsFromKills;
  if (typeof statsIn.coinsFromSales === 'number') stats.coinsFromSales = statsIn.coinsFromSales;
  if (typeof statsIn.coinsEarned === 'number') stats.coinsEarned = statsIn.coinsEarned;
  if (typeof statsIn.coinsSpent === 'number') stats.coinsSpent = statsIn.coinsSpent;
  if (typeof statsIn.timePlayed === 'number') stats.timePlayed = statsIn.timePlayed;
  if (typeof statsIn.lootValue === 'number') stats.lootValue = statsIn.lootValue;
  if (isRecord(statsIn.killsByEnemy)) {
    for (const [key, value] of Object.entries(statsIn.killsByEnemy)) {
      if (typeof value === 'number') stats.killsByEnemy[key] = value;
    }
  }
  if (Array.isArray(statsIn.pauseAtKill)) {
    stats.pauseAtKill = statsIn.pauseAtKill.filter((n) => typeof n === 'number');
  }
  if (typeof statsIn.playerSwings === 'number') stats.playerSwings = statsIn.playerSwings;
  if (typeof statsIn.playerHits === 'number') stats.playerHits = statsIn.playerHits;
  if (typeof statsIn.playerMisses === 'number') stats.playerMisses = statsIn.playerMisses;
  if (typeof statsIn.enemyHits === 'number') stats.enemyHits = statsIn.enemyHits;
  const shop: Save['shop'] = {};
  if (isRecord(parsed.shop)) {
    for (const [key, value] of Object.entries(parsed.shop)) {
      if (!isRecord(value) || typeof value.bought !== 'number') return null;
      shop[key] = {
        bought: value.bought,
        windowStart: typeof value.windowStart === 'number' ? value.windowStart : null,
      };
    }
  }
  const equipped = emptyEquipped();
  if (isRecord(parsed.equipped)) {
    for (const slot of ['weapon', 'body', 'shield'] as const) {
      const value = parsed.equipped[slot];
      if (typeof value === 'string' && value.length > 0) equipped[slot] = value;
    }
  }
  let activity: Activity | null = null;
  if (parsed.activity != null) {
    if (!isRecord(parsed.activity) || typeof parsed.activity.kind !== 'string') return null;
    if (parsed.activity.kind === 'gather' && typeof parsed.activity.nodeId === 'string') {
      activity = { kind: 'gather', nodeId: parsed.activity.nodeId };
    } else if (parsed.activity.kind === 'forage' && typeof parsed.activity.habitatId === 'string') {
      activity = { kind: 'forage', habitatId: parsed.activity.habitatId };
    } else if (parsed.activity.kind === 'produce' && typeof parsed.activity.recipeId === 'string') {
      activity = { kind: 'produce', recipeId: parsed.activity.recipeId };
    } else if (
      parsed.activity.kind === 'combat' &&
      typeof parsed.activity.enemyId === 'string' &&
      typeof parsed.activity.style === 'string'
    ) {
      activity = {
        kind: 'combat',
        enemyId: parsed.activity.enemyId,
        style: parsed.activity.style as CombatStyle,
      };
    } else {
      return null;
    }
  }
  let combat: CombatProgress | null = null;
  if (parsed.combat != null) {
    if (!isRecord(parsed.combat)) return null;
    const c = parsed.combat;
    if (
      (c.phase !== 'fight' && c.phase !== 'pause') ||
      typeof c.hitsPerKill !== 'number' ||
      typeof c.hitsLanded !== 'number' ||
      typeof c.enemyAttacks !== 'number' ||
      typeof c.enemyHp !== 'number' ||
      typeof c.enemyMaxHp !== 'number'
    ) {
      return null;
    }
    combat = {
      phase: c.phase,
      hitsPerKill: c.hitsPerKill,
      hitsLanded: c.hitsLanded,
      swings: typeof c.swings === 'number' ? c.swings : c.hitsLanded,
      enemyAttacks: c.enemyAttacks,
      enemyHp: c.enemyHp,
      enemyMaxHp: c.enemyMaxHp,
      killAtMs: typeof c.killAtMs === 'number' ? c.killAtMs : null,
    };
  }
  const mastery = readMastery(parsed.mastery);
  const enemyMastery = readMastery(parsed.enemyMastery);
  if (!mastery || !enemyMastery) return null;
  const loaded: Save = {
    saveFormat: SAVE_FORMAT,
    coins: parsed.coins,
    xp,
    owned: parsed.owned.filter((s): s is SkillId => typeof s === 'string'),
    purchaseCount: parsed.purchaseCount,
    nodes: parsed.nodes.filter((s): s is string => typeof s === 'string'),
    bank,
    equipped,
    activity,
    progressMs: typeof parsed.progressMs === 'number' ? parsed.progressMs : 0,
    hp: parsed.hp,
    paused: parsed.paused,
    pauseCause:
      parsed.pauseCause === 'hp' || parsed.pauseCause === 'knives' || parsed.pauseCause === 'javelins' || parsed.pauseCause === 'arrows'
        ? parsed.pauseCause
        : parsed.paused
          ? 'hp'
          : null,
    combat,
    foodSlot: typeof parsed.foodSlot === 'string' ? parsed.foodSlot : null,
    shop,
    lastCredited: parsed.lastCredited,
    rngState: parsed.rngState >>> 0,
    regenMs: typeof parsed.regenMs === 'number' ? parsed.regenMs : 0,
    stats,
    mastery,
    enemyMastery,
    enemyKills: {},
    buildings: {},
    buildingsEver: {},
    plots: [],
    plotsBought: 0,
    expedition: null,
    land: {},
    glimmer: {},
    markRanks: {},
    savedAt: typeof parsed.savedAt === 'number' && Number.isFinite(parsed.savedAt) ? parsed.savedAt : undefined,
    combatScale: 0,
  };
  migrateCombatScale(loaded, parsed.combatScale);
  if (!migrateEnemyKills(loaded, parsed.saveFormat as number, parsed.enemyKills)) return null;
  if (!migrateBuildings(loaded, parsed.saveFormat as number, parsed.buildings, parsed.buildingsEver)) return null;
  if (parsed.autoReplant === true) {
    loaded.autoReplant = true;
    loaded.autoReplantOn = parsed.autoReplantOn === false ? false : true;
  }
  if (!installPlots(loaded, parsed)) return null;
  loaded.expedition = readExpedition(parsed.expedition);
  migrateForaging(loaded);
  if (!installLand(loaded, parsed)) return null;
  const glimmer = readCountMap(parsed.glimmer);
  const markRanks = readRankMap(parsed.markRanks);
  if (!glimmer || !markRanks) return null;
  loaded.glimmer = glimmer;
  loaded.markRanks = markRanks;
  if (typeof parsed.combatStyle === 'string' && (COMBAT_STYLES as readonly string[]).includes(parsed.combatStyle)) {
    const style = parsed.combatStyle as CombatStyle;
    if (loaded.owned.includes(style)) loaded.combatStyle = style;
  }
  return loaded;
}

function readCountMap(value: unknown): Record<string, number> | null {
  if (value == null) return {};
  if (!isRecord(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value)) {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return null;
    if (amount > 0) out[key] = amount;
  }
  return out;
}

function readRankMap(value: unknown): Record<string, number> | null {
  if (value == null) return {};
  if (!isRecord(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value)) {
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > 5) return null;
    if (amount > 0) out[key] = amount;
  }
  return out;
}

function readExpedition(value: unknown): Save['expedition'] {
  if (value == null) return null;
  if (!isRecord(value)) return null;
  const routeId = value.routeId;
  const startedAt = value.startedAt;
  const durationMs = value.durationMs;
  const creditedMs = value.creditedMs;
  if (typeof routeId !== 'string' || routeId.length === 0) return null;
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return null;
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  if (typeof creditedMs !== 'number' || !Number.isFinite(creditedMs) || creditedMs < 0) return null;
  return { routeId, startedAt, durationMs, creditedMs: Math.min(creditedMs, durationMs) };
}

/**
 * Old Foraging saves keep their bought nodes and per-node mastery.
 * A missing habitat key starts at the highest old MXP among that habitat's nodes.
 * A gather action on a Foraging node becomes that habitat. A partial node tick
 * finishes as one habitat tick; time already credited up to lastCredited is left as saved.
 */
function migrateForaging(state: Save): void {
  for (const habitat of HABITATS) {
    const key = habitatMasteryId(habitat.id);
    if (state.mastery[key] != null) continue;
    let best = 0;
    for (const entry of habitat.entries) best = Math.max(best, state.mastery[entry.nodeId] ?? 0);
    if (best > 0) state.mastery[key] = best;
  }
  const activity = state.activity;
  if (!activity || activity.kind !== 'gather') return;
  const habitat = habitatForNode(activity.nodeId);
  if (!habitat) return;
  const partial = state.progressMs > 0;
  state.activity = { kind: 'forage', habitatId: habitat.id };
  state.progressMs = 0;
  if (partial && habitatTable(state, habitat.id).length > 0) {
    completeForageTick(state, habitat.id, undefined, {});
  }
}

/**
 * A missing `land` key places standing buildings in table order onto the tiles
 * open at this Construction level. Overflow stays in the store, with one note.
 */
function installLand(state: Save, parsed: Record<string, unknown>): boolean {
  if (typeof parsed.yardNote === 'string' && parsed.yardNote.length > 0) state.yardNote = parsed.yardNote;
  if (parsed.land !== undefined && parsed.land !== null) {
    const land = readLand(parsed.land);
    if (!land) return false;
    state.land = land;
    return true;
  }
  state.land = {};
  const open = openYardTiles(yardLevel(state));
  const overflow: string[] = [];
  let tile = 0;
  for (const id of YARD_BUILDINGS) {
    if (!state.buildings[id]) continue;
    if (tile < open) {
      state.land[String(tile)] = id;
      tile += 1;
    } else {
      overflow.push(YARD_NAMES[id]);
    }
  }
  if (overflow.length > 0) {
    const tiles = open === 1 ? '1 tile' : `${open} tiles`;
    const verb = overflow.length === 1 ? 'is' : 'are';
    state.yardNote = `Your yard has ${tiles}; ${overflow.join(', ')} ${verb} in the store.`;
  }
  return true;
}

function readLand(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const land: Record<string, string> = {};
  const seen = new Set<string>();
  for (const [key, id] of Object.entries(value)) {
    if (!/^[0-8]$/.test(key) || typeof id !== 'string' || !isYardBuilding(id)) return null;
    if (seen.has(id)) return null;
    seen.add(id);
    land[key] = id;
  }
  return land;
}

/**
 * Format 4 keeps `plots` when it is present. A save that still has the single `plot`
 * maps it onto plot 1 and finishes it with the old per-action output.
 * A missing key means no plots, then Farming's free plot is added.
 */
function installPlots(state: Save, parsed: Record<string, unknown>): boolean {
  if (parsed.plots !== undefined && parsed.plots !== null) {
    const plots = readPlots(parsed.plots);
    if (!plots) return false;
    state.plots = plots;
    state.plotsBought = readPlotsBought(parsed.plotsBought);
  } else if (parsed.plot != null) {
    const old = readLegacyPlot(parsed.plot);
    state.plots = old ? [old] : [];
    state.plotsBought = 0;
    if (old && (old.ready === true || old.remainingMs <= 0)) harvestPlot(state, 0);
  } else {
    state.plots = [];
    state.plotsBought = readPlotsBought(parsed.plotsBought);
  }
  ensureFarmPlots(state);
  return true;
}

function readPlotsBought(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(PLOT_GATES.length, Math.floor(value)));
}

function readPlots(value: unknown): Save['plots'] | null {
  if (!Array.isArray(value)) return null;
  const plots: Save['plots'] = [];
  for (const entry of value) {
    if (entry == null) {
      plots.push(null);
      continue;
    }
    if (!isRecord(entry) || typeof entry.recipeId !== 'string' || typeof entry.remainingMs !== 'number' || !Number.isFinite(entry.remainingMs)) {
      return null;
    }
    const compost: CompostKind = entry.compost === 'compost' || entry.compost === 'bone' ? entry.compost : null;
    const plot: PlotState = { recipeId: entry.recipeId, remainingMs: entry.remainingMs, compost };
    if (entry.ready === true) plot.ready = true;
    if (entry.legacy === true) plot.legacy = true;
    plots.push(plot);
  }
  return plots;
}

function readLegacyPlot(value: unknown): PlotState | null {
  if (!isRecord(value)) return null;
  if (typeof value.recipeId !== 'string' || typeof value.remainingMs !== 'number' || !Number.isFinite(value.remainingMs)) return null;
  const plot: PlotState = {
    recipeId: value.recipeId,
    remainingMs: value.remainingMs,
    compost: null,
    legacy: true,
  };
  if (value.ready === true) plot.ready = true;
  return plot;
}

/** Formats 1 and 2 derive kills from mastery. Formats 3 and 4 keep the stored counts. */
function migrateEnemyKills(state: Save, format: number, raw: unknown): boolean {
  if (format === SAVE_FORMAT || format === SAVE_FORMAT_V3) {
    if (raw == null) {
      state.enemyKills = killsFromMastery(state.enemyMastery);
      return true;
    }
    const kills = readKills(raw);
    if (!kills) return false;
    state.enemyKills = kills;
    return true;
  }
  state.enemyKills = killsFromMastery(state.enemyMastery);
  return true;
}

/**
 * Format 4 stores standing buildings and `buildingsEver`.
 * A format-4 save that lacks `buildingsEver` treats every standing id as ever-built.
 * Older saves load with both maps empty.
 */
function migrateBuildings(state: Save, format: number, raw: unknown, everRaw: unknown): boolean {
  if (format !== SAVE_FORMAT) {
    state.buildings = {};
    state.buildingsEver = {};
    return true;
  }
  const buildings = raw == null ? {} : readBuildings(raw);
  if (!buildings) return false;
  const buildingsEver = everRaw == null ? { ...buildings } : readBuildings(everRaw);
  if (!buildingsEver) return false;
  for (const id of Object.keys(buildings)) buildingsEver[id] = true;
  state.buildings = buildings;
  state.buildingsEver = buildingsEver;
  return true;
}

function readBuildings(value: unknown): Record<string, boolean> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, boolean> = {};
  for (const [key, built] of Object.entries(value)) {
    if (built !== true) return null;
    out[key] = true;
  }
  return out;
}

function killsFromMastery(mastery: Record<string, number>): Record<string, number> {
  const kills: Record<string, number> = {};
  for (const [id, mxp] of Object.entries(mastery)) {
    const count = Math.floor(mxp / ENEMY_MASTERY_XP);
    if (count > 0) kills[id] = count;
  }
  return kills;
}

function readKills(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value)) {
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0) return null;
    if (amount > 0) out[key] = amount;
  }
  return out;
}

function migrateCombatScale(state: Save, stored: unknown): void {
  if (stored === COMBAT_HP_SCALE) {
    state.combatScale = COMBAT_HP_SCALE;
    return;
  }
  state.hp = Math.min(maxHp(state), state.hp * COMBAT_HP_SCALE);
  if (state.activity?.kind === 'combat' && state.combat?.phase === 'fight' && !state.paused) spawnEnemy(state);
  state.combatScale = COMBAT_HP_SCALE;
}

function readMastery(value: unknown): Record<string, number> | null {
  if (value == null) return {};
  if (!isRecord(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value)) {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return null;
    const mxp = Math.round(amount);
    if (mxp > 0) out[key] = mxp;
  }
  return out;
}

export function serialize(state: Save): string {
  return JSON.stringify(state);
}

export interface LoadResult {
  state: Save;
  status: 'new' | 'ok' | 'corrupt';
  report: CatchupReport | null;
}

/**
 * Load the save, run one offline catch-up, and write the result before any
 * report is shown. A corrupt or missing save starts a new game. A corrupt
 * payload is copied aside and the readable bytes are not replaced by this call.
 */
export function loadAndCredit(storage: StorageLike, now: number): LoadResult {
  const raw = storage.getItem(SAVE_KEY);
  if (raw == null) {
    const state = newGame(now);
    writeSave(storage, state);
    return { state, status: 'new', report: null };
  }
  const loaded = deserialize(raw);
  if (!loaded) {
    storage.setItem(UNREADABLE_SAVE_KEY, raw);
    return { state: newGame(now), status: 'corrupt', report: null };
  }
  const report = creditOffline(loaded, now);
  writeSave(storage, loaded);
  return { state: loaded, status: 'ok', report };
}

export function writeSave(storage: StorageLike, state: Save): void {
  state.savedAt = Date.now();
  storage.setItem(SAVE_KEY, serialize(state));
}

/** Remove the game save and the unreadable-save copy. Does not touch the Debug switch. */
export function resetAccount(storage: StorageLike): void {
  storage.removeItem(SAVE_KEY);
  storage.removeItem(UNREADABLE_SAVE_KEY);
}

/** Confirm wipes the save. Cancel does nothing. */
export function confirmAccountReset(storage: StorageLike, confirmed: boolean): boolean {
  if (!confirmed) return false;
  resetAccount(storage);
  return true;
}

/** Returns the imported save, or null when the JSON is not a readable save. */
export function importSave(raw: string): Save | null {
  return deserialize(raw);
}

export interface TabLock {
  id: string;
  beat: number;
}

export function tabLockDecision(
  existing: TabLock | null,
  myId: string,
  now: number,
  staleMs: number,
): 'primary' | 'blocked' {
  if (!existing) return 'primary';
  if (existing.id === myId) return 'primary';
  if (now - existing.beat >= staleMs) return 'primary';
  return 'blocked';
}

export function xpForLevel(level: number): number {
  return XP_TABLE[Math.max(1, Math.min(LEVEL_CAP, level))];
}

export function setSkillLevel(state: Save, skill: SkillId, level: number): void {
  if (!state.owned.includes(skill)) state.owned.push(skill);
  state.xp[skill] = xpForLevel(level);
  if (skill === 'Hitpoints') state.hp = Math.min(state.hp, maxHp(state));
  if (skill === 'Farming') ensureFarmPlots(state);
}

export { ENEMIES };
