import {
  ENEMY_BY_ID,
  ITEMS,
  NODE_BY_ID,
  RECIPES,
  RECIPE_BY_ID,
  NODE_PRICE,
  hitChance,
  hitsPerKill,
  skillPrice,
  type RecipeDef,
  type SkillId,
} from './content';
import {
  actionSeconds,
  buyNode,
  buySkill,
  formulaLevel,
  newGame,
  nodeUsable,
  resumeCombat,
  sell,
  skillLevel,
  startCombat,
  startGather,
  startProduce,
  stepCompletion,
  simulate,
  type Save,
  type SimOptions,
} from './engine';

const PURCHASE_ORDER = ['Strength', 'Fishing', 'Cooking', 'Defence', 'Attack', 'Mining', 'Smithing'] as const;

const KEEP = new Set([
  'gear.melee.bronze_sword',
  'tool.woodcutting.bronze_axe',
  'tool.woodcutting.iron_axe',
  'tool.mining.bronze_pickaxe',
  'tool.mining.iron_pickaxe',
]);

export interface RouteEvent {
  skill: string;
  price?: number;
  target?: number;
  id?: string;
  atHours: number;
  coins: number;
}

export interface RouteResult {
  elapsedHours: number;
  coins: number;
  earned: number;
  kills: number;
  pauses: number;
  grindHours: number;
  purchases: RouteEvent[];
  nodes: RouteEvent[];
  segments: RouteEvent[];
  levels: Record<string, number>;
  state: Save;
}

interface Clock {
  ms: number;
  grindMs: number;
  purchases: RouteEvent[];
  nodes: RouteEvent[];
  segments: RouteEvent[];
}

function hours(ms: number): number {
  return Math.round((ms / 3_600_000) * 100) / 100;
}

function barId(metal: 'bronze' | 'iron'): string {
  return metal === 'bronze' ? 'mat.bar.bronze' : 'mat.bar.iron';
}

function owned(state: Save, skill: SkillId): boolean {
  return state.owned.includes(skill);
}

function tryBuy(state: Save, clock: Clock): void {
  while (state.purchaseCount < PURCHASE_ORDER.length) {
    const skill = PURCHASE_ORDER[state.purchaseCount];
    const price = skillPrice(state.purchaseCount);
    if (price == null || state.coins < price) return;
    if (!buySkill(state, skill)) return;
    clock.purchases.push({ skill, price, atHours: hours(clock.ms), coins: state.coins });
  }
}

function liquidate(state: Save, alsoKeep: string[] = []): void {
  const hold = new Set(alsoKeep);
  for (const id of Object.keys(state.bank)) {
    if (KEEP.has(id) || hold.has(id)) continue;
    const qty = state.bank[id] ?? 0;
    if (qty > 0) sell(state, id, qty);
  }
}

function ensureOwnedSkill(state: Save, skill: SkillId, clock: Clock, opts: SimOptions): void {
  let guard = 0;
  while (!owned(state, skill)) {
    tryBuy(state, clock);
    if (owned(state, skill)) return;
    grindOnce(state, clock, opts);
    if (++guard > 100000) throw new Error(`could not buy ${skill}`);
  }
}

function ensureNode(state: Save, nodeId: string, clock: Clock, opts: SimOptions): void {
  const node = NODE_BY_ID[nodeId];
  if (!node || node.cost <= 0 || state.nodes.includes(nodeId)) return;
  if (skillLevel(state, node.skill) < node.level) {
    throw new Error(`route reached ${nodeId} before ${node.skill} level ${node.level}`);
  }
  let guard = 0;
  while (state.coins < node.cost) {
    grindOnce(state, clock, opts);
    if (++guard > 100000) throw new Error(`could not afford ${nodeId}`);
  }
  if (!buyNode(state, nodeId)) throw new Error(`buy failed for ${nodeId}`);
  clock.nodes.push({ skill: node.skill, id: nodeId, atHours: hours(clock.ms), coins: state.coins });
}

function foodFree(enemyId: string, state: Save): boolean {
  const enemy = ENEMY_BY_ID[enemyId];
  const hits = hitsPerKill(formulaLevel(state, 'Strength'), enemy.level);
  const damage = hits * hitChance(enemy.level, formulaLevel(state, 'Defence')) * ((enemy.maxHit + 1) / 2);
  const regen = (hits * 2.4 + 3) / 6;
  return damage <= regen + 1e-9;
}

