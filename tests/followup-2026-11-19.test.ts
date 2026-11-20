import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { XP_TABLE } from '../src/content';
import {
  SAVE_KEY,
  advanceOpenTab,
  buyAutoReplant,
  buyNode,
  confirmAccountReset,
  creditOffline,
  deserialize,
  loadAndCredit,
  newGame,
  plantOnPlot,
  returnExpedition,
  serialize,
  setSkillLevel,
  startCombat,
  startExpedition,
  startProduce,
  stepCompletion,
  stopActivity,
  type FloatNote,
  type Save,
  type StorageLike,
} from '../src/engine';
import { masteryLevel } from '../src/mastery';
import { combatScreenFor, combatStyleChoice, mainHtml, plotCountdown, reportHtml, shellHtml, type View } from '../src/ui';

const FLAX = 'recipe.mat.fibre.flax';
const SEED = 'mat.seed.flax';
const FIBRE = 'mat.fibre.flax';
const COMPOST = 'mat.farm.compost';
const BONE = 'mat.farm.bone_compost';
const STREAM = 'activity.exploration.stream_survey';
const RUIN = 'activity.exploration.shallow_ruin';
const ALUM_SEEP = 'activity.exploration.alum_seep_recovery';
const BRIDGE = 'activity.exploration.bridge_approach_survey';
const FITTING = 'activity.exploration.fitting_appraisal';
const KIT = 'supply.exploration.route_kit';
const ROUTE_RECIPE = 'recipe.supply.exploration.route_kit';
const SLATE = 'mat.relic.weathered_slate';
const POTATO = 'mat.seed.potato';
const CUTTINGS = 'mat.cutting.meadow_herb';
const BERRIES = 'mat.fruit.berries';
const QUARTER = 15 * 60 * 1000;
const AWAY = 282 * 60 * 1000;

function view(extra: Partial<View> = {}): View {
  return {
    tab: 'skill',
    skill: 'Woodcutting',
    filter: 'all',
    selected: null,
    area: 'Meadow verge',
    style: null,
    message: '',
    ...extra,
  };
}

function fighter(): Save {
  const state = newGame(0);
  state.owned.push('Attack', 'Strength', 'Hitpoints');
  state.xp.Attack = 0;
  state.xp.Strength = 0;
  state.xp.Hitpoints = 0;
  return state;
}

function farmer(): Save {
  const state = newGame(0);
  setSkillLevel(state, 'Farming', 1);
  state.coins = 27_822;
  expect(buyAutoReplant(state)).toBe(true);
  return state;
}

function memory(initial: string | null = null): StorageLike {
  let raw = initial;
  return {
    getItem: () => raw,
    setItem: (_key, value) => {
      raw = value;
    },
    removeItem: () => {
      raw = null;
    },
  };
}

function toasts(notes: FloatNote[]): string[] {
  return notes.flatMap((note) => (note.kind === 'toast' ? [note.text] : []));
}

function buyButtons(html: string): string[] {
  return html.match(/<button\b[^>]*>Buy[^<]*/g) ?? [];
}

