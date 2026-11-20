import {
  actionTitle,
  arrowToUse,
  gearLocked,
  isBow,
  AREAS,
  TEASER_AREA,
  TEASER_COPY,
  MEADOW_LADDER,
  WOODLAND_LADDER,
  RUNG_KILLS,
  enemyUnlocked,
  teaserOpen,
  woodlandOpen,
  COMBAT_STYLES,
  SKILL_GROUPS,
  ENEMIES,
  ENEMY_BY_ID,
  ITEMS,
  HABITATS,
  NODE_BY_ID,
  NODES,
  RECIPE_BY_ID,
  RECIPES,
  DEMO_PURCHASE_SLOTS,
  SKILL_PRICES,
  SHOP_ITEMS,
  SHOP_PRICE,
  LEVEL_CAP,
  XP_CAP,
  XP_TABLE,
  equippedGear,
  gearStatText,
  isCombatStyle,
  isFood,
  countedLabel,
  countedName,
  habitatMasteryId,
  itemName,
  lockLine,
  type IconName,
  levelForXp,
  playerHitChance,
  skillPrice,
  weaponFitsStyle,
  equipSlotFor,
  type CombatStyle,
  type SkillId,
} from './content';
import {
  actionSeconds,
  activityLabel,
  dismantleRefund,
  EXPEDITION_MS,
  expeditionClock,
  expeditionPreview,
  expeditionRemainingMs,
  expeditionRouteName,
  explorationRoute,
  explorationRoutes,
  forageEntryReady,
  habitatPace,
  habitatSeconds,
  habitatTable,
  habitatTickXp,
  ensureFarmPlots,
  formulaLevel,
  hasInputs,
  maxHp,
  nodeUsable,
  ownsCombatSkill,
  shopStock,
  skillLevel,
  toolTier,
  type CatchupReport,
  type Save,
} from './engine';
import { icon } from './icons';
import {
  activityNextLine,
  activityTrack,
  enchantingNextLine,
  explorationNextLine,
  combatNextLine,
  combatSheetLines,
  masteryHeading,
  masterySheetLines,
  trackChoices,
  trackSeconds,
  unlockGroups,
  usedBy,
} from './milestones';
import { enemyFigure, playerFigure } from './sprites';
import {
  AUTO_REPLANT_COST,
  BONE_COMPOST_ITEM_ID,
  COMPOST_ITEM_ID,
  PLOT_COUNT,
  PLOT_GATES,
  isPlotCrop,
} from './plots';
import { YARD_BUILDINGS, YARD_NAMES, YARD_TILES, openYardTiles, yardBonus, yardTileLevel } from './yard';
import { MARKS, MARK_TEXT, markRecipeId, modifiersFor, rankCost } from './marks';
import { deriveProfileStats, formatPlayed, formatSavedAt } from './profile';
import {
  actionXpMultiplier,
  globalXpBonus,
  countMaxed,
  masteryLevel,
  masteryProgress,
  sellMultiplier,
} from './mastery';

export const TAB_IDS = ['skills', 'skill', 'combat', 'inventory', 'equipment', 'profile'] as const;
export type TabId = (typeof TAB_IDS)[number];
export type Filter = 'all' | 'material' | 'gear' | 'food';

export interface View {
  tab: TabId;
  skill: SkillId | null;
  filter: Filter;
  selected: string | null;
  area: (typeof AREAS)[number] | typeof TEASER_AREA;
  style: CombatStyle | null;
  message: string;
  /** Second tap of Reset account. Not saved. */
  resetConfirm?: boolean;
  /** Milestone sheet. Not saved. */
  milestoneOpen?: boolean;
  /** Track shown in the sheet. Null follows the running action or selected enemy. */
  milestoneTrack?: string | null;
  /** Combat tab screen. Not saved. */
  combatScreen?: CombatScreen;
  /** Row last tapped. Not the Next default. Not saved. */
  routeId?: string | null;
  /** Last route packed this session. Not saved. Weathered agate until then. */
  packedRoute?: string | null;
  /** Chosen expedition length. Not saved. One of 15 min, 1 h, 8 h. */
  routeMs?: number | null;
  /** Land screen over the Activity tab. Not saved. */
  land?: boolean;
  /** Compost applied to the next planting. Not saved. */
  plantCompost?: 'compost' | 'bone' | null;
  /** Enchanting mark whose mastery the Next row follows. Not saved. */
  markId?: string | null;
  /** Selected yard tile. Not saved. */
  yardTile?: number | null;
  /** Stored building waiting for an empty tile. Not saved. */
  placeId?: string | null;
}

export type CombatScreen = 'areas' | 'ladder' | 'fight' | 'teaser';

/** First open this session: a running or paused fight, otherwise Areas. */
export function combatScreenFor(state: Save, view: View): CombatScreen {
  if (view.combatScreen) return view.combatScreen;
  return state.activity?.kind === 'combat' ? 'fight' : 'areas';
}

/** Header back: Fight → that area's ladder, and every other combat screen → Areas. */
export function combatBackScreen(view: View): CombatScreen {
  if (view.combatScreen === 'fight') return view.area === TEASER_AREA ? 'teaser' : 'ladder';
  return 'areas';
}

/** The training-row chip. A set chip wins; otherwise the running fight, the saved style, then the first owned style. */
export function combatStyleChoice(state: Save, view: View): CombatStyle | null {
  if (view.style && state.owned.includes(view.style)) return view.style;
  const activity = state.activity;
  if (activity?.kind === 'combat' && state.owned.includes(activity.style)) return activity.style;
  if (state.combatStyle && state.owned.includes(state.combatStyle)) return state.combatStyle;
  return COMBAT_STYLES.find((id) => state.owned.includes(id)) ?? null;
}

