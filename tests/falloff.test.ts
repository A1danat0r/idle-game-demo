import { afterEach, describe, expect, it } from 'vitest';
import {
  FULL_GAME_OFFLINE_CAP_MS,
  OFFLINE_CAP_MS,
  SHOP_DAILY_LIMIT,
  SHOP_WINDOW_MS,
  XP_TABLE,
  levelForXp,
} from '../src/content';
import {
  EXPEDITION_MS,
  SAVE_FORMAT,
  actionDurationMs,
  buyPlot,
  creditOffline,
  deserialize,
  expeditionPreview,
  explorationRoute,
  falloffApplies,
  setExpeditionDoubleRoll,
  newGame,
  plantOnPlot,
  serialize,
  setSkillLevel,
  simulate,
  skillLevel,
  startCombat,
  startExpedition,
  startGather,
  startProduce,
  stepCompletion,
  xpFalloff,
  type Save,
} from '../src/engine';
import { actionMasteryXp } from '../src/mastery';
import { mainHtml, reportHtml, type View } from '../src/ui';

const PINE = 'mat.wood.pine';
const MAPLE = 'mat.wood.maple';
const OAK = 'mat.wood.oak';
const BARK = 'mat.tree.bark_strip';
const CHARCOAL = 'recipe.mat.fuel.charcoal';
const FLAX = 'recipe.mat.fibre.flax';
const POTATO = 'recipe.mat.crop.potato';
const COTTON = 'recipe.mat.fibre.cotton';
const MUSHROOM = 'recipe.farm.mushroom.log_route';
const HEMP = 'recipe.mat.fibre.hemp';
const STREAM = 'activity.exploration.stream_survey';
const FITTING = 'activity.exploration.fitting_appraisal';
const BRIDGE = 'activity.exploration.bridge_approach_survey';
const MEAL = 'food.trout_mushroom_meal';
const AGATE = 'mat.gem.weathered_agate';
const EIGHT = EXPEDITION_MS[2];
const HOUR = 3_600_000;

function view(skill: View['skill'], routeMs?: number): View {
  return {
    tab: 'skill',
    skill,
    filter: 'all',
    selected: null,
    area: 'Meadow verge',
    style: null,
    message: '',
    routeMs,
  };
}

function row(html: string, title: string): string {
  const at = html.indexOf(`<b>${title}</b>`);
  const start = html.lastIndexOf('<div class="row', at);
  const next = html.indexOf('<div class="row', at + 1);
  return html.slice(start, next === -1 ? undefined : next);
}

function explorer(level: number): Save {
  const state = newGame(0);
  setSkillLevel(state, 'Exploration', level);
  state.coins = 100_000;
  state.bank[MEAL] = 5;
  state.bank['mat.binding.hemp'] = 5;
  return state;
}

/** Hold the no-mastery timer and the no-bonus XP the brief's sits use. */
function chop(state: Save, nodeId: string): number {
  expect(startGather(state, nodeId)).toBe(true);
  const step = stepCompletion(state);
  state.mastery = {};
  return step.ms;
}

