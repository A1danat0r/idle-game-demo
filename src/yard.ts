import { BUILDING_STEPS, TOOL_TIME_FACTOR, type SkillId } from './content';

/** Placeable buildings, in the r2 table order used when an old save is migrated. */
export const YARD_BUILDINGS = [
  'activity.construction.pine_work_area',
  'activity.construction.stone_foundation',
  'activity.construction.oak_workshop',
  'activity.construction.supply_racks',
  'activity.construction.forge_extension',
] as const;

export const YARD_TILES = 9;
/** Tiles that can open. The other five stay locked. */
export const OPENABLE_TILES = 4;

const TILE_LEVEL = [1, 15, 25, 35] as const;

export const YARD_NAMES: Record<(typeof YARD_BUILDINGS)[number], string> = {
  'activity.construction.pine_work_area': 'Pine work area',
  'activity.construction.stone_foundation': 'Stone foundation',
  'activity.construction.oak_workshop': 'Oak workshop',
  'activity.construction.supply_racks': 'Supply racks',
  'activity.construction.forge_extension': 'Steel forge extension',
};

/** 1 at Construction 1, 2 at 15, 3 at 25, 4 at 35. */
export function openYardTiles(level: number): number {
  let open = 0;
  for (const gate of TILE_LEVEL) if (level >= gate) open += 1;
  return open;
}

export function yardTileLevel(index: number): number | null {
  return TILE_LEVEL[index] ?? null;
}

export function isYardBuilding(id: string): boolean {
  return (YARD_BUILDINGS as readonly string[]).includes(id);
}

/** "Crafting ×0.937". Empty when the id is not a placed bonus. */
export function yardBonus(id: string): string {
  const skills = BUILDING_STEPS[id] as SkillId[] | undefined;
  if (!skills?.length) return '';
  return `${skills[0]} ×${TOOL_TIME_FACTOR}`;
}
