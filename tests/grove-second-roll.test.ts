import { describe, expect, it } from 'vitest';
import { HABITAT_BY_ID, NODE_BY_ID, XP_CAP } from '../src/content';
import {
  creditOffline,
  deserialize,
  habitatPace,
  habitatTickXp,
  importSave,
  newGame,
  serialize,
  skillLevel,
  startForage,
  stepCompletion,
  xpFalloff,
  type FloatNote,
  type Save,
} from '../src/engine';
import { formatActionNotes } from '../src/floaters';
import { actionMasteryXp, masteryThreshold } from '../src/mastery';
import { runReferenceRoute } from '../src/route';

const HOUR = 3_600_000;
const TICKS = 10_000;
const FRESH = ['mat.herb.meadow', 'mat.seed.flax', 'mat.reagent.spell_moss'];

function forager(seed = 1): Save {
  const state = newGame(0, seed);
  state.owned.push('Foraging');
  state.xp.Foraging = 0;
  return state;
}

function meadow(rank: number, seed = 1): Save {
  const state = forager(seed);
  if (rank > 0) state.markRanks['grove.forage'] = rank;
  expect(startForage(state, 'meadow')).toBe(true);
  expect(habitatPace(state, 'meadow')?.id).toBe('mat.herb.meadow');
  return state;
}

function meadowItems(state: Save): number {
  let total = 0;
  for (const entry of HABITAT_BY_ID.meadow.entries) total += state.bank[entry.nodeId] ?? 0;
  return total;
}

function actionNotes(notes: FloatNote[]): Extract<FloatNote, { kind: 'action' }>[] {
  return notes.filter((note): note is Extract<FloatNote, { kind: 'action' }> => note.kind === 'action');
}

function routeNeed(result: { purchases: { price?: number }[]; nodes: { id?: string }[] }): number {
  return (
    result.purchases.reduce((sum, event) => sum + (event.price ?? 0), 0) +
    result.nodes.reduce((sum, event) => sum + (NODE_BY_ID[event.id ?? '']?.cost ?? 0), 0)
  );
}

