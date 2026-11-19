import { describe, expect, it } from 'vitest';
import {
  advanceOpenTab,
  buyAutoReplant,
  buyPlot,
  cancelPlot,
  creditOffline,
  deserialize,
  withoutOutputDoubles,
  newGame,
  plantOnPlot,
  serialize,
  setSkillLevel,
  startGather,
  type FloatNote,
  type Save,
} from '../src/engine';
import { mainHtml, type View } from '../src/ui';

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
    expect(mainHtml(loaded!, landView(), 0)).toContain('Auto-replant on');
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
    expect(capped.bank['mat.fibre.flax']).toBe(10_800);
    expect(capped.plots[0]?.remainingMs).toBe(3_510_000);
    expect(capped.bank['mat.seed.flax']).toBe(4);
  });

  it('stops after the seeds run out and does not retry', () => {
    const state = planted(3);
    creditOffline(state, 51_948_000 - 1000);
    const notes: FloatNote[] = [];
    advanceOpenTab(state, state.lastCredited + 1000, 60 * 60 * 1000, notes);
    expect(state.bank['mat.fibre.flax']).toBe(7_200);
    expect(state.xp.Farming).toBe(106_200);
    expect(state.bank['mat.seed.flax'] ?? 0).toBe(0);
    expect(state.plots[0]).toBeNull();
    expect(notes.filter((note) => note.kind === 'toast').map((note) => (note.kind === 'toast' ? note.text : ''))).toEqual([
      'Plot 1 not replanted: no Flax seed',
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
    expect(report.plotHarvests).toContain('Plot 2 not replanted: no Flax seed');
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
    expect(report.plotHarvests).toContain('Plot 1 not replanted: no Oak log');
  });

  it('replants a full flax field for 24h and still credits the selected activity', () => {
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
    expect(state.bank['mat.fibre.flax']).toBe(86_400);
    expect(state.bank['mat.seed.flax'] ?? 0).toBe(0);
    expect(state.plots.every((plot) => plot?.recipeId === FLAX)).toBe(true);
    expect(state.xp.Woodcutting).toBe(twin.xp.Woodcutting);
    expect(report.actions).toBe(alone.actions + 48);
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
    expect(state.bank['mat.fibre.flax']).toBe(10_800);
    expect(report.actions).toBe(alone.actions + 6);
  });
});

function planted(seeds: number): Save {
  const state = farmer();
  state.bank['mat.seed.flax'] = seeds + 1;
  expect(plantOnPlot(state, 0, FLAX, null)).toBe(true);
  expect(state.bank['mat.seed.flax']).toBe(seeds);
  state.coins = 27_822;
  expect(buyAutoReplant(state)).toBe(true);
  return state;
}
