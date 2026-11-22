import { afterEach, describe, expect, it } from 'vitest';
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
  haulToast,
  setExpeditionDoubleRoll,
  sell,
  type FloatNote,
  type Save,
  type StorageLike,
} from '../src/engine';
import { actionMasteryXp, actionXpMultiplier, masteryLevel, masteryThreshold } from '../src/mastery';
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
const ALUM = 'mat.mineral.alum';
const FITTING = 'activity.exploration.fitting_appraisal';
const BRIDGE = 'activity.exploration.bridge_approach_survey';

const TABLE: [string, number, string | null, number, number][] = [
  [AGATE, QUARTER, AGATE, 264, 7128],
  [AGATE, HOUR, AGATE, 1058, 22207.5],
  [AGATE, EIGHT, AGATE, 8470, 47654.7894],
  [STREAM, QUARTER, AGATE, 272, 7072],
  [STREAM, HOUR, AGATE, 1090, 22100],
  [STREAM, EIGHT, AGATE, 8727, 47635.4684],
  [SLATE, QUARTER, SLATE, 236, 7080],
  [SLATE, HOUR, SLATE, 947, 28410],
  [SLATE, EIGHT, SLATE, 7578, 70194.63],
  [RUIN, QUARTER, SLATE, 243, 7290],
  [RUIN, HOUR, SLATE, 972, 29160],
  [RUIN, EIGHT, SLATE, 7783, 70842.99],
  ['activity.exploration.riverbank_branch_agate', QUARTER, AGATE, 428, 10486],
  ['activity.exploration.riverbank_branch_agate', HOUR, AGATE, 1714, 41993],
  ['activity.exploration.riverbank_branch_agate', EIGHT, AGATE, 13714, 127743.245],
  ['activity.exploration.riverbank_branch_slate', QUARTER, SLATE, 418, 10450],
  ['activity.exploration.riverbank_branch_slate', HOUR, SLATE, 1674, 41850],
  ['activity.exploration.riverbank_branch_slate', EIGHT, SLATE, 13394, 127638.05],
  ['activity.exploration.alum_seep_recovery', QUARTER, 'mat.mineral.alum', 360, 10440],
  ['activity.exploration.alum_seep_recovery', HOUR, 'mat.mineral.alum', 1440, 41760],
  ['activity.exploration.alum_seep_recovery', EIGHT, 'mat.mineral.alum', 11520, 334080],
  [BRIDGE, QUARTER, ALUM, 163, 18093],
  [BRIDGE, HOUR, ALUM, 654, 72594],
  [BRIDGE, EIGHT, ALUM, 5236, 581196],
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

function view(skill: View['skill'], routeId?: string, routeMs?: number): View {
  return {
    tab: 'skill',
    skill,
    filter: 'all',
    selected: null,
    area: 'Meadow verge',
    style: null,
    message: '',
    routeId,
    routeMs,
  };
}

function finishInPlay(state: Save, duration: number, notes?: FloatNote[]): void {
  advanceOpenTab(state, duration, duration + 1, notes);
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
  afterEach(() => setExpeditionDoubleRoll(null));

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
    setExpeditionDoubleRoll(() => false);
    for (const [routeId, duration, itemId, qty, xp] of TABLE) {
      const state = explorer(levelFor(routeId));
      const before = state.xp.Exploration ?? 0;
      const preview = expeditionPreview(state, routeId, duration);
      const room = Math.max(0, XP_CAP - before);
      expect(preview.xp, routeId).toBeCloseTo(Math.min(xp, room), 4);
      expect(preview.items.reduce((sum, item) => sum + item.qty, 0), routeId).toBe(qty);
      expect(startExpedition(state, routeId, duration, 0), routeId).toBe(true);
      creditOffline(state, duration);
      if (itemId) expect(state.bank[itemId] ?? 0, routeId).toBe(qty);
      expect(state.xp.Exploration, routeId).toBeCloseTo(before + Math.min(xp, room), 4);
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
    expect((paired.xp.Exploration ?? 0) - (bare.xp.Exploration ?? 0)).toBe(22100);
  });

  it('credits 8h of pine and finishes an 8h stream in one save write', () => {
    setExpeditionDoubleRoll(() => false);
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
    expect(loaded.report?.creditedMs).toBe(8 * 60 * 60 * 1000);
    expect(loaded.state.bank['mat.wood.pine']).toBe(solo.bank['mat.wood.pine']);
    expect(loaded.state.xp.Woodcutting).toBe(solo.xp.Woodcutting);
    expect(loaded.state.bank[AGATE]).toBe(8727);
    expect(loaded.state.xp.Exploration).toBeCloseTo(47635.4684, 4);
    expect(loaded.state.expedition).toBeNull();
    expect(loaded.report?.activity).toContain('Woodcutting');
    expect(loaded.report?.expeditionLine).toContain('Stream survey');
    expect(loaded.report?.expeditionLine).toContain('8,727');
    expect(loaded.report?.expeditionLine).toContain('finished');
    const html = reportHtml(loaded.report!);
    expect(html).toContain('Woodcutting');
    expect(html).toContain('Expedition: Stream survey');
    expect(html).toContain('8,727');
  });

  it('shows 50:00 left after 10 minutes, then Return now pays the 10 minute ticks', () => {
    const state = explorer(1);
    startExpedition(state, STREAM, HOUR, 0);
    const report = creditOffline(state, 10 * 60 * 1000);
    expect(state.bank[AGATE] ?? 0).toBe(0);
    expect(state.xp.Exploration).toBe(0);
    expect(expeditionRemainingMs(state)).toBe(50 * 60 * 1000);
    expect(report.expeditionLine).toBe('Expedition: Stream survey — out, 50:00 left');
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
    expect(fitting).toContain('Needs trout-and-mushroom meal (Cooking)');
    expect(fitting.match(/Needs trout-and-mushroom meal/g)).toHaveLength(1);
    expect(fitting).not.toContain('coming later');
    expect(fitting).toContain('disabled');
    expect(fitting).toContain('Pack and go');
    expect(fitting).not.toContain('data-pack=');
    const bridge = rowHtml(html, 'Bridge approach survey');
    expect(bridge).toContain('disabled');
    expect(bridge).toContain('Hemp string');
    state.bank[HEMP] = 2;
    const ready = mainHtml(state, view('Exploration'), 0);
    const open = rowHtml(ready, 'Bridge approach survey');
    expect(open).toContain('Haul 163 Alum');
    expect(open).not.toContain('0 XP');
    expect(open).not.toContain('Haul no items');
    expect(open).not.toContain('Exploration is maxed');
    expect(open).toContain(`data-pack="${BRIDGE}"`);
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
    expect(html).toContain('Weathered agate mastery');
    expect(html).not.toContain('Stream survey mastery');
    const shell = shellHtml('', '', html, backgroundStripHtml(state) + activityHtml(state), '');
    expect(shell).not.toContain('data-bgstrip');

    startExpedition(state, STREAM, HOUR, 0);
    const out = mainHtml(state, view('Exploration', STREAM), HOUR);
    expect(out).toContain('data-expedition-card');
    expect(out).toContain('Return now');
    expect(out).toContain('60:00');
    expect(out).toContain('Stream survey mastery');
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
    expect(state.xp.Exploration).toBe(46106);
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
    expect(state.xp.Exploration).toBeCloseTo(287 * 26 * 1.08, 4);
    expect(state.mastery[STREAM]! - masteryThreshold(40)).toBe(287 * 33);
    expect(state.mastery[AGATE] ?? 0).toBe(0);
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

  it('names a stream survey catch-up by the route and counts the haul as one action', () => {
    const state = explorer(1);
    startGather(state, 'mat.wood.pine');
    startExpedition(state, STREAM, QUARTER, 0);
    const report = creditOffline(state, QUARTER);
    expect(state.mastery[STREAM]).toBe(8976);
    expect(state.mastery[AGATE] ?? 0).toBe(0);
    expect(report.masteryLevels.find((row) => row.id === STREAM)).toMatchObject({ name: 'Stream survey', before: 1, after: 11 });
    expect(report.perksUnlocked).toContain('Stream survey mastery 10: sell value +5%');
    expect(report.perksUnlocked.join(' ')).not.toContain('Weathered agate mastery');
    expect(report.actions).toBe(346 + 1);
    const html = reportHtml(report);
    expect(html).toContain('Stream survey 1 → 11');
    expect(html).not.toContain('Weathered agate 1 → 11');
  });

  it('titles the alum route Alum seep recovery', () => {
    const state = explorer(40);
    const html = mainHtml(state, view('Exploration'), 0);
    expect(rowHtml(html, 'Alum seep recovery')).toContain('Level 35');
    expect(html).not.toContain('<b>Alum</b>');
  });

  it('applies mastery 30 and a maxed track per tick, including the crossing tick', () => {
    const held = explorer(1);
    held.mastery[STREAM] = masteryThreshold(30);
    expect(expeditionPreview(held, STREAM, QUARTER).ticks).toBe(287);
    expect(expeditionPreview(held, STREAM, QUARTER).xp).toBeCloseTo(287 * 26 * 1.05, 4);
    startExpedition(held, STREAM, QUARTER, 0);
    creditOffline(held, QUARTER);
    expect(held.xp.Exploration).toBeCloseTo(7835.1, 4);
    expect(held.bank[AGATE]).toBe(287);
    expect(held.mastery[STREAM]! - masteryThreshold(30)).toBe(9471);
    expect(held.mastery[AGATE] ?? 0).toBe(0);

    const hour = explorer(1);
    hour.mastery[STREAM] = masteryThreshold(30);
    expect(expeditionPreview(hour, STREAM, HOUR)).toMatchObject({ ticks: 1148, mxp: 1148 * 33 });
    expect(expeditionPreview(hour, STREAM, HOUR).xp).toBeCloseTo(23600.85, 4);
    startExpedition(hour, STREAM, HOUR, 0);
    creditOffline(hour, HOUR);
    expect(hour.bank[AGATE]).toBe(1148);
    expect(hour.xp.Exploration).toBeCloseTo(23600.85, 4);

    setExpeditionDoubleRoll(() => false);
    const eight = explorer(1);
    eight.mastery[STREAM] = masteryThreshold(30);
    const eightPreview = expeditionPreview(eight, STREAM, EIGHT);
    expect(eightPreview.ticks).toBe(9186);
    expect(eightPreview.items[0]?.qty).toBe(9186);
    let mxp = masteryThreshold(30);
    let uncapped = 0;
    let maxedAt = 0;
    for (let tick = 1; tick <= 9186; tick += 1) {
      uncapped = Math.round((uncapped + 26 * actionXpMultiplier({ [STREAM]: mxp }, STREAM, 'Exploration')) * 10000) / 10000;
      mxp += actionMasteryXp(3.3);
      if (!maxedAt && masteryLevel(mxp) >= 40) maxedAt = tick;
    }
    expect(maxedAt).toBe(1545);
    expect(26 * (1545 * 1.05 + 7641 * 1.08)).toBeCloseTo(256737.78, 4);
    expect(uncapped).toBeCloseTo(256737.78, 4);
    startExpedition(eight, STREAM, EIGHT, 0);
    creditOffline(eight, EIGHT);
    expect(eight.bank[AGATE]).toBe(9186);
    expect(eightPreview.xp).toBeCloseTo(47804.6712, 4);
    expect(eight.xp.Exploration).toBeCloseTo(eightPreview.xp, 4);

    const crossing = explorer(1);
    crossing.mastery[STREAM] = masteryThreshold(30) - 1;
    startExpedition(crossing, STREAM, QUARTER, 0);
    creditOffline(crossing, QUARTER);
    expect(crossing.bank[AGATE]).toBe(287);
    expect(crossing.xp.Exploration).toBeCloseTo(26 + 286 * 26 * 1.05, 4);

    const global = explorer(1);
    global.mastery[AGATE] = masteryThreshold(40);
    startExpedition(global, STREAM, QUARTER, 0);
    creditOffline(global, QUARTER);
    expect(global.xp.Exploration).toBeCloseTo(272 * 26 * 1.03, 4);
    expect(global.mastery[AGATE]).toBe(masteryThreshold(40));
    expect(global.mastery[STREAM]).toBe(8976);
  });

  it('pays a mastery 30 stream at the global cap on the shortened tick', () => {
    const others = [
      AGATE,
      SLATE,
      RUIN,
      'activity.exploration.riverbank_branch_agate',
      'activity.exploration.alum_seep_recovery',
    ];
    const capTracks = (state: Save) => {
      state.mastery[STREAM] = masteryThreshold(30);
      for (const id of others) state.mastery[id] = masteryThreshold(40);
    };
    const quarter = explorer(1);
    capTracks(quarter);
    expect(expeditionPreview(quarter, STREAM, QUARTER).ticks).toBe(287);
    expect(expeditionPreview(quarter, STREAM, QUARTER).xp).toBeCloseTo(8954.4, 4);
    startExpedition(quarter, STREAM, QUARTER, 0);
    creditOffline(quarter, QUARTER);
    expect(quarter.bank[AGATE]).toBe(287);
    expect(quarter.xp.Exploration).toBeCloseTo(8954.4, 4);
    expect(quarter.mastery[STREAM]! - masteryThreshold(30)).toBe(9471);

    const hour = explorer(1);
    capTracks(hour);
    expect(expeditionPreview(hour, STREAM, HOUR).xp).toBeCloseTo(25833.6, 4);
    startExpedition(hour, STREAM, HOUR, 0);
    creditOffline(hour, HOUR);
    expect(hour.bank[AGATE]).toBe(1148);
    expect(hour.xp.Exploration).toBeCloseTo(25833.6, 4);

    setExpeditionDoubleRoll(() => false);
    const eight = explorer(1);
    eight.xp.Exploration = XP_CAP;
    capTracks(eight);
    const preview = expeditionPreview(eight, STREAM, EIGHT);
    expect(preview.ticks).toBe(9186);
    expect(preview.items[0]?.qty).toBe(9186);
    expect(preview.xp).toBe(0);
    expect(9186 * 26 * 1.2 - XP_CAP).toBeCloseTo(66369.2, 4);
    startExpedition(eight, STREAM, EIGHT, 0);
    creditOffline(eight, EIGHT);
    expect(eight.bank[AGATE]).toBe(9186);
    expect(eight.xp.Exploration).toBe(XP_CAP);
  });

  it('follows the trip while it is out, then the last packed route, else weathered agate', () => {
    const state = explorer(1);
    expect(mainHtml(state, view('Exploration'), 0)).toContain('Weathered agate mastery');
    startExpedition(state, STREAM, HOUR, 0);
    expect(mainHtml(state, view('Exploration'), 0)).toContain('Stream survey mastery');
    returnExpedition(state);
    const remembered = view('Exploration');
    remembered.packedRoute = STREAM;
    expect(mainHtml(state, remembered, 0)).toContain('Stream survey mastery');
    expect(mainHtml(state, view('Exploration'), 0)).toContain('Weathered agate mastery');
  });

  it('counts Return now as one action', () => {
    const state = explorer(1);
    startExpedition(state, STREAM, HOUR, 0);
    creditOffline(state, 10 * 60 * 1000);
    expect(state.stats.actions).toBe(0);
    expect(returnExpedition(state)).toBe(true);
    expect(state.stats.actions).toBe(1);
    expect(state.bank[AGATE]).toBe(181);
  });

  it('formats a finished catch-up with separators and hides skills that did not rise', () => {
    const state = explorer(10);
    startExpedition(state, STREAM, HOUR, 0);
    const report = creditOffline(state, HOUR);
    expect(report.expeditionLine).toBe('Expedition: Stream survey, 1,090 ticks, Weathered agate ×1,090, 15,236 XP — finished');
    const html = reportHtml(report);
    expect(html).toContain('Exploration 10→15');
    expect(html).not.toContain('Woodcutting 1');
  });

  it('drops the XP clause from a capped haul and from the route preview', () => {
    const state = explorer(1);
    state.xp.Exploration = XP_CAP;
    const preview = mainHtml(state, view('Exploration'), 0);
    const stream = rowHtml(preview, 'Stream survey');
    expect(stream).toContain('Haul 272 Weathered agate');
    expect(stream).not.toContain('Haul 272 Weathered agate ·');
    expect(stream).not.toContain('% XP');
    startExpedition(state, STREAM, QUARTER, 0);
    const notes: FloatNote[] = [];
    for (let t = 4_000; t < QUARTER; t += 4_000) advanceOpenTab(state, t, 5_000, []);
    advanceOpenTab(state, QUARTER, 5_000, notes);
    expect(notes).toContainEqual({ kind: 'toast', text: 'Stream survey is back: Weathered agate ×272' });
    expect(state.expedition).toBeNull();
  });

  it('toasts a haul that finishes in play and says nothing when the haul is empty', () => {
    const state = explorer(1);
    startExpedition(state, STREAM, QUARTER, 0);
    const notes: FloatNote[] = [];
    for (let t = 4_000; t < QUARTER; t += 4_000) advanceOpenTab(state, t, 5_000, []);
    advanceOpenTab(state, QUARTER, 5_000, notes);
    expect(notes).toContainEqual({ kind: 'toast', text: 'Stream survey is back: Weathered agate ×272 · 7,072 XP' });
    expect(haulToast('Bridge approach survey', {}, 0)).toBeNull();
    expect(haulToast('Bridge approach survey', {}, 18093)).toBe('Bridge approach survey is back: 18,093 XP');
  });

  it('locks a riverbank row with the padlock badge and no Pack button', () => {
    const state = explorer(19);
    const html = mainHtml(state, view('Exploration'), 0);
    const row = rowHtml(html, 'Riverbank branch — agate');
    expect(row).toContain('aria-label="Locked"');
    expect(row).toContain('Lv 20');
    expect(row).not.toContain('Haul');
    expect(row).not.toContain('XP');
    expect(row).not.toContain('Pack and go');
  });

  it('adds the mastery 10 sell perk on an expedition output that is not a node', () => {
    const state = explorer(35);
    const route = 'activity.exploration.alum_seep_recovery';
    state.mastery[route] = masteryThreshold(10);
    state.bank['mat.mineral.alum'] = 1;
    state.coins = 0;
    expect(sell(state, 'mat.mineral.alum', 1)).toBe(true);
    expect(state.coins).toBeCloseTo(12 * 1.05, 5);
  });
});

describe('bridge approach pays alum', () => {
  afterEach(() => setExpeditionDoubleRoll(null));

  function capped(): Save {
    const state = explorer(40);
    state.bank[HEMP] = 2;
    state.mastery[BRIDGE] = 0;
    return state;
  }

  function sellAlum(state: Save): number {
    const qty = state.bank[ALUM] ?? 0;
    state.coins = 0;
    expect(sell(state, ALUM, qty)).toBe(true);
    return state.coins;
  }

  it('A-T1 packs 15 min for 163 alum and no XP', () => {
    const state = capped();
    const html = mainHtml(state, view('Exploration', BRIDGE, QUARTER), 0);
    expect(rowHtml(html, 'Bridge approach survey')).toContain('Haul 163 Alum');
    for (const seed of [0, 1, 99]) {
      const trip = capped();
      trip.rngState = seed;
      expect(startExpedition(trip, BRIDGE, QUARTER, 0)).toBe(true);
      expect(trip.bank[HEMP] ?? 0).toBe(0);
      const notes: FloatNote[] = [];
      finishInPlay(trip, QUARTER, notes);
      expect(trip.bank[ALUM]).toBe(163);
      expect(trip.xp.Exploration).toBe(XP_CAP);
      expect(trip.mastery[BRIDGE]).toBe(8965);
      expect(masteryLevel(trip.mastery[BRIDGE])).toBe(11);
      expect(notes).toContainEqual({ kind: 'toast', text: 'Bridge approach survey is back: Alum ×163' });
      expect(sellAlum(trip)).toBe(1956);
    }
    expect(state.bank[HEMP]).toBe(2);
  });

  it('A-T2 packs 1 h for 654 alum', () => {
    const state = capped();
    const html = mainHtml(state, view('Exploration', BRIDGE, HOUR), 0);
    expect(rowHtml(html, 'Bridge approach survey')).toContain('Haul 654 Alum');
    expect(startExpedition(state, BRIDGE, HOUR, 0)).toBe(true);
    finishInPlay(state, HOUR);
    expect(state.bank[ALUM]).toBe(654);
    expect(state.xp.Exploration).toBe(XP_CAP);
    expect(state.mastery[BRIDGE]).toBe(35970);
    expect(masteryLevel(state.mastery[BRIDGE])).toBe(22);
    expect(sellAlum(state)).toBe(7848);
  });

  it('A-T3 packs 8 h, crosses mastery 40 on tick 2074, and doubles only after that', () => {
    setExpeditionDoubleRoll(() => false);
    const state = capped();
    const html = mainHtml(state, view('Exploration', BRIDGE, EIGHT), 0);
    expect(rowHtml(html, 'Bridge approach survey')).toContain('Haul 5,236 Alum');
    expect(startExpedition(state, BRIDGE, EIGHT, 0)).toBe(true);
    finishInPlay(state, EIGHT);
    expect(state.bank[ALUM]).toBe(5236);
    expect(state.xp.Exploration).toBe(XP_CAP);
    expect(state.mastery[BRIDGE]).toBe(287980);
    expect(masteryLevel(state.mastery[BRIDGE])).toBe(40);
    expect(sellAlum(state)).toBe(62832);

    const tick = 5500;
    const before = capped();
    expect(startExpedition(before, BRIDGE, EIGHT, 0)).toBe(true);
    creditOffline(before, 2073 * tick);
    expect(returnExpedition(before)).toBe(true);
    expect(masteryLevel(before.mastery[BRIDGE] ?? 0)).toBe(39);
    expect(before.mastery[BRIDGE]).toBe(114015);

    const crossed = capped();
    expect(startExpedition(crossed, BRIDGE, EIGHT, 0)).toBe(true);
    creditOffline(crossed, 2074 * tick);
    expect(returnExpedition(crossed)).toBe(true);
    expect(masteryLevel(crossed.mastery[BRIDGE] ?? 0)).toBe(40);
    expect(crossed.bank[ALUM]).toBe(2074);

    setExpeditionDoubleRoll(() => true);
    const always = capped();
    expect(startExpedition(always, BRIDGE, EIGHT, 0)).toBe(true);
    const alwaysNotes: FloatNote[] = [];
    finishInPlay(always, EIGHT, alwaysNotes);
    expect(always.bank[ALUM]).toBe(8398);
    expect(alwaysNotes).toContainEqual({ kind: 'toast', text: 'Bridge approach survey is back: Alum ×8,398' });
    const caught = capped();
    expect(startExpedition(caught, BRIDGE, EIGHT, 0)).toBe(true);
    expect(creditOffline(caught, EIGHT).expeditionLine).toBe(
      'Expedition: Bridge approach survey, 5,236 ticks, Alum ×8,398 — finished',
    );

    setExpeditionDoubleRoll(null);
    const seeded = capped();
    seeded.rngState = 1;
    expect(startExpedition(seeded, BRIDGE, EIGHT, 0)).toBe(true);
    finishInPlay(seeded, EIGHT);
    const alum = seeded.bank[ALUM] ?? 0;
    expect(alum).toBeGreaterThanOrEqual(5236);
    expect(alum).toBeLessThanOrEqual(8398);
  });

  it('A-T3b rolls every tick when Bridge mastery is already 40', () => {
    const state = capped();
    state.mastery[BRIDGE] = masteryThreshold(40);
    expect(rowHtml(mainHtml(state, view('Exploration', BRIDGE, QUARTER), 0), 'Bridge approach survey')).toContain('Haul 172 Alum');
    expect(rowHtml(mainHtml(state, view('Exploration', BRIDGE, HOUR), 0), 'Bridge approach survey')).toContain('Haul 688 Alum');
    expect(rowHtml(mainHtml(state, view('Exploration', BRIDGE, EIGHT), 0), 'Bridge approach survey')).toContain('Haul 5,511 Alum');

    const base = [172, 688, 5511];
    const doubled = [344, 1376, 11022];
    setExpeditionDoubleRoll(() => false);
    [QUARTER, HOUR, EIGHT].forEach((duration, index) => {
      const trip = capped();
      trip.mastery[BRIDGE] = masteryThreshold(40);
      expect(expeditionPreview(trip, BRIDGE, duration).items[0]).toEqual({ id: ALUM, qty: base[index] });
      expect(startExpedition(trip, BRIDGE, duration, 0)).toBe(true);
      finishInPlay(trip, duration);
      expect(trip.bank[ALUM]).toBe(base[index]);
      expect(trip.xp.Exploration).toBe(XP_CAP);
    });

    setExpeditionDoubleRoll(() => true);
    [QUARTER, HOUR, EIGHT].forEach((duration, index) => {
      const trip = capped();
      trip.mastery[BRIDGE] = masteryThreshold(40);
      expect(startExpedition(trip, BRIDGE, duration, 0)).toBe(true);
      const notes: FloatNote[] = [];
      finishInPlay(trip, duration, notes);
      expect(trip.bank[ALUM]).toBe(doubled[index]);
      expect(notes).toContainEqual({
        kind: 'toast',
        text: `Bridge approach survey is back: Alum ×${doubled[index].toLocaleString('en-US')}`,
      });
    });

    setExpeditionDoubleRoll(null);
    [QUARTER, HOUR, EIGHT].forEach((duration, index) => {
      const trip = capped();
      trip.mastery[BRIDGE] = masteryThreshold(40);
      trip.rngState = 1;
      expect(startExpedition(trip, BRIDGE, duration, 0)).toBe(true);
      finishInPlay(trip, duration);
      const alum = trip.bank[ALUM] ?? 0;
      expect(alum).toBeGreaterThanOrEqual(base[index]);
      expect(alum).toBeLessThanOrEqual(doubled[index]);
    });
  });

  it('A-T4 shortens the tick when mastery 20 is already reached', () => {
    setExpeditionDoubleRoll(() => false);
    const state = capped();
    state.mastery[BRIDGE] = masteryThreshold(20);
    const quarter = expeditionPreview(state, BRIDGE, QUARTER);
    const hour = expeditionPreview(state, BRIDGE, HOUR);
    const eight = expeditionPreview(state, BRIDGE, EIGHT);
    expect(quarter.items[0]).toEqual({ id: ALUM, qty: 172 });
    expect(hour.items[0]).toEqual({ id: ALUM, qty: 688 });
    expect(eight.items[0]).toEqual({ id: ALUM, qty: 5511 });
    expect(quarter.mxp).toBe(9460);
    expect(hour.mxp).toBe(37840);
    expect(eight.mxp).toBe(303105);
    expect(172 * 1.05).toBeCloseTo(180.6, 4);
    expect(688 * 1.05).toBeCloseTo(722.4, 4);
    expect(5511 * 1.05).toBeCloseTo(5786.55, 4);
    const started = state.mastery[BRIDGE] ?? 0;
    expect(startExpedition(state, BRIDGE, EIGHT, 0)).toBe(true);
    finishInPlay(state, EIGHT);
    expect(state.bank[ALUM]).toBe(5511);
    expect(state.mastery[BRIDGE]! - started).toBe(303105);

    const tickMs = 5225;
    setExpeditionDoubleRoll(() => true);
    const before = capped();
    before.mastery[BRIDGE] = masteryThreshold(20);
    expect(startExpedition(before, BRIDGE, EIGHT, 0)).toBe(true);
    creditOffline(before, 1582 * tickMs);
    expect(returnExpedition(before)).toBe(true);
    expect(before.bank[ALUM]).toBe(1582);
    expect(masteryLevel(before.mastery[BRIDGE] ?? 0)).toBe(40);

    const crossed = capped();
    crossed.mastery[BRIDGE] = masteryThreshold(20);
    expect(startExpedition(crossed, BRIDGE, EIGHT, 0)).toBe(true);
    creditOffline(crossed, 1583 * tickMs);
    expect(returnExpedition(crossed)).toBe(true);
    expect(crossed.bank[ALUM]).toBe(1584);
    expect(masteryLevel(crossed.mastery[BRIDGE] ?? 0)).toBe(40);
  });

  it('A-T5 returns a 10 minute bridge haul without refunding the hemp', () => {
    setExpeditionDoubleRoll(() => false);
    const state = capped();
    expect(startExpedition(state, BRIDGE, HOUR, 0)).toBe(true);
    creditOffline(state, 10 * 60 * 1000);
    expect(state.bank[ALUM] ?? 0).toBe(0);
    expect(state.bank[HEMP] ?? 0).toBe(0);
    const notes: FloatNote[] = [];
    expect(returnExpedition(state, notes)).toBe(true);
    expect(state.bank[ALUM]).toBe(109);
    expect(state.mastery[BRIDGE]).toBe(5995);
    expect(state.xp.Exploration).toBe(XP_CAP);
    expect(state.expedition).toBeNull();
    expect(state.bank[HEMP] ?? 0).toBe(0);
    expect(notes).toContainEqual({ kind: 'toast', text: 'Bridge approach survey is back: Alum ×109' });
    expect(sellAlum(state)).toBe(1308);

    setExpeditionDoubleRoll(() => false);
    const mastered = capped();
    mastered.mastery[BRIDGE] = masteryThreshold(40);
    const before = mastered.mastery[BRIDGE];
    expect(startExpedition(mastered, BRIDGE, HOUR, 0)).toBe(true);
    creditOffline(mastered, 10 * 60 * 1000);
    expect(returnExpedition(mastered)).toBe(true);
    expect(mastered.bank[ALUM]).toBe(114);
    expect(mastered.mastery[BRIDGE]! - before).toBe(114 * 55);

    setExpeditionDoubleRoll(() => true);
    const doubled = capped();
    doubled.mastery[BRIDGE] = masteryThreshold(40);
    expect(startExpedition(doubled, BRIDGE, HOUR, 0)).toBe(true);
    creditOffline(doubled, 10 * 60 * 1000);
    expect(returnExpedition(doubled)).toBe(true);
    expect(doubled.bank[ALUM]).toBe(228);
  });

  it('A-T6 keeps Pack closed without two hemp string or while a trip is out', () => {
    const short = capped();
    short.bank[HEMP] = 1;
    expect(startExpedition(short, BRIDGE, QUARTER, 0)).toBe(false);
    expect(short.bank[HEMP]).toBe(1);
    expect(rowHtml(mainHtml(short, view('Exploration'), 0), 'Bridge approach survey')).toContain('disabled');

    const empty = capped();
    empty.bank[HEMP] = 0;
    expect(startExpedition(empty, BRIDGE, QUARTER, 0)).toBe(false);
    expect(empty.bank[HEMP] ?? 0).toBe(0);
    expect(rowHtml(mainHtml(empty, view('Exploration'), 0), 'Bridge approach survey')).toContain('disabled');

    const busy = capped();
    expect(startExpedition(busy, STREAM, QUARTER, 0)).toBe(true);
    const hemp = busy.bank[HEMP] ?? 0;
    expect(startExpedition(busy, BRIDGE, QUARTER, 0)).toBe(false);
    expect(busy.bank[HEMP] ?? 0).toBe(hemp);
    const row = rowHtml(mainHtml(busy, view('Exploration'), 0), 'Bridge approach survey');
    expect(row).toContain('disabled');
    expect(row).not.toContain('data-pack=');

    const ready = capped();
    const open = rowHtml(mainHtml(ready, view('Exploration'), 0), 'Bridge approach survey');
    expect(open).toContain(`data-pack="${BRIDGE}"`);
    expect(open).not.toContain('disabled');
  });

  it('A-T7 reports an 8 h bridge catch-up beside 24 h of pine', () => {
    setExpeditionDoubleRoll(() => false);
    const state = capped();
    startGather(state, 'mat.wood.pine');
    expect(startExpedition(state, BRIDGE, EIGHT, 0)).toBe(true);
    const away = 30 * 60 * 60 * 1000;
    const pine = explorer(40);
    startGather(pine, 'mat.wood.pine');
    const pineReport = creditOffline(pine, away);
    const report = creditOffline(state, away);
    expect(report.expeditionLine).toBe('Expedition: Bridge approach survey, 5,236 ticks, Alum ×5,236 — finished');
    const html = reportHtml(report);
    expect(html).toContain('Bridge approach survey 1 → 40');
    const levels = html.slice(html.indexOf('<dt>Levels</dt>'), html.indexOf('<dt>Gained</dt>'));
    expect(levels).toContain('Woodcutting 1→21');
    expect(levels).not.toContain('Exploration');
    expect(1040 * actionMasteryXp(2.6)).toBeLessThan(masteryThreshold(20));
    expect(1041 * actionMasteryXp(2.6)).toBeGreaterThanOrEqual(masteryThreshold(20));
    expect(1041 * 2.6).toBeCloseTo(2706.6, 4);
    expect(1041 + Math.floor((24 * 60 * 60 - 2706.6) / (2.6 * 0.95))).toBe(34924);
    expect(1041 + Math.floor((8 * 60 * 60 - 2706.6) / (2.6 * 0.95))).toBe(11605);
    expect(pineReport.actions).toBe(11605);
    expect(pineReport.creditedMs).toBe(8 * 60 * 60 * 1000);
    expect(report.actions).toBe(11606);
    expect(state.bank[ALUM]).toBe(5236);
    expect(state.xp.Exploration).toBe(XP_CAP);
  });

  it('A-T8 keeps Bridge locked below level 40 and leaves Stream survey packable', () => {
    for (const level of [39, 38]) {
      const state = explorer(level);
      const hemp = state.bank[HEMP] ?? 0;
      const html = mainHtml(state, view('Exploration'), 0);
      const row = rowHtml(html, 'Bridge approach survey');
      expect(row).toContain('aria-label="Locked"');
      expect(row).toContain('Lv 40');
      expect(row).not.toContain('Haul');
      expect(row).not.toContain('XP');
      expect(row).not.toContain('Pack and go');
      expect(row).not.toContain('data-pack=');
      expect(startExpedition(state, BRIDGE, QUARTER, 0)).toBe(false);
      expect(state.bank[HEMP] ?? 0).toBe(hemp);
      expect(startExpedition(state, STREAM, QUARTER, 0)).toBe(true);
    }
    const fitting = rowHtml(mainHtml(explorer(19), view('Exploration'), 0), 'Fitting appraisal');
    expect(fitting).toContain('aria-label="Locked"');
    expect(fitting).toContain('Lv 30');
    expect(fitting).toContain('Needs trout-and-mushroom meal (Cooking)');
    expect(fitting).not.toContain('coming later');
    expect(fitting).not.toContain('Haul');
    expect(fitting).not.toContain('XP');
    expect(fitting).not.toContain('Pack and go');
  });

  it('A-T9 probes the haul below the cap without opening the route', () => {
    const cases = [
      { xp: 204446, pays: [15788, 15788, 15788], lost: [2305, 56806, 565408], uncapped: [18093, 72594, 581196] },
      { xp: 189713, pays: [18093, 30521, 30521], lost: [0, 42073, 550675], uncapped: [18093, 72594, 581196] },
    ];
    for (const row of cases) {
      const state = explorer(1);
      state.xp.Exploration = row.xp;
      const hemp = state.bank[HEMP] ?? 0;
      expect(startExpedition(state, BRIDGE, QUARTER, 0)).toBe(false);
      expect(state.bank[HEMP] ?? 0).toBe(hemp);
      [QUARTER, HOUR, EIGHT].forEach((duration, index) => {
        const preview = expeditionPreview(state, BRIDGE, duration);
        expect(preview.items).toEqual([{ id: ALUM, qty: [163, 654, 5236][index] }]);
        expect(preview.xp).toBe(row.pays[index]);
        expect(row.uncapped[index] - preview.xp).toBe(row.lost[index]);
        expect(row.xp + preview.xp).toBeLessThanOrEqual(XP_CAP);
      });
    }
  });

  it('E-B1 grants alum to a bridge trip that was already out', () => {
    setExpeditionDoubleRoll(() => false);
    const state = capped();
    delete state.bank[HEMP];
    state.expedition = { routeId: BRIDGE, startedAt: 0, durationMs: QUARTER, creditedMs: 0 };
    const raw = JSON.parse(serialize(state)) as Record<string, unknown>;
    expect(raw.saveFormat).toBe(4);
    expect(raw.autoReplant).toBeUndefined();
    expect(Object.keys(raw.expedition as object).sort()).toEqual(['creditedMs', 'durationMs', 'routeId', 'startedAt']);
    const loaded = deserialize(JSON.stringify(raw))!;
    const report = creditOffline(loaded, QUARTER);
    expect(report.expeditionLine).toBe('Expedition: Bridge approach survey, 163 ticks, Alum ×163 — finished');
    expect(loaded.bank[ALUM]).toBe(163);
    expect(loaded.xp.Exploration).toBe(XP_CAP);
    expect(loaded.saveFormat).toBe(4);

    const partial = deserialize(JSON.stringify(raw))!;
    partial.expedition!.creditedMs = 10 * 60 * 1000;
    const notes: FloatNote[] = [];
    expect(returnExpedition(partial, notes)).toBe(true);
    expect(partial.bank[ALUM]).toBe(109);
    expect(notes).toContainEqual({ kind: 'toast', text: 'Bridge approach survey is back: Alum ×109' });

    setExpeditionDoubleRoll(null);
    const live = deserialize(JSON.stringify(raw))!;
    live.rngState = 1;
    live.expedition = { routeId: BRIDGE, startedAt: 0, durationMs: EIGHT, creditedMs: 0 };
    creditOffline(live, EIGHT);
    const alum = live.bank[ALUM] ?? 0;
    expect(alum).toBeGreaterThanOrEqual(5236);
    expect(alum).toBeLessThanOrEqual(8398);
  });

  it('A-T10 still previews a capped stream survey without an XP clause', () => {
    const state = explorer(1);
    state.xp.Exploration = XP_CAP;
    const row = rowHtml(mainHtml(state, view('Exploration'), 0), 'Stream survey');
    expect(row).toContain('Haul 272 Weathered agate');
    expect(row).not.toContain('Haul 272 Weathered agate ·');
    expect(row).not.toContain('% XP');
    expect(row).toContain(`data-pack="${STREAM}"`);
  });
});