describe('T1–T8 stepped XP falloff and the demo 8h offline cap', () => {
  afterEach(() => setExpeditionDoubleRoll(null));

  it('T1 scales pine and cooking XP by d, and leaves farming and combat alone', () => {
    const pineXp = (level: number) => {
      const state = newGame(0);
      setSkillLevel(state, 'Woodcutting', level);
      const before = state.xp.Woodcutting ?? 0;
      chop(state, PINE);
      return (state.xp.Woodcutting ?? 0) - before;
    };
    for (const level of [1, 10]) expect(pineXp(level), `pine ${level}`).toBeCloseTo(42, 4);
    for (const level of [11, 15]) expect(pineXp(level), `pine ${level}`).toBeCloseTo(21, 4);
    for (const level of [16, 20]) expect(pineXp(level), `pine ${level}`).toBeCloseTo(4.2, 4);
    for (const level of [21, 39]) expect(pineXp(level), `pine ${level}`).toBeCloseTo(0.42, 4);
    expect(pineXp(40), 'pine 40 is already at the cap').toBe(0);

    const tagFor = (level: number) => row(mainHtml(wood(level), view('Woodcutting'), 0), 'Pine logs');
    for (const level of [1, 10]) {
      expect(tagFor(level)).toContain('42 XP');
      expect(tagFor(level)).not.toContain('% XP');
    }
    for (const level of [11, 15]) expect(tagFor(level)).toContain('<span class="tag">50% XP</span>');
    for (const level of [16, 20]) expect(tagFor(level)).toContain('<span class="tag">10% XP</span>');
    for (const level of [21, 40]) {
      expect(tagFor(level)).toContain('<span class="tag">1% XP</span>');
      expect(tagFor(level)).toContain('42 XP');
      expect(tagFor(level)).not.toContain('0.42');
    }

    const cookXp = (level: number) => {
      const state = newGame(0);
      setSkillLevel(state, 'Cooking', level);
      state.bank[PINE] = 1;
      const before = state.xp.Cooking ?? 0;
      expect(startProduce(state, CHARCOAL)).toBe(true);
      stepCompletion(state);
      return (state.xp.Cooking ?? 0) - before;
    };
    expect(cookXp(1)).toBeCloseTo(37, 4);
    expect(cookXp(10)).toBeCloseTo(37, 4);
    expect(cookXp(11)).toBeCloseTo(18.5, 4);
    expect(cookXp(15)).toBeCloseTo(18.5, 4);
    expect(cookXp(16)).toBeCloseTo(3.7, 4);
    expect(cookXp(20)).toBeCloseTo(3.7, 4);
    expect(cookXp(21)).toBeCloseTo(0.37, 4);
    const cookRow = row(mainHtml(cook(11), view('Cooking'), 0), 'Charcoal');
    expect(cookRow).toContain('<span class="tag">50% XP</span>');
    expect(cookRow).toContain('37 XP');

    const tail = newGame(0);
    setSkillLevel(tail, 'Woodcutting', 21);
    const before = tail.xp.Woodcutting ?? 0;
    expect(startGather(tail, PINE)).toBe(true);
    stepCompletion(tail);
    expect((tail.xp.Woodcutting ?? 0) - before).toBeCloseTo(0.42, 4);
    expect(tail.bank[PINE]).toBe(1);
    expect(tail.mastery[PINE]).toBe(actionMasteryXp(2.6));

    const farm = newGame(0);
    setSkillLevel(farm, 'Farming', 30);
    farm.bank['mat.seed.flax'] = 1;
    expect(plantOnPlot(farm, 0, FLAX, null)).toBe(true);
    creditOffline(farm, farm.plots[0]!.remainingMs);
    expect(farm.xp.Farming).toBe(XP_TABLE[30] + 26_550);

    const fight = newGame(0);
    setSkillLevel(fight, 'Strength', 39);
    setSkillLevel(fight, 'Attack', 39);
    setSkillLevel(fight, 'Hitpoints', 39);
    fight.hp = 2_000;
    const styleBefore = fight.xp.Strength ?? 0;
    const hpBefore = fight.xp.Hitpoints ?? 0;
    expect(startCombat(fight, 'meadow.hare', 'Strength')).toBe(true);
    expect(stepCompletion(fight).type).toBe('kill');
    expect((fight.xp.Strength ?? 0) - styleBefore).toBe(120);
    expect((fight.xp.Hitpoints ?? 0) - hpBefore).toBe(24);

    expect(falloffApplies('Farming', 'recipe')).toBe(false);
    expect(falloffApplies('Cooking', 'recipe')).toBe(true);
    expect(xpFalloff(21, 1)).toBe(0.01);
  });

  it('T2 sits on pine with no tool and no mastery', () => {
    const overnight = newGame(0);
    startGather(overnight, PINE);
    let actions = 0;
    let ms = 0;
    while (actionDurationMs(overnight, PINE) <= 8 * HOUR - ms + 1e-6) {
      ms += chop(overnight, PINE);
      actions += 1;
    }
    expect(actions).toBe(11_076);
    expect(ms).toBeCloseTo(28_797_600, 1);
    expect(8 * HOUR - ms).toBeCloseTo(2_400, 1);
    expect(overnight.xp.Woodcutting).toBeCloseTo(49_892.22, 4);
    expect(skillLevel(overnight, 'Woodcutting')).toBe(21);

    const to21 = newGame(0);
    startGather(to21, PINE);
    let elapsed = 0;
    while (actionDurationMs(to21, PINE) <= 14_079_000 - elapsed + 1e-6) elapsed += chop(to21, PINE);
    expect(elapsed).toBeCloseTo(14_079_000, 1);
    expect(to21.xp.Woodcutting).toBeCloseTo(47_514.6, 4);
    expect(skillLevel(to21, 'Woodcutting')).toBe(21);
  });

  it('T3 moves pine to maple to oak to bark at 10 / 20 / 30', () => {
    const state = newGame(0);
    state.nodes.push(MAPLE, OAK, BARK);
    const plan: [string, number][] = [
      [PINE, 10],
      [MAPLE, 20],
      [OAK, 30],
      [BARK, 40],
    ];
    let actions = 0;
    let ms = 0;
    for (const [nodeId, until] of plan) {
      while (skillLevel(state, 'Woodcutting') < until) {
        ms += chop(state, nodeId);
        actions += 1;
      }
    }
    expect(actions).toBe(3_056);
    expect(ms).toBeCloseTo(10_286_100, 1);
    expect(state.xp.Woodcutting).toBe(220_234);
    expect(skillLevel(state, 'Woodcutting')).toBe(40);
  });

  it('T4 previews and pays an 8h stream survey tick by tick', () => {
    setExpeditionDoubleRoll(() => false);
    const bare = streamXp(8 * HOUR);
    expect(bare.ticks).toBe(8_727);
    expect(bare.xp).toBeCloseTo(47_457.8, 4);
    expect(levelForXp(bare.xp)).toBe(20);
    expect(XP_TABLE[21] - bare.xp).toBeCloseTo(53.2, 4);

    const state = explorer(1);
    const preview = expeditionPreview(state, STREAM, EIGHT);
    expect(preview.ticks).toBe(8_727);
    // The verify sit is 47,457.8 with no mastery skill-XP bonus. The live haul
    // still applies the mastery 30 and maxed-track bonuses once those ticks land.
    expect(preview.xp).toBeCloseTo(47_635.4684, 4);
    expect(preview.xp).not.toBeCloseTo(47_457.8, 4);
    expect(preview.xp).not.toBe(226_902);
    expect(levelForXp(preview.xp)).toBe(21);
    expect(startExpedition(state, STREAM, EIGHT, 0)).toBe(true);
    creditOffline(state, EIGHT);
    expect(state.xp.Exploration).toBeCloseTo(preview.xp, 4);
    expect(skillLevel(state, 'Exploration')).toBe(21);
    expect(state.bank[AGATE]).toBe(8_727);
    const html = mainHtml(explorer(1), view('Exploration', EIGHT), 0);
    expect(row(html, 'Stream survey')).toContain('47,635.4684 XP');
    expect(row(html, 'Stream survey')).not.toContain('% XP');
  });

  it('T5 keeps an 8h Fitting appraisal from 30 at the room, and Bridge uses route level 40', () => {
    const state = explorer(30);
    const preview = expeditionPreview(state, FITTING, EIGHT);
    expect(preview.ticks).toBe(6_127);
    expect(preview.xp).toBe(117_933);
    expect(startExpedition(state, FITTING, EIGHT, 0)).toBe(true);
    creditOffline(state, EIGHT);
    expect(state.xp.Exploration).toBe(220_234);
    expect(state.xp.Exploration).toBe((XP_TABLE[30] ?? 0) + 117_933);

    expect(explorationRoute(BRIDGE)?.level).toBe(40);
    expect(explorationRoute(STREAM)?.level).toBe(1);
    expect(explorationRoute(FITTING)?.level).toBe(30);
    const below = explorer(39);
    const one = expeditionPreview(below, BRIDGE, 5_500);
    expect(one.ticks).toBe(1);
    expect(one.xp).toBe(111);
    expect(xpFalloff(40, 40)).toBe(1);
    expect(xpFalloff(40, 1)).toBe(0.01);
    const atCap = explorer(40);
    expect(expeditionPreview(atCap, BRIDGE, EIGHT).xp).toBe(0);
    const fittingRow = row(mainHtml(explorer(30), view('Exploration', EIGHT), 0), 'Fitting appraisal');
    expect(fittingRow).toContain('117,933 XP');
    expect(fittingRow).not.toContain('% XP');
  });

  it('T6 credits 8h of a 30h absence, grows crops inside that window, and finishes a packed 8h trip', () => {
    const away = newGame(0);
    startGather(away, PINE);
    const report = creditOffline(away, 30 * HOUR);
    expect(report.awayMs).toBe(30 * HOUR);
    expect(report.creditedMs).toBe(8 * HOUR);
    expect(report.capped).toBe(true);
    const html = reportHtml(report);
    expect(html).toContain('<dt>Credited</dt><dd>8 h 0 min (8h cut)</dd>');
    expect(html).toContain('Time past 8h was cut.');
    expect(OFFLINE_CAP_MS).toBe(8 * HOUR);
    expect(FULL_GAME_OFFLINE_CAP_MS).toBe(24 * HOUR);
    expect(SHOP_DAILY_LIMIT).toBe(25);
    expect(SHOP_WINDOW_MS).toBe(24 * HOUR);

    const replant = garden(true);
    plant(replant, 0, FLAX);
    plant(replant, 1, POTATO);
    plant(replant, 2, COTTON);
    plant(replant, 3, MUSHROOM);
    plant(replant, 4, HEMP);
    creditOffline(replant, 30 * HOUR);
    expect(replant.bank['mat.fibre.flax']).toBe(3_600);
    expect(replant.bank['mat.crop.potato']).toBe(3_600);
    expect(replant.bank['mat.fibre.cotton']).toBe(1_800);
    expect(replant.bank['mat.fungi.mushroom']).toBe(1_800);
    expect(replant.bank['mat.fibre.hemp']).toBe(1_800);

    const once = garden(false);
    plant(once, 0, FLAX);
    plant(once, 1, HEMP);
    creditOffline(once, 30 * HOUR);
    expect(once.bank['mat.fibre.flax']).toBe(1_800);
    expect(once.bank['mat.fibre.hemp']).toBe(1_800);
    expect(once.plots[0]).toBeNull();
    expect(once.plots[1]).toBeNull();

    const packed = explorer(1);
    setExpeditionDoubleRoll(() => false);
    expect(startExpedition(packed, STREAM, EIGHT, 0)).toBe(true);
    creditOffline(packed, 30 * HOUR);
    expect(packed.expedition).toBeNull();
    expect(packed.bank[AGATE]).toBe(8_727);

    const left = explorer(1);
    expect(startExpedition(left, STREAM, EIGHT, 0)).toBe(true);
    const partial = creditOffline(left, 2 * HOUR);
    expect(left.expedition?.creditedMs).toBe(2 * HOUR);
    expect(left.expedition?.durationMs).toBe(EIGHT);
    expect(partial.expeditionLine).toContain('out, 360:00 left');
    expect(left.bank[AGATE] ?? 0).toBe(0);
  });

  it('T7 counts the demo 8h pine chop with mastery, and keeps the 24h continuous count', () => {
    const state = newGame(0);
    startGather(state, PINE);
    const report = creditOffline(state, 8 * HOUR);
    expect(report.actions).toBe(11_605);
    expect(report.creditedMs).toBe(8 * HOUR);
    expect(state.progressMs).toBeCloseTo(320, 1);
    expect(1041 * actionMasteryXp(2.6)).toBeGreaterThanOrEqual(27_064);
    expect(1040 * actionMasteryXp(2.6)).toBeLessThan(27_064);

    const day = newGame(0);
    startGather(day, PINE);
    simulate(day, 24 * HOUR);
    expect(day.stats.actions).toBe(34_924);
    expect(FULL_GAME_OFFLINE_CAP_MS).toBe(24 * HOUR);
  });

  it('T8 loads an old save at format 4 without a new key or an XP change', () => {
    const state = newGame(0);
    setSkillLevel(state, 'Woodcutting', 21);
    state.xp.Woodcutting = (state.xp.Woodcutting ?? 0) + 0.25;
    const raw = JSON.parse(serialize(state)) as Record<string, unknown>;
    const fresh = JSON.parse(serialize(newGame(0))) as Record<string, unknown>;
    expect(raw.saveFormat).toBe(4);
    expect(SAVE_FORMAT).toBe(4);
    expect(Object.keys(raw).sort()).toEqual(Object.keys(fresh).sort());
    const loaded = deserialize(serialize(state));
    expect(loaded).not.toBeNull();
    expect(loaded!.saveFormat).toBe(4);
    expect(loaded!.xp.Woodcutting).toBe((XP_TABLE[21] ?? 0) + 0.25);
    chop(loaded!, PINE);
    expect(loaded!.xp.Woodcutting).toBeCloseTo((XP_TABLE[21] ?? 0) + 0.25 + 0.42, 4);
  });
});

