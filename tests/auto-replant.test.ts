import { describe, expect, it } from 'vitest';
import {
  advanceOpenTab,
  buyAutoReplant,
  buyPlot,
  toggleAutoReplant,
  cancelPlot,
  creditOffline,
  deserialize,
  withoutOutputDoubles,
  newGame,
  plantOnPlot,
  serialize,
  setSkillLevel,
  startGather,
  type CatchupReport,
  type FloatNote,
  type Save,
} from '../src/engine';
import { clearedLandStatus, mainHtml, plantedLine, reportHtml, type View } from '../src/ui';

const FLAX = 'recipe.mat.fibre.flax';
const LOG = 'recipe.farm.mushroom.log_route';

function farmer(level = 1): Save {
  const state = newGame(0);
  setSkillLevel(state, 'Farming', level);
  return state;
}

function landView(): View {
  return {
    tab: 'skill',
    skill: 'Farming',
    land: true,
    filter: 'all',
    selected: null,
    area: 'Meadow verge',
    style: null,
    message: '',
  };
}

function ownEight(state: Save): void {
  state.coins = 26_252;
  while (state.plotsBought < 7) expect(buyPlot(state)).toBe(true);
}

describe('farming auto-replant', () => {
  it('sells auto-replant for 27,822 coins and keeps the flag across a reload', () => {
    const poor = farmer();
    poor.coins = 27_821;
    expect(mainHtml(poor, landView(), 0)).toContain('Auto-replant — 27,822 coins');
    expect(buyAutoReplant(poor)).toBe(false);
    expect(poor.autoReplant).toBeUndefined();
    expect(poor.coins).toBe(27_821);

    const state = farmer();
    state.coins = 27_822;
    expect(buyAutoReplant(state)).toBe(true);
    expect(state.coins).toBe(0);
    expect(state.autoReplant).toBe(true);
    expect(buyAutoReplant(state)).toBe(false);
    const loaded = deserialize(serialize(state));
    expect(loaded?.autoReplant).toBe(true);
    expect(loaded?.autoReplantOn).toBe(true);
    const bought = mainHtml(loaded!, landView(), 0);
    expect(bought).toContain('data-auto-replant-toggle');
    expect(bought).toContain('>Auto-replant<');
    expect(bought).not.toContain('Auto-replant on');
    const raw = JSON.parse(serialize(loaded!)) as Record<string, unknown>;
    delete raw.autoReplant;
    const missing = deserialize(JSON.stringify(raw));
    expect(missing?.autoReplant).toBeUndefined();
  });

  it('harvests once and leaves the plot empty when auto-replant is not bought', () => {
    const state = farmer();
    state.bank['mat.seed.flax'] = 1;
    expect(plantOnPlot(state, 0, FLAX, null)).toBe(true);
    const report = creditOffline(state, 30 * 60 * 60 * 1000);
    expect(state.bank['mat.fibre.flax']).toBe(1_800);
    expect(state.xp.Farming).toBe(26_550);
    expect(state.plots[0]).toBeNull();
    expect(report.plotHarvests?.some((line) => line.includes('not replanted'))).toBe(false);
  });

  it('replants six flax harvests inside 24h and stops at the cap', () => {
    const state = planted(10);
    const times = [13_320, 26_640, 39_294, 51_948, 64_602, 77_256];
    const grows = [13_320_000, 12_654_000, 12_654_000, 12_654_000, 12_654_000, 12_654_000];
    for (let index = 0; index < times.length; index += 1) {
      creditOffline(state, times[index] * 1000);
      expect(state.bank['mat.fibre.flax']).toBe(1_800 * (index + 1));
      expect(state.plots[0]?.remainingMs).toBe(grows[index]);
      expect(state.plots[0]?.legacy).toBeUndefined();
    }
    creditOffline(state, 24 * 60 * 60 * 1000);
    expect(state.bank['mat.fibre.flax']).toBe(10_800);
    expect(state.xp.Farming).toBe(161_955);
    expect(state.mastery[FLAX]).toBe(99_900);
    expect(state.bank['mat.seed.flax']).toBe(4);
    expect(state.plots[0]?.remainingMs).toBe(3_510_000);

    const capped = planted(10);
    creditOffline(capped, 30 * 60 * 60 * 1000);
    expect(capped.bank['mat.fibre.flax']).toBe(3_600);
    expect(capped.plots[0]?.remainingMs).toBe(10_494_000);
    expect(capped.bank['mat.seed.flax']).toBe(8);
  });

  it('stops after the seeds run out and does not retry', () => {
    const state = planted(3);
    for (const seconds of [13_320, 26_640, 39_294]) creditOffline(state, seconds * 1000);
    creditOffline(state, 51_948_000 - 1000);
    const notes: FloatNote[] = [];
    advanceOpenTab(state, 51_948_000, 60 * 60 * 1000, notes);
    expect(state.bank['mat.fibre.flax']).toBe(7_200);
    expect(state.xp.Farming).toBe(106_200);
    expect(state.bank['mat.seed.flax'] ?? 0).toBe(0);
    expect(state.plots[0]).toBeNull();
    expect(notes.filter((note) => note.kind === 'toast').map((note) => (note.kind === 'toast' ? note.text : ''))).toEqual([
      'Plot 1 not replanted: no Flax seed',
      'Fields harvested: Flax fibre ×1,800',
      'Farming reached Lv 30',
      'Flax fibre mastery 30: +5% XP',
    ]);
    state.bank['mat.seed.flax'] = 1;
    creditOffline(state, state.lastCredited + 13_320_000);
    expect(state.plots[0]).toBeNull();
    expect(state.bank['mat.seed.flax']).toBe(1);
    expect(state.bank['mat.fibre.flax']).toBe(7_200);
  });

  it('gives the one banked seed to the lower plot number', () => {
    const state = farmer(5);
    state.coins = 188;
    expect(buyPlot(state)).toBe(true);
    state.bank['mat.seed.flax'] = 3;
    expect(plantOnPlot(state, 0, FLAX, null)).toBe(true);
    expect(plantOnPlot(state, 1, FLAX, null)).toBe(true);
    state.bank['mat.seed.flax'] = 1;
    state.autoReplant = true;
    const report = creditOffline(state, 13_320_000);
    expect(state.bank['mat.fibre.flax']).toBe(3_600);
    expect(state.bank['mat.seed.flax'] ?? 0).toBe(0);
    expect(state.plots[0]?.recipeId).toBe(FLAX);
    expect(state.plots[1]).toBeNull();
    expect(report.plotHarvests).toContain('Plot 2: Flax fibre ×1,800 · not replanted: no Flax seed');
  });

  it('does not replant a plot that was cancelled', () => {
    const state = planted(5);
    const xp = state.xp.Farming ?? 0;
    const seeds = state.bank['mat.seed.flax'];
    cancelPlot(state, 0);
    expect(state.plots[0]).toBeNull();
    expect(state.xp.Farming).toBe(xp);
    creditOffline(state, 30 * 60 * 60 * 1000);
    expect(state.plots[0]).toBeNull();
    expect(state.bank['mat.fibre.flax'] ?? 0).toBe(0);
    expect(state.bank['mat.seed.flax']).toBe(seeds);
    expect(state.xp.Farming).toBe(xp);
  });

  it('names the missing oak when a mushroom log cannot be replanted', () => {
    const state = farmer(30);
    state.bank['mat.spawn.mushroom'] = 2;
    state.bank['mat.wood.oak'] = 1;
    expect(plantOnPlot(state, 0, LOG, null)).toBe(true);
    expect(state.bank['mat.wood.oak'] ?? 0).toBe(0);
    expect(state.bank['mat.spawn.mushroom']).toBe(1);
    state.autoReplant = true;
    const report = creditOffline(state, 5.6 * 3_600_000);
    expect(state.bank['mat.fungi.mushroom']).toBe(1_800);
    expect(state.plots[0]).toBeNull();
    expect(state.bank['mat.spawn.mushroom']).toBe(1);
    expect(report.plotHarvests).toContain('Plot 1: Meadow mushrooms ×1,800 · not replanted: no Oak log');
  });

  it('replants a full flax field for the 8h demo window and still credits the selected activity', () => {
    const state = farmer(35);
    ownEight(state);
    state.bank['mat.seed.flax'] = 56;
    for (let index = 0; index < 8; index += 1) expect(plantOnPlot(state, index, FLAX, null)).toBe(true);
    expect(state.bank['mat.seed.flax']).toBe(48);
    state.autoReplant = true;
    startGather(state, 'mat.wood.pine');
    const twin = newGame(0);
    startGather(twin, 'mat.wood.pine');
    const report = withoutOutputDoubles(() => creditOffline(state, 24 * 60 * 60 * 1000));
    const alone = withoutOutputDoubles(() => creditOffline(twin, 24 * 60 * 60 * 1000));
    expect(report.creditedMs).toBe(8 * 60 * 60 * 1000);
    expect(state.bank['mat.fibre.flax']).toBe(28_800);
    expect(state.bank['mat.seed.flax'] ?? 0).toBe(32);
    expect(state.plots.every((plot) => plot?.recipeId === FLAX)).toBe(true);
    expect(state.xp.Woodcutting).toBe(twin.xp.Woodcutting);
    expect(report.actions).toBe(alone.actions + 16);
  });

  it('replants a migrated old plot as a new-rule flax plant', () => {
    const state = farmer();
    state.bank['mat.seed.flax'] = 1;
    state.autoReplant = true;
    const raw = JSON.parse(serialize(state)) as Record<string, unknown>;
    delete raw.plots;
    delete raw.plotsBought;
    raw.plot = { recipeId: FLAX, remainingMs: 0, ready: true };
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded?.bank['mat.fibre.flax']).toBe(4);
    expect(loaded?.xp.Farming).toBe(59);
    expect(loaded?.bank['mat.seed.flax'] ?? 0).toBe(0);
    expect(loaded?.plots[0]?.legacy).toBeUndefined();
    expect(loaded?.plots[0]?.remainingMs).toBe(13_320_000);
    expect(loaded?.plots[0]?.recipeId).toBe(FLAX);
  });

  it('counts a harvest as an action and a replant as none', () => {
    const state = planted(10);
    startGather(state, 'mat.wood.pine');
    const twin = newGame(0);
    startGather(twin, 'mat.wood.pine');
    const report = creditOffline(state, 24 * 60 * 60 * 1000);
    const alone = creditOffline(twin, 24 * 60 * 60 * 1000);
    expect(report.creditedMs).toBe(8 * 60 * 60 * 1000);
    expect(state.bank['mat.fibre.flax']).toBe(3_600);
    expect(report.actions).toBe(alone.actions + 2);
  });

  it('lists only skills whose level rose on the catch-up Levels line', () => {
    const state = farmer();
    state.bank['mat.seed.flax'] = 1;
    expect(plantOnPlot(state, 0, FLAX, null)).toBe(true);
    const html = reportHtml(creditOffline(state, 13_320_000));
    expect(html).toContain('<dt>Levels</dt><dd>Farming 1→15</dd>');
    expect(html).not.toContain('Woodcutting');
  });

  it('renders every catch-up amount of 1,000 or more with a thousands separator', () => {
    const html = reportHtml(reportWith({
      awayMs: 1_000 * 3_600_000,
      creditedMs: 1_000 * 3_600_000,
      actions: 1_000,
      kills: 2_000,
      xpGained: { Farming: 3_000 },
      levelsBefore: { Farming: 1_000, Woodcutting: 5 },
      levelsAfter: { Farming: 1_001, Woodcutting: 5 },
      itemsGained: { 'mat.fibre.flax': 1_800 },
      itemsConsumed: { 'mat.seed.flax': 4_000 },
      coinsGained: 5_000,
      foodEaten: 6_000,
      masteryLevels: [{ id: FLAX, name: 'Flax fibre', before: 7_000, after: 8_000 }],
      plotHarvests: ['Plot 1: Flax fibre ×1,800'],
      expeditionLine: 'Expedition: Stream survey, 5,236, Weathered agate ×8,727, 220,234 XP — finished',
    }));
    const text = html.replace(/<[^>]+>/g, ' ');
    expect(text.match(/\d{4,}/g) ?? []).toEqual([]);
    expect(html).toContain('Flax fibre ×1,800');
    expect(html).not.toContain('Woodcutting');
  });

  it('shows one fields toast when eight plots finish on the same tick', () => {
    const state = farmer(35);
    ownEight(state);
    state.bank['mat.seed.flax'] = 16;
    for (let index = 0; index < 8; index += 1) expect(plantOnPlot(state, index, FLAX, null)).toBe(true);
    state.autoReplant = true;
    for (const plot of state.plots) if (plot) plot.remainingMs = 500;
    const notes: FloatNote[] = [];
    expect(withoutOutputDoubles(() => advanceOpenTab(state, 500, 5_000, notes))).toBeNull();
    expect(notes).toEqual([
      { kind: 'toast', text: 'Fields harvested: Flax fibre ×14,400 · replanted 8' },
      { kind: 'toast', text: 'Farming reached Lv 40' },
      { kind: 'toast', text: 'Flax fibre mastery 10: sell value +5%' },
      { kind: 'toast', text: 'Flax fibre mastery 20: actions 5% faster' },
      { kind: 'toast', text: 'Flax fibre mastery 30: +5% XP' },
      { kind: 'toast', text: 'Flax fibre mastery 40: 5% chance to double the output' },
      { kind: 'toast', text: '+3% Farming XP' },
    ]);
  });

  it('omits the replanted clause when auto-replant is not bought', () => {
    const state = farmer();
    state.bank['mat.seed.flax'] = 1;
    expect(plantOnPlot(state, 0, FLAX, null)).toBe(true);
    state.plots[0]!.remainingMs = 500;
    const notes: FloatNote[] = [];
    expect(advanceOpenTab(state, 500, 5_000, notes)).toBeNull();
    expect(notes).toEqual([
      { kind: 'toast', text: 'Fields harvested: Flax fibre ×1,800' },
      { kind: 'toast', text: 'Farming reached Lv 15' },
      { kind: 'toast', text: 'Flax fibre mastery 10: sell value +5%' },
    ]);
    expect(state.plots[0]).toBeNull();
  });

  it('renders the Auto-replant switch and toggles it from the row', () => {
    const state = farmer();
    state.coins = 27_822;
    expect(buyAutoReplant(state)).toBe(true);
    const onHtml = mainHtml(state, landView(), 0);
    expect(onHtml).toContain('<button type="button" class="row" role="switch" aria-checked="true" aria-label="Auto-replant" data-auto-replant-toggle>');
    expect(onHtml).toContain('>Auto-replant</span><span class="tag on" aria-hidden="true">On</span>');
    state.autoReplantOn = false;
    const offHtml = mainHtml(state, landView(), 0);
    expect(offHtml).toContain('aria-checked="false"');
    expect(offHtml).toContain('aria-label="Auto-replant"');
    expect(offHtml).toContain('<span class="tag" aria-hidden="true">Off</span>');
    expect(offHtml).not.toContain('>On</span>');
    expect(toggleAutoReplant(state)).toBe(true);
    expect(state.autoReplantOn).toBe(true);
    expect(mainHtml(state, landView(), 0)).toContain('aria-checked="true"');
    expect(toggleAutoReplant(state)).toBe(true);
    expect(state.autoReplantOn).toBe(false);
  });

  it('harvests a hand-composted flax grow, then replants without compost', () => {
    const state = composted(2);
    creditOffline(state, 13_320_000);
    expect(state.bank['mat.fibre.flax']).toBe(2_250);
    creditOffline(state, 26_640_000);
    expect(state.bank['mat.fibre.flax']).toBe(4_050);
    creditOffline(state, 39_294_000);
    expect(state.bank['mat.fibre.flax']).toBe(5_850);
  });

  it('uses one banked compost on the first replant only', () => {
    const state = composted(2, { 'mat.farm.compost': 1 });
    creditOffline(state, 13_320_000);
    expect(state.plots[0]?.compost).toBe('compost');
    creditOffline(state, 26_640_000);
    expect(state.bank['mat.fibre.flax']).toBe(4_500);
    creditOffline(state, 39_294_000);
    expect(state.bank['mat.fibre.flax']).toBe(6_300);
    expect(state.bank['mat.farm.compost'] ?? 0).toBe(0);
  });

  it('uses bone compost before compost, and compost does not shorten the later grow', () => {
    const state = composted(2, { 'mat.farm.bone_compost': 1, 'mat.farm.compost': 1 });
    creditOffline(state, 13_320_000);
    expect(state.bank['mat.fibre.flax']).toBe(2_250);
    expect(state.plots[0]?.compost).toBe('bone');
    creditOffline(state, 25_800_840);
    expect(state.bank['mat.fibre.flax']).toBe(4_500);
    expect(state.plots[0]?.compost).toBe('compost');
    creditOffline(state, 38_454_840);
    expect(state.bank['mat.fibre.flax']).toBe(6_750);
    expect(state.bank['mat.farm.bone_compost'] ?? 0).toBe(0);
    expect(state.bank['mat.farm.compost'] ?? 0).toBe(0);
  });

  it('does not replant when the switch is off before the first harvest', () => {
    const state = composted(2);
    state.autoReplantOn = false;
    creditOffline(state, 13_320_000 - 1_000);
    const notes: FloatNote[] = [];
    expect(advanceOpenTab(state, state.lastCredited + 1_000, 5_000, notes)).toBeNull();
    expect(state.bank['mat.fibre.flax']).toBe(2_250);
    expect(state.plots[0]).toBeNull();
    expect(state.bank['mat.seed.flax']).toBe(2);
    expect(notes).toEqual([
      { kind: 'toast', text: 'Fields harvested: Flax fibre ×2,250' },
      { kind: 'toast', text: 'Farming reached Lv 15' },
      { kind: 'toast', text: 'Flax fibre mastery 10: sell value +5%' },
    ]);
  });

  it('finishes the replant already made after the switch is turned off', () => {
    const state = composted(2);
    creditOffline(state, 13_320_000 - 1_000);
    const first: FloatNote[] = [];
    expect(advanceOpenTab(state, state.lastCredited + 1_000, 5_000, first)).toBeNull();
    expect(first).toEqual([
      { kind: 'toast', text: 'Fields harvested: Flax fibre ×2,250 · replanted 1' },
      { kind: 'toast', text: 'Farming reached Lv 15' },
      { kind: 'toast', text: 'Flax fibre mastery 10: sell value +5%' },
    ]);
    state.autoReplantOn = false;
    creditOffline(state, 26_640_000 - 1_000);
    const second: FloatNote[] = [];
    expect(advanceOpenTab(state, state.lastCredited + 1_000, 5_000, second)).toBeNull();
    expect(state.bank['mat.fibre.flax']).toBe(4_050);
    expect(state.plots[0]).toBeNull();
    expect(state.bank['mat.seed.flax']).toBe(1);
    expect(second).toEqual([
      { kind: 'toast', text: 'Fields harvested: Flax fibre ×1,800' },
      { kind: 'toast', text: 'Farming reached Lv 22' },
      { kind: 'toast', text: 'Flax fibre mastery 20: actions 5% faster' },
    ]);
  });

  it('saves the switch and ignores it when the unlock is absent', () => {
    const off = farmer();
    off.coins = 27_822;
    expect(buyAutoReplant(off)).toBe(true);
    off.autoReplantOn = false;
    const loadedOff = deserialize(serialize(off));
    expect(loadedOff?.autoReplantOn).toBe(false);
    loadedOff!.bank['mat.seed.flax'] = 2;
    expect(plantOnPlot(loadedOff!, 0, FLAX, null)).toBe(true);
    creditOffline(loadedOff!, 13_320_000);
    expect(loadedOff!.plots[0]).toBeNull();
    expect(loadedOff!.bank['mat.seed.flax']).toBe(1);

    loadedOff!.autoReplantOn = true;
    const loadedOn = deserialize(serialize(loadedOff!));
    expect(loadedOn?.autoReplantOn).toBe(true);
    loadedOn!.bank['mat.seed.flax'] = 1;
    expect(plantOnPlot(loadedOn!, 0, FLAX, null)).toBe(true);
    creditOffline(loadedOn!, 13_320_000);
    expect(loadedOn!.plots[0]?.recipeId).toBe(FLAX);

    const raw = JSON.parse(serialize(farmer())) as Record<string, unknown>;
    raw.autoReplant = true;
    delete raw.autoReplantOn;
    const legacy = deserialize(JSON.stringify(raw));
    expect(legacy?.autoReplantOn).toBe(true);
    expect(mainHtml(legacy!, landView(), 0)).toContain('data-auto-replant-toggle');

    const bare = JSON.parse(serialize(farmer())) as Record<string, unknown>;
    delete bare.autoReplant;
    bare.autoReplantOn = true;
    const unlocked = deserialize(JSON.stringify(bare));
    expect(unlocked?.autoReplant).toBeUndefined();
    expect(unlocked?.autoReplantOn).toBeUndefined();
    expect(mainHtml(unlocked!, landView(), 0)).not.toContain('data-auto-replant-toggle');
    unlocked!.bank['mat.seed.flax'] = 2;
    expect(plantOnPlot(unlocked!, 0, FLAX, null)).toBe(true);
    creditOffline(unlocked!, 13_320_000);
    expect(unlocked!.plots[0]).toBeNull();
    expect(unlocked!.bank['mat.seed.flax']).toBe(1);
  });

  it('gives the one compost to plot 1 when two plots finish together', () => {
    const state = farmer(5);
    state.coins = 188;
    expect(buyPlot(state)).toBe(true);
    state.bank['mat.seed.flax'] = 4;
    state.bank['mat.farm.compost'] = 1;
    expect(plantOnPlot(state, 0, FLAX, null)).toBe(true);
    expect(plantOnPlot(state, 1, FLAX, null)).toBe(true);
    state.coins = 27_822;
    expect(buyAutoReplant(state)).toBe(true);
    const report = creditOffline(state, 13_320_000);
    expect(state.plots[0]?.compost).toBe('compost');
    expect(state.plots[1]?.compost).toBeNull();
    expect(state.bank['mat.farm.compost'] ?? 0).toBe(0);
    expect(report.plotHarvests?.some((line) => line.includes('not replanted'))).toBe(false);
    expect(report.plotHarvests?.join(' ')).not.toContain('compost');
  });

  it('clears Planted. when the open screen harvests, and stays clear after a replant', () => {
    const state = farmer();
    state.bank['mat.seed.flax'] = 2;
    const planted = plantOnPlot(state, 0, FLAX, null);
    let message = plantedLine(planted);
    expect(message).toBe('Planted.');
    state.coins = 27_822;
    expect(buyAutoReplant(state)).toBe(true);
    state.plots[0]!.remainingMs = 500;
    const notes: FloatNote[] = [];
    expect(advanceOpenTab(state, 500, 5_000, notes)).toBeNull();
    message = clearedLandStatus();
    expect(notes).toEqual([
      { kind: 'toast', text: 'Fields harvested: Flax fibre ×1,800 · replanted 1' },
      { kind: 'toast', text: 'Farming reached Lv 15' },
      { kind: 'toast', text: 'Flax fibre mastery 10: sell value +5%' },
    ]);
    expect(message).toBe('');
    expect(state.plots[0]?.recipeId).toBe(FLAX);
    expect(message).toBe('');
  });
});

