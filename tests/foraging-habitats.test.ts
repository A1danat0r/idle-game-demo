import { describe, expect, it } from 'vitest';
import {
  HABITATS,
  HABITAT_BY_ID,
  NODE_BY_ID,
  NODES,
  TOOL_TIME_FACTOR,
  XP_CAP,
  XP_TABLE,
} from '../src/content';
import {
  buyNode,
  creditOffline,
  deserialize,
  habitatPace,
  habitatSeconds,
  habitatTable,
  habitatTickXp,
  newGame,
  serialize,
  simulate,
  stepCompletion,
  startForage,
  startGather,
  type Save,
} from '../src/engine';
import { activityNextLine } from '../src/milestones';
import { globalXpBonus, masteryThreshold, sellMultiplier } from '../src/mastery';
import { mainHtml, type View } from '../src/ui';

const HOUR = 3_600_000;

function forager(level = 1): Save {
  const state = newGame(0);
  state.owned.push('Foraging');
  state.xp.Foraging = level <= 1 ? 0 : XP_TABLE[level];
  return state;
}

function buyAll(state: Save, habitatId: string): void {
  for (const entry of HABITAT_BY_ID[habitatId].entries) {
    const node = NODE_BY_ID[entry.nodeId];
    if (node.cost > 0 && !state.nodes.includes(node.id)) state.nodes.push(node.id);
  }
}

function counted(state: Save, id: string): number {
  return state.bank[id] ?? 0;
}

function forageItems(state: Save): number {
  let total = 0;
  for (const habitat of HABITATS) {
    for (const entry of habitat.entries) total += counted(state, entry.nodeId);
  }
  return total;
}

