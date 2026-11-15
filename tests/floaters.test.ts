import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { ITEMS, XP_TABLE } from '../src/content';
import { advanceOpenTab, newGame, setFood, startCombat, startGather, type FloatNote } from '../src/engine';
import { FLOAT_CAP, combatAnchor, formatActionNotes, formatCombatAmount, notesWhileSheetOpen, presentNotes } from '../src/floaters';

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
    expect(formatActionNotes([{ kind: 'action', skill: 'Construction', xp: 1, itemId: 'con.kit.pine_frame', qty: 4 }]))
      .toBe('+1 XP\n+4 Pine frame kits');
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
      { tone: 'heal', place: 'combat', text: '+5', anchor: 'player' },
      { tone: 'player', place: 'combat', text: '3.8', anchor: 'enemy' },
    ]);
    expect(shown.length).toBe(FLOAT_CAP);
    expect(presentNotes([{ kind: 'miss', side: 'player' }])).toEqual([
      { tone: 'miss', place: 'combat', text: 'Miss', anchor: 'enemy' },
    ]);
    expect(presentNotes([{ kind: 'miss', side: 'enemy' }])).toEqual([
      { tone: 'enemy', place: 'combat', text: 'Miss', anchor: 'player' },
    ]);
    expect(presentNotes([{ kind: 'enemy-hit', amount: 2 }])[0]).toMatchObject({ text: '-2', anchor: 'player' });
    expect(presentNotes([{ kind: 'player-hit', amount: 150 }])[0]).toMatchObject({ text: '150', anchor: 'enemy' });
    expect(presentNotes([{ kind: 'enemy-hit', amount: 1234 }])[0]).toMatchObject({ text: '-1,234', anchor: 'player' });
    expect(presentNotes([{ kind: 'heal', amount: 1234 }])[0]).toMatchObject({ text: '+1,234', anchor: 'player' });
    expect(formatCombatAmount(3.75)).toBe('3.8');
    expect(combatAnchor({ kind: 'player-hit', amount: 1 })).toBe('enemy');
    expect(combatAnchor({ kind: 'miss', side: 'player' })).toBe('enemy');
    expect(combatAnchor({ kind: 'enemy-hit', amount: 1 })).toBe('player');
    expect(combatAnchor({ kind: 'miss', side: 'enemy' })).toBe('player');
    expect(combatAnchor({ kind: 'heal', amount: 1 })).toBe('player');
  });

  it('records a miss, a hit amount, and a heal from the real rolls', () => {
    let foundPlayerMiss = false;
    let foundEnemyMiss = false;
    for (let seed = 1; seed < 40 && (!foundPlayerMiss || !foundEnemyMiss); seed += 1) {
      const miss = newGame(0, seed);
      miss.owned.push('Strength', 'Attack', 'Defence', 'Hitpoints');
      miss.xp.Strength = 0;
      miss.xp.Attack = 0;
      miss.xp.Defence = XP_TABLE[30];
      miss.xp.Hitpoints = XP_TABLE[30];
      miss.hp = 200;
      startCombat(miss, 'meadow.hare', 'Strength');
      const missed: FloatNote[] = [];
      advanceOpenTab(miss, 2400, 5000, missed);
      if (missed.some((note) => note.kind === 'miss' && note.side === 'player')) foundPlayerMiss = true;
      const player = missed.find((note) => note.kind === 'player-hit');
      if (missed.some((note) => note.kind === 'miss' && note.side === 'enemy')) {
        foundEnemyMiss = true;
        if (player && player.kind === 'player-hit') {
          expect(player.amount).toBeGreaterThanOrEqual(29);
          expect(player.amount).toBeLessThanOrEqual(32);
        }
      }
    }
    expect(foundPlayerMiss).toBe(true);
    expect(foundEnemyMiss).toBe(true);

    let healed = false;
    for (let seed = 1; seed < 30 && !healed; seed += 1) {
      const hit = newGame(0, seed);
      hit.owned.push('Strength', 'Attack', 'Hitpoints');
      hit.xp.Attack = XP_TABLE[30];
      hit.hp = 70;
      hit.bank['food.roast_minnows'] = 2;
      expect(setFood(hit, 'food.roast_minnows')).toBe(true);
      startCombat(hit, 'meadow.hare', 'Strength');
      const notes: FloatNote[] = [];
      advanceOpenTab(hit, 2400, 5000, notes);
      const enemy = notes.find((note) => note.kind === 'enemy-hit');
      const heal = notes.find((note) => note.kind === 'heal');
      const player = notes.find((note) => note.kind === 'player-hit');
      if (!enemy || enemy.kind !== 'enemy-hit' || !heal || heal.kind !== 'heal') continue;
      expect(enemy.amount === 10 || enemy.amount === 11).toBe(true);
      expect(heal.amount).toBe(50);
      expect(hit.hp).toBe(70 - enemy.amount + 50);
      expect(player && player.kind === 'player-hit' && player.amount >= 29 && player.amount <= 32).toBe(true);
      healed = true;
    }
    expect(healed).toBe(true);
  });

  it('does not collect notes for an offline catch-up', () => {
    const state = newGame(0);
    startGather(state, 'mat.wood.pine');
    const notes: FloatNote[] = [];
    const report = advanceOpenTab(state, 60_000, 5000, notes);
    expect(report?.actions).toBeGreaterThan(1);
    expect(notes).toEqual([]);
  });

  it('suppresses pop-ups while a sheet is open', async () => {
    const notes: FloatNote[] = [{ kind: 'action', skill: 'Woodcutting', xp: 42, itemId: 'mat.wood.pine', qty: 1 }];
    expect(notesWhileSheetOpen(notes, true)).toEqual([]);
    expect(notesWhileSheetOpen(notes, false)).toEqual(notes);
    const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>
      <div class="sheet" data-milestone-sheet></div>
      <div id="floaters"><div class="floater">+42 XP</div></div>
    </body></html>`);
    expect(await page.locator('#floaters').evaluate((el) => getComputedStyle(el).display)).toBe('none');
    await page.evaluate(() => document.querySelector('.sheet')?.remove());
    expect(await page.locator('#floaters').evaluate((el) => getComputedStyle(el).display)).toBe('flex');
    await browser.close();
  });

  it('reserves the sword icon for swords', () => {
    expect(ITEMS['enc.gear.neck.quarry_undercroft_amulet']?.icon).toBe('pendant');
    expect(ITEMS['gear.neck.shellback_scute_amulet']?.icon).toBe('pendant');
    for (const id of ['gear.melee.bronze_sword', 'gear.melee.iron_sword', 'gear.melee.steel_sword']) {
      expect(ITEMS[id]?.icon).toBe('sword');
    }
    const stillSword = Object.values(ITEMS)
      .filter((item) => item.icon === 'sword' && item.kind === 'gear' && !item.id.includes('.melee.'))
      .map((item) => item.name);
    expect(stillSword).toEqual([]);
  });
});