function reportWith(over: Partial<CatchupReport>): CatchupReport {
  return {
    awayMs: 0,
    creditedMs: 0,
    capped: false,
    backwards: false,
    activity: 'Idle',
    actions: 0,
    kills: 0,
    xpGained: {},
    levelsBefore: {},
    levelsAfter: {},
    itemsGained: {},
    itemsConsumed: {},
    coinsGained: 0,
    foodEaten: 0,
    stopped: 'window',
    masteryLevels: [],
    perksUnlocked: [],
    ...over,
  };
}

function composted(seeds: number, stock: Record<string, number> = {}): Save {
  const state = farmer();
  state.bank['mat.seed.flax'] = 1;
  state.bank['mat.farm.compost'] = 1;
  expect(plantOnPlot(state, 0, FLAX, 'compost')).toBe(true);
  state.bank['mat.seed.flax'] = seeds;
  state.bank['mat.farm.compost'] = stock['mat.farm.compost'] ?? 0;
  state.bank['mat.farm.bone_compost'] = stock['mat.farm.bone_compost'] ?? 0;
  state.coins = 27_822;
  expect(buyAutoReplant(state)).toBe(true);
  return state;
}

function planted(seeds: number): Save {
  const state = farmer();
  state.bank['mat.seed.flax'] = seeds + 1;
  expect(plantOnPlot(state, 0, FLAX, null)).toBe(true);
  expect(state.bank['mat.seed.flax']).toBe(seeds);
  state.coins = 27_822;
  expect(buyAutoReplant(state)).toBe(true);
  return state;
}
