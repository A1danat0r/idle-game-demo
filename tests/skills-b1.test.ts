import { describe, expect, it } from 'vitest';
import {
  DEMO_PURCHASE_SLOTS,
  ITEMS,
  NODES,
  SKILL_GROUPS,
  TOOL_TIME_FACTOR,
  nodeCost,
  skillPrice,
} from '../src/content';
import { actionSeconds, bankHasSpace, buySkill, newGame } from '../src/engine';
import { mainHtml, type View } from '../src/ui';

const view = (): View => ({
  tab: 'skills',
  skill: 'Woodcutting',
  filter: 'all',
  selected: null,
  area: 'Meadow verge',
  style: null,
  message: '',
});

describe('B1 skills and gathering', () => {
  it('sells the nine new skills in any order from the one price table', () => {
    expect(DEMO_PURCHASE_SLOTS).toBe(16);
    const first = newGame(0);
    expect(first.owned).toEqual(['Woodcutting']);
    first.coins = 750;
    expect(buySkill(first, 'Foraging')).toBe(true);
    expect(first.coins).toBe(0);
    expect(first.purchaseCount).toBe(1);
    expect(first.owned).toContain('Foraging');
    expect(first.owned).not.toContain('Hitpoints');

    const magic = newGame(0);
    magic.coins = 750 + 1036;
    expect(buySkill(magic, 'Magic')).toBe(true);
    expect(magic.owned).toContain('Hitpoints');
    expect(buySkill(magic, 'Enchanting')).toBe(true);
    expect(magic.purchaseCount).toBe(2);
    expect(magic.coins).toBe(0);

    const priced = newGame(0);
    priced.owned.push('Cooking', 'Mining', 'Smithing', 'Strength', 'Defence', 'Attack', 'Fishing', 'Hitpoints');
    priced.purchaseCount = 7;
    priced.coins = 17389;
    expect(buySkill(priced, 'Foraging')).toBe(true);
    expect(priced.coins).toBe(0);
    expect(priced.purchaseCount).toBe(8);
    expect(skillPrice(15)).toBe(746839);
  });

  it('adds the 16 Foraging nodes and 2 Exploration surveys, and no gap nodes', () => {
    const foraging = NODES.filter((node) => node.skill === 'Foraging' && node.level <= 30);
    const exploration = NODES.filter((node) => node.skill === 'Exploration');
    expect(foraging).toHaveLength(16);
    expect(exploration).toHaveLength(2);
    expect(foraging[0]).toMatchObject({ id: 'mat.herb.meadow', level: 1, seconds: 2.8, xp: 45, cost: 0 });
    expect(NODES.find((node) => node.id === 'mat.seed.potato')).toMatchObject({
      level: 5,
      seconds: 3.0,
      xp: 48,
      cost: nodeCost(5),
    });
    expect(nodeCost(5)).toBe(188);
    expect(NODES.find((node) => node.id === 'mat.seed.wheat')).toMatchObject({ level: 30, seconds: 4.1, xp: 95, cost: 6750 });
    expect(exploration[0]).toMatchObject({ id: 'mat.gem.weathered_agate', seconds: 3.4, xp: 27, cost: 0 });
    expect(ITEMS['mat.gem.weathered_agate'].sell).toBe(1);
    expect(ITEMS['mat.relic.weathered_slate'].sell).toBe(3);
    expect(NODES.filter((node) => node.skill === 'Foraging')).toHaveLength(22);
  });

  it('applies the tool step to Fishing and Foraging and leaves Exploration alone', () => {
    const state = newGame(0);
    expect(actionSeconds(state, 'mat.fish.minnow')).toBeCloseTo(3.2, 5);
    expect(actionSeconds(state, 'mat.herb.meadow')).toBeCloseTo(2.8, 5);
    state.bank['tool.fishing.bronze_rod'] = 1;
    state.bank['tool.foraging.bronze_sickle'] = 1;
    expect(actionSeconds(state, 'mat.fish.minnow')).toBeCloseTo(3.2 * TOOL_TIME_FACTOR, 5);
    expect(actionSeconds(state, 'mat.herb.meadow')).toBeCloseTo(2.8 * TOOL_TIME_FACTOR, 5);
    expect(actionSeconds(state, 'mat.gem.weathered_agate')).toBeCloseTo(3.4, 5);
    state.bank['tool.fishing.iron_rod'] = 1;
    expect(actionSeconds(state, 'mat.fish.minnow')).toBeCloseTo(3.2 * TOOL_TIME_FACTOR ** 2, 5);
    expect(bankHasSpace(state)).toBe(true);
  });

  it('groups the six tabs worth of skills without adding a tab', () => {
    const html = mainHtml(newGame(0), view(), 0);
    const combat = html.indexOf('>Combat<');
    const gathering = html.indexOf('>Gathering<');
    const production = html.indexOf('>Production<');
    expect(combat).toBeGreaterThan(0);
    expect(gathering).toBeGreaterThan(combat);
    expect(production).toBeGreaterThan(gathering);
    expect(html.indexOf('Foraging')).toBeGreaterThan(gathering);
    expect(html.indexOf('Foraging')).toBeLessThan(production);
    expect(html.indexOf('Ranged')).toBeGreaterThan(combat);
    expect(html.indexOf('Ranged')).toBeLessThan(gathering);
    expect(html.indexOf('Crafting')).toBeGreaterThan(production);
    expect(SKILL_GROUPS).toHaveLength(3);
  });
});
