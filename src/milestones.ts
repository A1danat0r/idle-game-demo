import {
  ENEMY_BY_ID,
  NODE_BY_ID,
  NODES,
  RECIPE_BY_ID,
  RECIPES,
  XP_TABLE,
  actionTitle,
  itemName,
  teaserOpen,
  woodlandOpen,
  type SkillId,
} from './content';
import type { Save } from './engine';
import { skillLevel } from './engine';
import { actionMasteryXp, masteryLevel, masteryThreshold } from './mastery';

const PERK_LEVELS = [10, 20, 30, 40] as const;
const ENEMY_PERK_KILLS = [60, 266, 619, 1118] as const;

const PERK_LABEL: Record<(typeof PERK_LEVELS)[number], string> = {
  10: '+5% sell',
  20: '−5% action time',
  30: '+5% XP',
  40: '5% double output',
};

export interface UnlockItem {
  id: string;
  title: string;
  level: number;
  reached: boolean;
  note: string;
}

export interface UnlockGroup {
  level: number;
  items: UnlockItem[];
}

function joinNames(titles: string[]): string {
  const names = titles.map((title) => title.toLowerCase());
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${cap(names[0])} and ${names[1]}`;
  return `${cap(names[0])}, ${names.slice(1, -1).join(', ')} and ${names[names.length - 1]}`;
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function fmt(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString('en-US');
}

function masteryLabel(id: string): string {
  const enemy = ENEMY_BY_ID[id];
  if (enemy) return enemy.name;
  const raw = NODE_BY_ID[id] ? itemName(id) : actionTitle(RECIPE_BY_ID[id] ?? { id, outputs: [] });
  return raw.replace(/ logs$/, '');
}

function itemNote(id: string, level: number, skillLevelNow: number, xpNow: number): { reached: boolean; note: string } {
  const recipe = RECIPE_BY_ID[id];
  if (recipe?.comingLater) return { reached: false, note: 'Coming later' };
  if (recipe?.locked) return { reached: false, note: recipe.locked };
  if (skillLevelNow < level) {
    const left = Math.max(0, (XP_TABLE[level] ?? 0) - xpNow);
    return { reached: false, note: `${fmt(left)} XP to go` };
  }
  return { reached: true, note: 'Reached' };
}

/** Shipped unlocks of one skill, in catalogue order, grouped by level. */
export function unlockGroups(state: Save, skill: SkillId): UnlockGroup[] {
  const now = skillLevel(state, skill);
  const xpNow = state.xp[skill] ?? 0;
  const items: UnlockItem[] = [];
  for (const node of NODES) {
    if (node.skill !== skill) continue;
    const mark = itemNote(node.id, node.level, now, xpNow);
    items.push({ id: node.id, title: itemName(node.id), level: node.level, ...mark });
  }
  for (const recipe of RECIPES) {
    if (recipe.skill !== skill) continue;
    const mark = itemNote(recipe.id, recipe.level, now, xpNow);
    items.push({ id: recipe.id, title: actionTitle(recipe), level: recipe.level, ...mark });
  }
  const levels = [...new Set(items.map((item) => item.level))].sort((a, b) => a - b);
  return levels.map((level) => ({
    level,
    items: items.filter((item) => item.level === level),
  }));
}

function skillProduces(skill: SkillId): Set<string> {
  const ids = new Set<string>();
  for (const node of NODES) if (node.skill === skill) ids.add(node.id);
  for (const recipe of RECIPES) {
    if (recipe.skill !== skill) continue;
    for (const output of recipe.outputs) ids.add(output.id);
  }
  return ids;
}

export interface UsedBy {
  id: string;
  title: string;
  skill: SkillId;
  level: number;
}

/** Cross-skill tools that consume this skill's outputs. Not candidates for the Next row. */
export function usedBy(skill: SkillId): UsedBy[] {
  const made = skillProduces(skill);
  const rows: UsedBy[] = [];
  for (const recipe of RECIPES) {
    if (recipe.skill === skill || !recipe.tool) continue;
    if (!recipe.inputs.some((input) => made.has(input.id))) continue;
    const output = recipe.outputs[0];
    rows.push({
      id: recipe.id,
      title: output ? itemName(output.id) : actionTitle(recipe),
      skill: recipe.skill,
      level: recipe.level,
    });
  }
  return rows;
}

export function activityTrack(state: Save): { id: string; skill: SkillId; seconds: number } | null {
  const activity = state.activity;
  if (!activity || activity.kind === 'combat') return null;
  if (activity.kind === 'gather') {
    const node = NODE_BY_ID[activity.nodeId];
    if (!node || !state.owned.includes(node.skill)) return null;
    return { id: node.id, skill: node.skill, seconds: node.seconds };
  }
  const recipe = RECIPE_BY_ID[activity.recipeId];
  if (!recipe || !state.owned.includes(recipe.skill)) return null;
  return { id: recipe.id, skill: recipe.skill, seconds: recipe.seconds };
}

function skillHalf(state: Save, skill: SkillId): string {
  const now = skillLevel(state, skill);
  const groups = unlockGroups(state, skill);
  const next = groups.find((group) => group.level > now);
  if (!next) return `${skill} 40 (max)`;
  const names = joinNames(next.items.map((item) => item.title));
  const xpLeft = Math.max(0, (XP_TABLE[next.level] ?? 0) - (state.xp[skill] ?? 0));
  return `${names} at ${skill} ${next.level} (${fmt(xpLeft)} XP)`;
}

function masteryHalf(state: Save, id: string, skill: SkillId, seconds: number): string {
  const mxp = state.mastery[id] ?? 0;
  const level = masteryLevel(mxp);
  const name = masteryLabel(id);
  const next = PERK_LEVELS.find((perk) => level < perk);
  if (!next) {
    return `${name} mastery 40 (maxed): 5% double output · +3% ${skill} XP (cap +15%)`;
  }
  const remaining = Math.max(0, masteryThreshold(next) - mxp);
  const actions = Math.ceil(remaining / actionMasteryXp(seconds));
  return `${name} mastery ${next}: ${PERK_LABEL[next]} (${fmt(remaining)} MXP, ${fmt(actions)} actions)`;
}

/** Activity-screen Next row. Null when nothing gatherable or producible is selected. */
export function activityNextLine(state: Save): string | null {
  const track = activityTrack(state);
  if (!track) return null;
  return `Next: ${skillHalf(state, track.skill)} · ${masteryHalf(state, track.id, track.skill, track.seconds)}.`;
}

/** Combat Next row for the selected enemy. Does not repeat the 12-kill ladder. */
export function combatNextLine(state: Save, enemyId: string): string | null {
  const enemy = ENEMY_BY_ID[enemyId];
  if (!enemy) return null;
  const kills = state.enemyKills[enemyId] ?? 0;
  const level = masteryLevel(kills * 102);
  const next = PERK_LEVELS.find((perk) => level < perk);
  if (!next) return `${enemy.name} mastery 40 (maxed) · +10% loot coins from kill 1,119.`;
  const needKills = Math.ceil(masteryThreshold(next) / 102) - kills;
  const bonus = next === 40 ? ' · +10% loot coins from kill 1,119' : '';
  return `${enemy.name} mastery ${next} in ${fmt(needKills)} kills${bonus}.`;
}

export function enemyPerkKills(): readonly number[] {
  return ENEMY_PERK_KILLS;
}

export function trackChoices(skill: SkillId): { id: string; title: string }[] {
  const rows: { id: string; title: string }[] = [];
  for (const node of NODES) {
    if (node.skill === skill) rows.push({ id: node.id, title: itemName(node.id) });
  }
  for (const recipe of RECIPES) {
    if (recipe.skill === skill) rows.push({ id: recipe.id, title: actionTitle(recipe) });
  }
  return rows;
}

export function trackSeconds(id: string): number {
  return NODE_BY_ID[id]?.seconds ?? RECIPE_BY_ID[id]?.seconds ?? 0;
}

export function masterySheetLines(state: Save, id: string): { label: string; detail: string }[] {
  const mxp = state.mastery[id] ?? 0;
  const level = masteryLevel(mxp);
  return PERK_LEVELS.map((perk) => {
    const reached = level >= perk;
    const remaining = Math.max(0, masteryThreshold(perk) - mxp);
    const detail = reached ? 'Reached' : `${fmt(remaining)} MXP to go`;
    return { label: `Mastery ${perk}: ${PERK_LABEL[perk]}`, detail };
  });
}

export function combatSheetLines(state: Save, enemyId: string): { label: string; detail: string }[] {
  const kills = state.enemyKills[enemyId] ?? 0;
  const lines = ENEMY_PERK_KILLS.map((need, index) => {
    const perk = PERK_LEVELS[index];
    return {
      label: `${fmt(need)} kills · mastery ${perk}`,
      detail: kills >= need ? 'Reached' : `${fmt(need - kills)} kills to go`,
    };
  });
  lines.push({
    label: 'First Thorn beetle kill opens Woodland edge',
    detail: woodlandOpen(state.enemyKills) ? 'Reached' : 'Locked',
  });
  lines.push({
    label: 'Kill the Hedge poacher to open ??? (coming later)',
    detail: teaserOpen(state.enemyKills) ? 'Reached' : 'Locked',
  });
  return lines;
}
