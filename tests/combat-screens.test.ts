import { describe, expect, it } from 'vitest';
import { ENEMY_BY_ID, XP_TABLE } from '../src/content';
import { newGame, startCombat } from '../src/engine';
import { combatBackScreen, combatScreenFor, mainHtml, type View } from '../src/ui';

function fighter(): ReturnType<typeof newGame> {
  const state = newGame(0);
  state.owned.push('Strength', 'Attack', 'Hitpoints');
  state.xp.Attack = XP_TABLE[1];
  state.xp.Strength = XP_TABLE[1];
  state.xp.Hitpoints = XP_TABLE[1];
  return state;
}

function view(combatScreen: View['combatScreen'], area: View['area'] = 'Meadow verge', selected = 'meadow.hare'): View {
  return {
    tab: 'combat',
    skill: 'Woodcutting',
    filter: 'all',
    selected,
    area,
    style: 'Strength',
    message: '',
    combatScreen,
  };
}

describe('combat screens', () => {
  it('opens on Fight when a fight is running or paused, and on Areas otherwise', () => {
    const idle = fighter();
    expect(combatScreenFor(idle, view(undefined))).toBe('areas');
    startCombat(idle, 'meadow.hare', 'Strength');
    expect(combatScreenFor(idle, view(undefined))).toBe('fight');
    idle.paused = true;
    expect(combatScreenFor(idle, view(undefined))).toBe('fight');
    const html = mainHtml(idle, view(undefined), 0);
    expect(html).toContain('Style: Strength');
    expect(html).toContain('data-milestone-open');
    expect(html).toContain('Drops');
    expect(html).toContain('Food');
  });

  it('goes back from Fight to the ladder and then Areas without stopping the fight', () => {
    const state = fighter();
    startCombat(state, 'meadow.hare', 'Strength');
    const running = state.activity;
    expect(combatBackScreen(view('fight'))).toBe('ladder');
    expect(combatBackScreen(view('ladder'))).toBe('areas');
    expect(combatBackScreen(view('teaser', '???'))).toBe('areas');
    const ladder = mainHtml(state, view('ladder'), 0);
    expect(ladder).toContain('In fight');
    expect(ladder).toContain('data-combat-back');
    expect(ladder).not.toContain('data-milestone-open');
    const areas = mainHtml(state, view('areas'), 0);
    expect(areas).toContain('In fight: Burrowing hare');
    expect(areas).not.toContain('data-milestone-open');
    expect(state.activity).toBe(running);
    expect(state.activity).toMatchObject({ kind: 'combat', enemyId: 'meadow.hare' });
  });

  it('keeps a locked rung Fight from starting or switching the running fight', () => {
    const state = fighter();
    expect(startCombat(state, 'meadow.hare', 'Strength')).toBe(true);
    expect(startCombat(state, 'meadow.rat', 'Strength')).toBe(false);
    expect(state.activity).toMatchObject({ kind: 'combat', enemyId: 'meadow.hare' });
    const html = mainHtml(state, view('ladder', 'Meadow verge', 'meadow.rat'), 0);
    expect(html).toContain('data-fight="meadow.rat" disabled');
    expect(html).toContain('Kill 12 burrowing hares to unlock (0/12)');
    expect(html).not.toContain('data-fight="meadow.hare" disabled');
  });

  it('shows each rung max hit from the enemy data, with the training chips', () => {
    const state = fighter();
    const html = mainHtml(state, view('ladder'), 0);
    const hare = ENEMY_BY_ID['meadow.hare'];
    const beetle = ENEMY_BY_ID['meadow.beetle'];
    expect(html).toContain(`${hare.hp} HP - max hit ${hare.maxHit}`);
    expect(html).toContain(`${beetle.hp} HP - max hit ${beetle.maxHit}`);
    expect(html).toContain('Training');
    expect(html).toContain('data-style="Strength"');
    expect(html).toContain('data-style="Attack"');
    expect(html).toContain('>BOSS<');
    expect(html).not.toContain('>Enemies<');
  });
});
