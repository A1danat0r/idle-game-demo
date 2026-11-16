import { describe, expect, it } from 'vitest';
import { ITEMS, RECIPES, XP_TABLE, actionTitle } from '../src/content';
import { activityLabel, creditOffline, equip, newGame, resumeCombat, startCombat, startProduce, stepCompletion } from '../src/engine';
import { activityHtml, activityIcon } from '../src/ui';
import { globalXpBonus, masteryLevel, masteryThreshold } from '../src/mastery';
import { T310_SELLS } from '../src/sells';
import { mainHtml, type View } from '../src/ui';

describe('t354 thrown weapons, mastery 40, and sells', () => {
  it('uses one thrown weapon per swing, including a miss, and pauses on an empty stack', () => {
    const state = newGame(0);
    state.owned.push('Ranged', 'Hitpoints');
    state.xp.Ranged = 0;
    state.xp.Attack = XP_TABLE[1];
    state.hp = 120;
    state.bank['ammo.thrown.bronze_knife'] = 3;
    state.bank['gear.shield.bronze'] = 1;
    expect(equip(state, 'gear.shield.bronze')).toBe(true);
    expect(equip(state, 'ammo.thrown.bronze_knife')).toBe(true);
    expect(state.equipped.shield).toBe('gear.shield.bronze');
    expect(startCombat(state, 'meadow.hare', 'Ranged')).toBe(true);
    let guard = 0;
    while (!state.paused && guard++ < 20) stepCompletion(state);
    expect(state.stats.playerSwings).toBe(3);
    expect(state.bank['ammo.thrown.bronze_knife'] ?? 0).toBe(0);
    expect(state.stats.kills).toBe(0);
    expect(state.coins).toBe(0);
    expect(state.xp.Ranged ?? 0).toBeGreaterThan(0);
    expect(activityLabel(state)).toBe('Combat paused – out of throwing knives');
    expect(resumeCombat(state)).toBe(false);
    state.bank['gear.melee.bronze_sword'] = 1;
    expect(equip(state, 'gear.melee.bronze_sword')).toBe(true);
    expect(resumeCombat(state)).toBe(true);
    expect(state.paused).toBe(false);

    const jav = newGame(0);
    jav.owned.push('Ranged', 'Hitpoints');
    jav.hp = 120;
    jav.bank['ammo.thrown.bronze_javelin'] = 1;
    expect(equip(jav, 'ammo.thrown.bronze_javelin')).toBe(true);
    expect(startCombat(jav, 'meadow.hare', 'Ranged')).toBe(true);
    stepCompletion(jav);
    expect(activityLabel(jav)).toBe('Combat paused – out of javelins');
    const view: View = {
      tab: 'equipment',
      skill: 'Woodcutting',
      filter: 'all',
      selected: null,
      area: 'Meadow verge',
      style: null,
      message: '',
    };
    const armed = newGame(0);
    armed.bank['ammo.thrown.bronze_knife'] = 8;
    expect(equip(armed, 'ammo.thrown.bronze_knife')).toBe(true);
    expect(mainHtml(armed, view, 0)).toContain('Bronze throwing knives ×8');

    const combat: View = {
      tab: 'combat',
      skill: 'Woodcutting',
      filter: 'all',
      selected: 'meadow.hare',
      area: 'Meadow verge',
      style: 'Ranged',
      message: '',
      combatScreen: 'fight',
    };
    const bare = newGame(0);
    bare.owned.push('Ranged', 'Hitpoints');
    bare.equipped.weapon = null;
    delete bare.bank['gear.melee.bronze_sword'];
    expect(mainHtml(bare, combat, 0)).toContain('Equip a weapon first.');
    const emptyKnives = newGame(0);
    emptyKnives.owned.push('Ranged', 'Hitpoints');
    emptyKnives.bank['ammo.thrown.bronze_knife'] = 1;
    expect(equip(emptyKnives, 'ammo.thrown.bronze_knife')).toBe(true);
    delete emptyKnives.bank['ammo.thrown.bronze_knife'];
    const knifeHtml = mainHtml(emptyKnives, combat, 0);
    expect(knifeHtml).toContain('Out of throwing knives.');
    expect(knifeHtml).not.toContain('Equip a weapon first.');
    const emptyJavelins = newGame(0);
    emptyJavelins.owned.push('Ranged', 'Hitpoints');
    emptyJavelins.bank['ammo.thrown.bronze_javelin'] = 1;
    expect(equip(emptyJavelins, 'ammo.thrown.bronze_javelin')).toBe(true);
    delete emptyJavelins.bank['ammo.thrown.bronze_javelin'];
    const javelinHtml = mainHtml(emptyJavelins, combat, 0);
    expect(javelinHtml).toContain('Out of javelins.');
    expect(javelinHtml).not.toContain('Equip a weapon first.');
  });

  it('consumes thrown weapons during offline catch-up and then stays paused', () => {
    const state = newGame(0);
    state.owned.push('Ranged', 'Hitpoints');
    state.hp = 120;
    state.bank['ammo.thrown.iron_knife'] = 2;
    expect(equip(state, 'ammo.thrown.iron_knife')).toBe(true);
    expect(startCombat(state, 'meadow.hare', 'Ranged')).toBe(true);
    const report = creditOffline(state, 60 * 60 * 1000);
    expect(state.bank['ammo.thrown.iron_knife'] ?? 0).toBe(0);
    expect(report.itemsConsumed['ammo.thrown.iron_knife']).toBe(2);
    expect(state.paused).toBe(true);
    expect(report.stopped).toBe('paused');
    expect(activityLabel(state)).toBe('Combat paused – out of throwing knives');
    expect(state.stats.playerSwings).toBe(2);
  });

  it('uses the section 2.7 mastery thresholds and pays the level-40 perks', () => {
    const thresholds = [67472, 72045, 76768, 81641, 86664, 91837, 97160, 102632, 108255, 114027];
    thresholds.forEach((mxp, index) => expect(masteryThreshold(index + 31)).toBe(mxp));
    const state = newGame(0);
    state.mastery['mat.wood.pine'] = masteryThreshold(40);
    expect(masteryLevel(state.mastery['mat.wood.pine'])).toBe(40);
    expect(globalXpBonus(state.mastery, 'Woodcutting')).toBeCloseTo(0.03);
    state.mastery['mat.wood.pine'] = masteryThreshold(30);
    expect(globalXpBonus(state.mastery, 'Woodcutting')).toBe(0);
    state.xp.Woodcutting = 0;
    let singles = 0;
    let doubles = 0;
    for (let seed = 1; seed < 80 && (singles === 0 || doubles === 0); seed += 1) {
      state.mastery['mat.wood.pine'] = masteryThreshold(40);
      state.rngState = seed;
      state.bank['mat.wood.pine'] = 0;
      state.activity = { kind: 'gather', nodeId: 'mat.wood.pine' };
      state.progressMs = 0;
      const before = state.xp.Woodcutting ?? 0;
      stepCompletion(state);
      const gained = state.bank['mat.wood.pine'] ?? 0;
      if (gained === 1) singles += 1;
      if (gained === 2) doubles += 1;
      expect(state.xp.Woodcutting ?? 0).toBeCloseTo(before + 42 * 1.08);
      expect(state.mastery['mat.wood.pine']).toBe(masteryThreshold(40) + 26);
    }
    expect(singles).toBeGreaterThan(0);
    expect(doubles).toBeGreaterThan(0);
  });

  it('applies the section 2.10 sell table, including the confirmed flax and sickle sells', () => {
    expect(Object.keys(T310_SELLS)).toHaveLength(186);
    expect(T310_SELLS['mat.fibre.flax']).toBe(1);
    expect(T310_SELLS['mat.binding.flax']).toBe(1);
    expect(T310_SELLS['tool.foraging.bronze_sickle']).toBe(9);
    expect(T310_SELLS['tool.foraging.iron_sickle']).toBe(32);
    expect(ITEMS['gear.magic.pine_focus'].sell).toBe(3);
    expect(ITEMS['tool.fishing.bronze_rod'].sell).toBe(11);
    expect(ITEMS['tool.fishing.iron_rod'].sell).toBe(41);
    expect(ITEMS['tool.fishing.reed_eel_trap'].sell).toBe(44);
    expect(ITEMS['ammo.arrow.steel'].sell).toBe(12);
    expect(ITEMS['mat.fibre.flax'].sell).toBe(1);
    expect(ITEMS['mat.binding.flax'].sell).toBe(1);
    expect(ITEMS['tool.foraging.bronze_sickle'].sell).toBe(9);
    expect(ITEMS['tool.foraging.iron_sickle'].sell).toBe(32);
  });

  it('shows catalogue names for builds and a style icon on the activity bar', () => {
    const raw = /activity\.|recipe\.|[a-z]+\.[a-z0-9_]+/;
    for (const recipe of RECIPES) {
      const title = actionTitle(recipe);
      expect(title, recipe.id).not.toMatch(raw);
    }
    const state = newGame(0);
    state.owned.push('Construction');
    state.xp.Construction = 0;
    state.bank['mat.wood.pine'] = 5;
    expect(startProduce(state, 'activity.construction.pine_work_area')).toBe(true);
    expect(activityLabel(state)).toBe('Construction · Build pine work area');
    const view: View = {
      tab: 'skill',
      skill: 'Construction',
      filter: 'all',
      selected: null,
      area: 'Meadow verge',
      style: null,
      message: '',
    };
    const html = mainHtml(state, view, 0);
    expect(html).toContain('Build pine work area');
    expect(html).toContain('Build stone foundation');
    expect(html).toContain('Practice workshop assembly');
    expect(html).not.toContain('activity.construction');
    expect(html).not.toContain('construction.pine');

    const melee = newGame(0);
    melee.owned.push('Strength', 'Hitpoints');
    startCombat(melee, 'meadow.hare', 'Strength');
    expect(activityIcon(melee)).toBe('sword');
    expect(activityHtml(melee)).toContain('M28 6');

    const ranged = newGame(0);
    ranged.owned.push('Ranged', 'Hitpoints');
    ranged.bank['ammo.thrown.bronze_knife'] = 4;
    expect(equip(ranged, 'ammo.thrown.bronze_knife')).toBe(true);
    startCombat(ranged, 'meadow.hare', 'Ranged');
    expect(activityIcon(ranged)).toBe('bow');
    expect(activityHtml(ranged)).toContain('M12 6 Q4 20 12 34');
    expect(activityHtml(ranged)).not.toContain('M28 6');

    const magic = newGame(0);
    magic.owned.push('Magic', 'Hitpoints');
    magic.bank['gear.magic.pine_focus'] = 1;
    expect(equip(magic, 'gear.magic.pine_focus')).toBe(true);
    startCombat(magic, 'meadow.hare', 'Magic');
    expect(activityIcon(magic)).toBe('staff');
    expect(activityHtml(magic)).toContain('fill="#6a4cc8"');
    expect(activityHtml(magic)).not.toContain('M28 6');
  });
});