function habitatCard(html: string, name: string): string {
  const at = html.indexOf(`<b>${name}</b>`);
  const start = html.lastIndexOf('<section', at);
  const next = html.indexOf('<section', start + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

function rowHtml(html: string, title: string): string {
  const at = html.indexOf(`<b>${title}</b>`);
  const start = html.lastIndexOf('<div class="row', at);
  const next = html.indexOf('<div class="row', at + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

describe('combat style chip', () => {
  it('keeps a fresh save without the key and shows Attack', () => {
    const fresh = newGame(0);
    const raw = JSON.parse(serialize(fresh)) as Record<string, unknown>;
    expect(raw.combatStyle).toBeUndefined();
    expect(raw.saveFormat).toBe(4);
    const state = fighter();
    expect(JSON.parse(serialize(state)).combatStyle).toBeUndefined();
    const screen = view({ tab: 'combat', combatScreen: 'ladder', style: null });
    expect(combatStyleChoice(state, screen)).toBe('Attack');
    expect(mainHtml(state, screen, 0)).toContain('class="tag on" data-style="Attack"');
  });

  it('remembers Strength after the fight stops and the save is reloaded', () => {
    const state = fighter();
    expect(startCombat(state, 'meadow.hare', 'Strength')).toBe(true);
    expect(state.combatStyle).toBe('Strength');
    stopActivity(state);
    const loaded = deserialize(serialize(state));
    expect(loaded?.combatStyle).toBe('Strength');
    expect(loaded?.saveFormat).toBe(4);
    const screen = view({ tab: 'combat', combatScreen: 'ladder', style: null });
    expect(combatStyleChoice(loaded!, screen)).toBe('Strength');
    expect(mainHtml(loaded!, screen, 0)).toContain('class="tag on" data-style="Strength"');
  });

  it('loads a save without the key as Attack at saveFormat 4', () => {
    const state = fighter();
    const raw = JSON.parse(serialize(state)) as Record<string, unknown>;
    delete raw.combatStyle;
    expect(raw.saveFormat).toBe(4);
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded?.saveFormat).toBe(4);
    expect(loaded?.combatStyle).toBeUndefined();
    expect(combatStyleChoice(loaded!, view({ style: null }))).toBe('Attack');
  });

  it('loads an unknown or unowned combatStyle as Attack', () => {
    const unknown = fighter();
    const raw = JSON.parse(serialize(unknown)) as Record<string, unknown>;
    raw.combatStyle = 'Sword';
    const bad = deserialize(JSON.stringify(raw));
    expect(bad?.combatStyle).toBeUndefined();
    expect(combatStyleChoice(bad!, view({ style: null }))).toBe('Attack');

    raw.combatStyle = 'Ranged';
    const unowned = deserialize(JSON.stringify(raw));
    expect(unowned?.owned.includes('Ranged')).toBe(false);
    expect(unowned?.combatStyle).toBeUndefined();
    expect(combatStyleChoice(unowned!, view({ style: null }))).toBe('Attack');
  });

  it('keeps the running fight style across a reload when the chip was only changed', () => {
    const state = fighter();
    expect(startCombat(state, 'meadow.hare', 'Attack')).toBe(true);
    const chip = view({ tab: 'combat', combatScreen: 'fight', style: 'Strength', selected: 'meadow.hare' });
    expect(combatStyleChoice(state, chip)).toBe('Strength');
    expect(state.combatStyle).toBe('Attack');
    const loaded = deserialize(serialize(state));
    expect(loaded?.combatStyle).toBe('Attack');
    expect(loaded?.activity).toMatchObject({ kind: 'combat', style: 'Attack' });
    const opened = view({ tab: 'combat', style: null, selected: 'meadow.hare' });
    expect(combatScreenFor(loaded!, opened)).toBe('fight');
    const html = mainHtml(loaded!, opened, 0);
    expect(html).toContain('Style: Attack');
    expect(html).not.toContain('Style: Strength');
    expect(combatStyleChoice(loaded!, opened)).toBe('Attack');
  });

  it('clears the key on Dev Reset', () => {
    const state = fighter();
    expect(startCombat(state, 'meadow.hare', 'Strength')).toBe(true);
    const storage = memory(serialize(state));
    expect(confirmAccountReset(storage, true)).toBe(true);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    const loaded = loadAndCredit(storage, 0);
    expect(JSON.parse(serialize(loaded.state)).combatStyle).toBeUndefined();
    expect(loaded.state.saveFormat).toBe(4);
  });
});

describe('catch-up replant report', () => {
  function away(stock: Record<string, number>): { state: Save; html: string } {
    const state = farmer();
    state.bank[SEED] = 4;
    state.bank[COMPOST] = stock[COMPOST] ?? 0;
    state.bank[BONE] = stock[BONE] ?? 0;
    expect(plantOnPlot(state, 0, FLAX, null)).toBe(true);
    const report = creditOffline(state, AWAY);
    return { state, html: reportHtml(report) };
  }

  it('lists the replant inputs and the replanted plot after 282 minutes', () => {
    const state = farmer();
    state.bank[SEED] = 4;
    state.bank[COMPOST] = 2;
    expect(plantOnPlot(state, 0, FLAX, null)).toBe(true);
    const report = creditOffline(state, AWAY);
    const html = reportHtml(report);
    expect(html).toContain('<dt>XP</dt><dd>Farming 26,550</dd>');
    expect(html).toContain('<dt>Levels</dt><dd>Farming 1→15</dd>');
    expect(html).toContain('<dt>Gained</dt><dd>Flax fibre ×1,800</dd>');
    expect(html).toContain('<dt>Consumed</dt><dd>Flax seed ×1 · Compost ×1</dd>');
    expect(html).toContain('<dt>Mastery</dt><dd>Flax fibre 1 → 15</dd>');
    expect(html).toContain('<dt>Perks</dt><dd>Flax fibre mastery 10: sell value +5%</dd>');
    expect(html).toContain('<dt>Plots</dt><dd>Plot 1: Flax fibre ×1,800 · replanted 1</dd>');
    expect(html).toContain('<dt>Actions</dt><dd>1</dd>');
    expect(report.actions).toBe(1);
    expect(state.mastery[FLAX]).toBe(16_650);
    expect(masteryLevel(state.mastery[FLAX] ?? 0)).toBe(15);
    expect(state.bank[SEED]).toBe(2);
    expect(state.bank[COMPOST]).toBe(1);
    expect(state.bank[FIBRE]).toBe(1_800);
    expect(state.plots[0]?.remainingMs).toBe(9_720_000);
  });

  it('uses bone compost before compost and shortens the replanted grow', () => {
    const { state, html } = away({ [BONE]: 1, [COMPOST]: 1 });
    expect(html).toContain('<dt>Consumed</dt><dd>Flax seed ×1 · Bone compost ×1</dd>');
    expect(state.bank[BONE] ?? 0).toBe(0);
    expect(state.bank[COMPOST]).toBe(1);
    const full = (state.plots[0]?.remainingMs ?? 0) + 3_600_000;
    expect(full).toBe(12_480_840);
    expect(plotCountdown(full)).toBe('3h 28m 1s');
  });

  it('says none were consumed when the hand-planted seed was the only one', () => {
    const state = farmer();
    state.bank[SEED] = 1;
    expect(plantOnPlot(state, 0, FLAX, null)).toBe(true);
    const html = reportHtml(creditOffline(state, AWAY));
    expect(html).toContain('<dt>Consumed</dt><dd>none</dd>');
    expect(html).toContain('<dt>Plots</dt><dd>Plot 1: Flax fibre ×1,800 · not replanted: no Flax seed</dd>');
    expect(state.plots[0]).toBeNull();
  });
});

describe('level-up and mastery toasts', () => {
  it('toasts the haul, then Exploration 20, then Stream survey mastery 10', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Exploration', 19);
    state.xp.Exploration = 39_317;
    expect(startExpedition(state, STREAM, QUARTER, 0)).toBe(true);
    const notes: FloatNote[] = [];
    expect(advanceOpenTab(state, QUARTER, QUARTER + 1, notes)).toBeNull();
    expect(toasts(notes)).toEqual([
      'Stream survey is back: Weathered agate ×272 · 7,072 XP',
      'Exploration reached Lv 20',
      'Stream survey mastery 10: sell value +5%',
    ]);
    expect(state.xp.Exploration).toBe(46_389);
  });

  it('toasts the harvest, then Farming 15, then Flax fibre mastery 10', () => {
    const state = farmer();
    state.bank[SEED] = 2;
    expect(plantOnPlot(state, 0, FLAX, null)).toBe(true);
    state.plots[0]!.remainingMs = 500;
    const notes: FloatNote[] = [];
    expect(advanceOpenTab(state, 500, 5_000, notes)).toBeNull();
    expect(toasts(notes)).toEqual([
      'Fields harvested: Flax fibre ×1,800 · replanted 1',
      'Farming reached Lv 15',
      'Flax fibre mastery 10: sell value +5%',
    ]);
  });

  it('shows only the haul toast when nothing crosses a threshold', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Exploration', 39);
    state.mastery[STREAM] = 14_694;
    expect(startExpedition(state, STREAM, QUARTER, 0)).toBe(true);
    const notes: FloatNote[] = [];
    expect(advanceOpenTab(state, QUARTER, QUARTER + 1, notes)).toBeNull();
    expect(toasts(notes)).toEqual(['Stream survey is back: Weathered agate ×272 · 7,072 XP']);
    expect(state.xp.Exploration).toBe((XP_TABLE[39] ?? 0) + 7_072);
  });

  it('shows no toast when the same trip finishes during offline catch-up', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Exploration', 19);
    state.xp.Exploration = 39_317;
    expect(startExpedition(state, STREAM, QUARTER, 0)).toBe(true);
    const notes: FloatNote[] = [];
    const report = advanceOpenTab(state, QUARTER, 5_000, notes);
    expect(notes).toEqual([]);
    expect(report?.expeditionLine).toContain('Stream survey');
    expect(state.xp.Exploration).toBe(46_389);
  });

  it('keeps the level-40 Return now toast without an XP clause', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Exploration', 40);
    state.bank['mat.binding.hemp'] = 2;
    expect(startExpedition(state, BRIDGE, QUARTER, 0)).toBe(true);
    expect(advanceOpenTab(state, 61_000, 62_000)).toBeNull();
    const notes: FloatNote[] = [];
    expect(returnExpedition(state, notes)).toBe(true);
    expect(toasts(notes)).toEqual(['Bridge approach survey is back: Alum ×11']);
    expect(state.bank['mat.binding.hemp'] ?? 0).toBe(0);
  });
});

