import './style.css';
import { hitRateReport, killCycleReport, meadowHour, samplePoacher, survivabilityReport } from './checks';
import { ITEMS, type CombatStyle, type EquipSlot, type SkillId, isCombatStyle } from './content';
import {
  advanceOpenTab,
  buyNode,
  buyShop,
  buySkill,
  creditOffline,
  equip,
  importSave,
  loadAndCredit,
  resumeCombat,
  setSkillLevel,
  sell,
  setFood,
  startCombat,
  startGather,
  startProduce,
  tabLockDecision,
  unequip,
  writeSave,
  type CatchupReport,
  type Save,
} from './engine';
import {
  CATCHUP_REPORT_MIN_MS,
  SILENT_GAP_MS,
  TAB_LOCK_STALE_MS,
  devToolsRequested,
} from './provisional';
import type { TabId } from './ui';
import { formatRouteResult, runReferenceRoute } from './route';
import { activityDestination, activityHtml, activityPercent, devHtml, headerHtml, mainHtml, noticeHtml, renderKey, reportHtml, shellHtml, tabsHtml, type Filter, type View } from './ui';

const CLOCK_KEY = 'idle-game-demo-clock-offset';
const TAB_KEY = 'idle-game-demo-tab';
const app = document.querySelector<HTMLDivElement>('#app')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const dev = document.querySelector<HTMLDivElement>('#dev')!;
const devOn = devToolsRequested(location.search);
const TAB_ID_KEY = 'idle-game-demo-tab-id';
const tabId = sessionStorage.getItem(TAB_ID_KEY) ?? Math.random().toString(36).slice(2);
sessionStorage.setItem(TAB_ID_KEY, tabId);

let offset = Number(sessionStorage.getItem(CLOCK_KEY) ?? '0') || 0;
let drawnKey = '';
let state: Save;
let lastSave = 0;
let lastActions = 0;
let view: View = {
  tab: 'skills',
  skill: 'Woodcutting',
  filter: 'all',
  selected: null,
  area: 'Meadow verge',
  style: null,
  message: '',
};

function gameNow(): number {
  return Date.now() + offset;
}

function claimLock(): 'primary' | 'blocked' {
  const raw = localStorage.getItem(TAB_KEY);
  const existing = raw ? (JSON.parse(raw) as { id: string; beat: number }) : null;
  const decision = tabLockDecision(existing, tabId, Date.now(), TAB_LOCK_STALE_MS);
  if (decision === 'primary') localStorage.setItem(TAB_KEY, JSON.stringify({ id: tabId, beat: Date.now() }));
  return decision;
}

if (claimLock() === 'blocked') {
  app.innerHTML = '';
  overlay.innerHTML = noticeHtml();
} else {
  boot();
}

function boot(): void {
  const loaded = loadAndCredit(localStorage, gameNow());
  state = loaded.state;
  if (loaded.status === 'corrupt') view.message = 'The save could not be read. A new game was started and the old data was kept aside.';
  window.setInterval(() => {
    if (tabLockDecision(readLock(), tabId, Date.now(), TAB_LOCK_STALE_MS) === 'primary') {
      localStorage.setItem(TAB_KEY, JSON.stringify({ id: tabId, beat: Date.now() }));
    }
  }, 1000);
  if (loaded.report && shouldShow(loaded.report)) showReport(loaded.report);
  render();
  window.setInterval(tick, 200);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) writeSave(localStorage, state);
    else {
      const report = creditOffline(state, gameNow());
      writeSave(localStorage, state);
      if (shouldShow(report)) showReport(report);
      render();
    }
  });
  window.addEventListener('pagehide', () => writeSave(localStorage, state));
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  }
}

function readLock(): { id: string; beat: number } | null {
  const raw = localStorage.getItem(TAB_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: string; beat: number };
  } catch {
    return null;
  }
}

function shouldShow(report: CatchupReport): boolean {
  return report.backwards || report.capped || report.creditedMs >= CATCHUP_REPORT_MIN_MS;
}

function showReport(report: CatchupReport): void {
  overlay.innerHTML = reportHtml(report);
}

function tick(): void {
  if (document.hidden) return;
  const now = gameNow();
  const report = advanceOpenTab(state, now, SILENT_GAP_MS);
  if (report) {
    writeSave(localStorage, state);
    if (shouldShow(report)) showReport(report);
  } else {
    const mark = state.stats.actions + state.stats.kills;
    if (mark !== lastActions || now - lastSave >= 10_000) {
      lastActions = mark;
      lastSave = now;
      writeSave(localStorage, state);
    }
  }
  render();
}