/** Fight-screen header: the running fight's style, or the chip when nothing is running. */
export function fightHeaderStyle(state: Save, view: View): CombatStyle | null {
  const activity = state.activity;
  if (activity?.kind === 'combat' && state.owned.includes(activity.style)) return activity.style;
  return combatStyleChoice(state, view);
}

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtCoins = (n: number) => Math.floor(n).toLocaleString('en-US');
const fmtXp = (n: number) => Math.floor(n).toLocaleString('en-US');
/** Bank counts of 1,000 or more use thousands separators. Smaller counts stay plain. */
function bankCount(n: number): string {
  const whole = Math.max(0, Math.floor(n));
  return whole >= 1000 ? whole.toLocaleString('en-US') : String(whole);
}
function buyOff(affordable: boolean): string {
  return affordable ? '' : ' disabled aria-disabled="true"';
}
const coin = (n: number) => `<span class="coin">${icon('coin', 16)}${fmtCoins(n)}</span>`;
const bar = (pct: number, cls = '', live = '') =>
  `<div class="bar ${cls}"><i${live ? ` data-live="${live}"` : ''} style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
const title = (text: string) => `<h2 class="title"><span>◆</span>${esc(text)}<span>◆</span></h2>`;
const lock = `<svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="9" width="14" height="10" rx="2" fill="#8a8f9c"/><path d="M6 9V6a4 4 0 0 1 8 0v3" fill="none" stroke="#8a8f9c" stroke-width="2"/></svg>`;
/** Padlock in the same small pill as a locked route's "Lv 20" badge. */
function lockBadge(extra = ''): string {
  return `<span class="tag" aria-label="Locked">${lock}${extra}</span>`;
}

function fmtAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function fmtXpAmount(value: number): string {
  const rounded = Math.round(value * 10000) / 10000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return Math.round(rounded).toLocaleString('en-US');
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function masteryLine(mxp: number): string {
  return `<small>Mastery Lv ${masteryLevel(mxp)}</small>${bar(masteryProgress(mxp), 'thin')}`;
}

function activityMastery(state: Save): { pct: number } | null {
  const activity = state.activity;
  if (!activity) return null;
  const mxp =
    activity.kind === 'gather'
      ? state.mastery[activity.nodeId] ?? 0
      : activity.kind === 'forage'
        ? state.mastery[habitatMasteryId(activity.habitatId)] ?? 0
        : activity.kind === 'produce'
          ? state.mastery[activity.recipeId] ?? 0
          : state.enemyMastery[activity.enemyId] ?? 0;
  return { pct: masteryProgress(mxp) };
}

function xpView(xp: number): { level: number; pct: number; text: string } {
  const level = levelForXp(xp);
  if (level >= LEVEL_CAP) return { level, pct: 100, text: `${fmtXp(xp)} XP · cap` };
  const prev = XP_TABLE[level];
  const next = XP_TABLE[level + 1];
  return { level, pct: ((xp - prev) / (next - prev)) * 100, text: `${fmtXp(xp)} / ${fmt(next)} XP` };
}

function secondsText(seconds: number): string {
  const text = (Math.round(seconds * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '');
  return `${text}s`;
}

function timeLabel(state: Save, id: string): string {
  return secondsText(actionSeconds(state, id));
}

function oddsText(weight: number, total: number): string {
  const pct = (weight / total) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

/** Header, then the scrolling page, then the activity bar in the bottom bar, directly above the tabs. */
export function shellHtml(header: string, message: string, main: string, activity: string, tabs: string): string {
  return `${header}${message}<main>${main}</main>${activity}${tabs}`;
}

export function headerHtml(state: Save, devOn: boolean): string {
  return `<header class="top">
    <div class="avatar">${playerFigure(30)}</div>
    <div class="coins" data-coins>${coin(state.coins)}</div>
    ${devOn ? '<button type="button" class="devbtn" data-dev-open>Dev</button>' : ''}
    <button type="button" class="build" data-about><b>${esc(__BUILD_LABEL__)}</b>${esc(__COMMIT_SHA__)}</button>
  </header>`;
}

/** One line above the activity slot. Shown while an expedition is out or plots are ready. */
export function backgroundStripHtml(state: Save): string {
  const ready = state.plots.filter((plot) => plot?.ready).length;
  if (!state.expedition && ready === 0) return '';
  const trip = state.expedition
    ? `Expedition <span data-live="expedition-clock">${expeditionClock(expeditionRemainingMs(state))}</span>`
    : '';
  const plots = ready > 0 ? `Plots ${ready} ready` : '';
  return `<div class="bgstrip" data-bgstrip>${trip}${trip && plots ? ' · ' : ''}${plots}</div>`;
}

export function activityHtml(state: Save): string {
  const pct = activityPct(state);
  const label = activityLabel(state);
  const detail = activityDetail(state);
  const iconName = activityIcon(state);
  const resume = state.paused
    ? `<button type="button" class="tag btn" data-resume>Resume</button>`
    : `<small data-live="act-pct">${Math.round(pct)}%</small>`;
  const mastery = activityMastery(state);
  const bars = mastery
    ? `<div class="actbars">${bar(pct, state.paused ? 'red' : '', 'act-bar')}${bar(mastery.pct, 'thin')}</div>`
    : bar(pct, state.paused ? 'red' : '', 'act-bar');
  return `<div class="activity" data-activity>${icon(iconName, 34)}<div class="grow"><b>${esc(label)}</b><small>${esc(detail)}</small>${bars}</div>${resume}</div>`;
}

/** Progress within the current action. This changes on every tick; the controls do not. */
export function activityPercent(state: Save): number {
  return activityPct(state);
}

const SKILL_ICON: Record<SkillId, IconName> = {
  Woodcutting: 'log',
  Fishing: 'fish',
  Mining: 'ore',
  Cooking: 'food',
  Smithing: 'bar',
  Attack: 'sword',
  Strength: 'sword',
  Defence: 'shield',
  Hitpoints: 'food',
  Foraging: 'herb',
  Farming: 'herb',
  Crafting: 'part',
  Alchemy: 'herb',
  Construction: 'stone',
  Enchanting: 'gem',
  Exploration: 'gem',
  Ranged: 'ammo',
  Magic: 'gem',
};

/** The running action's item icon, then its skill icon, then the idle mark. */
export function activityIcon(state: Save): IconName {
  const activity = state.activity;
  if (!activity) return 'idle';
  if (activity.kind === 'combat') {
    if (activity.style === 'Ranged') return 'bow';
    if (activity.style === 'Magic') return 'staff';
    return 'sword';
  }
  if (activity.kind === 'gather') {
    return ITEMS[activity.nodeId]?.icon ?? SKILL_ICON[NODE_BY_ID[activity.nodeId]?.skill ?? 'Woodcutting'];
  }
  if (activity.kind === 'forage') return 'herb';
  const recipe = RECIPE_BY_ID[activity.recipeId];
  const output = recipe?.outputs[0]?.id;
  if (output && ITEMS[output]?.icon) return ITEMS[output].icon;
  return SKILL_ICON[recipe?.skill ?? 'Cooking'];
}

export interface ActivityDestination {
  tab: 'skill' | 'combat';
  skill: SkillId;
  area?: (typeof AREAS)[number];
  selected?: string;
}

/**
 * Where the Activity tab goes.
 * A running gather or production action opens that skill.
 * A fight opens the Combat screen on that enemy. Combat skills have no activity page.
 * With nothing running, use the skill already open this session, then Woodcutting.
 * The save does not store the open skill, so a reload forgets it.
 */
export function activityDestination(state: Save, lastSkill: SkillId | null): ActivityDestination {
  const activity = state.activity;
  if (activity?.kind === 'combat') {
    const enemy = ENEMY_BY_ID[activity.enemyId];
    return {
      tab: 'combat',
      skill: activity.style,
      area: enemy?.area,
      selected: activity.enemyId,
    };
  }
  let skill: SkillId | null = null;
  if (activity?.kind === 'gather') skill = NODE_BY_ID[activity.nodeId]?.skill ?? null;
  if (activity?.kind === 'forage') skill = 'Foraging';
  if (activity?.kind === 'produce') skill = RECIPE_BY_ID[activity.recipeId]?.skill ?? null;
  if (!skill) {
    skill = lastSkill && !isCombatStyle(lastSkill) && lastSkill !== 'Hitpoints' ? lastSkill : 'Woodcutting';
  }
  return { tab: 'skill', skill };
}

/**
 * Identity of the interactive screen. Progress inside an action is intentionally
 * left out, so a tick can refresh bars without replacing the buttons under a finger.
 */
export function renderKey(state: Save, view: View, extra = ''): string {
  const activity = state.activity;
  const act = !activity
    ? ''
    : activity.kind === 'gather'
      ? `g:${activity.nodeId}`
      : activity.kind === 'forage'
        ? `f:${activity.habitatId}`
        : activity.kind === 'produce'
          ? `p:${activity.recipeId}`
          : `c:${activity.enemyId}:${activity.style}`;
  return JSON.stringify({
    extra,
    view,
    paused: state.paused,
    act,
    phase: state.combat?.phase ?? '',
    enemyHp: state.combat ? Math.ceil(state.combat.enemyHp) : null,
    hits: state.combat?.hitsLanded ?? 0,
    hp: Math.ceil(state.hp),
    coins: Math.floor(state.coins),
    owned: state.owned,
    nodes: state.nodes,
    bank: state.bank,
    equipped: state.equipped,
    food: state.foodSlot,
    xp: state.xp,
    mastery: state.mastery,
    enemyMastery: state.enemyMastery,
    shop: state.shop,
    purchaseCount: state.purchaseCount,
    plotsBought: state.plotsBought,
    autoReplant: state.autoReplant === true,
    autoReplantOn: state.autoReplant === true && state.autoReplantOn !== false,
    plots: state.plots.map((plot) => (plot ? `${plot.recipeId}:${plot.compost ?? ''}:${plot.ready ? 1 : 0}` : '')).join('|'),
    expedition: state.expedition?.routeId ?? '',
  });
}

function activityPct(state: Save): number {
  const activity = state.activity;
  if (!activity) return 0;
  if (activity.kind === 'gather') return pct(state.progressMs, actionSeconds(state, activity.nodeId) * 1000);
  if (activity.kind === 'forage') return pct(state.progressMs, habitatSeconds(state, activity.habitatId) * 1000);
  if (activity.kind === 'produce') return pct(state.progressMs, actionSeconds(state, activity.recipeId) * 1000);
  const combat = state.combat;
  if (!combat) return 0;
  if (combat.phase === 'pause') {
    const start = combat.killAtMs ?? 0;
    return pct(state.progressMs - start, 3000);
  }
  return pct(state.progressMs - combat.swings * 2400, 2400);
}

function pct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (done / total) * 100));
}

function activityDetail(state: Save): string {
  const activity = state.activity;
  if (!activity) return 'Nothing running';
  if (state.paused) return 'Tap to resume';
  if (activity.kind === 'gather') {
    const node = NODES.find((row) => row.id === activity.nodeId)!;
    const seconds = actionSeconds(state, node.id);
    const unit = (ITEMS[node.id]?.sell ?? 0) * sellMultiplier(state.mastery, node.id);
    const perHour = Math.round((3600 * unit) / seconds);
    return `${timeLabel(state, node.id)} · ${node.xp} XP · ${fmt(perHour)} coins/h if sold`;
  }
  if (activity.kind === 'forage') {
    const pace = habitatPace(state, activity.habitatId);
    if (!pace) return 'Nothing in the table';
    return `${secondsText(habitatSeconds(state, activity.habitatId))} · ${fmtAmount(habitatTickXp(state, activity.habitatId))} XP`;
  }
  if (activity.kind === 'produce') {
    const recipe = RECIPES.find((row) => row.id === activity.recipeId)!;
    return `${timeLabel(state, recipe.id)} · ${recipe.xp} XP`;
  }
  const enemy = ENEMY_BY_ID[activity.enemyId];
  return `${activity.style} · hit ${Math.round(shownHitChance(state, enemy.level) * 100)}% · ${state.hp}/${maxHp(state)} HP`;
}

function shownHitChance(state: Save, enemyLevel: number): number {
  const gear = equippedGear(state.equipped, state.bank);
  return playerHitChance(formulaLevel(state, 'Attack'), enemyLevel, gear.acc + (state.markRanks?.['hunt.acc'] ?? 0));
}

export function tabsHtml(view: View): string {
  const labels: Record<TabId, string> = {
    skills: 'Skills',
    skill: 'Activity',
    combat: 'Combat',
    inventory: 'Inventory',
    equipment: 'Equip',
    profile: 'Profile',
  };
  const paths: Record<TabId, string> = {
    skills: '<path d="M12 2 L15 9 L22 9 L16 14 L18 21 L12 17 L6 21 L8 14 L2 9 L9 9 Z"/>',
    skill: '<path d="M5 20 L15 6 M13 4 L20 8 L16 12 Z"/>',
    combat: '<path d="M4 20 L18 6 M6 6 L20 20 M16 4 L20 4 L20 8 M4 16 L4 20 L8 20"/>',
    inventory: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8 V5 H15 V8"/>',
    equipment: '<path d="M12 3 L20 6 Q20 16 12 21 Q4 16 4 6 Z"/>',
    profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20 Q5 13 12 13 Q19 13 19 20"/>',
  };
  return `<nav class="tabs">${TAB_IDS.map((id) => `<button type="button" data-tab="${id}" class="${view.tab === id ? 'on' : ''}"><svg viewBox="0 0 24 24" width="22" height="22">${paths[id]}</svg>${esc(labels[id])}</button>`).join('')}</nav>`;
}

export function mainHtml(state: Save, view: View, now: number, devOn = false): string {
  ensureFarmPlots(state);
  if (view.tab === 'skills') return skillsHtml(state);
  if (view.tab === 'skill' && view.land) return landHtml(state, view);
  if (view.tab === 'skill') return skillHtml(state, view) + milestoneSheetHtml(state, view);
  if (view.tab === 'combat') return combatHtml(state, view) + milestoneSheetHtml(state, view);
  if (view.tab === 'inventory') return inventoryHtml(state, view, now);
  if (view.tab === 'profile') return profileHtml(state, devOn, view.resetConfirm === true);
  return equipmentHtml(state);
}

function profileHtml(state: Save, devOn: boolean, resetConfirm: boolean): string {
  const stats = deriveProfileStats(state);
  const kills =
    stats.killsByEnemy.length === 0
      ? '<p class="note">No kills yet.</p>'
      : stats.killsByEnemy
          .map((row) => `<p class="statline"><span>${esc(row.name)}</span><b>${fmt(row.kills)}</b></p>`)
          .join('');
  const reset = resetConfirm
    ? `<p class="note">This deletes the save on this device and starts over. Offline time is not granted.</p>
      <button type="button" class="tag btn danger" data-reset-confirm>Confirm reset</button>
      <button type="button" class="tag btn ghost" data-reset-cancel>Cancel</button>`
    : `<p class="note">Wipes this save on this device. The Debug switch stays as it is.</p>
      <button type="button" class="tag btn danger" data-reset-ask>Reset account</button>`;
  return `${title('Profile')}
    <div class="panel">
      <h3>Stats</h3>
      <div class="statgrid">
        <div><small>Total level</small><b>${fmt(stats.totalLevel)}</b></div>
        <div><small>Total XP</small><b>${fmtXp(stats.totalXp)}</b></div>
        <div><small>Coins</small><b>${fmtCoins(stats.coins)}</b></div>
        <div><small>Kills</small><b>${fmt(stats.kills)}</b></div>
        <div><small>Time played</small><b>${esc(formatPlayed(stats.timePlayed))}</b></div>
        <div><small>Coins earned</small><b>${fmtCoins(stats.coinsEarned)}</b></div>
        <div><small>Coins spent</small><b>${fmtCoins(stats.coinsSpent)}</b></div>
        <div><small>Coins from kills</small><b>${fmtCoins(stats.coinsFromKills)}</b></div>
        <div><small>Coins from sales</small><b>${fmtCoins(stats.coinsFromSales)}</b></div>
        <div><small>Enemies mastered</small><b>${fmt(stats.enemiesMastered)}</b></div>
        <div><small>Nodes mastered</small><b>${fmt(stats.nodesMastered)}</b></div>
      </div>
      <p class="statline"><span>Ladder open</span><b>${esc(stats.ladderOpen)}</b></p>
      <p class="statline"><span>Last save</span><b>${esc(formatSavedAt(stats.savedAt))}</b></p>
    </div>
    <div class="panel">
      <h3>Kills</h3>
      ${kills}
    </div>
    <div class="panel">
      <h3>Build</h3>
      <p class="aboutline"><b>${esc(__BUILD_LABEL__)}</b> ${esc(__COMMIT_SHA__)}</p>
    </div>
    <div class="panel">
      <h3>Debug</h3>
      <p class="note">Turns the dev tools on or off. Remembered on this device, including the installed app. A link with ?dev=1 still turns them on.</p>
      <button type="button" class="tag btn" data-debug-toggle>${devOn ? 'Debug on' : 'Debug off'}</button>
    </div>
    <div class="panel resetbox">
      <h3>Reset</h3>
      ${reset}
    </div>`;
}

function skillsHtml(state: Save): string {
  const next = skillPrice(state.purchaseCount);
  const groups = SKILL_GROUPS.map((group) => {
    const rows = group.skills
      .filter((skill) => skill !== 'Hitpoints' || state.owned.includes('Hitpoints'))
      .map((skill) => skillRow(state, skill, next))
      .join('');
    return `<h3>${group.name}</h3><div class="list">${rows}</div>`;
  }).join('');
  const curve = SKILL_PRICES.slice(0, DEMO_PURCHASE_SLOTS)
    .map((price, index) => `<div class="k ${index === state.purchaseCount ? 'next' : ''}"><small>#${index + 1}</small>${fmt(price)}</div>`)
    .join('');
  return `${title('Skills')}
    <p class="note">The next skill costs the same whichever one you buy. Hitpoints is free with the first combat skill.</p>
    ${groups}
    <div class="panel"><h3>Skill prices</h3><div class="curve">${curve}</div></div>`;
}

