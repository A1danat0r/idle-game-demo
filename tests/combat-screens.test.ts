import { describe, expect, it } from 'vitest';
import { ENEMY_BY_ID, XP_TABLE } from '../src/content';
import { newGame, simulate, startCombat, stopActivity } from '../src/engine';
import { combatBackScreen, combatScreenFor, combatStyleChoice, mainHtml, type View } from '../src/ui';

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
    expect(html).toContain(`${hare.hp} HP · max hit ${hare.maxHit}`);
    expect(html).not.toContain('HP - max hit');
    expect(html).toContain('Training');
    expect(html).toContain('data-style="Strength"');
    expect(html).toContain('data-style="Attack"');
    expect(html).toContain('>BOSS<');
    expect(html).toContain('aria-label="Locked"');
    expect(html).not.toContain('[lock]');
    expect(html).not.toContain('>Enemies<');
    const beetleAt = html.indexOf('Thorn beetle');
    expect(html.slice(beetleAt, beetleAt + 500)).not.toContain('350 HP');
  });

  it('defaults the chip to the first owned style, then to the last fight, without showing unowned styles', () => {
    const fresh = fighter();
    const open = mainHtml(fresh, { ...view('ladder'), style: null }, 0);
    expect(open).toContain('class="tag on" data-style="Attack"');
    expect(open).toContain('data-style="Strength"');
    expect(open).not.toContain('data-style="Ranged"');
    expect(open).not.toContain('data-style="Magic"');

    startCombat(fresh, 'meadow.hare', 'Strength');
    stopActivity(fresh);
    const again = mainHtml(fresh, { ...view('ladder'), style: 'Strength' }, 0);
    expect(again).toContain('class="tag on" data-style="Strength"');
    expect(again).not.toContain('class="tag on" data-style="Attack"');

    fresh.owned.push('Ranged');
    const bought = mainHtml(fresh, { ...view('ladder'), style: 'Strength' }, 0);
    expect(bought).toContain('data-style="Ranged"');
    expect(bought).not.toContain('class="tag on" data-style="Ranged"');
  });

  it('shows the running fight style in the header and keeps XP on that style when the chip changes', () => {
    const state = fighter();
    startCombat(state, 'meadow.hare', 'Attack');
    const strength = state.xp.Strength;
    const screen = { ...view('fight'), style: 'Strength' as const };
    const html = mainHtml(state, screen, 0);
    expect(html).toContain('Style: Attack');
    expect(html).toContain('Next fight: Strength');
    expect(html).not.toContain('Style: Strength');
    expect(combatStyleChoice(state, screen)).toBe('Strength');
    simulate(state, 8000);
    expect(state.activity).toMatchObject({ kind: 'combat', enemyId: 'meadow.hare', style: 'Attack' });
    expect(state.xp.Strength).toBe(strength);
    expect(startCombat(state, 'meadow.rat', 'Strength')).toBe(false);
    expect(state.activity).toMatchObject({ enemyId: 'meadow.hare', style: 'Attack' });
  });

  it('uses All n open without the check until the boss kill, and omits n/12 on an open boss', () => {
    const meadow = fighter();
    meadow.enemyKills['meadow.hare'] = 12;
    meadow.enemyKills['meadow.rat'] = 12;
    meadow.enemyKills['meadow.ram'] = 12;
    meadow.enemyKills['meadow.moss'] = 12;
    const mid = mainHtml(meadow, view('areas'), 0);
    expect(mid).toContain('All 5 open');
    expect(mid).toContain('Boss Thorn beetle: not beaten');
    expect(mid).not.toContain('Boss beaten ✓');
    expect(mid).not.toContain('→');
    startCombat(meadow, 'meadow.beetle', 'Strength');
    stopActivity(meadow);
    expect(mainHtml(meadow, view('areas'), 0)).toContain('Boss Thorn beetle: not beaten');
    meadow.enemyKills['meadow.beetle'] = 1;
    expect(mainHtml(meadow, view('areas'), 0)).toContain('All 5 open · Boss beaten ✓');

    const wood = fighter();
    wood.enemyKills['meadow.beetle'] = 1;
    for (const id of ['wood.fox', 'wood.jay', 'wood.tortoise', 'wood.grub', 'wood.boar']) wood.enemyKills[id] = 12;
    const unlocked = mainHtml(wood, { ...view('areas'), area: 'Woodland edge' }, 0);
    expect(unlocked).toContain('All 6 open');
    expect(unlocked).toContain('Boss Hedge poacher: not beaten');
    wood.enemyKills['wood.poacher'] = 1;
    expect(mainHtml(wood, view('areas'), 0)).toContain('All 6 open · Boss beaten ✓');

    const boss = mainHtml(meadow, view('ladder'), 0);
    expect(boss).toContain('12/12 done');
    const beetleAt = boss.indexOf('Thorn beetle');
    const beetle = boss.slice(beetleAt, beetleAt + 400);
    expect(beetle).toContain('BOSS');
    expect(beetle).toContain('350 HP · max hit 20');
    expect(beetle).not.toContain('/12');
  });

  it('opens a locked Woodland ladder on the area-gate copy, then the 12-kill copy after the beetle', () => {
    const locked = fighter();
    const html = mainHtml(locked, view('ladder', 'Woodland edge', 'wood.fox'), 0);
    const card = mainHtml(locked, view('areas'), 0);
    expect(card).toContain('aria-label="Locked"');
    expect(card).not.toContain('[lock]');
    expect(card).toContain('Kill the Thorn beetle to open Woodland edge.');
    for (const name of ['Forest fox', 'Berry jay', 'Root tortoise', 'Resin grub', 'Wild boar', 'Hedge poacher']) {
      expect(html).toContain(name);
    }
    expect(html.match(/Kill the Thorn beetle to open Woodland edge\./g)?.length).toBe(6);
    expect(html.match(/data-fight="[^"]+" disabled/g)?.length).toBe(6);
    expect(html).not.toContain('HP · max hit');
    expect(html).not.toContain('Mastery Lv');

    locked.enemyKills['meadow.beetle'] = 1;
    const open = mainHtml(locked, view('ladder', 'Woodland edge', 'wood.fox'), 0);
    expect(open).toContain('data-fight="wood.fox"');
    expect(open).not.toContain('data-fight="wood.fox" disabled');
    const fox = open.slice(open.indexOf('Forest fox'), open.indexOf('Berry jay'));
    expect(fox).not.toContain('Kill the Thorn beetle');
    expect(open).toContain('Kill 12 forest foxes to unlock (0/12)');
    const openAreas = mainHtml(locked, view('areas'), 0);
    const wood = openAreas.slice(openAreas.indexOf('Woodland edge'), openAreas.indexOf('???'));
    expect(wood).not.toContain('aria-label="Locked"');
  });

  it('keeps ??? on Areas until the poacher kill, then opens an empty teaser', () => {
    const state = fighter();
    const before = mainHtml(state, view('areas'), 0);
    expect(before).toContain('Kill the Hedge poacher to open ??? (coming later)');
    expect(before).toContain('aria-label="Locked"');
    expect(before).not.toContain('[lock]');
    expect(before).not.toContain('data-open-area="???"');
    startCombat(state, 'wood.poacher', 'Strength');
    expect(startCombat(state, 'wood.poacher', 'Strength')).toBe(false);
    expect(mainHtml(state, view('areas'), 0)).not.toContain('data-open-area="???"');

    state.enemyKills['wood.poacher'] = 1;
    const after = mainHtml(state, view('areas'), 0);
    expect(after).toContain('??? — coming later');
    expect(after).toContain('data-open-area="???"');
    expect(after).toContain('aria-label="Locked"');
    expect(after).not.toContain('[lock]');
    const teaser = mainHtml(state, view('teaser', '???'), 0);
    expect(teaser).toContain('disabled>Fight</button>');
    expect(teaser).not.toContain('data-enemy');
    expect(teaser).not.toContain('data-fight');
    expect(teaser).toContain('data-loadout');
    expect(teaser).toContain('Food');
    expect(teaser).not.toContain('data-stop');
    startCombat(state, 'meadow.hare', 'Strength');
    const during = mainHtml(state, view('teaser', '???'), 0);
    expect(during).toContain('data-stop');
    expect(state.activity).toMatchObject({ enemyId: 'meadow.hare', style: 'Strength' });
  });

  it('previews a locked row at full HP without a fight, and does not switch a running one', () => {
    const idle = fighter();
    idle.bank['food.roast_hare'] = 1;
    const preview = mainHtml(idle, view('fight', 'Meadow verge', 'meadow.rat'), 0);
    expect(preview).toContain('200/200 · max hit 10');
    expect(preview).toContain('Mastery Lv 1');
    expect(preview).toContain('data-fight="meadow.rat" disabled');
    expect(preview).not.toContain('data-stop');
    expect(preview).toContain('Next: Field rat mastery 10 in 60 kills.');
    expect(preview).toContain('&gt;</button>');
    expect(preview).toContain('data-loadout');
    expect(preview).toContain('data-food');
    expect(idle.activity).toBeNull();

    const running = fighter();
    startCombat(running, 'meadow.hare', 'Strength');
    const during = mainHtml(running, view('fight', 'Meadow verge', 'meadow.rat'), 0);
    expect(during).toContain('200/200 · max hit 10');
    expect(during).toContain('Style: Strength');
    expect(running.activity).toMatchObject({ enemyId: 'meadow.hare', style: 'Strength' });
    const areas = mainHtml(running, view('areas'), 0);
    const ladder = mainHtml(running, view('ladder'), 0);
    expect(areas).not.toContain('data-milestone-open');
    expect(ladder).not.toContain('data-milestone-open');
  });

  it('keeps the no-combat-skill copy in place of Areas', () => {
    const html = mainHtml(newGame(0), view('areas'), 0);
    expect(html).toContain('Buy Attack, Strength, or Defence to fight. Meadow verge and Woodland edge stay locked until then.');
    expect(html).not.toContain('data-open-area');
    expect(html).not.toContain('data-style');
  });
});
