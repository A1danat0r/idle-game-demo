import { ENEMIES, ENEMY_BY_ID, MEADOW_LADDER, NODES, SKILL_IDS, enemyUnlocked } from './content';
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
  for (const skill of SKILL_IDS) totalLevel += skillLevel(state, skill);
  let totalXp = 0;
  for (const amount of Object.values(state.xp)) totalXp += amount ?? 0;
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
    if (masteryLevel(state.mastery[node.id] ?? 0) >= MASTERY_CAP) nodesMastered += 1;
  }
  return {
    totalLevel,
    totalXp,
    coins: state.coins,
    coinsFromKills: state.stats.coinsFromKills,
    coinsFromSales: state.stats.coinsFromSales,
    kills: state.stats.kills,
    killsByEnemy,
    ladderOpen,
    enemiesMastered,
    nodesMastered,
  };
}