function skillRow(state: Save, skill: SkillId, next: number | null): string {
  if (skill === 'Hitpoints') {
    const view = xpView(state.xp.Hitpoints ?? 0);
    return `<div class="row owned"><div class="ico gold">H</div><div class="grow"><b>Hitpoints <em>Lv ${view.level}</em></b>${bar(view.pct)}<small>Free with the first combat skill · ${view.text}</small></div></div>`;
  }
  if (!state.owned.includes(skill)) {
    const affordable = next != null && state.coins + 1e-9 >= next;
    const buy =
      next == null
        ? ''
        : `<button type="button" class="tag btn" data-buy-skill="${skill}"${buyOff(affordable)}>Buy</button>`;
    return `<div class="row locked"><div class="ico">${lock}</div><div class="grow"><b>${skill}</b><small>Locked</small></div><div class="price"><small>Unlock</small>${coin(next ?? 0)}${buy}</div></div>`;
  }
  const view = xpView(state.xp[skill] ?? 0);
  const open = true;
  return `<button type="button" class="row owned" data-open-skill="${skill}" ${open ? '' : 'disabled'}><div class="ico gold">${skill[0]}</div><div class="grow"><b>${skill} <em>Lv ${view.level}</em></b>${bar(view.pct)}<small>${skill === 'Woodcutting' ? 'Free from the start' : 'Owned'} · ${view.text}</small></div></button>`;
}

function isCombat(skill: SkillId): boolean {
  return skill === 'Attack' || skill === 'Strength' || skill === 'Defence' || skill === 'Ranged' || skill === 'Magic';
}

function skillHtml(state: Save, view: View): string {
  const skill = view.skill;
  if (!skill || !state.owned.includes(skill) || skill === 'Hitpoints' || isCombat(skill)) {
    return `<div class="empty">Choose a gathering or production skill from Skills.</div>`;
  }
  const xp = xpView(state.xp[skill] ?? 0);
  const tier =
    skill === 'Woodcutting' || skill === 'Mining' || skill === 'Fishing' || skill === 'Foraging'
      ? `<small>Tool tier ${toolTier(state, skill)}</small>`
      : '';
  const scene = skillScene(skill);
  const maxed = countMaxed(state.mastery, skill);
  const bonus = globalXpBonus(state.mastery, skill);
  const bonusLine =
    maxed > 0 ? `<small class="ok">+${Math.round(bonus * 100)}% XP, ${Math.min(maxed, 5)} of 5 mastered</small>` : '';
  const head = `<div class="skillhead"><div class="emblem">${icon(SKILL_ICON[skill], 30)}</div><div class="grow"><h2>${skill}</h2><small>Lv ${xp.level} · ${xp.text}</small>${bar(xp.pct)}${bonusLine}${tier}</div></div>`;
  if (skill === 'Exploration') {
    return `${head}
      ${nextRow(explorationNextLine(state, expeditionNextId(state, view)))}
      ${scene}
      ${expeditionCard(state)}
      <div class="list">${explorationRoutes().map((route) => routeRow(state, view, route)).join('')}</div>`;
  }
  if (skill === 'Enchanting') {
    const selected = view.markId && MARKS.some((mark) => mark.id === view.markId) ? view.markId : MARKS[0].id;
    return `${head}
      ${nextRow(enchantingNextLine(state, markRecipeId(selected)))}
      ${scene}
      <div class="list" data-marks>${markCardsHtml(state)}</div>
      <div class="list">${RECIPES.filter((recipe) => recipe.skill === 'Enchanting' && !recipe.id.startsWith('recipe.mark.')).map((recipe) => recipeRow(state, recipe)).join('')}</div>`;
  }
  const rows =
    skill === 'Foraging'
      ? habitatCards(state)
      : [
          ...NODES.filter((node) => node.skill === skill).map((node) => nodeRow(state, node)),
          ...RECIPES.filter((recipe) => recipe.skill === skill && !isPlotCrop(recipe.id) && !recipe.id.startsWith('recipe.mark.')).map((recipe) => recipeRow(state, recipe)),
        ].join('');
  const landButton =
    skill === 'Farming' || skill === 'Construction'
      ? `<button type="button" class="tag btn" data-open-land>Land</button>`
      : '';
  const plots =
    skill === 'Farming'
      ? `<div class="panel" data-activity-plots><h3>Plots ${landButton}</h3>${plotListHtml(state, view, false)}<p class="note">Cancelling returns nothing. Plots keep growing when another skill is selected.</p></div>`
      : landButton
        ? `<p class="landline">${landButton}</p>`
        : '';
  return `${head}
    ${nextRow(activityNextLine(state))}
    ${scene}
    ${plots}
    <div class="list">${rows}</div>`;
}

const FIRST_EXPEDITION = 'mat.gem.weathered_agate';

/** Trip out, else the last route packed this session, else the first table row. */
function expeditionNextId(state: Save, view: View): string {
  const trip = state.expedition?.routeId;
  if (trip && explorationRoute(trip)) return trip;
  if (view.packedRoute && explorationRoute(view.packedRoute)) return view.packedRoute;
  return FIRST_EXPEDITION;
}

function chosenDuration(view: View): number {
  if (view.routeMs != null && (EXPEDITION_MS as readonly number[]).includes(view.routeMs)) return view.routeMs;
  return EXPEDITION_MS[0];
}

const DURATION_LABEL: Record<number, string> = {
  [EXPEDITION_MS[0]]: '15 min',
  [EXPEDITION_MS[1]]: '1 h',
  [EXPEDITION_MS[2]]: '8 h',
};

function expeditionCard(state: Save): string {
  const trip = state.expedition;
  if (!trip) return '';
  const left = expeditionClock(expeditionRemainingMs(state));
  return `<div class="panel" data-expedition-card><b>${esc(expeditionRouteName(trip.routeId))}</b><p class="note">Back in <b data-live="expedition-clock">${left}</b></p><button type="button" class="tag btn" data-return-expedition>Return now</button></div>`;
}