function bestCoinActivity(state: Save): 'pine' | 'meadow' | 'poacher' {
  const pine = 1 / actionSeconds(state, 'mat.wood.pine');
  let best: 'pine' | 'meadow' | 'poacher' = 'pine';
  let bestRate = pine;
  if (state.owned.some((skill) => skill === 'Attack' || skill === 'Strength' || skill === 'Defence')) {
    const meadowHits = hitsPerKill(formulaLevel(state, 'Strength'), 1);
    const meadow = 6.25 / (meadowHits * 2.4 + 3);
    if (meadow > bestRate) {
      best = 'meadow';
      bestRate = meadow;
    }
    if (foodFree('wood.poacher', state)) {
      const hits = hitsPerKill(formulaLevel(state, 'Strength'), 12);
      const rate = 12.5 / (hits * 2.4 + 3);
      if (rate > bestRate) best = 'poacher';
    }
  }
  return best;
}

function recoverPause(state: Save, clock: Clock): void {
  let guard = 0;
  while (state.paused && guard++ < 1000) {
    if (state.hp <= 0) {
      simulate(state, 6000);
      clock.ms += 6000;
    }
    if (state.hp > 0) resumeCombat(state);
  }
}

function oneCompletion(state: Save, clock: Clock, opts: SimOptions): void {
  recoverPause(state, clock);
  const step = stepCompletion(state, opts);
  clock.ms += step.ms;
  if (step.type === 'none' && state.paused) recoverPause(state, clock);
}

function gather(state: Save, nodeId: string, qty: number, clock: Clock, opts: SimOptions): void {
  for (let i = 0; i < qty; i++) {
    if (!nodeUsable(state, nodeId)) ensureNode(state, nodeId, clock, opts);
    if (!startGather(state, nodeId)) throw new Error(`cannot gather ${nodeId}`);
    oneCompletion(state, clock, opts);
    tryBuy(state, clock);
  }
}

function craft(state: Save, recipeId: string, qty: number, clock: Clock, opts: SimOptions): void {
  for (let i = 0; i < qty; i++) {
    if (!startProduce(state, recipeId)) throw new Error(`cannot craft ${recipeId}`);
    oneCompletion(state, clock, opts);
    tryBuy(state, clock);
  }
}

function fight(state: Save, enemyId: string, style: SkillId, clock: Clock, opts: SimOptions): void {
  const combatStyle = style === 'Attack' || style === 'Strength' || style === 'Defence' ? style : 'Strength';
  const active =
    state.activity?.kind === 'combat' &&
    state.activity.enemyId === enemyId &&
    state.activity.style === combatStyle &&
    !state.paused;
  if (!active && !startCombat(state, enemyId, combatStyle)) throw new Error(`cannot fight ${enemyId}`);
  oneCompletion(state, clock, opts);
  if (!opts.expectedLoot) liquidate(state);
  tryBuy(state, clock);
}

function grindOnce(state: Save, clock: Clock, opts: SimOptions): void {
  const before = clock.ms;
  const choice = bestCoinActivity(state);
  if (choice === 'pine') {
    gather(state, 'mat.wood.pine', 1, clock, opts);
    liquidate(state);
  } else if (choice === 'meadow') {
    const style = (['Strength', 'Attack', 'Defence'] as const).find((skill) => owned(state, skill)) ?? 'Strength';
    fight(state, 'meadow.beetle', style, clock, opts);
  } else {
    const style = (['Strength', 'Attack', 'Defence'] as const).find((skill) => owned(state, skill)) ?? 'Strength';
    fight(state, 'wood.poacher', style, clock, opts);
  }
  clock.grindMs += clock.ms - before;
}

function produceBars(state: Save, metal: 'bronze' | 'iron', n: number, clock: Clock, opts: SimOptions): void {
  if (metal === 'bronze') {
    gather(state, 'mat.ore.copper', n, clock, opts);
    gather(state, 'mat.ore.tin', n, clock, opts);
    gather(state, 'mat.wood.pine', n / 2, clock, opts);
    craft(state, 'recipe.mat.fuel.charcoal', n / 2, clock, opts);
    craft(state, 'recipe.mat.bar.bronze', n, clock, opts);
  } else {
    gather(state, 'mat.ore.iron', n * 2, clock, opts);
    gather(state, 'mat.wood.pine', n / 2, clock, opts);
    craft(state, 'recipe.mat.fuel.charcoal', n / 2, clock, opts);
    craft(state, 'recipe.mat.bar.iron', n, clock, opts);
  }
}

export function bestBarRecipe(state: Save, metal: 'bronze' | 'iron'): RecipeDef {
  const bar = barId(metal);
  const level = skillLevel(state, 'Smithing');
  const options = RECIPES.filter(
    (recipe) =>
      recipe.skill === 'Smithing' &&
      recipe.level <= level &&
      recipe.inputs.length > 0 &&
      recipe.inputs.every((input) => input.id === bar),
  );
  if (options.length === 0) throw new Error(`no ${metal} bar recipe at smithing ${level}`);
  let best = options[0];
  let bestXp = -1;
  let bestCoins = -1;
  for (const recipe of options) {
    const score = cycleScore(state, metal, recipe);
    if (score.xpPerSec > bestXp + 1e-12 || (Math.abs(score.xpPerSec - bestXp) <= 1e-12 && score.coinsPerSec > bestCoins)) {
      best = recipe;
      bestXp = score.xpPerSec;
      bestCoins = score.coinsPerSec;
    }
  }
  return best;
}

