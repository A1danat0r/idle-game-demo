import { describe, expect, it } from 'vitest';
import { XP_TABLE } from '../src/content';
import { activityHtml } from '../src/ui';
import { newGame, startGather } from '../src/engine';
import { activityNextLine, combatNextLine } from '../src/milestones';
import { mainHtml, type View } from '../src/ui';

function view(tab: View['tab'], extra: Partial<View> = {}): View {
  return {
    tab,
    skill: 'Woodcutting',
    filter: 'all',
    selected: 'meadow.beetle',
    area: 'Meadow verge',
    style: null,
    message: '',
    ...extra,
  };
}

describe('milestone next row and sheet', () => {
  it('shows the worked Woodcutting row and hides it when nothing is running', () => {
    const state = newGame(0);
    expect(activityNextLine(state)).toBeNull();
    state.xp.Woodcutting = 13_726;
    state.mastery['mat.wood.pine'] = 4_798;
    expect(startGather(state, 'mat.wood.pine')).toBe(true);
    expect(activityNextLine(state)).toBe(
      'Next: oak logs at Woodcutting 20 (29,546 XP) · Pine mastery 10: +5% sell (1,274 MXP, 49 actions).',
    );
    const html = mainHtml(state, view('skill'), 0);
    expect(html).toContain('Next: oak logs at Woodcutting 20 (29,546 XP)');
    expect(html).toContain('Pine mastery 10: +5% sell (1,274 MXP, 49 actions).');
    expect(activityHtml(state)).not.toContain('Next:');
    expect(html).not.toContain('data-tab="milestones"');

    const idle = newGame(0);
    expect(mainHtml(idle, view('skill'), 0)).not.toContain('data-milestone-open');
  });

  it('lists Woodcutting unlocks and perk thresholds in the sheet', () => {
    const state = newGame(0);
    state.xp.Woodcutting = XP_TABLE[10];
    state.mastery['mat.wood.pine'] = 4_798;
    startGather(state, 'mat.wood.pine');
    const html = mainHtml(state, view('skill', { milestoneOpen: true }), 0);
    for (const name of ['Pine logs', 'Resin', 'Maple logs', 'Oak logs', 'Bark strips', 'Willow rods', 'Ash logs', 'Ash spear shafts']) {
      expect(html).toContain(name);
    }
    expect(html).toContain('29,546 XP remaining');
    expect(html).toContain('Mastery 10: +5% sell');
    expect(html).toContain('Mastery 20: −5% action time');
    expect(html).toContain('Mastery 30: +5% XP');
    expect(html).toContain('Mastery 40: 5% double output');
    expect(html).toContain('Used by');
    expect(html).toContain('Iron axe');
    expect(html).toContain('data-milestone-track="mat.wood.oak"');
  });

  it('shows the beetle row and sheet, and moves on after an offline jump', () => {
    const state = newGame(0);
    state.owned.push('Attack', 'Hitpoints');
    state.enemyKills['meadow.beetle'] = 1000;
    expect(combatNextLine(state, 'meadow.beetle')).toBe(
      'Thorn beetle mastery 40 in 118 kills · +10% loot coins from kill 1,119.',
    );
    const html = mainHtml(state, view('combat', { milestoneOpen: true, selected: 'meadow.beetle' }), 0);
    expect(html).toContain('Thorn beetle mastery 40 in 118 kills');
    expect(html).toContain('60 kills · mastery 10');
    expect(html).toContain('266 kills · mastery 20');
    expect(html).toContain('619 kills · mastery 30');
    expect(html).toContain('1,118 kills · mastery 40');
    expect(html).toContain('First Thorn beetle kill opens Woodland edge');
    expect(activityHtml(state)).not.toContain('1,119');

    state.xp.Woodcutting = XP_TABLE[20];
    state.mastery['mat.wood.pine'] = 6_072;
    startGather(state, 'mat.wood.pine');
    expect(activityNextLine(state)).toContain('Bark strips and willow rods at Woodcutting 30');
    expect(activityNextLine(state)).toContain('Pine mastery 20: −5% action time');
  });
});