describe('grove second roll', () => {
  it('gives 500 ± 65 extras on 10,000 seeded fresh Meadow ticks at rank 5, and exactly 0 at rank 0', () => {
    const ranked = meadow(5);
    let extras = 0;
    let different = 0;
    for (let i = 0; i < TICKS; i += 1) {
      const notes: FloatNote[] = [];
      stepCompletion(ranked, { notes });
      const actions = actionNotes(notes);
      expect(actions.length === 1 || actions.length === 2).toBe(true);
      expect(FRESH).toContain(actions[0].itemId);
      if (actions.length !== 2) continue;
      extras += 1;
      expect(actions[1].xp).toBe(0);
      expect(actions[1].qty).toBe(1);
      expect(FRESH).toContain(actions[1].itemId);
      if (actions[1].itemId !== actions[0].itemId) different += 1;
    }
    console.log(`grove rank 5 extras in ${TICKS} seed-1 ticks: ${extras} (${different} different from the tick item)`);
    expect(ranked.stats.actions).toBe(TICKS);
    expect(extras).toBeGreaterThanOrEqual(500 - 65);
    expect(extras).toBeLessThanOrEqual(500 + 65);
    expect(different).toBeGreaterThan(0);
    expect(different).toBeLessThan(extras);

    const bare = meadow(0);
    let bareExtras = 0;
    for (let i = 0; i < TICKS; i += 1) {
      const notes: FloatNote[] = [];
      stepCompletion(bare, { notes });
      bareExtras += actionNotes(notes).length - 1;
    }
    console.log(`grove rank 0 extras in ${TICKS} seed-1 ticks: ${bareExtras}`);
    expect(bare.stats.actions).toBe(TICKS);
    expect(bareExtras).toBe(0);
  });

  it('pays the tick XP and mastery XP once, including an extra at the Foraging cap', () => {
    const state = meadow(5);
    let found = false;
    for (let i = 0; i < 500 && !found; i += 1) {
      const pace = habitatPace(state, 'meadow');
      const expected = habitatTickXp(state, 'meadow') * xpFalloff(skillLevel(state, 'Foraging'), pace?.level ?? 1);
      const xpBefore = state.xp.Foraging ?? 0;
      const mxpBefore = state.mastery['forage.meadow'] ?? 0;
      const notes: FloatNote[] = [];
      stepCompletion(state, { notes });
      const actions = actionNotes(notes);
      if (actions.length !== 2) continue;
      found = true;
      expect((state.xp.Foraging ?? 0) - xpBefore).toBeCloseTo(expected, 4);
      expect((state.xp.Foraging ?? 0) - xpBefore).toBeCloseTo(actions[0].xp, 4);
      expect(actions[0].xp).toBeGreaterThan(0);
      expect(actions[1].xp).toBe(0);
      expect(state.mastery['forage.meadow']! - mxpBefore).toBe(actionMasteryXp(pace?.seconds ?? 0));
      expect(state.stats.actions).toBe(i + 1);
      const xpLines = formatActionNotes(actions).split('\n').filter((line) => line.includes('XP'));
      expect(xpLines).toEqual([`+${Math.floor(actions[0].xp)} XP`]);
    }
    expect(found).toBe(true);

    const capped = meadow(5, 2);
    capped.xp.Foraging = XP_CAP;
    let granted = false;
    for (let i = 0; i < 500 && !granted; i += 1) {
      const before = meadowItems(capped);
      const mxpBefore = capped.mastery['forage.meadow'] ?? 0;
      const notes: FloatNote[] = [];
      stepCompletion(capped, { notes });
      expect(capped.xp.Foraging).toBe(XP_CAP);
      const actions = actionNotes(notes);
      expect(actions[0].xp).toBe(0);
      expect(capped.mastery['forage.meadow']! - mxpBefore).toBe(actionMasteryXp(2.8));
      if (actions.length !== 2) continue;
      granted = true;
      expect(actions[1].qty).toBe(1);
      expect(actions[1].xp).toBe(0);
      expect(meadowItems(capped)).toBe(before + actions[0].qty + 1);
      expect(formatActionNotes(actions).includes('XP')).toBe(false);
    }
    expect(granted).toBe(true);
  });

  it('lets mastery 40 double the tick item and never the extra', () => {
    const state = meadow(5, 3);
    state.mastery['forage.meadow'] = masteryThreshold(40);
    let doubled = 0;
    let paired = 0;
    for (let i = 0; i < 4_000; i += 1) {
      const before: Record<string, number> = {};
      for (const id of FRESH) before[id] = state.bank[id] ?? 0;
      const notes: FloatNote[] = [];
      stepCompletion(state, { notes });
      const actions = actionNotes(notes);
      expect(actions[0].qty === 1 || actions[0].qty === 2).toBe(true);
      if (actions[0].qty === 2) doubled += 1;
      if (actions.length !== 2) continue;
      expect(actions[1].qty).toBe(1);
      const tickId = actions[0].itemId;
      const extraId = actions[1].itemId;
      if (tickId === extraId) expect((state.bank[tickId] ?? 0) - before[tickId]).toBe(actions[0].qty + 1);
      else {
        expect((state.bank[tickId] ?? 0) - before[tickId]).toBe(actions[0].qty);
        expect((state.bank[extraId] ?? 0) - before[extraId]).toBe(1);
      }
      if (actions[0].qty === 2) paired += 1;
    }
    expect(doubled).toBeGreaterThan(0);
    expect(paired).toBeGreaterThan(0);
  });

  it('credits 8h of a 30h Meadow absence, including second rolls, and cuts the rest', () => {
    const long = meadow(5);
    const longReport = creditOffline(long, 30 * HOUR);
    const eight = meadow(5);
    const eightReport = creditOffline(eight, 8 * HOUR);
    expect(longReport.backwards).toBe(false);
    expect(longReport.capped).toBe(true);
    expect(longReport.creditedMs).toBe(8 * HOUR);
    expect(longReport.awayMs).toBe(30 * HOUR);
    expect(eightReport.creditedMs).toBe(8 * HOUR);
    expect(eightReport.capped).toBe(false);
    expect(longReport.actions).toBe(eightReport.actions);
    expect(meadowItems(long)).toBe(meadowItems(eight));
    expect(meadowItems(long)).toBeGreaterThan(longReport.actions);
    const gained = Object.values(longReport.itemsGained).reduce((sum, qty) => sum + qty, 0);
    expect(gained).toBe(meadowItems(long));
    expect(gained).toBeGreaterThan(longReport.actions);

    const quiet = meadow(0);
    const quietReport = creditOffline(quiet, 8 * HOUR);
    expect(quietReport.actions).toBe(longReport.actions);
    expect(meadowItems(quiet)).toBeLessThan(meadowItems(long));

    const hour = meadow(0, 4);
    const hourReport = creditOffline(hour, HOUR);
    expect(hourReport.actions).toBe(1302);
    expect(meadowItems(hour)).toBe(hourReport.actions);
    const hourRanked = meadow(5, 4);
    const hourRankedReport = creditOffline(hourRanked, HOUR);
    expect(hourRankedReport.actions).toBe(1302);
    expect(meadowItems(hourRanked)).toBeGreaterThan(1302);

    const backwards = meadow(5);
    backwards.lastCredited = 10_000;
    const back = creditOffline(backwards, 9_000);
    expect(back.actions).toBe(0);
    expect(back.backwards).toBe(true);
    expect(meadowItems(backwards)).toBe(0);
  });

  it('keeps saveFormat 4 and round-trips markRanks through export and import', () => {
    const state = meadow(5);
    state.markRanks['grove.time'] = 2;
    state.markRanks['hearth.xp'] = 1;
    const raw = serialize(state);
    const parsed = JSON.parse(raw) as { saveFormat: number; markRanks: Record<string, number> };
    expect(parsed.saveFormat).toBe(4);
    expect(parsed.markRanks).toEqual({ 'grove.forage': 5, 'grove.time': 2, 'hearth.xp': 1 });
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(JSON.parse(serialize(newGame(0)))).sort());
    const loaded = deserialize(raw);
    expect(loaded?.saveFormat).toBe(4);
    expect(loaded?.markRanks).toEqual(state.markRanks);
    const imported = importSave(raw);
    expect(imported?.saveFormat).toBe(4);
    expect(imported?.markRanks).toEqual(state.markRanks);
  });

  it('leaves reference routes A and A_meadowgrind on their published times and coins', () => {
    const route = runReferenceRoute({ seed: 1, expectedLoot: true });
    const needed = routeNeed(route);
    expect(needed).toBe(41_878);
    expect(Math.round((route.elapsedMs / HOUR) * 1_000_000) / 1_000_000).toBe(39.257123);
    expect(Math.round(route.earned)).toBe(93_484);
    expect(Math.round(route.earned) - needed).toBe(51_606);
    expect(route.state.owned.includes('Foraging')).toBe(false);

    const meadowGrind = runReferenceRoute({ seed: 1, expectedLoot: true, meadowGrind: true });
    const meadowNeeded = routeNeed(meadowGrind);
    expect(meadowNeeded).toBe(41_878);
    expect(Math.round((meadowGrind.elapsedMs / HOUR) * 1_000_000) / 1_000_000).toBe(39.138366);
    expect(Math.round(meadowGrind.earned)).toBe(92_002);
    expect(Math.round(meadowGrind.earned) - meadowNeeded).toBe(50_124);
    expect(meadowGrind.state.owned.includes('Foraging')).toBe(false);
  });
});