describe('unaffordable buys', () => {
  it('disables Grove rank 1 at 119 Glimmer and enables it at 120', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Enchanting', 1);
    state.glimmer.grove = 119;
    const poor = mainHtml(state, view({ skill: 'Enchanting' }), 0);
    expect(poor).toContain('data-buy-rank="grove.time" disabled aria-disabled="true"');
    state.glimmer.grove = 120;
    const ready = mainHtml(state, view({ skill: 'Enchanting' }), 0);
    const card = ready.slice(ready.indexOf('data-mark-card="grove"'), ready.indexOf('data-mark-card="hearth"'));
    expect(card).toContain('data-buy-rank="grove.time">Buy rank 1 — 120');
    expect(card).not.toContain('aria-disabled');
  });

  it('disables the Meadow node at 187 coins and enables it at 188', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Foraging', 5);
    state.coins = 187;
    expect(mainHtml(state, view({ skill: 'Foraging' }), 0)).toContain(
      `data-buy-node="${POTATO}" disabled aria-disabled="true"`,
    );
    state.coins = 188;
    const ready = mainHtml(state, view({ skill: 'Foraging' }), 0);
    expect(ready).toContain(`data-buy-node="${POTATO}">Buy 188`);
    expect(ready).not.toContain(`data-buy-node="${POTATO}" disabled`);
  });

  it('disables Woodland nodes and Weathered slate at 749 and enables them at 750', () => {
    const wood = newGame(0);
    setSkillLevel(wood, 'Foraging', 10);
    wood.coins = 749;
    const locked = mainHtml(wood, view({ skill: 'Foraging' }), 0);
    expect(locked).toContain(`data-buy-node="${CUTTINGS}" disabled aria-disabled="true"`);
    expect(locked).toContain(`data-buy-node="${BERRIES}" disabled aria-disabled="true"`);
    wood.coins = 750;
    const open = mainHtml(wood, view({ skill: 'Foraging' }), 0);
    expect(open).toContain(`data-buy-node="${CUTTINGS}">Buy 750`);
    expect(open).toContain(`data-buy-node="${BERRIES}">Buy 750`);

    const explore = newGame(0);
    setSkillLevel(explore, 'Exploration', 10);
    explore.coins = 749;
    expect(mainHtml(explore, view({ skill: 'Exploration' }), 0)).toContain(
      `data-buy-node="${SLATE}" disabled aria-disabled="true"`,
    );
    explore.coins = 750;
    const bought = mainHtml(explore, view({ skill: 'Exploration' }), 0);
    expect(bought).toContain(`data-buy-node="${SLATE}">Buy`);
    expect(bought).not.toContain(`data-buy-node="${SLATE}" disabled`);
    expect(rowHtml(bought, 'Weathered slate')).not.toContain('aria-label="Locked"');
  });

  it('draws every price Buy grey at 0 coins', () => {
    const state = newGame(0);
    state.coins = 0;
    setSkillLevel(state, 'Foraging', 40);
    setSkillLevel(state, 'Exploration', 40);
    setSkillLevel(state, 'Enchanting', 40);
    setSkillLevel(state, 'Farming', 40);
    state.nodes = state.nodes.filter((id) => id !== SLATE);
    const pages = [
      mainHtml(state, view({ tab: 'skills', skill: null }), 0),
      mainHtml(state, view({ skill: 'Foraging' }), 0),
      mainHtml(state, view({ skill: 'Exploration' }), 0),
      mainHtml(state, view({ skill: 'Enchanting' }), 0),
      mainHtml(state, view({ skill: 'Farming', land: true }), 0),
      mainHtml(state, view({ tab: 'inventory' }), 0),
    ];
    const buttons = pages.flatMap(buyButtons);
    expect(buttons.length).toBeGreaterThan(10);
    for (const button of buttons) {
      expect(button, button).toContain('disabled');
      expect(button, button).toContain('aria-disabled="true"');
    }
  });
});