function cycleScore(state: Save, metal: 'bronze' | 'iron', recipe: RecipeDef): { xpPerSec: number; coinsPerSec: number } {
  const k = recipe.inputs[0].qty;
  const n = k % 2 === 0 ? k : 2 * k;
  const m = n / k;
  let seconds = 0;
  let smithXp = 0;
  if (metal === 'bronze') {
    seconds += n * actionSeconds(state, 'mat.ore.copper');
    seconds += n * actionSeconds(state, 'mat.ore.tin');
    seconds += (n / 2) * actionSeconds(state, 'mat.wood.pine');
    seconds += (n / 2) * actionSeconds(state, 'recipe.mat.fuel.charcoal');
    seconds += n * actionSeconds(state, 'recipe.mat.bar.bronze');
    smithXp += n * (RECIPE_BY_ID['recipe.mat.bar.bronze'].xp);
  } else {
    seconds += n * 2 * actionSeconds(state, 'mat.ore.iron');
    seconds += (n / 2) * actionSeconds(state, 'mat.wood.pine');
    seconds += (n / 2) * actionSeconds(state, 'recipe.mat.fuel.charcoal');
    seconds += n * actionSeconds(state, 'recipe.mat.bar.iron');
    smithXp += n * (RECIPE_BY_ID['recipe.mat.bar.iron'].xp);
  }
  seconds += m * actionSeconds(state, recipe.id);
  smithXp += m * recipe.xp;
  const out = recipe.outputs[0];
  const sellValue = m * out.qty * (ITEMS[out.id]?.sell ?? 0);
  return { xpPerSec: smithXp / seconds, coinsPerSec: sellValue / seconds };
}

function craftTool(state: Save, recipeId: string, metal: 'bronze' | 'iron', clock: Clock, opts: SimOptions): void {
  const recipe = RECIPE_BY_ID[recipeId];
  const bar = barId(metal);
  const barQty = recipe.inputs.find((input) => input.id === bar)?.qty ?? 0;
  const woods = recipe.inputs.filter((input) => input.id.startsWith('mat.wood.'));
  for (const wood of woods) ensureNode(state, wood.id, clock, opts);
  produceBars(state, metal, 2, clock, opts);
  for (const wood of woods) gather(state, wood.id, wood.qty, clock, opts);
  craft(state, recipe.id, 1, clock, opts);
  const spare = 2 - barQty;
  if (spare > 0) sell(state, bar, spare);
}

function craftTools(state: Save, metal: 'bronze' | 'iron', clock: Clock, opts: SimOptions): void {
  const ids =
    metal === 'bronze'
      ? ['recipe.tool.woodcutting.bronze_axe', 'recipe.tool.mining.bronze_pickaxe']
      : ['recipe.tool.woodcutting.iron_axe', 'recipe.tool.mining.iron_pickaxe'];
  for (const id of ids) {
    const recipe = RECIPE_BY_ID[id];
    const toolId = recipe.outputs[0].id;
    if ((state.bank[toolId] ?? 0) > 0) continue;
    if (skillLevel(state, 'Smithing') < recipe.level) continue;
    craftTool(state, id, metal, clock, opts);
  }
}

function finisherCycle(state: Save, metal: 'bronze' | 'iron', clock: Clock, opts: SimOptions): void {
  craftTools(state, metal, clock, opts);
  const recipe = bestBarRecipe(state, metal);
  const k = recipe.inputs[0].qty;
  const n = k % 2 === 0 ? k : 2 * k;
  const m = n / k;
  produceBars(state, metal, n, clock, opts);
  craft(state, recipe.id, m, clock, opts);
  liquidate(state);
}

function charcoalCycle(state: Save, clock: Clock, opts: SimOptions): void {
  gather(state, 'mat.wood.pine', 1, clock, opts);
  craft(state, 'recipe.mat.fuel.charcoal', 1, clock, opts);
  liquidate(state);
}

function troutMeal(state: Save, clock: Clock, opts: SimOptions): void {
  ensureNode(state, 'mat.fish.trout', clock, opts);
  gather(state, 'mat.fish.trout', 1, clock, opts);
  craft(state, 'recipe.food.roast_trout', 1, clock, opts);
  liquidate(state);
}

