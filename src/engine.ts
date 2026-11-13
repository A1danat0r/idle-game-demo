import {
  ATTACK_INTERVAL_MS,
  AUTO_EAT_FRACTION,
  COMBAT_STYLES,
  ENEMY_BY_ID,
  ENEMIES,
  type EnemyDef,
  type EquipSlot,
  type EquippedSlots,
  HITPOINTS_XP_PER_KILL,
  ITEMS,
  KILL_PAUSE_MS,
  LEVEL_CAP,
  NODE_BY_ID,
  OFFLINE_CAP_MS,
  RECIPE_BY_ID,
  REGEN_MS,
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
  itemName,
  levelForXp,
  playerMaxHp,
  skillPrice,
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

export const SAVE_FORMAT = 2;
/** Format-1 saves load with empty mastery maps and are written back as format 2. */
const SAVE_FORMAT_V1 = 1;
export const SAVE_KEY = 'idle-game-demo-save';
export const UNREADABLE_SAVE_KEY = 'idle-game-demo-save-unreadable';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type Activity =
  | { kind: 'gather'; nodeId: string }
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
  combat: CombatProgress | null;
  foodSlot: string | null;
  shop: Record<string, ShopCounter>;
  lastCredited: number;
  rngState: number;
  regenMs: number;
  stats: StatsLog;
  /** Integer mastery XP per node or recipe. Levels and perks are derived. */
  mastery: Record<string, number>;
  /** Integer mastery XP per enemy. */
  enemyMastery: Record<string, number>;
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
}

export function emptyStats(): StatsLog {
  return {
    actions: 0,
    kills: 0,
    pauses: 0,
    foodEaten: 0,
    coinsFromKills: 0,
    coinsFromSales: 0,
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
    paused: false,
    combat: null,
    foodSlot: null,
    shop: {},
    lastCredited: now,
    rngState: seed >>> 0,
    regenMs: 0,
    stats: emptyStats(),
    mastery: {},
    enemyMastery: {},
  };
  return state;
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

export function ownsCombatSkill(state: Save): boolean {
  return COMBAT_STYLES.some((skill) => state.owned.includes(skill));
}

export function toolTier(state: Save, skill: 'Woodcutting' | 'Mining'): number {
  let tier = 0;
  for (const [id, info] of Object.entries(TOOL_TIER)) {
    if (info.skill === skill && (state.bank[id] ?? 0) > 0) tier = Math.max(tier, info.tier);
  }
  return tier;
}

export function actionSeconds(state: Save, id: string): number {
  const node = NODE_BY_ID[id];
  if (node) {
    const tier = node.skill === 'Fishing' ? 0 : toolTier(state, node.skill);
    const factor = TOOL_TIME_FACTOR ** tier;
    return node.seconds * factor * (1 - masteryPerks(masteryLevel(state.mastery[id] ?? 0)).speed);
  }
  const recipe = RECIPE_BY_ID[id];
  if (!recipe) return 0;
  return recipe.seconds * (1 - masteryPerks(masteryLevel(state.mastery[id] ?? 0)).speed);
}

export function actionXp(id: string): number {
  return NODE_BY_ID[id]?.xp ?? RECIPE_BY_ID[id]?.xp ?? 0;
}

export function actionDurationMs(state: Save, id: string): number {
  return actionSeconds(state, id) * 1000;
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
    for (const slot of ['weapon', 'body', 'shield'] as const) {
      if (state.equipped[slot] === id) {
        state.equipped[slot] = null;
        if (slot === 'weapon') lostWeapon = true;
      }
    }
    if (lostWeapon) abandonCombat(state);
  }
  return true;
}