function routeRow(state: Save, view: View, route: ReturnType<typeof explorationRoutes>[number]): string {
  const level = skillLevel(state, 'Exploration');
  const reached = level >= route.level;
  const owned = route.cost <= 0 || state.nodes.includes(route.id);
  const duration = chosenDuration(view);
  const selected = expeditionNextId(state, view) === route.id;
  const packs = route.inputs.length === 0
    ? 'Packs nothing'
    : `Packs ${route.inputs.map((input) => countedName(input.qty, input.id)).join(', ')}`;
  const preview = expeditionPreview(state, route.id, duration);
  const haulItems = preview.items
    .filter((item) => item.qty > 0)
    .map((item) => `${fmt(item.qty)} ${countedLabel(item.qty, item.id)}`)
    .join(', ');
  const atCap = (state.xp.Exploration ?? 0) >= XP_CAP - 1e-9;
  const empty = preview.xp <= 1e-9 && preview.items.every((item) => item.qty <= 0);
  const xpClause = atCap ? '' : ` · ${fmtXpAmount(preview.xp)} XP`;
  const haul = empty ? 'no items' : haulItems ? `${haulItems}${xpClause}` : `${fmtXpAmount(preview.xp)} XP`;
  const missing = route.inputs.find((input) => (state.bank[input.id] ?? 0) < input.qty);
  const busy = state.expedition != null;
  const chips = EXPEDITION_MS.map((ms) => `<button type="button" class="tag ${duration === ms ? 'on' : ''}" data-duration="${ms}" data-route="${route.id}">${DURATION_LABEL[ms]}</button>`).join('');
  let right = '';
  if (route.locked || !reached) {
    right = lockBadge(!reached ? ` Lv ${route.level}` : '');
  } else if (!owned) {
    right = `<small>Unlock</small>${coin(route.cost)}<button type="button" class="tag btn" data-buy-node="${route.id}"${buyOff(state.coins + 1e-9 >= route.cost)}>Buy</button>`;
  } else if (busy || missing || empty) {
    right = `<button type="button" class="tag btn" disabled>Pack and go</button>`;
  } else {
    right = `<button type="button" class="tag btn" data-pack="${route.id}">Pack and go</button>`;
  }
  const lockedRow = Boolean(route.locked) || !reached;
  const note = [route.locked, !route.locked && missing ? needLine(missing.id) : '', !route.locked && empty ? 'Exploration is maxed' : ''].filter(Boolean).join(' · ');
  const outputId = route.outputs[0]?.id;
  const iconName = (outputId && ITEMS[outputId]?.icon) || 'gem';
  const haulLine = lockedRow ? '' : `<small>Haul ${esc(haul)}</small>`;
  return `<div class="row node ${reached && !route.locked ? '' : 'dim'} ${selected ? 'picked' : ''}" data-route="${route.id}"><div class="ico wood">${icon(iconName, 34)}</div><div class="grow"><b>${esc(expeditionRouteName(route.id))}</b><small class="${reached ? 'ok' : ''}">Level ${route.level}</small>${masteryLine(state.mastery[route.id] ?? 0)}<small>${esc(packs)}</small>${haulLine}${note ? `<small>${esc(note)}</small>` : ''}<div class="chips">${chips}</div></div><div class="price">${right}</div></div>`;
}

/** Whole seconds, rounded up, so a running plot never shows 0s while time remains. */
export function plotCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000 - 1e-9));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Hand-plant status. A failed plant keeps its own sentence. */
export function plantedLine(ok: boolean): string {
  return ok ? 'Planted.' : 'That crop cannot be planted.';
}

/** Harvest, leaving Land, and a catch-up harvest blank the status. The toast carries the news. */
export function clearedLandStatus(): string {
  return '';
}

function autoReplantRow(state: Save): string {
  if (state.autoReplant) {
    const on = state.autoReplantOn !== false;
    return `<button type="button" class="row" role="switch" aria-checked="${on}" aria-label="Auto-replant" data-auto-replant-toggle><span class="grow">Auto-replant</span><span class="tag${on ? ' on' : ''}" aria-hidden="true">${on ? 'On' : 'Off'}</span></button>`;
  }
  const cost = AUTO_REPLANT_COST.toLocaleString('en-US');
  const ready = state.coins + 1e-9 >= AUTO_REPLANT_COST;
  return `<div class="row" data-auto-replant><div class="grow"><b>Auto-replant — ${cost} coins</b></div><button type="button" class="tag btn" data-buy-auto-replant${buyOff(ready)}>Buy</button></div>`;
}

function landHtml(state: Save, view: View): string {
  return `${title('Land')}
    <div class="landhead"><button type="button" class="tag btn ghost" data-land-close>Back</button><p class="note">Fields and the yard.</p></div>
    <div class="panel" data-land-fields><h3>Fields</h3>${autoReplantRow(state)}${plotListHtml(state, view, true)}</div>
    <div class="panel" data-land-yard><h3>Yard</h3>${yardHtml(state, view)}</div>`;
}

export function yardHtml(state: Save, view: View): string {
  const open = openYardTiles(state.owned.includes('Construction') ? skillLevel(state, 'Construction') : 0);
  const placed = state.land ?? {};
  const tiles = Array.from({ length: YARD_TILES }, (_, index) => yardTileHtml(view, index, open, placed)).join('');
  const stored = YARD_BUILDINGS.filter((id) => state.buildings[id] && !Object.values(placed).includes(id));
  const store = stored.length
    ? stored
        .map((id) => {
          const armed = view.placeId === id ? ' on' : '';
          return `<div class="row" data-yard-stored="${id}"><div class="ico wood">${icon('stone', 28)}</div><div class="grow"><b>${esc(YARD_NAMES[id])}</b><small>${esc(yardBonus(id))}</small></div><button type="button" class="tag btn${armed}" data-yard-arm="${id}">Place</button></div>`;
        })
        .join('')
    : '<p class="note">The store is empty.</p>';
  const selected = view.yardTile;
  const selectedId = selected != null ? placed[String(selected)] : undefined;
  const actions = selectedId
    ? `<div class="chips"><button type="button" class="tag btn" data-yard-store="${selected}">Store</button><button type="button" class="tag btn" data-dismantle="${selectedId}">Dismantle</button></div><p class="note">Tap an empty tile to move.</p>`
    : view.placeId
      ? '<p class="note">Tap an empty tile to place.</p>'
      : '';
  const note = state.yardNote ? `<p class="note" data-yard-note>${esc(state.yardNote)} <button type="button" class="tag" data-yard-note-clear>Dismiss</button></p>` : '';
  return `${note}<div class="yard">${tiles}</div><h3>Store</h3>${store}${actions}`;
}

function yardTileHtml(view: View, index: number, open: number, placed: Record<string, string>): string {
  const gate = yardTileLevel(index);
  if (gate == null || index >= open) {
    const label = gate == null ? 'Coming later' : `Construction ${gate}`;
    return `<div class="tile" data-yard-tile="${index}"><small>${label}</small></div>`;
  }
  const id = placed[String(index)];
  if (!id) {
    return `<button type="button" class="tile" data-yard-tile="${index}"><small>Empty</small></button>`;
  }
  const on = view.yardTile === index ? ' on' : '';
  return `<button type="button" class="tile${on}" data-yard-tile="${index}">${icon('stone', 22)}<b>${esc(YARD_NAMES[id as keyof typeof YARD_NAMES] ?? id)}</b><small>${esc(yardBonus(id))}</small></button>`;
}

function plotListHtml(state: Save, view: View, compact: boolean): string {
  const cards = Array.from({ length: PLOT_COUNT }, (_, index) => plotCardHtml(state, view, index, compact)).join('');
  return `<div class="${compact ? 'plotgrid' : 'list'}" data-plots>${cards}</div>`;
}

function plotCardHtml(state: Save, view: View, index: number, compact: boolean): string {
  const owned = state.owned.includes('Farming') && index < state.plots.length;
  if (!owned) return lockedPlotCard(state, index);
  const plot = state.plots[index];
  if (!plot) return emptyPlotCard(state, view, index);
  const recipe = RECIPE_BY_ID[plot.recipeId];
  const output = recipe?.outputs[0]?.id;
  const name = output ? itemName(output) : plot.recipeId;
  const compost = plot.compost === 'bone' ? 'Bone compost' : plot.compost === 'compost' ? 'Compost' : '';
  const status =
    plot.ready || plot.remainingMs <= 0
      ? 'Ready'
      : `Growing · <span data-plot-left="${index}">${plotCountdown(plot.remainingMs * (1 - 0.01 * (state.markRanks?.['road.grow'] ?? 0)))}</span>`;
  const mark = compact ? '' : `<div class="ico wood">${icon(ITEMS[output ?? '']?.icon ?? 'herb', 28)}</div>`;
  return `<div class="row" data-plot-card="${index}">${mark}<div class="grow"><b>Plot ${index + 1} · ${esc(name)}</b><small>${status}</small>${compost ? `<small>${compost}</small>` : ''}</div><button type="button" class="tag btn" data-cancel-plot="${index}">Cancel</button></div>`;
}

function lockedPlotCard(state: Save, index: number): string {
  const gate = index === 0 ? { plot: 1, level: 1, cost: 0 } : PLOT_GATES[index - 1];
  const next = state.owned.includes('Farming') && state.plotsBought === index - 1 && gate.cost > 0;
  const levelOk = state.owned.includes('Farming') && skillLevel(state, 'Farming') >= gate.level;
  const coinOk = state.coins + 1e-9 >= gate.cost;
  const buy = next
    ? `<button type="button" class="tag btn" data-buy-plot${buyOff(levelOk && coinOk)}>Buy</button>`
    : '';
  const cost = gate.cost > 0 ? `${gate.cost.toLocaleString('en-US')} coins` : 'Free with Farming';
  return `<div class="row locked" data-plot-card="${index}"><div class="grow"><b>Plot ${gate.plot}</b><small>Farming ${gate.level} · ${cost}</small></div><div class="price">${gate.cost > 0 ? coin(gate.cost) : ''}${buy}</div></div>`;
}

function emptyPlotCard(state: Save, view: View, index: number): string {
  const crops = RECIPES.filter(
    (recipe) => isPlotCrop(recipe.id) && skillLevel(state, 'Farming') >= recipe.level && hasInputs(state, recipe.id),
  );
  const buttons = crops.length
    ? crops.map((recipe) => `<button type="button" class="tag btn" data-plot="${index}" data-plant="${recipe.id}">${esc(actionTitle(recipe))}</button>`).join('')
    : '<small>No crop you can plant.</small>';
  return `<div class="row" data-plot-card="${index}"><div class="grow"><b>Plot ${index + 1}</b><small>Empty</small>${compostChips(state, view)}<div class="chips">${buttons}</div></div></div>`;
}

