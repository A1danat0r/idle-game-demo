import { ENEMIES, ENEMY_BY_ID, HABITATS, LEVEL_CAP, MEADOW_LADDER, NODES, SKILL_IDS, enemyUnlocked, habitatMasteryId } from './content';
import { skillLevel, type Save } from './engine';
import { MASTERY_CAP, masteryLevel } from './mastery';

export interface EnemyKillLine {
  id: string;
  name: string;
  kills: number;
}

export interface ProfileStats {
  totalLevel: number;
  totalXp: number;
  coins: number;
  coinsFromKills: number;
  coinsFromSales: number;
  coinsEarned: number;
  coinsSpent: number;
  timePlayed: number;
  savedAt: number | null;
  kills: number;
  killsByEnemy: EnemyKillLine[];
  /** Furthest Meadow rung the save can fight. */
  ladderOpen: string;
  enemiesMastered: number;
  nodesMastered: number;
}

/** Numbers the Profile screen can show from the save as it already exists. */
export function deriveProfileStats(state: Save): ProfileStats {
  let totalLevel = 0;
  for (const skill of SKILL_IDS) totalLevel += Math.min(LEVEL_CAP, skillLevel(state, skill));
  let totalXp = 0;
  for (const amount of Object.values(state.xp)) totalXp += amount ?? 0;
  let killTotal = 0;
  for (const count of Object.values(state.enemyKills)) killTotal += count ?? 0;
  const killsByEnemy = ENEMIES.flatMap((enemy) => {
    const kills = state.enemyKills[enemy.id] ?? 0;
    return kills > 0 ? [{ id: enemy.id, name: enemy.name, kills }] : [];
  });
  let ladderOpen = ENEMY_BY_ID[MEADOW_LADDER[0]].name;
  for (const id of MEADOW_LADDER) {
    if (enemyUnlocked(state.enemyKills, id)) ladderOpen = ENEMY_BY_ID[id].name;
  }
  let enemiesMastered = 0;
  for (const enemy of ENEMIES) {
    if (masteryLevel(state.enemyMastery[enemy.id] ?? 0) >= MASTERY_CAP) enemiesMastered += 1;
  }
  let nodesMastered = 0;
  for (const node of NODES) {
    if (node.skill === 'Foraging') continue;
    if (masteryLevel(state.mastery[node.id] ?? 0) >= MASTERY_CAP) nodesMastered += 1;
  }
  for (const habitat of HABITATS) {
    if (masteryLevel(state.mastery[habitatMasteryId(habitat.id)] ?? 0) >= MASTERY_CAP) nodesMastered += 1;
  }
  return {
    totalLevel,
    totalXp,
    coins: state.coins,
    coinsFromKills: state.stats.coinsFromKills,
    coinsFromSales: state.stats.coinsFromSales,
    coinsEarned: state.stats.coinsEarned,
    coinsSpent: state.stats.coinsSpent,
    timePlayed: state.stats.timePlayed,
    savedAt: state.savedAt ?? null,
    kills: killTotal,
    killsByEnemy,
    ladderOpen,
    enemiesMastered,
    nodesMastered,
  };
}

/** Credited play time, floored to minutes. Hours appear once an hour has passed. */
export function formatPlayed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** Local date and time of the last write. Missing timestamps stay unknown. */
export function formatSavedAt(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return 'unknown';
  return new Date(ms).toLocaleString();
}
