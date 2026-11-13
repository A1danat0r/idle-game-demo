import {
  AREAS,
  COMBAT_STYLES,
  ENEMIES,
  ENEMY_BY_ID,
  ITEMS,
  NODES,
  RECIPES,
  SKILL_IDS,
  SKILL_PRICES,
  SHOP_ITEMS,
  SHOP_PRICE,
  XP_TABLE,
  equippedGear,
  gearStatText,
  isFood,
  itemName,
  levelForXp,
  playerHitChance,
  skillPrice,
  equipSlotFor,
  type CombatStyle,
  type SkillId,
} from './content';
import {
  actionSeconds,
  activityLabel,
  formulaLevel,
  maxHp,
  nodeUsable,
  ownsCombatSkill,
  shopStock,
  skillLevel,
  toolTier,
  type CatchupReport,
  type Save,
} from './engine';
import { chibi, icon } from './icons';

export const TAB_IDS = ['skills', 'skill', 'combat', 'inventory', 'equipment'] as const;
export type TabId = (typeof TAB_IDS)[number];
export type Filter = 'all' | 'material' | 'gear' | 'food';

export interface View {
  tab: TabId;
  skill: SkillId | null;
  filter: Filter;
  selected: string | null;
  area: (typeof AREAS)[number];
  style: CombatStyle | null;
  message: string;
}

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtXp = (n: number) => Math.floor(n).toLocaleString('en-US');
const coin = (n: number) => `<span class="coin">${icon('coin', 16)}${fmt(n)}</span>`;
const bar = (pct: number, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
const title = (text: string) => `<h2 class="title"><span>◆</span>${esc(text)}<span>◆</span></h2>`;
const lock = `<svg width="14" height="14" viewBox="0 0 20 20"><rect x="3" y="9" width="14" height="10" rx="2" fill="#8a8f9c"/><path d="M6 9V6a4 4 0 0 1 8 0v3" fill="none" stroke="#8a8f9c" stroke-width="2"/></svg>`;

function xpView(xp: number): { level: number; pct: number; text: string } {
  const level = levelForXp(xp);
  if (level >= 30) return { level, pct: 100, text: `${fmtXp(xp)} XP · cap` };
  const prev = XP_TABLE[level];
  const next = XP_TABLE[level + 1];
  return { level, pct: ((xp - prev) / (next - prev)) * 100, text: `${fmtXp(xp)} / ${fmt(next)} XP` };
}

function timeLabel(state: Save, id: string, base: number): string {
  const seconds = actionSeconds(state, id);
  if (Math.abs(seconds - base) < 1e-9) {
    const text = Number.isInteger(base) ? base.toFixed(1) : String(base);
    return `${text}s`;
  }
  return `${seconds.toFixed(3)}s`;
}

/** Header, then the scrolling page, then the activity bar in the bottom bar, directly above the tabs. */
export function shellHtml(header: string, message: string, main: string, activity: string, tabs: string): string {
  return `${header}${message}<main>${main}</main>${activity}${tabs}`;
}

export function headerHtml(state: Save, devOn: boolean): string {
  return `<header class="top">
    <div class="avatar">${chibi('#2d3a5c', 30)}</div>
    <div class="coins" data-coins>${coin(state.coins)}</div>
    ${devOn ? '<button type="button" class="devbtn" data-dev-open>Dev</button>' : ''}
    <button type="button" class="build" data-about><b>${esc(__BUILD_LABEL__)}</b>${esc(__COMMIT_SHA__)}</button>
  </header>`;
}

export function activityHtml(state: Save): string {
  const pct = activityPct(state);
  const label = activityLabel(state);
  const detail = activityDetail(state);
  const iconName = state.activity?.kind === 'combat' ? 'sword' : state.activity?.kind === 'produce' ? 'food' : 'log';
  const resume = state.paused
    ? `<button type="button" class="tag btn" data-resume>Resume</button>`
    : `<small>${Math.round(pct)}%</small>`;
  return `<div class="activity" data-activity>${icon(iconName, 34)}<div class="grow"><b>${esc(label)}</b><small>${esc(detail)}</small>${bar(pct, state.paused ? 'red' : '')}</div>${resume}</div>`;
}

function activityPct(state: Save): number {
  const activity = state.activity;
  if (!activity) return 0;
  if (activity.kind === 'gather') return pct(state.progressMs, actionSeconds(state, activity.nodeId) * 1000);
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
    const perHour = Math.round(3600 / seconds) * (ITEMS[node.id]?.sell ?? 0);
    return `${timeLabel(state, node.id, node.seconds)} · ${node.xp} XP · ${fmt(perHour)} coins/h if sold`;
  }
  if (activity.kind === 'produce') {
    const recipe = RECIPES.find((row) => row.id === activity.recipeId)!;
    return `${timeLabel(state, recipe.id, recipe.seconds)} · ${recipe.xp} XP`;
  }
  const enemy = ENEMY_BY_ID[activity.enemyId];
  return `${activity.style} · hit ${Math.round(shownHitChance(state, enemy.level) * 100)}% · ${state.hp}/${maxHp(state)} HP`;
}

