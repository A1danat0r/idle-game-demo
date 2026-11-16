import { describe, expect, it } from 'vitest';
import { XP_CAP, XP_TABLE } from '../src/content';
import {
  EXPEDITION_MS,
  buyNode,
  creditOffline,
  deserialize,
  expeditionPreview,
  expeditionRemainingMs,
  loadAndCredit,
  newGame,
  returnExpedition,
  serialize,
  startCombat,
  startExpedition,
  startGather,
  startProduce,
  advanceOpenTab,
  sell,
  type Save,
  type StorageLike,
} from '../src/engine';
import { masteryThreshold } from '../src/mastery';
import { activityHtml, backgroundStripHtml, mainHtml, reportHtml, shellHtml, type View } from '../src/ui';

const QUARTER = EXPEDITION_MS[0];
const HOUR = EXPEDITION_MS[1];
const EIGHT = EXPEDITION_MS[2];
const AGATE = 'mat.gem.weathered_agate';
const SLATE = 'mat.relic.weathered_slate';
const STREAM = 'activity.exploration.stream_survey';
const RUIN = 'activity.exploration.shallow_ruin';
const KIT = 'supply.exploration.route_kit';
const HEMP = 'mat.binding.hemp';
const FITTING = 'activity.exploration.fitting_appraisal';
const BRIDGE = 'activity.exploration.bridge_approach_survey';

const TABLE: [string, number, string | null, number, number][] = [
  [AGATE, QUARTER, AGATE, 264, 7128],
  [AGATE, HOUR, AGATE, 1058, 28566],
  [AGATE, EIGHT, AGATE, 8470, 228690],
  [STREAM, QUARTER, AGATE, 272, 7072],
  [STREAM, HOUR, AGATE, 1090, 28340],
  [STREAM, EIGHT, AGATE, 8727, 226902],
  [SLATE, QUARTER, SLATE, 236, 7080],
  [SLATE, HOUR, SLATE, 947, 28410],
  [SLATE, EIGHT, SLATE, 7578, 227340],
  [RUIN, QUARTER, SLATE, 243, 7290],
  [RUIN, HOUR, SLATE, 972, 29160],
  [RUIN, EIGHT, SLATE, 7783, 233490],
  ['activity.exploration.riverbank_branch_agate', QUARTER, AGATE, 428, 10486],
  ['activity.exploration.riverbank_branch_agate', HOUR, AGATE, 1714, 41993],
  ['activity.exploration.riverbank_branch_agate', EIGHT, AGATE, 13714, 335993],
  ['activity.exploration.riverbank_branch_slate', QUARTER, SLATE, 418, 10450],
  ['activity.exploration.riverbank_branch_slate', HOUR, SLATE, 1674, 41850],
  ['activity.exploration.riverbank_branch_slate', EIGHT, SLATE, 13394, 334850],
  ['activity.exploration.alum_seep_recovery', QUARTER, 'mat.mineral.alum', 360, 10440],
  ['activity.exploration.alum_seep_recovery', HOUR, 'mat.mineral.alum', 1440, 41760],
  ['activity.exploration.alum_seep_recovery', EIGHT, 'mat.mineral.alum', 11520, 334080],
  [BRIDGE, QUARTER, null, 0, 18093],
  [BRIDGE, HOUR, null, 0, 72594],
  [BRIDGE, EIGHT, null, 0, 581196],
];

function explorer(level: number): Save {
  const state = newGame(0);
  state.owned.push('Exploration');
  state.xp.Exploration = XP_TABLE[level] ?? 0;
  state.coins = 100_000;
  state.bank[KIT] = 5;
  state.bank[HEMP] = 5;
  if (level >= 10) state.nodes.push(SLATE);
  return state;
}

function view(skill: View['skill'], routeId?: string): View {
  return {
    tab: 'skill',
    skill,
    filter: 'all',
    selected: null,
    area: 'Meadow verge',
    style: null,
    message: '',
    routeId,
  };
}

