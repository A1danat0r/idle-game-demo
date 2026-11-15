import { describe, expect, it } from 'vitest';
import { XP_TABLE } from '../src/content';
import { activityHtml } from '../src/ui';
import { newGame, startGather, startProduce } from '../src/engine';
import { activityNextLine, combatNextLine, masteryHeading } from '../src/milestones';
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
    expect(html).toContain('Level 1 · Reached');
    expect(html).toContain('Level 20 · 29,546 XP to go');
    expect(html).toContain('1,274 MXP to go');
    expect(html).not.toContain('XP remaining');
    expect(html).not.toContain('Level 20 · Lv 20');
    expect(html).toContain('Mastery 10: +5% sell');
    expect(html).toContain('Mastery 20: −5% action time');
    expect(html).toContain('Mastery 30: +5% XP');
    expect(html).toContain('Mastery 40: 5% double output');
    expect(html).toContain('<h3>Used by</h3>');
    expect(html).toContain('<h3>Pine mastery</h3>');
    expect(masteryHeading('mat.wood.pine')).toBe('Pine mastery');
    expect(masteryHeading('')).toBe('Mastery');
    const usedAt = html.indexOf('<h3>Used by</h3>');
    const masteryAt = html.indexOf('<h3>Pine mastery</h3>');
    const perkAt = html.indexOf('Mastery 10: +5% sell');
    const pickerAt = html.indexOf('data-milestone-track="mat.wood.oak"');
    expect(usedAt).toBeGreaterThan(-1);
    expect(masteryAt).toBeGreaterThan(usedAt);
    expect(perkAt).toBeGreaterThan(masteryAt);
    expect(pickerAt).toBeGreaterThan(perkAt);
    expect(html).toContain('Iron axe');
  });

  it('names the mastery track and hides Used by when nothing uses the skill', () => {
    const cooking = newGame(0);
    cooking.owned.push('Cooking');
    cooking.xp.Cooking = 0;
    cooking.bank['mat.fish.minnow'] = 2;
    expect(startProduce(cooking, 'recipe.food.roast_minnows')).toBe(true);
    const html = mainHtml(cooking, view('skill', { skill: 'Cooking', milestoneOpen: true }), 0);
    expect(html).toContain('<h3>Roast minnows mastery</h3>');
    expect(html).not.toContain('<h3>Used by</h3>');
    expect(html).toContain('Mastery 10: +5% sell');
    expect(html.indexOf('data-milestone-track=')).toBeGreaterThan(html.indexOf('<h3>Roast minnows mastery</h3>'));
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