export function hasInputs(state: Save, recipeId: string): boolean {
  const recipe = RECIPE_BY_ID[recipeId];
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

export function activityLabel(state: Save): string {
  const activity = state.activity;
  if (!activity) return 'Idle';
  if (state.paused && activity.kind === 'combat') return 'Combat paused – out of HP';
  if (activity.kind === 'gather') {
    const node = NODE_BY_ID[activity.nodeId];
    return `${node.skill} · ${itemName(activity.nodeId)}`;
  }
  if (activity.kind === 'produce') {
    const recipe = RECIPE_BY_ID[activity.recipeId];
    return `${recipe.skill} · ${itemName(recipe.outputs[0].id)}`;
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
  if (!nodeUsable(state, nodeId)) return false;
  const same = state.activity?.kind === 'gather' && state.activity.nodeId === nodeId;
  if (same) return true;
  beginActivity(state);
  state.activity = { kind: 'gather', nodeId };
  return true;
}

export function startProduce(state: Save, recipeId: string): boolean {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe) return false;
  if (!state.owned.includes(recipe.skill)) return false;
  if (skillLevel(state, recipe.skill) < recipe.level) return false;
  if (!hasInputs(state, recipeId)) return false;
  const same = state.activity?.kind === 'produce' && state.activity.recipeId === recipeId;
  if (same) return true;
  beginActivity(state);
  state.activity = { kind: 'produce', recipeId };
  return true;
}

export function startCombat(state: Save, enemyId: string, style: CombatStyle): boolean {
  if (!ENEMY_BY_ID[enemyId]) return false;
  if (!ownsCombatSkill(state)) return false;
  if (!state.owned.includes(style) || !isCombatStyle(style)) return false;
  const weapon = state.equipped.weapon;
  if (!weapon || equipSlotFor(weapon) !== 'weapon' || (state.bank[weapon] ?? 0) <= 0) return false;
  const same =
    state.activity?.kind === 'combat' &&
    state.activity.enemyId === enemyId &&
    state.activity.style === style &&
    !state.paused;
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
  const hits = hitsPerKill(strength, enemy.level, equippedGear(state.equipped, state.bank).pow);
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
  state.paused = false;
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

export function buySkill(state: Save, skill: SkillId): boolean {
  if (skill === 'Woodcutting' || skill === 'Hitpoints') return false;
  if (state.owned.includes(skill)) return false;
  const price = skillPrice(state.purchaseCount);
  if (price == null || state.coins < price) return false;
  state.coins = roundXp(state.coins - price);
  state.purchaseCount += 1;
  state.owned.push(skill);
  state.xp[skill] = 0;
  if (isCombatStyle(skill) && !state.owned.includes('Hitpoints')) {
    state.owned.push('Hitpoints');
    state.xp.Hitpoints = 0;
    state.hp = maxHp(state);
  }
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
  state.nodes.push(nodeId);
  return true;
}

export function sell(state: Save, itemId: string, qty: number): boolean {
  if (!Number.isInteger(qty) || qty <= 0) return false;
  const def = ITEMS[itemId];
  if (!def) return false;
  if (!takeItem(state, itemId, qty)) return false;
  const price = def.sell * sellMultiplier(state.mastery, itemId) * qty;
  state.coins = roundXp(state.coins + price);
  state.stats.coinsFromSales = roundXp(state.stats.coinsFromSales + price);
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
  giveItem(state, itemId, 1);
  return true;
}

export function equip(state: Save, itemId: string): boolean {
  const slot = equipSlotFor(itemId);
  if (!slot || (state.bank[itemId] ?? 0) <= 0) return false;
  state.equipped[slot] = itemId;
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
  if (sink) sink.kills += 1;
  // Loot uses the mastery already earned. This kill's MXP is added afterwards.
  const factor = enemyLootFactor(state.enemyMastery, enemy.id);
  if (opts.expectedLoot) {
    const coins = expectedCoinValue(enemy) * factor;
    const loot = expectedDropValue(enemy.drops) * factor;
    state.coins = roundXp(state.coins + coins + loot);
    state.stats.coinsFromKills = roundXp(state.stats.coinsFromKills + coins);
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
      if (sink) sink.coins = roundXp(sink.coins + rolled);
    }
    if (extra > 0) {
      state.coins = roundXp(state.coins + extra);
      if (sink) sink.coins = roundXp(sink.coins + extra);
    }
    state.stats.lootValue = roundXp(state.stats.lootValue + itemValue * factor);
  }
  grantEnemyMastery(state, enemy.id, opts);
}

function markPaused(state: Save, sink?: Sink): void {
  state.hp = 0;
  state.paused = true;
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
  const chance = hitChance(enemy.level, formulaLevel(state, 'Defence'), equippedGear(state.equipped, state.bank).grd);
  if (nextUnit(state) >= chance) {
    notes?.push({ kind: 'miss', side: 'enemy' });
    return;
  }
  state.stats.enemyHits += 1;
  const damage = rollInt(state, 1, enemy.maxHit);
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

function playerAttack(state: Save, sink: Sink | undefined, opts: SimOptions): void {
  const activity = state.activity;
  const combat = state.combat;
  if (!activity || activity.kind !== 'combat' || !combat || combat.phase !== 'fight') return;
  const enemy = ENEMY_BY_ID[activity.enemyId];
  const hits = combat.hitsPerKill;
  combat.swings += 1;
  state.stats.playerSwings += 1;
  const attackLevel = formulaLevel(state, 'Attack');
  const chance = playerHitChance(attackLevel, enemy.level, equippedGear(state.equipped, state.bank).acc);
  if (nextUnit(state) >= chance) {
    state.stats.playerMisses += 1;
    opts.notes?.push({ kind: 'miss', side: 'player' });
    return;
  }
  state.stats.playerHits += 1;
  combat.hitsLanded += 1;
  const styleXp = STYLE_XP_PER_KILL / hits;
  const hpXp = HITPOINTS_XP_PER_KILL / hits;
  addXp(state, activity.style, styleXp);
  if (state.owned.includes('Hitpoints')) addXp(state, 'Hitpoints', hpXp);
  const dealt = combat.enemyMaxHp / hits;
  opts.notes?.push({ kind: 'player-hit', amount: dealt });
  combat.enemyHp -= dealt;
  if (combat.hitsLanded >= hits) {
    combat.enemyHp = 0;
    combat.phase = 'pause';
    combat.killAtMs = state.progressMs;
    grantKillRewards(state, enemy, sink, opts);
  }
}

function resolveDue(state: Save, sink: Sink | undefined, opts: SimOptions): void {
  const activity = state.activity;
  if (!activity || state.paused) return;
  if (activity.kind === 'gather') {
    const node = NODE_BY_ID[activity.nodeId];
    giveItem(state, node.id, 1, sink);
    const gained = addXp(state, node.skill, node.xp * actionXpMultiplier(state.mastery, node.id, node.skill));
    opts.notes?.push({ kind: 'action', skill: node.skill, xp: gained, itemId: node.id, qty: 1 });
    grantActionMastery(state, node.id, node.skill, node.seconds, opts);
    state.stats.actions += 1;
    if (sink) sink.actions += 1;
    state.progressMs = 0;
    return;
  }
  if (activity.kind === 'produce') {
    const recipe = RECIPE_BY_ID[activity.recipeId];
    if (!hasInputs(state, recipe.id)) {
      state.activity = null;
      state.progressMs = 0;
      if (sink) sink.stopped = 'inputs';
      return;
    }
    for (const input of recipe.inputs) takeItem(state, input.id, input.qty, sink);
    for (const made of recipe.outputs) giveItem(state, made.id, made.qty, sink);
    const gained = addXp(state, recipe.skill, recipe.xp * actionXpMultiplier(state.mastery, recipe.id, recipe.skill));
    grantActionMastery(state, recipe.id, recipe.skill, recipe.seconds, opts);
    const made = recipe.outputs[0];
    if (made) {
      opts.notes?.push({ kind: 'action', skill: recipe.skill, xp: gained, itemId: made.id, qty: made.qty });
    }
    state.stats.actions += 1;
    if (sink) sink.actions += 1;
    state.progressMs = 0;
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
      if (state.hp < cap) state.hp += 1;
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
 * Advance a visible tab to `now`.
 * A backwards clock credits 0 and moves the last-credited time to `now`,
 * so the next positive gap runs immediately instead of waiting for the clock to catch up.
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
    simulate(state, gap, undefined, notes ? { notes } : undefined);
    state.lastCredited = now;
  }
  return null;
}

export function creditOffline(state: Save, now: number): CatchupReport {
  const away = now - state.lastCredited;
  const before = levelsOf(state);
  const xpBefore = { ...state.xp };
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
  };
  if (away < 0) {
    report.backwards = true;
    report.stopped = 'backwards';
    state.lastCredited = now;
    report.levelsAfter = levelsOf(state);
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
  simulate(state, credited, sink);
  report.actions = sink.actions;
  report.kills = sink.kills;
  report.foodEaten = sink.foodEaten;
  report.coinsGained = sink.coins;
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
  state.lastCredited = now;
  return report;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deserialize(raw: string): Save | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.saveFormat !== SAVE_FORMAT && parsed.saveFormat !== SAVE_FORMAT_V1) return null;
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
  const statsIn = isRecord(parsed.stats) ? parsed.stats : {};
  const stats = emptyStats();
  if (typeof statsIn.actions === 'number') stats.actions = statsIn.actions;
  if (typeof statsIn.kills === 'number') stats.kills = statsIn.kills;
  if (typeof statsIn.pauses === 'number') stats.pauses = statsIn.pauses;
  if (typeof statsIn.foodEaten === 'number') stats.foodEaten = statsIn.foodEaten;
  if (typeof statsIn.coinsFromKills === 'number') stats.coinsFromKills = statsIn.coinsFromKills;
  if (typeof statsIn.coinsFromSales === 'number') stats.coinsFromSales = statsIn.coinsFromSales;
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
  return {
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
    combat,
    foodSlot: typeof parsed.foodSlot === 'string' ? parsed.foodSlot : null,
    shop,
    lastCredited: parsed.lastCredited,
    rngState: parsed.rngState >>> 0,
    regenMs: typeof parsed.regenMs === 'number' ? parsed.regenMs : 0,
    stats,
    mastery,
    enemyMastery,
  };
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
    storage.setItem(SAVE_KEY, serialize(state));
    return { state, status: 'new', report: null };
  }
  const loaded = deserialize(raw);
  if (!loaded) {
    storage.setItem(UNREADABLE_SAVE_KEY, raw);
    return { state: newGame(now), status: 'corrupt', report: null };
  }
  const report = creditOffline(loaded, now);
  storage.setItem(SAVE_KEY, serialize(loaded));
  return { state: loaded, status: 'ok', report };
}

export function writeSave(storage: StorageLike, state: Save): void {
  storage.setItem(SAVE_KEY, serialize(state));
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
}

export { ENEMIES };