function shownHitChance(state: Save, enemyLevel: number): number {
  const gear = equippedGear(state.equipped, state.bank);
  return playerHitChance(formulaLevel(state, 'Attack'), enemyLevel, gear.acc);
}

export function tabsHtml(view: View): string {
  const labels: Record<TabId, string> = {
    skills: 'Skills',
    skill: 'Activity',
    combat: 'Combat',
    inventory: 'Inventory',
    equipment: 'Equip',
  };
  const paths: Record<TabId, string> = {
    skills: '<path d="M12 2 L15 9 L22 9 L16 14 L18 21 L12 17 L6 21 L8 14 L2 9 L9 9 Z"/>',
    skill: '<path d="M5 20 L15 6 M13 4 L20 8 L16 12 Z"/>',
    combat: '<path d="M4 20 L18 6 M6 6 L20 20 M16 4 L20 4 L20 8 M4 16 L4 20 L8 20"/>',
    inventory: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8 V5 H15 V8"/>',
    equipment: '<path d="M12 3 L20 6 Q20 16 12 21 Q4 16 4 6 Z"/>',
  };
  return `<nav class="tabs">${TAB_IDS.map((id) => `<button type="button" data-tab="${id}" class="${view.tab === id ? 'on' : ''}"><svg viewBox="0 0 24 24" width="22" height="22">${paths[id]}</svg>${esc(labels[id])}</button>`).join('')}</nav>`;
}

export function mainHtml(state: Save, view: View, now: number): string {
  if (view.tab === 'skills') return skillsHtml(state);
  if (view.tab === 'skill') return skillHtml(state, view.skill);
  if (view.tab === 'combat') return combatHtml(state, view);
  if (view.tab === 'inventory') return inventoryHtml(state, view, now);
  return equipmentHtml(state);
}

function skillsHtml(state: Save): string {
  const next = skillPrice(state.purchaseCount);
  const rows = SKILL_IDS.filter((skill) => skill !== 'Hitpoints' || state.owned.includes('Hitpoints'))
    .map((skill) => skillRow(state, skill, next))
    .join('');
  const curve = SKILL_PRICES.slice(0, 7)
    .map((price, index) => `<div class="k ${index === state.purchaseCount ? 'next' : ''}"><small>#${index + 1}</small>${fmt(price)}</div>`)
    .join('');
  return `${title('Skills')}
    <p class="note">The next skill costs the same whichever one you buy. Hitpoints is free with the first combat skill.</p>
    <div class="list">${rows}</div>
    <div class="panel"><h3>Skill prices</h3><div class="curve">${curve}</div></div>`;
}