function render(): void {
  const key = renderKey(state, view);
  if (key === drawnKey && app.querySelector('[data-activity]')) {
    patchLive();
    return;
  }
  drawnKey = key;
  const main = app.querySelector('main');
  const scroll = main?.scrollTop ?? 0;
  const message = view.message ? `<p class="msg">${escapeText(view.message)}</p>` : '';
  app.innerHTML = shellHtml(
    headerHtml(state, devOn),
    message,
    mainHtml(state, view, gameNow()),
    activityHtml(state),
    tabsHtml(view),
  );
  const next = app.querySelector('main');
  if (next) next.scrollTop = scroll;
  const clock = dev.querySelector('[data-clock]');
  if (clock) clock.textContent = `Game clock offset ${Math.round(offset / 1000)}s · coins ${Math.round(state.coins)} · HP ${state.hp}`;
  const stats = dev.querySelector('[data-stats]');
  if (stats) {
    stats.textContent = `Actions ${state.stats.actions} · kills ${state.stats.kills} · pauses ${state.stats.pauses} · food ${state.stats.foodEaten} · swings ${state.stats.playerSwings} · hits ${state.stats.playerHits} · misses ${state.stats.playerMisses}`;
  }
}

/** Move the progress bars without replacing the buttons a finger is holding. */
function patchLive(): void {
  const pct = Math.max(0, Math.min(100, activityPercent(state)));
  for (const name of ['act-bar', 'fight-bar']) {
    const bar = app.querySelector<HTMLElement>(`[data-live="${name}"]`);
    if (bar) bar.style.width = `${pct}%`;
  }
  const label = app.querySelector('[data-live="act-pct"]');
  if (label) label.textContent = `${Math.round(pct)}%`;
}

function escapeText(value: string): string {
  return value.replace(/[&<>]/g, (ch) => (ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'));
}

function persistClock(): void {
  sessionStorage.setItem(CLOCK_KEY, String(offset));
}

function fastForward(ms: number): void {
  offset += ms;
  persistClock();
  const report = creditOffline(state, gameNow());
  writeSave(localStorage, state);
  if (shouldShow(report) || report.creditedMs > 0) showReport(report);
  render();
}

function afterChange(message = ''): void {
  if (message) view.message = message;
  writeSave(localStorage, state);
  render();
}

app.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-tab], [data-open-skill], [data-buy-skill], [data-node], [data-buy-node], [data-recipe], [data-enemy], [data-style], [data-area], [data-fight], [data-food], [data-filter], [data-select], [data-sell], [data-shop-buy], [data-equip], [data-unequip], [data-resume], [data-about], [data-dev-open]');
  if (!target) return;
  if (target.dataset.tab === 'skill') openActivityTab();
  else if (target.dataset.tab) view.tab = target.dataset.tab as TabId;
  if (target.dataset.openSkill) openSkill(target.dataset.openSkill as SkillId);
  if (target.dataset.buySkill) {
    const skill = target.dataset.buySkill as SkillId;
    view.message = buySkill(state, skill) ? `Bought ${skill}.` : 'Not enough coins.';
  }
  if (target.dataset.buyNode) {
    view.message = buyNode(state, target.dataset.buyNode) ? 'Node bought.' : 'That node is not available.';
  }
  if (target.dataset.node && !target.dataset.buyNode) {
    startGather(state, target.dataset.node);
    view.message = '';
  }
  if (target.dataset.recipe) {
    view.message = startProduce(state, target.dataset.recipe) ? '' : 'Missing inputs.';
  }
  if (target.dataset.enemy) view.selected = target.dataset.enemy;
  if (target.dataset.style && isCombatStyle(target.dataset.style as SkillId)) view.style = target.dataset.style as CombatStyle;
  if (target.dataset.area === 'Meadow verge' || target.dataset.area === 'Woodland edge') view.area = target.dataset.area;
  if (target.dataset.fight) {
    const style = view.style && state.owned.includes(view.style) ? view.style : firstStyle();
    if (style) {
      startCombat(state, target.dataset.fight, style);
      view.message = '';
    }
  }
  if (target.dataset.food) setFood(state, target.dataset.food);
  if (target.dataset.filter) view.filter = target.dataset.filter as Filter;
  if (target.dataset.select) view.selected = target.dataset.select;
  if (target.dataset.sell && view.selected) {
    const qty = target.dataset.sell === 'all' ? state.bank[view.selected] ?? 0 : 1;
    sell(state, view.selected, qty);
  }
  if (target.dataset.shopBuy) {
    view.message = buyShop(state, target.dataset.shopBuy, gameNow()) ? 'Bought.' : 'Shop limit or not enough coins.';
  }
  if (target.dataset.equip) equip(state, target.dataset.equip);
  if (target.dataset.unequip) unequip(state, target.dataset.unequip as EquipSlot);
  if (target.hasAttribute('data-resume')) resumeCombat(state);
  if (target.hasAttribute('data-about')) view.message = `${__BUILD_LABEL__} · ${__COMMIT_SHA__}`;
  if (target.hasAttribute('data-dev-open')) openDev();
  afterChange(view.message);
});