function rowHtml(html: string, title: string): string {
  const at = html.indexOf(`<b>${title}</b>`);
  const start = html.lastIndexOf('<div class="row', at);
  const next = html.indexOf('<div class="row', at + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

function memory(initial: string | null = null): StorageLike & { writes: number } {
  let raw = initial;
  const box = {
    writes: 0,
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      box.writes += 1;
      raw = value;
    },
    removeItem: () => {
      raw = null;
    },
  };
  return box;
}

describe('exploration expeditions', () => {
  it('grants a 15 min stream survey the same haul online and offline', () => {
    const offline = explorer(1);
    expect(startExpedition(offline, STREAM, QUARTER, 0)).toBe(true);
    creditOffline(offline, QUARTER);
    expect(offline.bank[AGATE]).toBe(272);
    expect(offline.xp.Exploration).toBe(7072);
    expect(offline.mastery[STREAM]).toBe(8976);
    expect(offline.expedition).toBeNull();

    const online = explorer(1);
    startExpedition(online, STREAM, QUARTER, 0);
    for (let t = 4_000; t <= QUARTER; t += 4_000) advanceOpenTab(online, t, 5_000);
    expect(online.bank[AGATE]).toBe(272);
    expect(online.xp.Exploration).toBe(7072);
    expect(online.mastery[STREAM]).toBe(8976);
    expect(online.expedition).toBeNull();
  });

  it('matches every haul cell in the route table', () => {
    const levelFor = (routeId: string) => {
      if (routeId === AGATE || routeId === STREAM) return 1;
      if (routeId === SLATE || routeId === RUIN) return 10;
      if (routeId.includes('riverbank')) return 20;
      if (routeId.includes('alum')) return 35;
      return 40;
    };
    for (const [routeId, duration, itemId, qty, xp] of TABLE) {
      const state = explorer(levelFor(routeId));
      const before = state.xp.Exploration ?? 0;
      const preview = expeditionPreview(state, routeId, duration);
      expect(preview.xp, routeId).toBe(xp);
      expect(preview.items.reduce((sum, item) => sum + item.qty, 0), routeId).toBe(qty);
      expect(startExpedition(state, routeId, duration, 0), routeId).toBe(true);
      creditOffline(state, duration);
      if (itemId) expect(state.bank[itemId] ?? 0, routeId).toBe(qty);
      else expect(state.bank[AGATE] ?? 0, routeId).toBe(0);
      const room = Math.max(0, XP_CAP - before);
      expect(state.xp.Exploration, routeId).toBe(before + Math.min(xp, room));
    }
  });

  it('takes one route kit for a shallow ruin and keeps Pack and go closed while it is out', () => {
    const state = explorer(10);
    state.bank[KIT] = 3;
    expect(startExpedition(state, RUIN, HOUR, 0)).toBe(true);
    expect(state.bank[KIT]).toBe(2);
    expect(startExpedition(state, STREAM, QUARTER, 0)).toBe(false);
    const html = mainHtml(state, view('Exploration'), 0);
    expect(html).toContain('Return now');
    expect(html).not.toContain('data-pack=');
    creditOffline(state, HOUR);
    expect(state.bank[SLATE]).toBe(972);
    expect(state.xp.Exploration).toBe((XP_TABLE[10] ?? 0) + 29160);
    expect(state.bank[KIT]).toBe(2);
    expect(state.expedition).toBeNull();
  });

  it('lets woodcutting and combat keep their pace, and leaves the haul on the route numbers', () => {
    const wood = explorer(1);
    startGather(wood, 'mat.wood.pine');
    const withTrip = deserialize(serialize(wood))!;
    startExpedition(withTrip, STREAM, QUARTER, 0);
    creditOffline(wood, QUARTER);
    creditOffline(withTrip, QUARTER);
    expect(withTrip.bank['mat.wood.pine']).toBe(wood.bank['mat.wood.pine']);
    expect(withTrip.xp.Woodcutting).toBe(wood.xp.Woodcutting);
    expect(withTrip.bank[AGATE]).toBe(272);
    expect(withTrip.xp.Exploration).toBe((wood.xp.Exploration ?? 0) + 7072);

    const bare = explorer(1);
    bare.owned.push('Strength', 'Attack', 'Hitpoints');
    bare.xp.Strength = 0;
    bare.xp.Attack = 0;
    bare.xp.Hitpoints = 0;
    const fight = deserialize(serialize(bare))!;
    const paired = deserialize(serialize(bare))!;
    expect(startCombat(fight, 'meadow.hare', 'Strength')).toBe(true);
    expect(startCombat(paired, 'meadow.hare', 'Strength')).toBe(true);
    startExpedition(paired, STREAM, HOUR, 0);
    creditOffline(fight, 10 * 60 * 1000);
    creditOffline(paired, 10 * 60 * 1000);
    expect(paired.stats.kills).toBe(fight.stats.kills);
    expect(paired.xp.Strength).toBe(fight.xp.Strength);
    expect(paired.rngState).toBe(fight.rngState);
    expect(paired.bank[AGATE] ?? 0).toBe(0);
    creditOffline(paired, HOUR);
    expect(paired.bank[AGATE]).toBe(1090);
    expect((paired.xp.Exploration ?? 0) - (bare.xp.Exploration ?? 0)).toBe(28340);
  });

  it('credits 24h of pine and finishes an 8h stream in one save write', () => {
    const state = explorer(1);
    startGather(state, 'mat.wood.pine');
    startExpedition(state, STREAM, EIGHT, 0);
    const solo = deserialize(serialize(state))!;
    solo.expedition = null;
    creditOffline(solo, 30 * 60 * 60 * 1000);

    const storage = memory(serialize(state));
    const before = storage.writes;
    const loaded = loadAndCredit(storage, 30 * 60 * 60 * 1000);
    expect(storage.writes).toBe(before + 1);
    expect(loaded.report?.capped).toBe(true);
    expect(loaded.report?.creditedMs).toBe(24 * 60 * 60 * 1000);
    expect(loaded.state.bank['mat.wood.pine']).toBe(solo.bank['mat.wood.pine']);
    expect(loaded.state.xp.Woodcutting).toBe(solo.xp.Woodcutting);
    expect(loaded.state.bank[AGATE]).toBe(8727);
    expect(loaded.state.xp.Exploration).toBe(XP_CAP);
    expect(loaded.state.expedition).toBeNull();
    expect(loaded.report?.activity).toContain('Woodcutting');
    expect(loaded.report?.expeditionLine).toContain('Stream survey');
    expect(loaded.report?.expeditionLine).toContain('8727');
    expect(loaded.report?.expeditionLine).toContain('finished');
    const html = reportHtml(loaded.report!);
    expect(html).toContain('Woodcutting');
    expect(html).toContain('Expedition: Stream survey');
    expect(html).toContain('8727');
  });

  it('shows 50:00 left after 10 minutes, then Return now pays the 10 minute ticks', () => {
    const state = explorer(1);
    startExpedition(state, STREAM, HOUR, 0);
    const report = creditOffline(state, 10 * 60 * 1000);
    expect(state.bank[AGATE] ?? 0).toBe(0);
    expect(state.xp.Exploration).toBe(0);
    expect(expeditionRemainingMs(state)).toBe(50 * 60 * 1000);
    expect(report.expeditionLine).toBe('Expedition: Stream survey, 0, none, 0 XP — out, 50:00 left');
    expect(returnExpedition(state)).toBe(true);
    expect(state.bank[AGATE]).toBe(181);
    expect(state.xp.Exploration).toBe(4706);
    expect(state.mastery[STREAM]).toBe(181 * 33);
    expect(state.expedition).toBeNull();
  });

  it('blocks bridge approach without two hemp string, and shows fitting appraisal locked', () => {
    const state = explorer(40);
    state.bank[HEMP] = 1;
    expect(startExpedition(state, BRIDGE, QUARTER, 0)).toBe(false);
    expect(startExpedition(state, FITTING, QUARTER, 0)).toBe(false);
    expect(startProduce(state, FITTING)).toBe(false);
    expect(startGather(state, AGATE)).toBe(false);
    const html = mainHtml(state, view('Exploration'), 0);
    const fitting = rowHtml(html, 'Fitting appraisal');
    expect(fitting).toContain('Needs trout-and-mushroom meal (coming later)');
    expect(fitting).toContain('disabled');
    expect(fitting).not.toContain('data-pack=');
    const bridge = rowHtml(html, 'Bridge approach survey');
    expect(bridge).toContain('disabled');
    expect(bridge).toContain('Hemp string');
    state.bank[HEMP] = 2;
    expect(startExpedition(state, BRIDGE, QUARTER, 0)).toBe(true);
    expect(state.bank[HEMP] ?? 0).toBe(0);
  });

  it('stops an old selected stream survey after the legacy catch-up and keeps its agate', () => {
    const state = explorer(1);
    state.activity = { kind: 'produce', recipeId: STREAM };
    state.progressMs = 0;
    state.bank[AGATE] = 7;
    state.mastery[STREAM] = 120;
    const raw = JSON.parse(serialize(state)) as Record<string, unknown>;
    delete raw.expedition;
    raw.lastCredited = 0;
    const quiet = memory(JSON.stringify({ ...raw, lastCredited: 5_000 }));
    const kept = loadAndCredit(quiet, 5_000);
    expect(kept.state.activity).toBeNull();
    expect(kept.state.expedition).toBeNull();
    expect(kept.state.bank[AGATE]).toBe(7);
    expect(kept.state.mastery[STREAM]).toBe(120);
    expect(kept.state.saveFormat).toBe(4);

    const running = memory(JSON.stringify(raw));
    const caught = loadAndCredit(running, 3_300);
    expect(caught.state.activity).toBeNull();
    expect(caught.state.expedition).toBeNull();
    expect(caught.state.bank[AGATE]).toBe(8);
    expect(caught.state.xp.Exploration).toBe(26);
    expect(caught.state.mastery[STREAM]).toBe(120 + 33);
  });

  it('unlocks weathered slate only after the node is bought', () => {
    const state = explorer(10);
    state.nodes = [];
    expect(startExpedition(state, SLATE, QUARTER, 0)).toBe(false);
    expect(buyNode(state, SLATE)).toBe(true);
    expect(startExpedition(state, SLATE, QUARTER, 0)).toBe(true);
  });

  it('lists duration chips, a haul preview, the trip card, and the background strip', () => {
    const state = explorer(1);
    const html = mainHtml(state, view('Exploration', STREAM), 0);
    expect(html).toContain('15 min');
    expect(html).toContain('1 h');
    expect(html).toContain('8 h');
    expect(html).toContain('Packs nothing');
    expect(html).toContain('Pack and go');
    expect(html).toContain('Haul 272 Weathered agate · 7,072 XP');
    expect(html).toContain('Stream survey mastery');
    const shell = shellHtml('', '', html, backgroundStripHtml(state) + activityHtml(state), '');
    expect(shell).not.toContain('data-bgstrip');

    startExpedition(state, STREAM, HOUR, 0);
    const out = mainHtml(state, view('Exploration', STREAM), HOUR);
    expect(out).toContain('data-expedition-card');
    expect(out).toContain('Return now');
    expect(out).toContain('60:00');
    startGather(state, 'mat.wood.pine');
    const bar = shellHtml('', '', '', backgroundStripHtml(state) + activityHtml(state), '<nav class="tabs"></nav>');
    expect(bar.indexOf('data-bgstrip')).toBeLessThan(bar.indexOf('data-activity'));
    expect(bar).toContain('Expedition');
    expect(bar).toContain('Woodcutting');
    expect(activityHtml(state)).toContain('Pine logs');
  });

  it('keeps the route fixed when Exploration levels during the trip', () => {
    const state = explorer(1);
    startExpedition(state, STREAM, HOUR, 0);
    state.xp.Exploration = XP_TABLE[20];
    creditOffline(state, HOUR);
    expect(state.bank[AGATE]).toBe(1090);
    expect(state.xp.Exploration).toBe((XP_TABLE[20] ?? 0) + 28340);
  });

  it('shortens the tick at mastery 20 and still pays mastery from the base tick', () => {
    const state = explorer(1);
    state.mastery[STREAM] = masteryThreshold(20);
    const preview = expeditionPreview(state, STREAM, QUARTER);
    expect(preview.ticks).toBe(287);
    expect(preview.items[0]?.qty).toBe(287);
    expect(preview.xp).toBe(287 * 26);
    expect(preview.mxp).toBe(287 * 33);
    startExpedition(state, STREAM, QUARTER, 0);
    creditOffline(state, QUARTER);
    expect(state.bank[AGATE]).toBe(287);
    expect(state.mastery[STREAM]! - masteryThreshold(20)).toBe(287 * 33);
  });

  it('rolls mastery 40 doubles per tick and does not double XP or mastery XP', () => {
    const state = explorer(1);
    state.mastery[STREAM] = masteryThreshold(40);
    startExpedition(state, STREAM, QUARTER, 0);
    creditOffline(state, QUARTER);
    expect(state.bank[AGATE]!).toBeGreaterThan(287);
    expect(state.bank[AGATE]!).toBeLessThanOrEqual(287 * 2);
    expect(state.xp.Exploration).toBe(287 * 26);
    expect(state.mastery[STREAM]! - masteryThreshold(40)).toBe(287 * 33);
  });

  it('gives items and no XP once Exploration is already at the cap', () => {
    const state = explorer(1);
    state.xp.Exploration = XP_CAP;
    startExpedition(state, STREAM, QUARTER, 0);
    creditOffline(state, QUARTER);
    expect(state.bank[AGATE]).toBe(272);
    expect(state.xp.Exploration).toBe(XP_CAP);
    expect(state.mastery[STREAM]).toBe(8976);
  });

  it('does not refund inputs on Return now, and a backwards clock credits nothing', () => {
    const state = explorer(10);
    state.bank[KIT] = 1;
    startExpedition(state, RUIN, HOUR, 0);
    expect(returnExpedition(state)).toBe(true);
    expect(state.bank[KIT] ?? 0).toBe(0);
    expect(state.bank[SLATE] ?? 0).toBe(0);

    const out = explorer(1);
    startExpedition(out, STREAM, HOUR, 1_000);
    out.lastCredited = 5_000;
    const report = creditOffline(out, 0);
    expect(report.backwards).toBe(true);
    expect(report.creditedMs).toBe(0);
    expect(out.bank[AGATE] ?? 0).toBe(0);
    expect(expeditionRemainingMs(out)).toBe(HOUR);
    expect(report.expeditionLine).toContain('out, 60:00 left');
  });

  it('adds the mastery 10 sell perk on an expedition output that is not a node', () => {
    const state = explorer(35);
    const route = 'activity.exploration.alum_seep_recovery';
    state.mastery[route] = masteryThreshold(10);
    state.bank['mat.mineral.alum'] = 1;
    state.coins = 0;
    expect(sell(state, 'mat.mineral.alum', 1)).toBe(true);
    expect(state.coins).toBeCloseTo(1.05, 5);
  });
});