type Act = 'pine' | 'minnow' | 'meadow' | 'charcoal' | 'bronze' | 'iron' | 'cook2030' | 'trout';

function doCycle(state: Save, act: Act, train: SkillId, clock: Clock, opts: SimOptions): void {
  if (act === 'pine') {
    gather(state, 'mat.wood.pine', 1, clock, opts);
    liquidate(state);
  } else if (act === 'minnow') {
    gather(state, 'mat.fish.minnow', 1, clock, opts);
    liquidate(state);
  } else if (act === 'trout') {
    ensureNode(state, 'mat.fish.trout', clock, opts);
    gather(state, 'mat.fish.trout', 1, clock, opts);
    liquidate(state);
  } else if (act === 'meadow') {
    fight(state, 'meadow.beetle', train, clock, opts);
  } else if (act === 'charcoal') {
    charcoalCycle(state, clock, opts);
  } else if (act === 'bronze') {
    finisherCycle(state, 'bronze', clock, opts);
  } else if (act === 'iron') {
    finisherCycle(state, 'iron', clock, opts);
  } else if (skillLevel(state, 'Cooking') < 22) {
    charcoalCycle(state, clock, opts);
  } else {
    troutMeal(state, clock, opts);
  }
}

function train(state: Save, skill: SkillId, target: number, act: Act, clock: Clock, opts: SimOptions): void {
  ensureOwnedSkill(state, skill, clock, opts);
  if (act === 'iron') ensureNode(state, 'mat.ore.iron', clock, opts);
  let guard = 0;
  while (skillLevel(state, skill) < target) {
    doCycle(state, act, skill, clock, opts);
    tryBuy(state, clock);
    if (++guard > 200000) throw new Error(`segment stuck ${skill} ${target} ${act}`);
  }
  clock.segments.push({
    skill,
    target,
    id: act,
    atHours: hours(clock.ms),
    coins: Math.round(state.coins),
  });
}

export function runReferenceRoute(options: { seed?: number; expectedLoot?: boolean } = {}): RouteResult {
  const expectedLoot = options.expectedLoot !== false;
  const opts: SimOptions = { expectedLoot };
  const state = newGame(0, options.seed ?? 1);
  const clock: Clock = { ms: 0, grindMs: 0, purchases: [], nodes: [], segments: [] };
  train(state, 'Woodcutting', 20, 'pine', clock, opts);
  train(state, 'Strength', 30, 'meadow', clock, opts);
  train(state, 'Fishing', 20, 'minnow', clock, opts);
  train(state, 'Cooking', 20, 'charcoal', clock, opts);
  train(state, 'Defence', 30, 'meadow', clock, opts);
  train(state, 'Attack', 30, 'meadow', clock, opts);
  train(state, 'Smithing', 20, 'bronze', clock, opts);
  train(state, 'Smithing', 30, 'iron', clock, opts);
  train(state, 'Cooking', 30, 'cook2030', clock, opts);
  train(state, 'Fishing', 30, 'trout', clock, opts);
  const spent =
    clock.purchases.reduce((sum, event) => sum + (event.price ?? 0), 0) + clock.nodes.length * NODE_PRICE;
  const levels: Record<string, number> = {};
  for (const skill of ['Woodcutting', 'Fishing', 'Cooking', 'Attack', 'Strength', 'Defence', 'Mining', 'Smithing', 'Hitpoints'] as const) {
    levels[skill] = skillLevel(state, skill);
  }
  return {
    elapsedHours: hours(clock.ms),
    coins: state.coins,
    earned: state.coins + spent,
    kills: state.stats.kills,
    pauses: state.stats.pauses,
    grindHours: clock.grindMs / 3_600_000,
    purchases: clock.purchases,
    nodes: clock.nodes,
    segments: clock.segments,
    levels,
    state,
  };
}

/** Text summary for the dev panel and `npm run route`. */
export function formatRouteResult(result: RouteResult): string {
  const lines = [
    `elapsed ${result.elapsedHours}h`,
    `coins left ${Math.round(result.coins)}`,
    `coins earned ${Math.round(result.earned)}`,
    `kills ${result.kills}`,
    `pauses ${result.pauses}`,
    `grind ${result.grindHours.toFixed(3)}h`,
    `levels ${Object.entries(result.levels).map(([skill, level]) => `${skill} ${level}`).join(', ')}`,
    'purchases:',
    ...result.purchases.map((event) => `  ${event.skill} ${event.price} at ${event.atHours}h`),
    'nodes:',
    ...result.nodes.map((event) => `  ${event.id} at ${event.atHours}h`),
    'segments:',
    ...result.segments.map((event) => `  ${event.skill} to ${event.target} (${event.id}) at ${event.atHours}h coins ${event.coins}`),
  ];
  return lines.join('\n');
}
