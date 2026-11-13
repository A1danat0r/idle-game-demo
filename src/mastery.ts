import { ENEMY_BY_ID, NODE_BY_ID, NODES, RECIPE_BY_ID, RECIPES, itemName, type SkillId } from './content';

/** Shown mastery stops at 30. Stored MXP may continue past the level-30 threshold. */
export const MASTERY_CAP = 30;
/** One kill. round(10 × 10.2s), the 3-hit kill cycle. */
export const ENEMY_MASTERY_XP = 102;

/** Cumulative MXP required to reach `level`. Level 1 is 0. */
export function masteryThreshold(level: number): number {
  if (level <= 1) return 0;
  return Math.round(720_000 * ((level - 1) / 98) ** 2);
}

const THRESHOLDS = Array.from({ length: MASTERY_CAP + 1 }, (_, level) => masteryThreshold(level));

/** Demo level for a mastery total. Never above {@link MASTERY_CAP}. */
export function masteryLevel(mxp: number): number {
  let level = 1;
  for (let next = 2; next <= MASTERY_CAP; next += 1) {
    if (mxp + 1e-9 >= THRESHOLDS[next]) level = next;
    else break;
  }
  return level;
}

/** Fill of the bar from the current level toward the next. Full at the cap. */
export function masteryProgress(mxp: number): number {
  const level = masteryLevel(mxp);
  if (level >= MASTERY_CAP) return 100;
  const prev = THRESHOLDS[level];
  const next = THRESHOLDS[level + 1];
  return ((mxp - prev) / (next - prev)) * 100;
}

/** MXP for one completed action. Uses the base timer, not tools or the speed perk. */
export function actionMasteryXp(baseSeconds: number): number {
  return Math.round(10 * baseSeconds);
}

export function masteryPerks(level: number): { sell: number; speed: number; xp: number } {
  return {
    sell: level >= 10 ? 0.05 : 0,
    speed: level >= 20 ? 0.05 : 0,
    xp: level >= 30 ? 0.05 : 0,
  };
}

export function countMaxed(mastery: Record<string, number>, skill: SkillId): number {
  let count = 0;
  for (const node of NODES) {
    if (node.skill === skill && masteryLevel(mastery[node.id] ?? 0) >= MASTERY_CAP) count += 1;
  }
  for (const recipe of RECIPES) {
    if (recipe.skill === skill && masteryLevel(mastery[recipe.id] ?? 0) >= MASTERY_CAP) count += 1;
  }
  return count;
}

/** +3% per maxed track of this skill, capped at +15%. */
export function globalXpBonus(mastery: Record<string, number>, skill: SkillId): number {
  return Math.min(0.15, 0.03 * countMaxed(mastery, skill));
}

export function actionXpMultiplier(mastery: Record<string, number>, actionId: string, skill: SkillId): number {
  return 1 + masteryPerks(masteryLevel(mastery[actionId] ?? 0)).xp + globalXpBonus(mastery, skill);
}

const OUTPUT_RECIPE: Record<string, string> = {};
for (const recipe of RECIPES) {
  for (const output of recipe.outputs) {
    if (!OUTPUT_RECIPE[output.id]) OUTPUT_RECIPE[output.id] = recipe.id;
  }
}

/** The mastery track whose sell perk applies to this item, if it has one. */
export function masteryTrackForItem(itemId: string): string | null {
  if (NODE_BY_ID[itemId]) return itemId;
  return OUTPUT_RECIPE[itemId] ?? null;
}

export function sellMultiplier(mastery: Record<string, number>, itemId: string): number {
  const track = masteryTrackForItem(itemId);
  if (!track) return 1;
  return 1 + masteryPerks(masteryLevel(mastery[track] ?? 0)).sell;
}

export function enemyLootFactor(enemyMastery: Record<string, number>, enemyId: string): number {
  return masteryLevel(enemyMastery[enemyId] ?? 0) >= MASTERY_CAP ? 1.1 : 1;
}

export function trackName(id: string): string {
  if (NODE_BY_ID[id]) return itemName(id);
  const recipe = RECIPE_BY_ID[id];
  if (recipe?.outputs[0]) return itemName(recipe.outputs[0].id);
  return ENEMY_BY_ID[id]?.name ?? id;
}

/** Perk lines for crossing 10, 20, or 30. One action crosses at most one of these. */
export function levelUpLines(name: string, before: number, after: number, kind: 'node' | 'enemy'): string[] {
  const lines: string[] = [];
  if (kind === 'node') {
    if (before < 10 && after >= 10) lines.push(`${name} mastery 10: sell value +5%`);
    if (before < 20 && after >= 20) lines.push(`${name} mastery 20: actions 5% faster`);
    if (before < 30 && after >= 30) lines.push(`${name} mastery 30: +5% XP`);
  } else {
    if (before < 10 && after >= 10) lines.push(`${name} mastery 10`);
    if (before < 20 && after >= 20) lines.push(`${name} mastery 20`);
    if (before < 30 && after >= 30) lines.push(`${name} mastery 30: loot value +10%`);
  }
  return lines;
}

/** Shown when maxing a track actually raises that skill's global bonus. */
export function globalBonusLine(skill: string, beforeBonus: number, afterBonus: number): string | null {
  if (afterBonus <= beforeBonus + 1e-9) return null;
  return `+${Math.round((afterBonus - beforeBonus) * 100)}% ${skill} XP`;
}
