import { ENEMY_BY_ID, XP_TABLE, playerHitChance, playerMaxHp } from './content';
import { newGame, simulate, startCombat, stepCompletion, type Save } from './engine';

function fighter(attackLevel: number, enemyId: string, seed: number): Save {
  const state = newGame(0, seed);
  state.owned.push('Attack', 'Strength', 'Defence', 'Hitpoints');
  state.xp.Attack = XP_TABLE[attackLevel];
  state.xp.Strength = 0;
  state.xp.Defence = XP_TABLE[30];
  state.xp.Hitpoints = XP_TABLE[30];
  state.hp = playerMaxHp(30);
  startCombat(state, enemyId, 'Attack');
  return state;
}

/** Measured hit rate over 1,000 swings for the section 5 table. */
export function hitRateReport(): string {
  const rows: [number, string, number][] = [
    [1, 'meadow.beetle', 0.88],
    [1, 'wood.jay', 0.772],
    [1, 'wood.poacher', 0.748],
    [11, 'meadow.beetle', 1],
    [11, 'wood.jay', 0.892],
    [11, 'wood.poacher', 0.868],
    [30, 'meadow.beetle', 1],
    [30, 'wood.jay', 1],
    [30, 'wood.poacher', 1],
  ];
  return rows
    .map(([attack, enemyId, expected]) => {
      const enemy = ENEMY_BY_ID[enemyId];
      const state = fighter(attack, enemyId, 3);
      startCombat(state, enemyId, 'Defence');
      let guard = 0;
      while (state.stats.playerSwings < 1000 && !state.paused && guard++ < 8000) simulate(state, 2400);
      const rate = state.stats.playerHits / state.stats.playerSwings;
      return `Attack ${attack} vs ${enemy.name} (Lv ${enemy.level}): ${(rate * 100).toFixed(1)}% measured, ${(expected * 100).toFixed(1)}% expected, formula ${playerHitChance(attack, enemy.level)}`;
    })
    .join('\n');
}

/** Mean kill cycle at Attack 1, Strength 1, against a level-1 enemy. */
export function killCycleReport(): string {
  const state = fighter(1, 'meadow.beetle', 4);
  state.xp.Strength = 0;
  state.xp.Attack = 0;
  startCombat(state, 'meadow.beetle', 'Defence');
  let total = 0;
  let kills = 0;
  while (kills < 200 && !state.paused) {
    const step = stepCompletion(state);
    if (step.type !== 'kill') break;
    total += step.ms;
    kills += 1;
  }
  const mean = total / Math.max(1, kills) / 1000;
  return `Attack 1 vs Lv 1, 5 hits: mean cycle ${mean.toFixed(2)}s over ${kills} kills (target 16.64s ±3%)`;
}

export function samplePoacher(kills = 1000, seed = 7): string {
  const state = fighter(30, 'wood.poacher', seed);
  let guard = 0;
  while (state.stats.kills < kills && !state.paused && guard++ < kills + 5) {
    simulate(state, 4 * 2400 + 3000);
  }
  const mean = state.stats.coinsFromKills / state.stats.kills;
  const loot = state.stats.lootValue / state.stats.kills;
  return [
    `poacher kills ${state.stats.kills}`,
    `mean coins ${mean.toFixed(3)} (target 6 ± 0.3)`,
    `loot value/kill ${loot.toFixed(3)} (expected 6.5, ±10%)`,
    `pauses ${state.stats.pauses}`,
    `player hits ${state.stats.playerHits} / swings ${state.stats.playerSwings}`,
  ].join('\n');
}

export function meadowHour(seed: number): string {
  const state = bare(seed);
  startCombat(state, 'meadow.beetle', 'Strength');
  let guard = 0;
  while (state.stats.kills < 240 && !state.paused && guard++ < 300) stepCompletion(state);
  return `meadow seed ${seed}: pauses ${state.stats.pauses}, kills ${state.stats.kills}`;
}

/** Ten meadow runs and five poacher food runs, for check 6. */
export function survivabilityReport(): string {
  const meadow = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => {
    const state = bare(seed);
    startCombat(state, 'meadow.beetle', 'Strength');
    let guard = 0;
    while (state.stats.kills < 240 && !state.paused && guard++ < 400) stepCompletion(state);
    return state.stats.pauses > 0 ? 1 : 0;
  });
  const poacher = [1, 2, 3, 4, 5].map((seed) => pauseKill(seed));
  const food = [1, 2, 3, 4, 5].map((seed) => shrimpFood(seed));
  const meadowPauses = meadow.reduce<number>((sum, n) => sum + n, 0);
  const meanPause = poacher.reduce((sum, n) => sum + n, 0) / poacher.length;
  const meanFood = food.reduce((sum, n) => sum + n, 0) / food.length;
  return [
    `Meadow, Attack 1, 10 runs of 240 kills: ${meadowPauses} runs paused (pass if at most 1)`,
    `Poacher, 20 roast minnows, pause after this many completed kills, mean ${meanPause.toFixed(2)} over ${poacher.join(', ')} (pass 9–15)`,
    `Poacher, Defence 20, Hitpoints 7, cooked shrimp, food/240 kills mean ${meanFood.toFixed(2)} over ${food.join(', ')} (pass 4–10)`,
  ].join('\n');
}

function bare(seed: number): Save {
  const state = newGame(0, seed);
  state.owned.push('Strength', 'Attack', 'Defence', 'Hitpoints');
  state.xp.Strength = 0;
  state.xp.Attack = 0;
  state.xp.Defence = 0;
  state.xp.Hitpoints = 0;
  state.hp = 12;
  return state;
}

function pauseKill(seed: number): number {
  const state = bare(seed);
  state.bank['food.roast_minnows'] = 20;
  state.foodSlot = 'food.roast_minnows';
  startCombat(state, 'wood.poacher', 'Strength');
  let guard = 0;
  while (!state.paused && guard++ < 80) stepCompletion(state);
  return state.stats.pauseAtKill[0] ?? state.stats.kills;
}

function shrimpFood(seed: number): number {
  const state = bare(seed + 20);
  state.xp.Defence = XP_TABLE[20];
  state.xp.Hitpoints = XP_TABLE[7];
  state.hp = playerMaxHp(7);
  state.bank['food.cooked_shrimp'] = 40;
  state.foodSlot = 'food.cooked_shrimp';
  startCombat(state, 'wood.poacher', 'Strength');
  const before = state.stats.foodEaten;
  let guard = 0;
  while (state.stats.kills < 240 && !state.paused && guard++ < 300) stepCompletion(state);
  return state.stats.foodEaten - before;
}