function skillRow(state: Save, skill: SkillId, next: number | null): string {
  if (skill === 'Hitpoints') {
    const view = xpView(state.xp.Hitpoints ?? 0);
    return `<div class="row owned"><div class="ico gold">H</div><div class="grow"><b>Hitpoints <em>Lv ${view.level}</em></b>${bar(view.pct)}<small>Free with the first combat skill · ${view.text}</small></div></div>`;
  }
  if (!state.owned.includes(skill)) {
    const affordable = next != null && state.coins >= next;
    return `<div class="row locked"><div class="ico">${lock}</div><div class="grow"><b>${skill}</b><small>Locked</small></div><div class="price"><small>Unlock</small>${coin(next ?? 0)}${affordable ? `<button type="button" class="tag btn" data-buy-skill="${skill}">Buy</button>` : ''}</div></div>`;
  }
  const view = xpView(state.xp[skill] ?? 0);
  const open = true;
  return `<button type="button" class="row owned" data-open-skill="${skill}" ${open ? '' : 'disabled'}><div class="ico gold">${skill[0]}</div><div class="grow"><b>${skill} <em>Lv ${view.level}</em></b>${bar(view.pct)}<small>${skill === 'Woodcutting' ? 'Free from the start' : 'Owned'} · ${view.text}</small></div></button>`;
}

function isCombat(skill: SkillId): boolean {
  return skill === 'Attack' || skill === 'Strength' || skill === 'Defence';
}

function skillHtml(state: Save, skill: SkillId | null): string {
  if (!skill || !state.owned.includes(skill) || skill === 'Hitpoints' || isCombat(skill)) {
    return `<div class="empty">Choose a gathering or production skill from Skills.</div>`;
  }
  const view = xpView(state.xp[skill] ?? 0);
  const tier =
    skill === 'Woodcutting' || skill === 'Mining' ? `<small>Tool tier ${toolTier(state, skill)}</small>` : '';
  const scene = skillScene(skill);
  const rows =
    skill === 'Cooking' || skill === 'Smithing'
      ? RECIPES.filter((recipe) => recipe.skill === skill).map((recipe) => recipeRow(state, recipe)).join('')
      : NODES.filter((node) => node.skill === skill).map((node) => nodeRow(state, node)).join('');
  return `<div class="skillhead"><div class="emblem">${icon(skill === 'Fishing' ? 'fish' : skill === 'Mining' ? 'ore' : skill === 'Cooking' ? 'food' : skill === 'Smithing' ? 'bar' : 'log', 30)}</div><div class="grow"><h2>${skill}</h2><small>Lv ${view.level} · ${view.text}</small>${bar(view.pct)}${tier}</div></div>
    ${scene}
    <div class="list">${rows}</div>`;
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
  return `<div class="scene wc">${chibi('#2d3a5c', 70)}<svg width="110" height="90" viewBox="0 0 110 90">${prop}</svg></div>`;
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
      ? `<div class="price"><small>Unlock</small>${coin(node.cost)}<button type="button" class="tag btn" data-buy-node="${node.id}">Buy</button></div>`
      : `<div class="price"><small>Unlock</small>${coin(node.cost)}<span class="tag">${lock} Lv ${node.level}</span></div>`;
  } else if (active) {
    right = `<div class="price"><b class="free">FREE</b><span class="tag on">Active</span></div>`;
  } else if (usable) {
    right = `<div class="price"><button type="button" class="tag btn" data-node="${node.id}">Start</button></div>`;
  } else {
    right = `<div class="price"><span class="tag">${lock} Lv ${node.level}</span></div>`;
  }
  const click = usable ? `data-node="${node.id}"` : '';
  return `<div class="row node ${reached ? '' : 'dim'}" ${click}><div class="ico wood">${icon(ITEMS[node.id].icon, 34)}</div><div class="grow"><b>${esc(itemName(node.id))}</b><small class="${reached ? 'ok' : ''}">Level ${node.level}</small><small>${timeLabel(state, node.id, node.seconds)} · ${node.xp} XP · sells ${ITEMS[node.id].sell}</small></div>${right}</div>`;
}