function compostChips(state: Save, view: View): string {
  const haveCompost = (state.bank[COMPOST_ITEM_ID] ?? 0) > 0;
  const haveBone = (state.bank[BONE_COMPOST_ITEM_ID] ?? 0) > 0;
  if (!haveCompost && !haveBone) return '';
  const selected = view.plantCompost ?? null;
  const chip = (id: string, label: string) =>
    `<button type="button" class="tag ${selected === (id || null) || (id === '' && selected == null) ? 'on' : ''}" data-plant-compost="${id}">${label}</button>`;
  return `<div class="chips">${chip('', 'None')}${haveCompost ? chip('compost', 'Compost') : ''}${haveBone ? chip('bone', 'Bone compost') : ''}</div>`;
}

function markCardsHtml(state: Save): string {
  const level = skillLevel(state, 'Enchanting');
  return MARKS.map((mark) => {
    const locked = level < mark.level;
    const studying = state.activity?.kind === 'produce' && state.activity.recipeId === markRecipeId(mark.id);
    const glimmer = state.glimmer?.[mark.id] ?? 0;
    const mods = modifiersFor(mark.id)
      .map((mod) => {
        const rank = state.markRanks?.[mod.id] ?? 0;
        const pips = Array.from({ length: 5 }, (_, index) => `<i class="${index < rank ? 'on' : ''}"></i>`).join('');
        const nextRank = rank + 1;
        const cost = rankCost(mod.seconds, nextRank);
        const buy = locked || rank >= 5
          ? ''
          : `<button type="button" class="tag btn" data-buy-rank="${mod.id}"${buyOff((state.glimmer?.[mark.id] ?? 0) + 1e-9 >= cost)}>Buy rank ${nextRank} — ${fmt(cost)}</button>`;
        return `<div class="mod"><b>${esc(mod.name)}</b><span class="pips">${pips}</span>${buy}</div>`;
      })
      .join('');
    const action = locked
      ? `<span class="tag">${lock} Lv ${mark.level}</span>`
      : studying
        ? `<span class="tag on">Studying</span>`
        : `<button type="button" class="tag btn" data-recipe="${markRecipeId(mark.id)}" data-mark="${mark.id}">Study</button>`;
    return `<div class="row" data-mark-card="${mark.id}"><div class="grow"><b>${esc(mark.name)}</b><small>${esc(MARK_TEXT.glimmer)} ${fmt(glimmer)} · ${mark.seconds}s · ${mark.xp} XP</small>${mods}</div>${action}</div>`;
  }).join('');
}

function skillScene(skill: SkillId): string {
  const prop =
    skill === 'Mining'
      ? '<path d="M18 70 L50 20 L82 70 Z" fill="#667"/>'
      : skill === 'Fishing'
        ? '<ellipse cx="70" cy="78" rx="28" ry="10" fill="#1d4c66"/>'
        : skill === 'Cooking'
          ? '<rect x="48" y="58" width="28" height="18" rx="4" fill="#6d4c2f"/>'
          : skill === 'Smithing'
            ? '<rect x="46" y="62" width="34" height="12" fill="#444"/>'
            : '<rect x="62" y="50" width="12" height="38" fill="#5a3b22"/><path d="M68 8 L96 56 H40 Z" fill="#2f5a3a"/>';
  return `<div class="scene wc">${playerFigure(70)}<svg width="110" height="90" viewBox="0 0 110 90">${prop}</svg></div>`;
}

function habitatCards(state: Save): string {
  return HABITATS.map((habitat) => {
    const table = habitatTable(state, habitat.id);
    const open = table.length > 0;
    const active = state.activity?.kind === 'forage' && state.activity.habitatId === habitat.id;
    const total = table.reduce((sum, entry) => sum + entry.weight, 0);
    const pace = habitatPace(state, habitat.id);
    const gate = NODE_BY_ID[habitat.entries[0].nodeId].level;
    const time = pace
      ? `${secondsText(habitatSeconds(state, habitat.id))} · ${fmtAmount(habitatTickXp(state, habitat.id))} XP`
      : skillLevel(state, 'Foraging') >= gate
        ? 'Buy a node below to open'
        : `Foraging ${gate}`;
    const entries = habitat.entries
      .map((entry) => {
        const node = NODE_BY_ID[entry.nodeId];
        const ready = forageEntryReady(state, entry.nodeId);
        const reached = skillLevel(state, 'Foraging') >= node.level;
        let status = '';
        if (ready) status = `<b class="odds">${oddsText(entry.weight, total)}</b>`;
        else if (!reached || node.cost <= 0) status = `<span class="tag">${lock} Lv ${node.level}</span>`;
        else status = `<button type="button" class="tag btn" data-buy-node="${node.id}"${buyOff(state.coins + 1e-9 >= node.cost)}>Buy ${fmt(node.cost)}</button>`;
        return `<div class="drop ${ready ? '' : 'dim'}"><span>${esc(itemName(node.id))}</span>${status}</div>`;
      })
      .join('');
    const select = open ? `data-habitat="${habitat.id}"` : '';
    return `<section class="panel habitat ${active ? 'on' : ''}" ${select}>
      <div class="habitat-head">
        <div class="ico wood">${icon('herb', 34)}</div>
        <div class="grow"><b>${esc(habitat.name)}</b><small>${time}</small>${masteryLine(state.mastery[habitatMasteryId(habitat.id)] ?? 0)}</div>
        ${active ? '<span class="tag on">Active</span>' : open ? '<span class="tag">Start</span>' : `<span class="tag">${lock}</span>`}
      </div>
      <div class="drops">${entries}</div>
    </section>`;
  }).join('');
}

function nodeRow(state: Save, node: (typeof NODES)[number]): string {
  const level = skillLevel(state, node.skill);
  const owned = node.cost === 0 || state.nodes.includes(node.id);
  const reached = level >= node.level;
  const active = state.activity?.kind === 'gather' && state.activity.nodeId === node.id;
  const usable = nodeUsable(state, node.id);
  let right = '';
  if (!owned) {
    right = reached
      ? `<div class="price"><small>Unlock</small>${coin(node.cost)}<button type="button" class="tag btn" data-buy-node="${node.id}"${buyOff(state.coins + 1e-9 >= node.cost)}>Buy</button></div>`
      : `<div class="price"><small>Unlock</small>${coin(node.cost)}<span class="tag">${lock} Lv ${node.level}</span></div>`;
  } else if (active) {
    right = `<div class="price"><b class="free">FREE</b><span class="tag on">Active</span></div>`;
  } else if (usable) {
    right = `<div class="price"><button type="button" class="tag btn" data-node="${node.id}">Start</button></div>`;
  } else {
    right = `<div class="price"><span class="tag">${lock} Lv ${node.level}</span></div>`;
  }
  const click = usable ? `data-node="${node.id}"` : '';
  const xp = fmtAmount(node.xp * actionXpMultiplier(state.mastery, node.id, node.skill));
  const sell = fmtAmount((ITEMS[node.id]?.sell ?? 0) * sellMultiplier(state.mastery, node.id));
  return `<div class="row node ${reached ? '' : 'dim'}" ${click}><div class="ico wood">${icon(ITEMS[node.id].icon, 34)}</div><div class="grow"><b>${esc(itemName(node.id))}</b><small class="${reached ? 'ok' : ''}">Level ${node.level}</small>${masteryLine(state.mastery[node.id] ?? 0)}<small>${timeLabel(state, node.id)} · ${xp} XP · sells ${sell}</small></div>${right}</div>`;
}

function recipeRow(state: Save, recipe: (typeof RECIPES)[number]): string {
  const level = skillLevel(state, recipe.skill);
  const reached = level >= recipe.level;
  const active = state.activity?.kind === 'produce' && state.activity.recipeId === recipe.id;
  const inputs = recipe.inputs.map((input) => countedName(input.qty, input.id)).join(', ');
  const output = recipe.outputs[0];
  const missing = recipe.inputs.find((input) => (state.bank[input.id] ?? 0) < input.qty);
  const foundation = recipe.requiresBuilding && !state.buildings[recipe.requiresBuilding]
    ? 'Needs stone foundation (Construction)'
    : null;
  const need = recipe.locked ?? foundation ?? (missing ? needLine(missing.id) : null);
  const stats = output ? gearStatText(output.id) : '';
  const standing = !!recipe.oneTime && !!state.buildings[recipe.id];
  const placed = standing && Object.values(state.land ?? {}).includes(recipe.id);
  const known = standing || (!!recipe.oneTime && !!state.buildingsEver?.[recipe.id]);
  const fee = recipe.rebuildFee ?? 0;
  const canPay = state.coins + 1e-9 >= fee;
  const later = !!recipe.comingLater;
  const right = later
    ? `<span class="tag">${lock}</span>`
    : !reached
      ? `<span class="tag">${lock} Lv ${recipe.level}</span>`
      : active
        ? `<span class="tag on">Active</span>`
        : known
          ? `<div class="price"><small>Fee</small>${coin(fee)}<button type="button" class="tag btn" data-recipe="${recipe.id}"${need || !canPay ? ' disabled aria-disabled="true"' : ''}>Rebuild</button>${standing ? `<button type="button" class="tag btn" data-dismantle="${recipe.id}">Dismantle</button>` : ''}</div>`
          : need
            ? `<button type="button" class="tag btn" disabled>Start</button>`
            : `<button type="button" class="tag btn" data-recipe="${recipe.id}">Start</button>`;
  const xp = fmtAmount(known ? 0 : recipe.xp * actionXpMultiplier(state.mastery, recipe.id, recipe.skill));
  const sell = output ? fmtAmount((ITEMS[output.id]?.sell ?? 0) * sellMultiplier(state.mastery, output.id)) : '0';
  const heal = output ? ITEMS[output.id]?.heal : undefined;
  const title = actionTitle(recipe);
  const iconName = output ? ITEMS[output.id]?.icon ?? 'part' : 'stone';
  const refund = standing ? dismantleRefund(recipe.id) : [];
  const refundText = !standing
    ? ''
    : refund.length
      ? ` · returns ${refund.map((part) => countedName(part.qty, part.id)).join(', ')}`
      : ' · returns no kits';
  const detail = later
    ? `Coming later${heal ? ` · heals ${heal}` : ''}`
    : `${timeLabel(state, recipe.id)} · ${xp} XP · sells ${sell}${heal ? ` · heals ${heal}` : ''}${refundText}${need ? ` · ${esc(need)}` : ''}`;
  return `<div class="row node ${reached && !later ? '' : 'dim'}"><div class="ico wood">${icon(iconName, 34)}</div><div class="grow"><b>${esc(title)}</b><small>Level ${recipe.level}${recipe.tool ? ' · tool' : ''}${standing ? (placed ? ' · Placed' : ' · In store') : recipe.oneTime && !known ? ' · build' : ''}${stats ? ` · ${esc(stats)}` : ''}</small>${later ? '' : masteryLine(state.mastery[recipe.id] ?? 0)}<small>${esc(inputs)} → ${output ? output.qty : 'structure'}</small><small>${detail}</small></div>${right}</div>`;
}