function openActivityTab(): void {
  const choice = activityDestination(state, view.skill);
  if (choice.tab === 'combat') {
    view.tab = 'combat';
    if (isCombatStyle(choice.skill)) view.style = choice.skill;
    if (choice.area) view.area = choice.area;
    if (choice.selected) view.selected = choice.selected;
    return;
  }
  view.skill = choice.skill;
  view.tab = 'skill';
}

function openSkill(skill: SkillId): void {
  if (isCombatStyle(skill)) {
    view.style = skill;
    view.tab = 'combat';
    return;
  }
  view.skill = skill;
  view.tab = 'skill';
}

function firstStyle(): CombatStyle | null {
  if (state.owned.includes('Strength')) return 'Strength';
  if (state.owned.includes('Attack')) return 'Attack';
  if (state.owned.includes('Defence')) return 'Defence';
  return null;
}

function openDev(): void {
  dev.innerHTML = devHtml();
  dev.querySelector('[data-dev-close]')?.addEventListener('click', () => {
    dev.innerHTML = '';
  });
  dev.querySelectorAll<HTMLButtonElement>('[data-ff]').forEach((button) => {
    button.addEventListener('click', () => fastForward(Number(button.dataset.ff)));
  });
  dev.querySelector('[data-ff-back]')?.addEventListener('click', () => fastForward(-3_600_000));
  dev.querySelector('[data-ff-apply]')?.addEventListener('click', () => {
    const input = dev.querySelector<HTMLInputElement>('[data-ff-custom]');
    const minutes = Number(input?.value ?? '0');
    if (minutes > 0) fastForward(minutes * 60_000);
  });
  const fill = () => {
    const box = dev.querySelector<HTMLTextAreaElement>('[data-export]');
    if (box) box.value = JSON.stringify(state, null, 2);
  };
  fill();
  dev.querySelector('[data-export-fill]')?.addEventListener('click', fill);
  dev.querySelector('[data-import-apply]')?.addEventListener('click', () => {
    const raw = dev.querySelector<HTMLTextAreaElement>('[data-import]')?.value ?? '';
    const next = importSave(raw);
    if (!next) {
      view.message = 'That save could not be read. The current game was kept.';
      render();
      return;
    }
    state = next;
    writeSave(localStorage, state);
    view.message = 'Save imported.';
    render();
  });
  dev.querySelector('[data-route]')?.addEventListener('click', () => {
    const out = dev.querySelector('[data-dev-out]');
    if (out) out.textContent = 'Running the reference route…';
    window.setTimeout(() => {
      const result = runReferenceRoute({ seed: 1, expectedLoot: true });
      if (out) out.textContent = formatRouteResult(result);
    }, 30);
  });
  const show = (text: string) => {
    const out = dev.querySelector('[data-dev-out]');
    if (out) out.textContent = text;
  };
  dev.querySelector('[data-apply-coins]')?.addEventListener('click', () => {
    const value = Number(dev.querySelector<HTMLInputElement>('[data-set-coins]')?.value ?? '0');
    if (Number.isFinite(value) && value >= 0) {
      state.coins = value;
      afterChange('Coins updated.');
    }
  });
  dev.querySelector('[data-apply-level]')?.addEventListener('click', () => {
    const skill = dev.querySelector<HTMLInputElement>('[data-set-skill]')?.value ?? '';
    const level = Number(dev.querySelector<HTMLInputElement>('[data-set-level]')?.value ?? '1');
    if (!isSkill(skill) || !Number.isInteger(level)) return;
    setSkillLevel(state, skill, level);
    if (skill === 'Hitpoints') state.hp = Math.min(state.hp, 10 + 2 * level);
    afterChange(`${skill} set to level ${level}.`);
  });
  dev.querySelector('[data-apply-give]')?.addEventListener('click', () => {
    const id = dev.querySelector<HTMLInputElement>('[data-give-id]')?.value ?? '';
    const qty = Number(dev.querySelector<HTMLInputElement>('[data-give-qty]')?.value ?? '1');
    if (!ITEMS[id] || !Number.isInteger(qty) || qty <= 0) return;
    state.bank[id] = (state.bank[id] ?? 0) + qty;
    afterChange(`Added ${qty} ${id}.`);
  });
  dev.querySelector('[data-poacher]')?.addEventListener('click', () => show(samplePoacher()));
  dev.querySelector('[data-hit-rates]')?.addEventListener('click', () => show(hitRateReport()));
  dev.querySelector('[data-kill-cycle]')?.addEventListener('click', () => show(killCycleReport()));
  dev.querySelector('[data-survive]')?.addEventListener('click', () => show(`${survivabilityReport()}\n${meadowHour(1)}`));
  render();
}

function isSkill(value: string): value is SkillId {
  return (
    value === 'Woodcutting' ||
    value === 'Fishing' ||
    value === 'Cooking' ||
    value === 'Attack' ||
    value === 'Strength' ||
    value === 'Defence' ||
    value === 'Mining' ||
    value === 'Smithing' ||
    value === 'Hitpoints'
  );
}

overlay.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest('[data-catchup-close]');
  if (target) overlay.innerHTML = '';
});