function recipeRow(state: Save, recipe: (typeof RECIPES)[number]): string {
  const level = skillLevel(state, recipe.skill);
  const reached = level >= recipe.level;
  const active = state.activity?.kind === 'produce' && state.activity.recipeId === recipe.id;
  const inputs = recipe.inputs.map((input) => `${input.qty} ${itemName(input.id)}`).join(', ');
  const output = recipe.outputs[0];
  const have = recipe.inputs.every((input) => (state.bank[input.id] ?? 0) >= input.qty);
  const stats = gearStatText(output.id);
  const right = !reached
    ? `<span class="tag">${lock} Lv ${recipe.level}</span>`
    : active
      ? `<span class="tag on">Active</span>`
      : `<button type="button" class="tag btn" data-recipe="${recipe.id}">Start</button>`;
  return `<div class="row node ${reached ? '' : 'dim'}"><div class="ico wood">${icon(ITEMS[output.id].icon, 34)}</div><div class="grow"><b>${esc(itemName(output.id))}</b><small>Level ${recipe.level}${recipe.tool ? ' · tool' : ''}${stats ? ` · ${esc(stats)}` : ''}</small><small>${esc(inputs)} → ${output.qty}</small><small>${timeLabel(state, recipe.id, recipe.seconds)} · ${recipe.xp} XP · sells ${ITEMS[output.id].sell}${have ? '' : ' · missing inputs'}</small></div>${right}</div>`;
}