function needLine(itemId: string): string {
  const name = itemName(itemId).toLowerCase();
  const node = NODE_BY_ID[itemId];
  if (node) return `Needs ${name} (${node.skill})`;
  const made = RECIPES.find((recipe) => recipe.outputs.some((output) => output.id === itemId));
  return made ? `Needs ${name} (${made.skill})` : `Needs ${name}`;
}

function ladderIds(area: View['area']): readonly string[] {
  if (area === 'Meadow verge') return MEADOW_LADDER;
  if (area === 'Woodland edge') return WOODLAND_LADDER;
  return [];
}

function levelSpan(area: View['area']): string {
  const levels = ladderIds(area).map((id) => ENEMY_BY_ID[id].level);
  if (levels.length === 0) return '';
  return `Lv ${Math.min(...levels)}–${Math.max(...levels)}`;
}

function fightingEnemy(state: Save) {
  if (state.activity?.kind !== 'combat') return null;
  return ENEMY_BY_ID[state.activity.enemyId] ?? null;
}

function areaProgress(state: Save, area: 'Meadow verge' | 'Woodland edge'): string[] {
  const ids = ladderIds(area);
  const kills = state.enemyKills;
  if (area === 'Woodland edge' && !woodlandOpen(kills)) return ['Kill the Thorn beetle to open Woodland edge.'];
  const open = ids.filter((id) => enemyUnlocked(kills, id)).length;
  const boss = ENEMY_BY_ID[ids[ids.length - 1]];
  const beaten = (kills[boss.id] ?? 0) >= 1;
  if (open === ids.length && beaten) return [`All ${ids.length} open · Boss beaten ✓`];
  if (open === ids.length) return [`All ${ids.length} open`, `Boss ${boss.name}: not beaten`];
  const lines = [`Rungs ${open}/${ids.length} open`];
  let highest = ids[0];
  for (const id of ids) if (enemyUnlocked(kills, id)) highest = id;
  const next = ids[ids.indexOf(highest) + 1];
  if (next) {
    const have = Math.min(kills[highest] ?? 0, RUNG_KILLS);
    lines.push(`${ENEMY_BY_ID[highest].name} ${have}/${RUNG_KILLS} → ${ENEMY_BY_ID[next].name}`);
  }
  lines.push(`Boss ${boss.name}: ${beaten ? 'beaten ✓' : 'not beaten'}`);
  return lines;
}

function rungProgress(kills: Record<string, number>, id: string, ids: readonly string[]): string {
  const have = kills[id] ?? 0;
  if (have >= RUNG_KILLS) return `${RUNG_KILLS}/${RUNG_KILLS} done`;
  const next = ids[ids.indexOf(id) + 1];
  if (next) return `${have}/${RUNG_KILLS} → ${ENEMY_BY_ID[next].name}`;
  return `${have}/${RUNG_KILLS}`;
}

function styleChips(state: Save, style: CombatStyle | null): string {
  return COMBAT_STYLES.filter((id) => state.owned.includes(id))
    .map((id) => `<button type="button" class="tag ${style === id ? 'on' : ''}" data-style="${id}">${id}</button>`)
    .join('');
}

function combatHead(back: string, heading: string, extra = ''): string {
  return `<div class="combathead"><button type="button" class="tag btn ghost" data-combat-back>‹ ${esc(back)}</button><h2>${esc(heading)}</h2>${extra}</div>`;
}

function areasHtml(state: Save): string {
  const fight = fightingEnemy(state);
  const woodLocked = !woodlandOpen(state.enemyKills);
  const cards = (['Meadow verge', 'Woodland edge'] as const).map((area) => {
    const lines = areaProgress(state, area).map((line) => `<small>${esc(line)}</small>`).join('');
    const badge = fight && fight.area === area ? `<small>In fight: ${esc(fight.name)}</small>` : '';
    const lock = area === 'Woodland edge' && woodLocked ? ` ${lockBadge()}` : '';
    return `<button type="button" class="row areacard" data-open-area="${area}"><div class="grow"><b>${esc(area)}${lock}</b><small>${levelSpan(area)}</small>${lines}${badge}</div></button>`;
  }).join('');
  const opened = teaserOpen(state.enemyKills);
  const teaserName = `<b>??? ${lockBadge()}</b>`;
  const teaser = opened
    ? `<button type="button" class="row areacard" data-open-area="${TEASER_AREA}"><div class="grow">${teaserName}<small>??? — coming later</small></div></button>`
    : `<div class="row locked"><div class="grow">${teaserName}<small>${esc(TEASER_COPY)}</small></div></div>`;
  return `${title('Areas')}${cards}${teaser}`;
}

function ladderHtml(state: Save, view: View): string {
  const area = view.area === 'Woodland edge' ? 'Woodland edge' : 'Meadow verge';
  const ids = ladderIds(area);
  const style = combatStyleChoice(state, view);
  const fight = fightingEnemy(state);
  const rows = ids.map((id) => {
    const enemy = ENEMY_BY_ID[id];
    const gate = lockLine(state.enemyKills, id);
    const last = id === ids[ids.length - 1];
    const boss = last ? ' <span class="tag">BOSS</span>' : '';
    const lock = gate ? ` ${lockBadge()}` : '';
    const openStats = gate
      ? `<small>Lv ${enemy.level}</small>`
      : `<small>Lv ${enemy.level} · ${enemy.hp} HP · max hit ${enemy.maxHit}</small>${masteryLine(state.enemyMastery[id] ?? 0)}`;
    const progress = gate
      ? `<small>${esc(gate)}</small>`
      : last
        ? ''
        : `<small>${esc(rungProgress(state.enemyKills, id, ids))}</small>`;
    const badge = fight && fight.id === id ? '<small>In fight</small>' : '';
    return `<div class="row${gate ? ' locked' : ''}">${enemyFigure(id, 34)}<button type="button" class="grow" data-enemy="${id}"><b>${esc(enemy.name)}${lock}${boss}</b>${openStats}${progress}${badge}</button>${fightButton(id, !gate)}</div>`;
  }).join('');
  return `${combatHead('Areas', area, `<small>${levelSpan(area)}</small>`)}
    <div class="train"><span class="note">Training</span><div class="chips">${styleChips(state, style)}</div></div>
    ${rows}`;
}

function foodPanel(state: Save): string {
  const foods = Object.keys(state.bank).filter((id) => isFood(id) && (state.bank[id] ?? 0) > 0);
  const food = state.foodSlot && (state.bank[state.foodSlot] ?? 0) > 0
    ? `<div class="slot">${icon('food', 32)}<div><b>${esc(itemName(state.foodSlot))}</b><small>×${bankCount(state.bank[state.foodSlot] ?? 0)}${ITEMS[state.foodSlot].heal != null ? ` · heal ${ITEMS[state.foodSlot].heal}` : ''}</small></div></div>`
    : `<div class="slot"><div><b>No food slotted</b><small>Pick a cooked food below</small></div></div>`;
  const foodList = foods
    .map((id) => `<button type="button" class="tag ${state.foodSlot === id ? 'on' : ''}" data-food="${id}">${esc(itemName(id))} ×${bankCount(state.bank[id] ?? 0)}</button>`)
    .join(' ');
  return `<div class="panel"><h3>Food</h3>${food}<p class="note">Eats at or below half HP, from this stack only.</p><div class="devgrid">${foodList}</div></div>`;
}

function teaserHtml(state: Save): string {
  const copy = teaserOpen(state.enemyKills) ? '??? — coming later' : TEASER_COPY;
  return `${combatHead('Areas', '???')}
    <div class="panel"><p class="note">${esc(copy)}</p><div class="fightrow">${fightButton(null, false)}</div>${loadoutLine(state)}</div>
    ${foodPanel(state)}`;
}

function loadoutLine(state: Save): string {
  const weapon = state.equipped.weapon;
  let text = 'No weapon';
  if (weapon) {
    const qty = state.bank[weapon] ?? 0;
    if (isBow(weapon)) {
      const arrow = arrowToUse(state.bank);
      const ammo = arrow ? `${itemName(arrow)} ×${bankCount(state.bank[arrow] ?? 0)}` : 'No arrows';
      text = `${itemName(weapon)} · ${ammo}`;
    } else if (weapon.startsWith('ammo.thrown.')) {
      text = `${itemName(weapon)} ×${bankCount(qty)}`;
    } else if (qty > 0) {
      text = itemName(weapon);
    }
  }
  return `<button type="button" class="note loadout" data-loadout>${esc(text)}</button>`;
}

