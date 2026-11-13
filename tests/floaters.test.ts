import { describe, expect, it } from 'vitest';
import { XP_TABLE } from '../src/content';
import { advanceOpenTab, newGame, setFood, startCombat, startGather, type FloatNote } from '../src/engine';
import { FLOAT_CAP, formatActionNotes, presentNotes } from '../src/floaters';

describe('action and combat floaters', () => {
  it('records the real XP and item for a completed gather', () => {
    const state = newGame(0);
    state.owned.push('Mining');
    state.xp.Mining = 0;
    startGather(state, 'mat.ore.copper');
    const notes: FloatNote[] = [];
    expect(advanceOpenTab(state, 2900, 5000, notes)).toBeNull();
    expect(notes).toEqual([{ kind: 'action', skill: 'Mining', xp: 46, itemId: 'mat.ore.copper', qty: 1 }]);
    expect(formatActionNotes(notes as Extract<FloatNote, { kind: 'action' }>[]))
      .toBe('+46 XP\n+1 Copper ore');
  });

  it('merges a short burst into one popup and caps the screen', () => {
    const notes: FloatNote[] = [
      { kind: 'action', skill: 'Woodcutting', xp: 42, itemId: 'mat.wood.pine', qty: 1 },
      { kind: 'action', skill: 'Woodcutting', xp: 42, itemId: 'mat.wood.pine', qty: 1 },
      { kind: 'player-hit', amount: 3 },
      { kind: 'miss', side: 'player' },
      { kind: 'enemy-hit', amount: 2 },
      { kind: 'heal', amount: 5 },
      { kind: 'player-hit', amount: 3.75 },
    ];
    const shown = presentNotes(notes);
    expect(shown).toEqual([
      { tone: 'action', place: 'bar', text: '+84 XP\n+2 Pine logs' },
      { tone: 'heal', place: 'combat', text: '+5' },
      { tone: 'player', place: 'combat', text: '3.8' },
    ]);
    expect(shown.length).toBe(FLOAT_CAP);
    expect(presentNotes([{ kind: 'miss', side: 'player' }])).toEqual([
      { tone: 'miss', place: 'combat', text: 'Miss' },
    ]);
    expect(presentNotes([{ kind: 'miss', side: 'enemy' }])).toEqual([
      { tone: 'enemy', place: 'combat', text: 'Miss' },
    ]);
    expect(presentNotes([{ kind: 'enemy-hit', amount: 2 }])[0].text).toBe('-2');
  });

  it('records a miss, a hit amount, and a heal from the real rolls', () => {
    const miss = newGame(0, 7);
    miss.owned.push('Strength', 'Attack', 'Defence', 'Hitpoints');
    miss.xp.Strength = 0;
    miss.xp.Attack = 0;
    miss.xp.Defence = XP_TABLE[30];
    miss.xp.Hitpoints = XP_TABLE[30];
    miss.hp = 70;
    startCombat(miss, 'meadow.beetle', 'Strength');
    const missed: FloatNote[] = [];
    advanceOpenTab(miss, 2400, 5000, missed);
    expect(missed).toContainEqual({ kind: 'miss', side: 'player' });

    const glancing = newGame(0, 1);
    glancing.owned.push('Strength');
    startCombat(glancing, 'meadow.hare', 'Strength');
    const enemyMiss: FloatNote[] = [];
    advanceOpenTab(glancing, 2400, 5000, enemyMiss);
    expect(enemyMiss).toContainEqual({ kind: 'miss', side: 'enemy' });
    expect(enemyMiss).toContainEqual({ kind: 'player-hit', amount: 3 });

    const hit = newGame(0, 8);
    hit.owned.push('Strength', 'Attack', 'Hitpoints');
    hit.xp.Attack = XP_TABLE[30];
    hit.hp = 6;
    hit.bank['food.roast_minnows'] = 2;
    expect(setFood(hit, 'food.roast_minnows')).toBe(true);
    startCombat(hit, 'meadow.hare', 'Strength');
    const notes: FloatNote[] = [];
    advanceOpenTab(hit, 2400, 5000, notes);
    expect(notes).toContainEqual({ kind: 'enemy-hit', amount: 1 });
    expect(notes).toContainEqual({ kind: 'heal', amount: 5 });
    expect(notes).toContainEqual({ kind: 'player-hit', amount: 3 });
    expect(hit.hp).toBe(10);
  });

  it('does not collect notes for an offline catch-up', () => {
    const state = newGame(0);
    startGather(state, 'mat.wood.pine');
    const notes: FloatNote[] = [];
    const report = advanceOpenTab(state, 60_000, 5000, notes);
    expect(report?.actions).toBeGreaterThan(1);
    expect(notes).toEqual([]);
  });
});