function shownSeconds(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

function view(skill: View['skill'] = 'Foraging', extra: Partial<View> = {}): View {
  return {
    tab: 'skill',
    skill,
    filter: 'all',
    selected: null,
    area: 'Meadow verge',
    style: null,
    message: '',
    ...extra,
  };
}

describe('foraging habitats', () => {
  it('maps every foraging node into one habitat and keeps the paid costs', () => {
    const seen = new Map<string, string>();
    for (const habitat of HABITATS) {
      for (const entry of habitat.entries) {
        expect(seen.has(entry.nodeId), entry.nodeId).toBe(false);
        seen.set(entry.nodeId, habitat.id);
        expect(NODE_BY_ID[entry.nodeId]?.skill).toBe('Foraging');
      }
    }
    const foraging = NODES.filter((node) => node.skill === 'Foraging');
    expect(foraging).toHaveLength(22);
    expect(seen.size).toBe(22);
    expect(HABITAT_BY_ID.meadow.entries.map((entry) => entry.nodeId)).toEqual([
      'mat.herb.meadow',
      'mat.seed.flax',
      'mat.reagent.spell_moss',
      'mat.seed.potato',
      'mat.seed.carrot',
      'mat.fruit.crabapple',
      'mat.herb.bitterroot',
    ]);
    expect(HABITAT_BY_ID.woodland.entries.map((entry) => entry.nodeId)).toEqual([
      'mat.cutting.meadow_herb',
      'mat.fruit.berries',
      'mat.forage.wild_wax_comb',
      'mat.fungi.mushroom',
      'mat.spawn.mushroom',
      'mat.fruit.plum',
      'mat.cutting.emberleaf',
      'mat.herb.emberleaf',
    ]);
    expect(HABITAT_BY_ID.riverbank.entries.map((entry) => entry.nodeId)).toEqual([
      'mat.seed.cotton',
      'mat.plant.cattail',
      'mat.seed.onion',
      'mat.seed.wheat',
      'mat.seed.garlic',
      'mat.seed.turnip',
      'mat.seed.hemp',
    ]);
    const paid = foraging.filter((node) => node.cost > 0);
    expect(paid).toHaveLength(19);
    expect(paid.reduce((sum, node) => sum + node.cost, 0)).toBe(100_998);
  });

  it('ticks fresh Meadow at 2.8s and 45 XP, with sickle steps before mastery speed', () => {
    const state = forager();
    expect(startGather(state, 'mat.herb.meadow')).toBe(false);
    expect(startForage(state, 'meadow')).toBe(true);
    expect(habitatPace(state, 'meadow')?.id).toBe('mat.herb.meadow');
    expect(habitatSeconds(state, 'meadow')).toBeCloseTo(2.8, 10);
    expect(habitatTickXp(state, 'meadow')).toBe(45);
    const ticks = 3600 / 2.8;
    expect(ticks).toBeCloseTo(1285.714, 3);
    expect(ticks * 45).toBeCloseTo(57_857.143, 3);
    expect(ticks * 0.5).toBeCloseTo(642.857, 3);
    expect(ticks * 0.3).toBeCloseTo(385.714, 3);
    expect(ticks * 0.2).toBeCloseTo(257.143, 3);

    state.bank['tool.foraging.bronze_sickle'] = 1;
    const bronze = habitatSeconds(state, 'meadow');
    expect(bronze).toBeCloseTo(2.8 * TOOL_TIME_FACTOR, 10);
    expect(shownSeconds(bronze)).toBe(2.624);
    state.bank['tool.foraging.iron_sickle'] = 1;
    const iron = habitatSeconds(state, 'meadow');
    expect(iron).toBeCloseTo(2.8 * TOOL_TIME_FACTOR ** 2, 10);
    expect(shownSeconds(iron)).toBe(2.458);
    state.mastery['forage.meadow'] = masteryThreshold(20);
    expect(habitatSeconds(state, 'meadow')).toBeCloseTo(2.8 * TOOL_TIME_FACTOR ** 2 * 0.95, 8);

    const one = forager();
    startForage(one, 'meadow');
    simulate(one, 2800);
    expect(one.stats.actions).toBe(1);
    expect(one.xp.Foraging).toBe(45);
    expect(one.mastery['forage.meadow']).toBe(28);
    expect(one.mastery['mat.herb.meadow']).toBeUndefined();
    expect(forageItems(one)).toBe(1);
  });

  it('rolls 10,000 fresh Meadow ticks inside the weight bands', () => {
    const state = forager();
    startForage(state, 'meadow');
    const rolls = { herbs: 0, flax: 0, moss: 0 };
    for (let i = 0; i < 10_000; i++) {
      const herbs = counted(state, 'mat.herb.meadow');
      const flax = counted(state, 'mat.seed.flax');
      const moss = counted(state, 'mat.reagent.spell_moss');
      stepCompletion(state);
      if (counted(state, 'mat.herb.meadow') > herbs) rolls.herbs += 1;
      else if (counted(state, 'mat.seed.flax') > flax) rolls.flax += 1;
      else if (counted(state, 'mat.reagent.spell_moss') > moss) rolls.moss += 1;
    }
    expect(state.stats.actions).toBe(10_000);
    expect(rolls.herbs).toBeGreaterThanOrEqual(5_000 - 150);
    expect(rolls.herbs).toBeLessThanOrEqual(5_000 + 150);
    expect(rolls.flax).toBeGreaterThanOrEqual(3_000 - 137.5);
    expect(rolls.flax).toBeLessThanOrEqual(3_000 + 137.5);
    expect(rolls.moss).toBeGreaterThanOrEqual(2_000 - 120);
    expect(rolls.moss).toBeLessThanOrEqual(2_000 + 120);
    expect(rolls.herbs + rolls.flax + rolls.moss).toBe(10_000);
    expect(forageItems(state)).toBeGreaterThan(10_000);
    expect(state.activity).toEqual({ kind: 'forage', habitatId: 'meadow' });
  });

  it('uses bitterroot as the Meadow pace once every Meadow node is in the table', () => {
    const state = forager(30);
    buyAll(state, 'meadow');
    const table = habitatTable(state, 'meadow');
    expect(table.reduce((sum, entry) => sum + entry.weight, 0)).toBe(18);
    expect(habitatPace(state, 'meadow')).toMatchObject({ id: 'mat.herb.bitterroot', seconds: 4, xp: 93 });
    const ticks = 3600 / habitatSeconds(state, 'meadow');
    expect(ticks).toBeCloseTo(900, 6);
    expect(ticks * 93).toBeCloseTo(83_700, 6);
    const flax = table.find((entry) => entry.nodeId === 'mat.seed.flax')!;
    expect((ticks * flax.weight) / 18).toBeCloseTo(150, 6);
  });

  it('paces Woodland from the first tied entry, then from emberleaf cuttings', () => {
    const early = forager(10);
    early.nodes.push('mat.cutting.meadow_herb', 'mat.fruit.berries');
    expect(habitatPace(early, 'woodland')).toMatchObject({ id: 'mat.cutting.meadow_herb', seconds: 3.2, xp: 51 });
    const earlyTicks = 3600 / habitatSeconds(early, 'woodland');
    expect(earlyTicks).toBeCloseTo(1125, 6);
    expect(earlyTicks * 0.5).toBeCloseTo(562.5, 6);
    expect(earlyTicks * 51).toBeCloseTo(57_375, 6);

    const late = forager(40);
    buyAll(late, 'woodland');
    expect(habitatPace(late, 'woodland')).toMatchObject({ id: 'mat.cutting.emberleaf', seconds: 4.4, xp: 177 });
    const lateTicks = 3600 / habitatSeconds(late, 'woodland');
    expect(lateTicks).toBeCloseTo(818.182, 3);
    expect(lateTicks * 177).toBeCloseTo(144_818.182, 3);
  });

  it('paces Riverbank from cotton, then from hemp seed', () => {
    const early = forager(20);
    early.nodes.push('mat.seed.cotton');
    expect(habitatPace(early, 'riverbank')).toMatchObject({ id: 'mat.seed.cotton', seconds: 3.8, xp: 88 });
    const earlyTicks = 3600 / habitatSeconds(early, 'riverbank');
    expect(earlyTicks).toBeCloseTo(947.368, 3);
    expect(earlyTicks * 88).toBeCloseTo(83_368.421, 3);

    const late = forager(40);
    buyAll(late, 'riverbank');
    expect(habitatPace(late, 'riverbank')).toMatchObject({ id: 'mat.seed.hemp', seconds: 4.6, xp: 185 });
    const lateTicks = 3600 / habitatSeconds(late, 'riverbank');
    expect(lateTicks * 185).toBeCloseTo(144_782.609, 3);
  });

  it('keeps an unbought entry out of the roll until it is paid for', () => {
    const state = forager(12);
    state.coins = 1080;
    startForage(state, 'meadow');
    expect(habitatTable(state, 'meadow').some((entry) => entry.nodeId === 'mat.seed.carrot')).toBe(false);
    simulate(state, 3000 * 2800);
    expect(counted(state, 'mat.seed.carrot')).toBe(0);
    expect(counted(state, 'mat.seed.potato')).toBe(0);
    expect(buyNode(state, 'mat.seed.carrot')).toBe(true);
    expect(state.coins).toBe(0);
    expect(state.nodes).toContain('mat.seed.carrot');
    const table = habitatTable(state, 'meadow');
    expect(table.some((entry) => entry.nodeId === 'mat.seed.carrot')).toBe(true);
    expect(table.reduce((sum, entry) => sum + entry.weight, 0)).toBe(12);
    let guard = 0;
    while (counted(state, 'mat.seed.carrot') === 0 && guard++ < 200) simulate(state, 2800);
    expect(counted(state, 'mat.seed.carrot')).toBeGreaterThan(0);
  });

  it('loads a flax-seed save onto Meadow verge and seeds habitat mastery from the old tracks', () => {
    const raw = JSON.stringify({
      saveFormat: 4,
      coins: 40,
      xp: { Woodcutting: 0, Foraging: 0 },
      owned: ['Woodcutting', 'Foraging'],
      purchaseCount: 1,
      nodes: ['mat.seed.potato', 'mat.fruit.crabapple'],
      bank: { 'gear.melee.bronze_sword': 1 },
      equipped: { weapon: 'gear.melee.bronze_sword', body: null, shield: null },
      activity: { kind: 'gather', nodeId: 'mat.seed.flax' },
      progressMs: 0,
      hp: 100,
      paused: false,
      combat: null,
      foodSlot: null,
      shop: {},
      lastCredited: 0,
      rngState: 1,
      regenMs: 0,
      stats: { actions: 0, kills: 0, pauses: 0, foodEaten: 0, coinsFromKills: 0, coinsFromSales: 0, lootValue: 0, killsByEnemy: {}, pauseAtKill: [], playerSwings: 0, playerHits: 0, playerMisses: 0, enemyHits: 0 },
      mastery: {
        'mat.herb.meadow': 120,
        'mat.seed.flax': 4800,
        'mat.seed.potato': 900,
        'mat.cutting.meadow_herb': 9000,
      },
      enemyMastery: {},
      enemyKills: {},
      buildings: {},
      buildingsEver: {},
      plot: null,
    });
    const loaded = deserialize(raw);
    expect(loaded).not.toBeNull();
    expect(loaded!.saveFormat).toBe(4);
    expect(loaded!.activity).toEqual({ kind: 'forage', habitatId: 'meadow' });
    expect(loaded!.nodes).toEqual(['mat.seed.potato', 'mat.fruit.crabapple']);
    expect(loaded!.mastery['mat.seed.flax']).toBe(4800);
    expect(loaded!.mastery['mat.herb.meadow']).toBe(120);
    expect(loaded!.mastery['mat.cutting.meadow_herb']).toBe(9000);
    expect(loaded!.mastery['forage.meadow']).toBe(4800);
    expect(loaded!.mastery['forage.woodland']).toBe(9000);
    expect(loaded!.mastery['forage.riverbank']).toBeUndefined();
    expect(forageItems(loaded!)).toBe(0);
    expect(loaded!.xp.Foraging).toBe(0);

    const partial = JSON.parse(raw) as { progressMs: number; mastery: Record<string, number> };
    partial.progressMs = 800;
    partial.mastery = { 'mat.seed.flax': 2500, 'mat.herb.meadow': 100 };
    const migrated = deserialize(JSON.stringify(partial));
    expect(migrated!.activity).toEqual({ kind: 'forage', habitatId: 'meadow' });
    expect(migrated!.progressMs).toBe(0);
    expect(migrated!.stats.actions).toBe(1);
    expect(migrated!.xp.Foraging).toBe(45);
    expect(migrated!.mastery['forage.meadow']).toBe(2528);
    expect(migrated!.mastery['mat.seed.flax']).toBe(2500);
    expect(forageItems(migrated!)).toBe(1);

    const kept = JSON.parse(raw) as { mastery: Record<string, number> };
    kept.mastery['forage.meadow'] = 12;
    const again = deserialize(JSON.stringify(kept));
    expect(again!.mastery['forage.meadow']).toBe(12);
    expect(again!.mastery['mat.seed.flax']).toBe(4800);
  });

  it('credits offline Meadow with the speed perk, and still drops items after the XP cap', () => {
    const hour = forager();
    startForage(hour, 'meadow');
    const hourReport = creditOffline(hour, HOUR);
    expect(hourReport.backwards).toBe(false);
    expect(hourReport.actions).toBe(1302);
    expect(hourReport.xpGained.Foraging).toBe(30_631.5);
    expect(forageItems(hour)).toBe(1302);

    const backwards = forager();
    startForage(backwards, 'meadow');
    backwards.lastCredited = 10_000;
    const back = creditOffline(backwards, 9_000);
    expect(back.actions).toBe(0);
    expect(back.backwards).toBe(true);
    expect(backwards.xp.Foraging).toBe(0);

    const day = forager();
    startForage(day, 'meadow');
    const dayReport = creditOffline(day, 24 * HOUR);
    expect(dayReport.capped).toBe(true);
    expect(dayReport.creditedMs).toBe(8 * HOUR);
    day.xp.Foraging = XP_CAP;
    const items = forageItems(day);
    simulate(day, habitatSeconds(day, 'meadow') * 1000);
    expect(day.xp.Foraging).toBe(XP_CAP);
    expect(forageItems(day)).toBeGreaterThan(items);

    const long = forager();
    startForage(long, 'meadow');
    const capped = creditOffline(long, 30 * HOUR);
    expect(capped.capped).toBe(true);
    expect(capped.creditedMs).toBe(8 * HOUR);
    expect(capped.actions).toBe(dayReport.actions);
  });

  it('sells habitat items from the habitat track and adds 3% when that track is maxed', () => {
    const state = forager();
    state.mastery['mat.herb.meadow'] = masteryThreshold(40);
    expect(globalXpBonus(state.mastery, 'Foraging')).toBe(0);
    state.mastery['forage.meadow'] = masteryThreshold(10);
    expect(sellMultiplier(state.mastery, 'mat.herb.meadow')).toBeCloseTo(1.05);
    state.mastery['forage.meadow'] = masteryThreshold(40);
    expect(globalXpBonus(state.mastery, 'Foraging')).toBeCloseTo(0.03);
    state.mastery['forage.woodland'] = masteryThreshold(40);
    state.mastery['forage.riverbank'] = masteryThreshold(40);
    expect(globalXpBonus(state.mastery, 'Foraging')).toBeCloseTo(0.09);

    state.mastery['forage.meadow'] = masteryThreshold(40);
    startForage(state, 'meadow');
    for (let i = 0; i < 4_000; i++) stepCompletion(state);
    const extra = forageItems(state) - state.stats.actions;
    expect(extra).toBeGreaterThan(120);
    expect(extra).toBeLessThan(280);
  });

  it('lists the next Foraging entry or habitat, and the habitat mastery, on the activity screen', () => {
    const state = forager();
    startForage(state, 'meadow');
    expect(activityNextLine(state)).toBe(
      'Next: seed potatoes at Foraging 5 (5,065 XP) · Meadow verge mastery 10: +5% sell (6,072 MXP, 217 actions).',
    );
    state.xp.Foraging = XP_TABLE[9];
    expect(activityNextLine(state)).toContain('woodland edge at Foraging 10 (1,979 XP)');
    state.xp.Foraging = XP_TABLE[40];
    expect(activityNextLine(state)).toContain('Foraging 40 (max)');

    const html = mainHtml(forager(12), view(), 0);
    const bought = forager(12);
    bought.coins = 1080;
    const card = mainHtml(bought, view(), 0);
    expect(card).toContain('Meadow verge');
    expect(card).toContain('Woodland edge');
    expect(card).toContain('Riverbank');
    expect(card).toContain('2.8s · 45 XP');
    expect(card).toContain('50%');
    expect(card).toContain('Buy 1,080');
    expect(card).toContain('data-habitat="meadow"');
    expect(card).not.toContain('data-node="mat.herb.meadow"');
    expect(card).not.toContain('data-habitat="woodland"');

    const sheet = mainHtml(state, view('Foraging', { milestoneOpen: true }), 0);
    expect(sheet).toContain('<h3>Meadow verge mastery</h3>');
    expect(sheet).toContain('data-milestone-track="forage.meadow"');
    expect(sheet).toContain('data-milestone-track="forage.woodland"');
    expect(sheet).toContain('data-milestone-track="forage.riverbank"');
    expect(sheet).not.toContain('data-milestone-track="mat.herb.meadow"');
    expect(html).toContain('Lv 30');

    const round = forager();
    startForage(round, 'meadow');
    expect(deserialize(serialize(round))).toEqual(round);
  });
});