function fightScreen(state: Save, view: View): string {
  const area = view.area === 'Woodland edge' ? 'Woodland edge' : 'Meadow verge';
  const enemies = ladderIds(area).map((id) => ENEMY_BY_ID[id]);
  const selected =
    enemies.find((enemy) => enemy.id === view.selected) ??
    enemies.find((enemy) => state.activity?.kind === 'combat' && state.activity.enemyId === enemy.id) ??
    enemies[0];
  const fighting = fightingEnemy(state);
  const live = state.combat && fighting && fighting.id === selected.id ? state.combat : null;
  const enemyHp = live ? live.enemyHp : selected.hp;
  const enemyMax = live ? live.enemyMaxHp : selected.hp;
  const chip = combatStyleChoice(state, view);
  const headerStyle = fightHeaderStyle(state, view);
  const nextFight = headerStyle && chip && chip !== headerStyle ? `<p class="note" data-next-fight>Next fight: ${esc(chip)}</p>` : '';
  const drops = selected.drops
    .map((drop) => `<div class="cell t-base">${icon(ITEMS[drop.itemId].icon, 28)}<small>${esc(itemName(drop.itemId))}</small><span class="qty">${drop.num}/${drop.den} ×${drop.qty}</span></div>`)
    .join('');
  const coins = selected.coins ? `<div class="cell t-coin">${icon('coin', 28)}<small>Coins</small><span class="qty">${selected.coins.min}–${selected.coins.max}</span></div>` : '';
  const chance = Math.round(shownHitChance(state, selected.level) * 100);
  const stop = state.activity?.kind === 'combat' ? `<button type="button" class="tag btn" data-stop>Stop</button>` : '';
  return `${combatHead(area, `Style: ${headerStyle ?? 'none'}`)}
    ${nextFight}
    ${nextRow(combatNextLine(state, selected.id))}
    <div class="fight">
      <div class="stage">
        <div class="scene">
          <div class="fighter">${playerFigure(84)}<div class="hp"><b>You</b> ${state.hp}/${maxHp(state)}${bar((state.hp / maxHp(state)) * 100, 'red')}</div></div>
          <div class="vs"><small>${live ? 'In fight' : 'Ready'}</small>${bar(activityPct(state), 'green', 'fight-bar')}<small>${chance}% hit</small></div>
          <div class="fighter">${enemyFigure(selected.id, 84)}<div class="hp"><b>${esc(selected.name)}</b> <em>Lv ${selected.level}</em> ${Math.max(0, Math.ceil(enemyHp))}/${enemyMax} · max hit ${selected.maxHit}${bar((enemyHp / enemyMax) * 100, 'red')}${masteryLine(state.enemyMastery[selected.id] ?? 0)}</div></div>
        </div>
        <div class="fightrow">${fightControl(state, selected.id, chip)}${stop}</div>
        ${loadoutLine(state)}
      </div>
    </div>
    <div class="panel"><h3>Drops</h3><div class="lootgrid">${drops}${coins}</div><p class="note">Each drop rolls on its own.</p></div>
    ${foodPanel(state)}`;
}

function combatHtml(state: Save, view: View): string {
  if (!ownsCombatSkill(state)) {
    return `${title('Combat')}<div class="empty">Buy Attack, Strength, or Defence to fight. Meadow verge and Woodland edge stay locked until then.</div>`;
  }
  const screen = combatScreenFor(state, view);
  if (screen === 'areas') return areasHtml(state);
  if (screen === 'teaser' || view.area === TEASER_AREA) return teaserHtml(state);
  if (screen === 'ladder') return ladderHtml(state, view);
  return fightScreen(state, view);
}

function nextRow(line: string | null): string {
  if (!line) return '';
  const body = line.startsWith('Next:') ? line : `Next: ${line}`;
  return `<button type="button" class="nextrow" data-milestone-open>${esc(body)} &gt;</button>`;
}

export function milestoneSheetHtml(state: Save, view: View): string {
  if (!view.milestoneOpen) return '';
  if (view.tab === 'combat') {
    const inArea = ENEMIES.filter((enemy) => enemy.area === view.area);
    const enemyId =
      view.selected && ENEMY_BY_ID[view.selected] ? view.selected : inArea[0]?.id ?? '';
    if (!enemyId || !ENEMY_BY_ID[enemyId]) return '';
    const rows = combatSheetLines(state, enemyId)
      .map((row) => `<div class="row"><div class="grow"><b>${esc(row.label)}</b><small>${esc(row.detail)}</small></div></div>`)
      .join('');
    return `<div class="sheet" data-milestone-sheet><div class="card"><h2>${esc(ENEMY_BY_ID[enemyId].name)}</h2><div class="list">${rows}</div><button type="button" class="tag btn" data-milestone-close>Close</button></div></div>`;
  }
  const selectedRoute = view.tab === 'skill' && view.skill === 'Exploration' ? expeditionNextId(state, view) : '';
  const track = selectedRoute
    ? { id: selectedRoute, skill: 'Exploration' as const, seconds: trackSeconds(selectedRoute) }
    : activityTrack(state);
  if (!track || track.seconds <= 0) return '';
  const planted = state.plots.find((plot) => plot && isPlotCrop(plot.recipeId));
  const picked =
    view.milestoneTrack && trackSeconds(view.milestoneTrack) > 0
      ? view.milestoneTrack
      : !view.milestoneTrack && track.skill === 'Farming' && planted
        ? planted.recipeId
        : track.id;
  const groups = unlockGroups(state, track.skill)
    .map((group) => {
      const items = group.items
        .map((item) => `<div class="row ${item.reached ? '' : 'dim'}"><div class="grow"><b>${esc(item.title)}</b><small>Level ${group.level} · ${esc(item.note)}</small></div></div>`)
        .join('');
      return `<h3>Level ${group.level}</h3>${items}`;
    })
    .join('');
  const tools = usedBy(track.skill)
    .map((row) => `<div class="row"><div class="grow"><b>${esc(row.title)}</b><small>${esc(row.skill)} ${row.level}</small></div></div>`)
    .join('');
  const usedHeading = tools ? '<h3>Used by</h3>' : '';
  const perks = masterySheetLines(state, picked)
    .map((row) => `<div class="row"><div class="grow"><b>${esc(row.label)}</b><small>${esc(row.detail)}</small></div></div>`)
    .join('');
  const picker = trackChoices(track.skill)
    .map((choice) => `<button type="button" class="tag ${choice.id === picked ? 'on' : ''}" data-milestone-track="${choice.id}">${esc(choice.title)}</button>`)
    .join('');
  return `<div class="sheet" data-milestone-sheet><div class="card"><h2>${esc(track.skill)}</h2><div class="list">${groups}${usedHeading}${tools}<h3>${esc(masteryHeading(picked))}</h3>${perks}<div class="chips">${picker}</div></div><button type="button" class="tag btn" data-milestone-close>Close</button></div></div>`;
}

function inventoryHtml(state: Save, view: View, now: number): string {
  const filters: Filter[] = ['all', 'material', 'gear', 'food'];
  const names: Record<Filter, string> = { all: 'All', material: 'Materials', gear: 'Gear', food: 'Food' };
  const ids = Object.keys(state.bank).filter((id) => {
    const kind = ITEMS[id]?.kind;
    if (!kind || (state.bank[id] ?? 0) <= 0) return false;
    if (view.filter === 'all') return true;
    if (view.filter === 'gear') return kind === 'gear' || kind === 'tool';
    if (view.filter === 'food') return kind === 'food';
    return kind === 'material' || kind === 'ammo';
  });
  const cells = ids
    .map((id) => {
      const item = ITEMS[id];
      const qty = state.bank[id] ?? 0;
      const label = id === 'food.trout_mushroom_meal' ? countedLabel(qty, id) : item.name;
      const border = 't-base';
      return `<button type="button" class="cell ${border} ${view.selected === id ? 'picked' : ''}" data-select="${id}">${icon(item.icon, 40)}<span class="qty">${bankCount(qty)}</span><small>${esc(label)}</small></button>`;
    })
    .join('');
  const selected = view.selected && ITEMS[view.selected] ? ITEMS[view.selected] : null;
  const sell = selected
    ? `<div class="panel detail">${icon(selected.icon, 36)}<div class="grow"><b>${esc(selected.name)}</b><small>Sells for ${selected.sell} each, instantly${selected.kind === 'tool' ? ' · owning it sets the tool tier' : ''}${selected.heal != null ? ` · heals ${selected.heal}` : ''}${gearStatText(selected.id) ? ` · ${esc(gearStatText(selected.id))}` : ''}</small></div><button type="button" class="tag btn sell" data-sell="1">Sell 1</button><button type="button" class="tag btn sell" data-sell="all">Sell all</button></div>`
    : '';
  const shop = `<div class="panel"><h3>Shop</h3>${SHOP_ITEMS.map((id) => {
    const left = shopStock(state, id, now);
    return `<div class="shoprow">${icon('meat', 28)}<div class="grow"><b>${esc(itemName(id))}</b><small>${coin(SHOP_PRICE)} · ${left} left in this 24h</small></div><button type="button" class="tag btn" data-shop-buy="${id}"${buyOff(left > 0 && state.coins + 1e-9 >= SHOP_PRICE)}>Buy</button></div>`;
  }).join('')}</div>`;
  return `${title('Inventory')}
    <p class="note center">The bank has no item cap.</p>
    ${shop}
    <div class="filters">${filters.map((filter) => `<button type="button" class="${view.filter === filter ? 'on' : ''}" data-filter="${filter}">${names[filter]}</button>`).join('')}</div>
    <div class="invgrid">${cells || '<div class="empty">Nothing stored yet.</div>'}</div>
    ${sell}`;
}

/** A visible Fight control. Locked rungs and the teaser keep the button and disable it. */
function fightButton(enemyId: string | null, enabled: boolean): string {
  const target = enemyId ? ` data-fight="${enemyId}"` : '';
  const disabled = enabled ? '' : ' disabled';
  return `<button type="button" class="tag btn"${target}${disabled}>Fight</button>`;
}

function emptyThrownNote(itemId: string): string | null {
  if (itemId.includes('javelin')) return 'Out of javelins.';
  if (itemId.includes('knife')) return 'Out of throwing knives.';
  return null;
}

function fightControl(state: Save, enemyId: string, style: CombatStyle | null): string {
  if (!weaponReady(state)) {
    const worn = state.equipped.weapon;
    const note = worn ? emptyThrownNote(worn) : null;
    return `<p class="note">${esc(note ?? 'Equip a weapon first.')}</p>`;
  }
  const gate = lockLine(state.enemyKills, enemyId);
  const worn = state.equipped.weapon ?? '';
  const styleGate = style && !weaponFitsStyle(worn, style) ? styleNeed(style) : null;
  const button = fightButton(enemyId, !gate && !styleGate);
  const note = gate ?? styleGate;
  return note ? `<p class="note">${esc(note)}</p>${button}` : button;
}

function styleNeed(style: CombatStyle): string {
  if (style === 'Magic') return 'Equip a Magic focus (crafted with Crafting) to train Magic.';
  if (style === 'Ranged') return 'Needs bronze throwing knives (Smithing)';
  return 'Equip a melee weapon first.';
}

function weaponReady(state: Save): boolean {
  const id = state.equipped.weapon;
  return !!id && equipSlotFor(id) === 'weapon' && (state.bank[id] ?? 0) > 0;
}

function worn(state: Save, slot: 'weapon' | 'body' | 'shield'): string | null {
  const id = state.equipped[slot];
  if (!id || equipSlotFor(id) !== slot || (state.bank[id] ?? 0) <= 0) return null;
  return id;
}