describe('bank thousands separators', () => {
  function badge(qty: number): string {
    const state = newGame(0);
    state.bank[FIBRE] = qty;
    const html = mainHtml(state, view({ tab: 'inventory' }), 0);
    const at = html.indexOf('Flax fibre');
    return html.slice(Math.max(0, at - 80), at);
  }

  it('formats 1,800, leaves 999, and formats 1,000', () => {
    expect(badge(1_800)).toContain('>1,800<');
    expect(badge(999)).toContain('>999<');
    expect(badge(999)).not.toContain('999,');
    expect(badge(1_000)).toContain('>1,000<');
  });

  it('keeps a six-digit count inside the 390 px tile', async () => {
    const state = newGame(0);
    state.bank[FIBRE] = 12_345;
    const html = shellHtml('', '', mainHtml(state, view({ tab: 'inventory' }), 0), '', '');
    const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div id="app">${html}</div></body></html>`);
    const cell = page.locator('.invgrid .cell', { hasText: 'Flax fibre' });
    const qty = cell.locator('.qty');
    const text = await qty.innerText();
    const cellBox = await cell.boundingBox();
    const qtyBox = await qty.boundingBox();
    await browser.close();
    expect(text).toBe('12,345');
    expect(qtyBox).toBeTruthy();
    expect(cellBox).toBeTruthy();
    expect(qtyBox!.x).toBeGreaterThanOrEqual(cellBox!.x - 0.5);
    expect(qtyBox!.x + qtyBox!.width).toBeLessThanOrEqual(cellBox!.x + cellBox!.width + 0.5);
  });
});

describe('woodland caption and fitting lock', () => {
  it('asks for a node once Woodland is at level and has no entry', () => {
    const below = newGame(0);
    setSkillLevel(below, 'Foraging', 9);
    const early = habitatCard(mainHtml(below, view({ skill: 'Foraging' }), 0), 'Woodland edge');
    expect(early).toContain('Foraging 10');
    expect(early).not.toContain('Buy a node below to open');

    const met = newGame(0);
    setSkillLevel(met, 'Foraging', 10);
    const locked = habitatCard(mainHtml(met, view({ skill: 'Foraging' }), 0), 'Woodland edge');
    expect(locked).toContain('Buy a node below to open');
    const head = locked.slice(0, locked.indexOf('class="drops"'));
    expect(head).toContain('viewBox="0 0 20 20"');
    expect(locked).not.toContain('data-habitat="woodland"');

    const river = habitatCard(mainHtml(met, view({ skill: 'Foraging' }), 0), 'Riverbank');
    expect(river).toContain('Foraging 20');
    expect(river).not.toContain('Buy a node below to open');
  });

  it('opens Woodland after the first node and drops the padlock', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Foraging', 10);
    state.coins = 750;
    expect(buyNode(state, CUTTINGS)).toBe(true);
    const card = habitatCard(mainHtml(state, view({ skill: 'Foraging' }), 0), 'Woodland edge');
    expect(card).toContain('data-habitat="woodland"');
    expect(card).toContain('3.2s · 51 XP');
    const head = card.slice(0, card.indexOf('class="drops"'));
    expect(head).not.toContain('aria-label="Locked"');
    expect(head).not.toContain('Buy a node below to open');
  });

  it('keeps Locked on the Fitting appraisal padlock', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Exploration', 40);
    const fitting = rowHtml(mainHtml(state, view({ skill: 'Exploration' }), 0), 'Fitting appraisal');
    expect(fitting).toContain('aria-label="Locked"');
    expect(fitting).not.toContain('Pack and go');
    expect(FITTING).toBe('activity.exploration.fitting_appraisal');
  });
});

describe('route kit', () => {
  it('already crafts one Route kit in 4.9 s for 26 XP and takes the inputs', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Crafting', 10);
    state.bank['mat.binding.flax'] = 2;
    state.bank['food.roast_minnows'] = 1;
    const row = rowHtml(mainHtml(state, view({ skill: 'Crafting' }), 0), 'Route kit');
    expect(row).toContain('data-recipe="recipe.supply.exploration.route_kit"');
    expect(row).toContain('4.9s · 26 XP');
    expect(row).not.toContain('disabled');
    expect(startProduce(state, ROUTE_RECIPE)).toBe(true);
    const done = stepCompletion(state);
    expect(done.ms).toBe(4_900);
    expect(done.type).toBe('action');
    expect(state.bank[KIT]).toBe(1);
    expect(state.bank['mat.binding.flax'] ?? 0).toBe(0);
    expect(state.bank['food.roast_minnows'] ?? 0).toBe(0);
    expect(state.xp.Crafting).toBe((XP_TABLE[10] ?? 0) + 26);
  });

  it('shows the unusable pattern without the inputs', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Crafting', 10);
    const row = rowHtml(mainHtml(state, view({ skill: 'Crafting' }), 0), 'Route kit');
    expect(row).toContain('disabled');
    expect(row).toContain('Needs flax string (Crafting)');
    expect(startProduce(state, ROUTE_RECIPE)).toBe(false);
  });

  it('lets one kit pack Shallow ruin and Alum seep, and does not refund it', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Exploration', 35);
    state.bank[KIT] = 1;
    const html = mainHtml(state, view({ skill: 'Exploration', routeMs: QUARTER }), 0);
    const ruin = rowHtml(html, 'Shallow ruin');
    expect(ruin).toContain('Haul 243 Weathered slate · 7,290 XP');
    expect(ruin).toContain(`data-pack="${RUIN}"`);
    const seep = rowHtml(html, 'Alum seep recovery');
    expect(seep).toContain('Level 35');
    expect(seep).toContain(`data-pack="${ALUM_SEEP}"`);

    expect(startExpedition(state, RUIN, QUARTER, 0)).toBe(true);
    expect(state.bank[KIT] ?? 0).toBe(0);
    expect(startExpedition(state, ALUM_SEEP, QUARTER, 0)).toBe(false);
    const notes: FloatNote[] = [];
    expect(returnExpedition(state, notes)).toBe(true);
    expect(state.bank[KIT] ?? 0).toBe(0);
    expect(state.expedition).toBeNull();

    state.bank[KIT] = 1;
    expect(startExpedition(state, ALUM_SEEP, QUARTER, 0)).toBe(true);
    expect(state.bank[KIT] ?? 0).toBe(0);
    expect(returnExpedition(state)).toBe(true);
    expect(state.bank[KIT] ?? 0).toBe(0);
  });
});