function wood(level: number): Save {
  const state = newGame(0);
  setSkillLevel(state, 'Woodcutting', level);
  return state;
}

function cook(level: number): Save {
  const state = newGame(0);
  setSkillLevel(state, 'Cooking', level);
  state.bank[PINE] = 5;
  return state;
}

function garden(replant: boolean): Save {
  const state = newGame(0);
  setSkillLevel(state, 'Farming', 40);
  state.coins = 100_000;
  while (state.plotsBought < 7) expect(buyPlot(state)).toBe(true);
  if (replant) {
    state.autoReplant = true;
    state.autoReplantOn = true;
  }
  state.bank['mat.seed.flax'] = 20;
  state.bank['mat.seed.potato'] = 20;
  state.bank['mat.seed.cotton'] = 20;
  state.bank['mat.seed.hemp'] = 20;
  state.bank['mat.spawn.mushroom'] = 20;
  state.bank['mat.wood.oak'] = 20;
  return state;
}

function plant(state: Save, index: number, recipeId: string): void {
  expect(plantOnPlot(state, index, recipeId, null)).toBe(true);
}

/** No mastery skill-XP bonus. This is the verify.py stream sit. */
function streamXp(windowMs: number): { ticks: number; xp: number } {
  const tick = 3_300;
  const ticks = Math.floor(windowMs / tick);
  let xp = 0;
  for (let i = 0; i < ticks; i += 1) {
    const gain = 26 * xpFalloff(levelForXp(xp), 1);
    const next = Math.min(220_234, Math.round((xp + gain) * 10000) / 10000);
    xp = next;
    if (xp >= 220_234) break;
  }
  return { ticks, xp };
}