function slotButton(state: Save, slot: 'weapon' | 'body' | 'shield', label: string): string {
  const equippedThrown = slot === 'weapon' && state.equipped.weapon?.startsWith('ammo.thrown.') ? state.equipped.weapon : null;
  const id = equippedThrown ?? worn(state, slot);
  const item = id ? ITEMS[id] : null;
  const stats = id ? gearStatText(id) : '';
  const stack = equippedThrown ? ` ×${bankCount(state.bank[equippedThrown] ?? 0)}` : '';
  return `<div class="eslot t-base"><button type="button" data-unequip="${slot}">${item ? icon(item.icon, 34) : ''}<small>${label}</small><em>${item ? esc(item.name) + stack : 'Empty'}</em>${stats ? `<small>${esc(stats)}</small>` : ''}</button></div>`;
}

function gearList(state: Save, slot: 'weapon' | 'body' | 'shield', empty: string): string {
  const ids = Object.keys(state.bank).filter((id) => equipSlotFor(id) === slot && (state.bank[id] ?? 0) > 0);
  if (ids.length === 0) return `<p class="note">${empty}</p>`;
  return ids
    .map((id) => {
      const on = state.equipped[slot] === id;
      const stack = id.startsWith('ammo.thrown.') ? ` ×${bankCount(state.bank[id] ?? 0)}` : '';
      if (gearLocked(id)) {
        return `<div class="gearpick">${icon(ITEMS[id].icon, 28)}<div class="grow"><b>${esc(itemName(id))}${stack}</b><small>${esc(gearStatText(id))} · Locked</small></div></div>`;
      }
      return `<button type="button" class="gearpick${on ? ' on' : ''}" data-equip="${id}">${icon(ITEMS[id].icon, 28)}<div class="grow"><b>${esc(itemName(id))}${stack}</b><small>${esc(gearStatText(id))} · ${on ? 'Equipped' : 'Tap to equip'}</small></div></button>`;
    })
    .join('');
}

function equipmentHtml(state: Save): string {
  const tools = Object.keys(state.bank).filter((id) => ITEMS[id]?.kind === 'tool' && (state.bank[id] ?? 0) > 0);
  const toolRows = tools
    .map((id) => `<div class="gearpick">${icon(ITEMS[id].icon, 28)}<div class="grow"><b>${esc(itemName(id))}</b><small>×${bankCount(state.bank[id] ?? 0)} · tier applies while owned</small></div></div>`)
    .join('');
  return `${title('Equipment')}
    <div class="equip">
      <div class="col">${slotButton(state, 'body', 'Body')}</div>
      <div class="hero">${playerFigure(120)}</div>
      <div class="col">${slotButton(state, 'weapon', 'Weapon')}${slotButton(state, 'shield', 'Shield')}</div>
    </div>
    <p class="note center">A weapon must be equipped to fight. Body and shield may stay empty. Crafted gear is not equipped for you. Tools are never equipped.</p>
    <div class="panel"><h3>Weapon</h3>${gearList(state, 'weapon', 'No weapon in the bank.')}</div>
    <div class="panel"><h3>Body</h3>${gearList(state, 'body', 'No body armour in the bank.')}</div>
    <div class="panel"><h3>Shield</h3>${gearList(state, 'shield', 'No shield in the bank.')}</div>
    <div class="panel"><h3>Tools</h3>${toolRows || '<p class="note">No tools owned. The highest owned axe or pickaxe applies on its own.</p>'}</div>`;
}

/** Whole minutes, rounded down. Under an hour: "5 min". An exact hour keeps the zero: "2 h 0 min". */
function awayTime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${fmt(rest)} min`;
  return `${fmt(hours)} h ${fmt(rest)} min`;
}

export function reportHtml(report: CatchupReport): string {
  const xp = Object.entries(report.xpGained)
    .map(([skill, amount]) => `${skill} ${fmtXp(amount)}`)
    .join(', ') || 'none';
  const levels =
    Object.entries(report.levelsAfter)
      .flatMap(([skill, level]) => {
        const before = report.levelsBefore[skill as SkillId];
        if (before == null || level <= before) return [];
        return [`${skill} ${fmt(before)}→${fmt(level)}`];
      })
      .join(', ') || 'none';
  const gained = stackText(report.itemsGained);
  const consumed = consumedText(report.itemsConsumed);
  const why =
    report.stopped === 'backwards'
      ? 'Clock moved backwards, so nothing was credited.'
      : report.stopped === 'inputs'
        ? 'Stopped when inputs ran out.'
        : report.stopped === 'paused'
          ? 'Combat paused at 0 HP.'
          : report.capped
            ? 'Ran the full credited window. Time past 24h was cut.'
            : 'Ran the full credited window.';
  return `<div class="popup" data-catchup><div class="card">
    <h2>While you were away</h2>
    <dl>
      <dt>Away</dt><dd>${awayTime(report.awayMs)}</dd>
      <dt>Credited</dt><dd>${awayTime(report.creditedMs)}${report.capped ? ' (24h cut)' : ''}</dd>
      <dt>Activity</dt><dd>${esc(report.activity)}</dd>
      <dt>Actions</dt><dd>${fmt(report.actions)}</dd>
      <dt>Kills</dt><dd>${fmt(report.kills)}</dd>
      <dt>XP</dt><dd>${esc(xp)}</dd>
      <dt>Levels</dt><dd>${esc(levels || 'none')}</dd>
      <dt>Gained</dt><dd>${esc(gained)}</dd>
      <dt>Consumed</dt><dd>${esc(consumed)}</dd>
      <dt>Coins</dt><dd>${fmtCoins(report.coinsGained)}</dd>
      <dt>Food eaten</dt><dd>${fmt(report.foodEaten)}</dd>
      <dt>Mastery</dt><dd>${esc(masteryText(report))}</dd>
      <dt>Perks</dt><dd>${esc((report.perksUnlocked ?? []).join('; ') || 'none')}</dd>
      ${report.expeditionLine ? `<dt>Expedition</dt><dd>${esc(report.expeditionLine)}</dd>` : ''}
      ${(report.plotHarvests ?? []).length ? `<dt>Plots</dt><dd>${esc((report.plotHarvests ?? []).join('; '))}</dd>` : ''}
      <dt>Stopped</dt><dd>${esc(why)}</dd>
    </dl>
    <button type="button" class="tag btn" data-catchup-close>Continue</button>
  </div></div>`;
}

function masteryText(report: CatchupReport): string {
  const rows = report.masteryLevels ?? [];
  if (rows.length === 0) return 'none';
  return rows.map((row) => `${row.name} ${fmt(row.before)} → ${fmt(row.after)}`).join(', ');
}

function stackText(stacks: Record<string, number>): string {
  const parts = Object.entries(stacks).filter(([, qty]) => qty > 0);
  if (parts.length === 0) return 'none';
  return parts.map(([id, qty]) => `${countedLabel(qty, id)} ×${fmt(qty)}`).join(', ');
}

/** Replant inputs read seed, then bone compost, then compost. Other consumption keeps its order ahead of those. */
function consumedText(stacks: Record<string, number>): string {
  const rank = (id: string) => (id === BONE_COMPOST_ITEM_ID ? 1 : id === COMPOST_ITEM_ID ? 2 : 0);
  const parts = Object.entries(stacks).filter(([, qty]) => qty > 0);
  parts.sort((a, b) => rank(a[0]) - rank(b[0]));
  if (parts.length === 0) return 'none';
  return parts.map(([id, qty]) => `${countedLabel(qty, id)} ×${fmt(qty)}`).join(' · ');
}

export function devHtml(): string {
  return `<div class="sheet" data-dev-panel><div class="card">
    <h2>Dev</h2>
    <p class="aboutline" data-clock></p>
    <p class="note" data-stats></p>
    <div class="devgrid">
      <button type="button" class="tag btn" data-ff="60000">+1 min</button>
      <button type="button" class="tag btn" data-ff="600000">+10 min</button>
      <button type="button" class="tag btn" data-ff="3600000">+1 hour</button>
      <button type="button" class="tag btn" data-ff="86400000">+24 hours</button>
      <button type="button" class="tag btn" data-ff="108000000">+30 hours</button>
      <button type="button" class="tag" data-ff-back="3600000">Back 1 hour</button>
    </div>
    <label>Minutes <input data-ff-custom type="number" min="0" step="1" value="30"></label>
    <button type="button" class="tag btn" data-ff-apply>Advance</button>
    <label>Set coins <input data-set-coins type="number" min="0" step="1" value="0"></label>
    <button type="button" class="tag btn" data-apply-coins>Apply coins</button>
    <label>Skill level <input data-set-skill value="Fishing"> <input data-set-level type="number" min="1" max="40" value="10"></label>
    <button type="button" class="tag btn" data-apply-level>Apply level</button>
    <label>Give item <input data-give-id value="food.roast_minnows"> <input data-give-qty type="number" min="1" value="20"></label>
    <button type="button" class="tag btn" data-apply-give>Give</button>
    <label>Export (includes the stats log)</label><textarea data-export readonly></textarea>
    <div class="devgrid"><button type="button" class="tag btn" data-export-fill>Refresh export</button></div>
    <label>Import</label><textarea data-import></textarea>
    <button type="button" class="tag btn" data-import-apply>Import save</button>
    <div class="devgrid">
      <button type="button" class="tag btn" data-route>Play §4 route</button>
      <button type="button" class="tag btn" data-hit-rates>Hit rates</button>
      <button type="button" class="tag btn" data-kill-cycle>200-kill cycle</button>
      <button type="button" class="tag btn" data-poacher>Poacher sample</button>
      <button type="button" class="tag btn" data-survive>Survivability</button>
    </div>
    <p class="note">Route autoplay is the section 4 Smithing-first route. It forges the iron spear and equips it before combat, then climbs the Meadow ladder. Loot is expected value. Hit rolls use the seeded generator.</p>
    <pre data-dev-out></pre>
    <button type="button" class="tag" data-dev-close>Close</button>
  </div></div>`;
}

export function noticeHtml(): string {
  return `<div class="notice"><div class="card"><h2>Already open</h2><p>This game is running in another tab. Close that tab and reload this one.</p></div></div>`;
}