function combatHtml(state: Save, view: View): string {
  if (!ownsCombatSkill(state)) {
    return `${title('Combat')}<div class="empty">Buy Attack, Strength, or Defence to fight. Meadow verge and Woodland edge stay locked until then.</div>`;
  }
  const style = view.style && state.owned.includes(view.style) ? view.style : (COMBAT_STYLES.find((id) => state.owned.includes(id)) ?? null);
  const enemies = ENEMIES.filter((enemy) => enemy.area === view.area);
  const selected =
    enemies.find((enemy) => enemy.id === view.selected) ??
    enemies.find((enemy) => state.activity?.kind === 'combat' && state.activity.enemyId === enemy.id) ??
    enemies[0];
  const fighting = state.activity?.kind === 'combat' ? ENEMY_BY_ID[state.activity.enemyId] : null;
  const enemyHp = state.combat && fighting ? state.combat.enemyHp : selected.hp;
  const enemyMax = state.combat && fighting && fighting.id === selected.id ? state.combat.enemyMaxHp : selected.hp;
  const styles = COMBAT_STYLES.filter((id) => state.owned.includes(id))
    .map((id) => `<button type="button" class="tag ${style === id ? 'on' : ''}" data-style="${id}">${id}</button>`)
    .join('');
  const areas = AREAS.map((area) => `<button type="button" class="tag ${view.area === area ? 'on' : ''}" data-area="${area}">${area}</button>`).join('');
  const list = enemies
    .map((enemy) => `<button type="button" class="mini ${selected.id === enemy.id ? 'sel' : ''}" data-enemy="${enemy.id}">${esc(enemy.name)}<small>Lv ${enemy.level} · ${enemy.hp} HP</small></button>`)
    .join('');
  const drops = selected.drops
    .map((drop) => `<div class="cell t-base">${icon(ITEMS[drop.itemId].icon, 28)}<small>${esc(itemName(drop.itemId))}</small><span class="qty">${drop.num}/${drop.den} ×${drop.qty}</span></div>`)
    .join('');
  const coins = selected.coins ? `<div class="cell t-coin">${icon('coin', 28)}<small>Coins</small><span class="qty">${selected.coins.min}–${selected.coins.max}</span></div>` : '';
  const foods = Object.keys(state.bank).filter((id) => isFood(id) && (state.bank[id] ?? 0) > 0);
  const food = state.foodSlot && (state.bank[state.foodSlot] ?? 0) > 0
    ? `<div class="slot">${icon('food', 32)}<div><b>${esc(itemName(state.foodSlot))}</b><small>×${state.bank[state.foodSlot]} · heal ${ITEMS[state.foodSlot].heal}</small></div></div>`
    : `<div class="slot"><div><b>No food slotted</b><small>Pick a cooked food below</small></div></div>`;
  const foodList = foods
    .map((id) => `<button type="button" class="tag ${state.foodSlot === id ? 'on' : ''}" data-food="${id}">${esc(itemName(id))} ×${state.bank[id]}</button>`)
    .join(' ');
  const chance = Math.round(shownHitChance(state, selected.level) * 100);
  return `<div class="areahead"><div><h2>${esc(view.area)}</h2><small>${styles}</small></div><small>${areas}</small></div>
    <div class="fight">
      <div class="scene">
        <div class="fighter">${chibi('#2d3a5c', 84)}<div class="hp"><b>You</b> ${state.hp}/${maxHp(state)}${bar((state.hp / maxHp(state)) * 100, 'red')}</div></div>
        <div class="vs"><small>${fighting ? 'In fight' : 'Ready'}</small>${bar(activityPct(state), 'green')}<small>${chance}% hit</small></div>
        <div class="fighter">${chibi('#4a2f2f', 84)}<div class="hp"><b>${esc(selected.name)}</b> <em>Lv ${selected.level}</em> ${Math.max(0, Math.ceil(enemyHp))}/${enemyMax}${bar((enemyHp / enemyMax) * 100, 'red')}</div></div>
      </div>
      <div class="panel enemies"><h3>Enemies</h3>${list}${weaponReady(state) ? `<button type="button" class="tag btn" data-fight="${selected.id}">Fight</button>` : '<p class="note">Equip a weapon first.</p>'}</div>
    </div>
    <div class="two">
      <div class="panel"><h3>Drops</h3><div class="lootgrid">${drops}${coins}</div><p class="note">Each drop rolls on its own.</p></div>
      <div class="panel"><h3>Food</h3>${food}<p class="note">Eats at or below half HP, from this stack only.</p><div class="devgrid">${foodList}</div></div>
    </div>`;
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
      const border = 't-base';
      return `<button type="button" class="cell ${border} ${view.selected === id ? 'picked' : ''}" data-select="${id}">${icon(item.icon, 40)}<span class="qty">${state.bank[id]}</span><small>${esc(item.name)}</small></button>`;
    })
    .join('');
  const selected = view.selected && ITEMS[view.selected] ? ITEMS[view.selected] : null;
  const sell = selected
    ? `<div class="panel detail">${icon(selected.icon, 36)}<div class="grow"><b>${esc(selected.name)}</b><small>Sells for ${selected.sell} each, instantly${selected.kind === 'tool' ? ' · owning it sets the tool tier' : ''}${gearStatText(selected.id) ? ` · ${esc(gearStatText(selected.id))}` : ''}</small></div><button type="button" class="tag btn sell" data-sell="1">Sell 1</button><button type="button" class="tag btn sell" data-sell="all">Sell all</button></div>`
    : '';
  const shop = `<div class="panel"><h3>Shop</h3>${SHOP_ITEMS.map((id) => {
    const left = shopStock(state, id, now);
    return `<div class="shoprow">${icon('meat', 28)}<div class="grow"><b>${esc(itemName(id))}</b><small>${coin(SHOP_PRICE)} · ${left} left in this 24h</small></div><button type="button" class="tag btn" data-shop-buy="${id}" ${left <= 0 || state.coins < SHOP_PRICE ? 'disabled' : ''}>Buy</button></div>`;
  }).join('')}</div>`;
  return `${title('Inventory')}
    <p class="note center">The bank has no item cap.</p>
    ${shop}
    <div class="filters">${filters.map((filter) => `<button type="button" class="${view.filter === filter ? 'on' : ''}" data-filter="${filter}">${names[filter]}</button>`).join('')}</div>
    <div class="invgrid">${cells || '<div class="empty">Nothing stored yet.</div>'}</div>
    ${sell}`;
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
  const id = worn(state, slot);
  const item = id ? ITEMS[id] : null;
  const stats = id ? gearStatText(id) : '';
  return `<div class="eslot t-base"><button type="button" data-unequip="${slot}">${item ? icon(item.icon, 34) : ''}<small>${label}</small><em>${item ? esc(item.name) : 'Empty'}</em>${stats ? `<small>${esc(stats)}</small>` : ''}</button></div>`;
}

function gearList(state: Save, slot: 'weapon' | 'body' | 'shield', empty: string): string {
  const ids = Object.keys(state.bank).filter((id) => equipSlotFor(id) === slot && (state.bank[id] ?? 0) > 0);
  if (ids.length === 0) return `<p class="note">${empty}</p>`;
  return ids
    .map((id) => {
      const on = state.equipped[slot] === id;
      return `<button type="button" class="gearpick" data-equip="${id}">${icon(ITEMS[id].icon, 28)}<div class="grow"><b>${esc(itemName(id))}</b><small>${esc(gearStatText(id))} · ${on ? 'Equipped' : 'Tap to equip'}</small></div></button>`;
    })
    .join('');
}

function equipmentHtml(state: Save): string {
  const tools = Object.keys(state.bank).filter((id) => ITEMS[id]?.kind === 'tool' && (state.bank[id] ?? 0) > 0);
  const toolRows = tools
    .map((id) => `<div class="gearpick">${icon(ITEMS[id].icon, 28)}<div class="grow"><b>${esc(itemName(id))}</b><small>×${state.bank[id]} · tier applies while owned</small></div></div>`)
    .join('');
  return `${title('Equipment')}
    <div class="equip">
      <div class="col">${slotButton(state, 'body', 'Body')}</div>
      <div class="hero">${chibi('#151b2e', 120)}</div>
      <div class="col">${slotButton(state, 'weapon', 'Weapon')}${slotButton(state, 'shield', 'Shield')}</div>
    </div>
    <p class="note center">A weapon must be equipped to fight. Body and shield may stay empty. Crafted gear is not equipped for you. Tools are never equipped.</p>
    <div class="panel"><h3>Weapon</h3>${gearList(state, 'weapon', 'No weapon in the bank.')}</div>
    <div class="panel"><h3>Body</h3>${gearList(state, 'body', 'No body armour in the bank.')}</div>
    <div class="panel"><h3>Shield</h3>${gearList(state, 'shield', 'No shield in the bank.')}</div>
    <div class="panel"><h3>Tools</h3>${toolRows || '<p class="note">No tools owned. The highest owned axe or pickaxe applies on its own.</p>'}</div>`;
}

export function reportHtml(report: CatchupReport): string {
  const hours = (ms: number) => `${(ms / 3_600_000).toFixed(2)} h`;
  const xp = Object.entries(report.xpGained)
    .map(([skill, amount]) => `${skill} ${fmtXp(amount)}`)
    .join(', ') || 'none';
  const levels = Object.entries(report.levelsAfter)
    .map(([skill, level]) => {
      const before = report.levelsBefore[skill as SkillId];
      return before != null && before !== level ? `${skill} ${before}→${level}` : `${skill} ${level}`;
    })
    .join(', ');
  const gained = stackText(report.itemsGained);
  const consumed = stackText(report.itemsConsumed);
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
      <dt>Away</dt><dd>${hours(report.awayMs)}</dd>
      <dt>Credited</dt><dd>${hours(report.creditedMs)}${report.capped ? ' (24h cut)' : ''}</dd>
      <dt>Activity</dt><dd>${esc(report.activity)}</dd>
      <dt>Actions</dt><dd>${report.actions}</dd>
      <dt>Kills</dt><dd>${report.kills}</dd>
      <dt>XP</dt><dd>${esc(xp)}</dd>
      <dt>Levels</dt><dd>${esc(levels || 'none')}</dd>
      <dt>Gained</dt><dd>${esc(gained)}</dd>
      <dt>Consumed</dt><dd>${esc(consumed)}</dd>
      <dt>Coins</dt><dd>${fmt(report.coinsGained)}</dd>
      <dt>Food eaten</dt><dd>${report.foodEaten}</dd>
      <dt>Stopped</dt><dd>${esc(why)}</dd>
    </dl>
    <button type="button" class="tag btn" data-catchup-close>Continue</button>
  </div></div>`;
}

function stackText(stacks: Record<string, number>): string {
  const parts = Object.entries(stacks).filter(([, qty]) => qty > 0);
  if (parts.length === 0) return 'none';
  return parts.map(([id, qty]) => `${itemName(id)} ×${qty}`).join(', ');
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
    <label>Skill level <input data-set-skill value="Fishing"> <input data-set-level type="number" min="1" max="30" value="10"></label>
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
    <p class="note">Route autoplay is the section 4 Smithing-first route. It forges the iron spear and equips it before combat. Loot is expected value. Hit rolls use the seeded generator.</p>
    <pre data-dev-out></pre>
    <button type="button" class="tag" data-dev-close>Close</button>
  </div></div>`;
}

export function noticeHtml(): string {
  return `<div class="notice"><div class="card"><h2>Already open</h2><p>This game is running in another tab. Close that tab and reload this one.</p></div></div>`;
}
