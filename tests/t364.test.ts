import { describe, expect, it } from 'vitest';
import { ATTACK_INTERVAL_MS, ITEMS, arrowToUse, gearLocked, gearStatText } from '../src/content';
import {
  activityLabel,
  creditOffline,
  equip,
  maxHp,
  newGame,
  resumeCombat,
  simulate,
  startCombat,
  stepCompletion,
} from '../src/engine';
import { XP_TABLE } from '../src/content';

function ranger(seed = 1) {
  const state = newGame(0, seed);
  state.owned.push('Ranged', 'Hitpoints');
  state.xp.Ranged = 0;
  state.xp.Hitpoints = XP_TABLE[40];
  state.hp = maxHp(state);
  state.bank['gear.ranged.pine_shortbow'] = 1;
  state.bank['gear.shield.bronze'] = 1;
  expect(equip(state, 'gear.shield.bronze')).toBe(true);
  expect(equip(state, 'gear.ranged.pine_shortbow')).toBe(true);
  expect(state.equipped.shield).toBeNull();
  return state;
}

describe('arrows and level 31–40 gear', () => {
  it('uses one arrow per shot, including misses, and pauses with the exact copy', () => {
    let sawMiss = false;
    let sawHit = false;
    for (let seed = 1; seed <= 30 && !(sawMiss && sawHit); seed += 1) {
      const state = ranger(seed);
      state.bank['ammo.arrow.bronze'] = 1;
      state.enemyKills['wood.poacher'] = 1;
      expect(startCombat(state, 'wood.poacher', 'Ranged')).toBe(true);
      stepCompletion(state);
      expect(state.stats.playerSwings).toBe(1);
      expect(state.bank['ammo.arrow.bronze'] ?? 0).toBe(0);
      expect(activityLabel(state)).toBe('Combat paused – out of arrows');
      if (state.stats.playerMisses > 0) sawMiss = true;
      if (state.stats.playerHits > 0) sawHit = true;
    }
    expect(sawMiss).toBe(true);
    expect(sawHit).toBe(true);

    const state = ranger();
    state.bank['ammo.arrow.bronze'] = 3;
    expect(startCombat(state, 'meadow.hare', 'Ranged')).toBe(true);
    let guard = 0;
    while (!state.paused && guard++ < 10) stepCompletion(state);
    expect(state.stats.playerSwings).toBe(3);
    expect(state.bank['ammo.arrow.bronze'] ?? 0).toBe(0);
    expect(activityLabel(state)).toBe('Combat paused – out of arrows');
    expect(resumeCombat(state)).toBe(false);
    state.bank['ammo.arrow.bronze'] = 2;
    expect(resumeCombat(state)).toBe(true);
  });

  it('draws the highest banked demo tier and keeps using arrows offline', () => {
    const state = ranger();
    state.bank['ammo.arrow.steel'] = 2;
    state.bank['ammo.arrow.iron'] = 4;
    state.bank['ammo.arrow.bronze'] = 6;
    state.bank['ammo.arrow.serpent_fang'] = 9;
    expect(arrowToUse(state.bank)).toBe('ammo.arrow.steel');
    expect(startCombat(state, 'meadow.hare', 'Ranged')).toBe(true);
    simulate(state, ATTACK_INTERVAL_MS + 50);
    expect(state.stats.playerSwings).toBe(1);
    expect(state.bank['ammo.arrow.steel']).toBe(1);
    expect(state.bank['ammo.arrow.iron']).toBe(4);
    expect(state.bank['ammo.arrow.bronze']).toBe(6);
    expect(state.bank['ammo.arrow.serpent_fang']).toBe(9);

    const away = ranger();
    away.bank['ammo.arrow.bronze'] = 2;
    expect(startCombat(away, 'meadow.hare', 'Ranged')).toBe(true);
    const report = creditOffline(away, 60 * 60 * 1000);
    expect(away.bank['ammo.arrow.bronze'] ?? 0).toBe(0);
    expect(away.stats.playerSwings).toBe(2);
    expect(report.stopped).toBe('paused');
    expect(activityLabel(away)).toBe('Combat paused – out of arrows');
  });

  it('sets the approved level 31–40 gear stats and keeps locked pieces unworn', () => {
    expect(ITEMS['gear.melee.steel_sword']).toMatchObject({ acc: 10, pow: 10, grd: 0 });
    expect(ITEMS['gear.melee.steel_spear']).toMatchObject({ acc: 11, pow: 11, grd: 0 });
    expect(ITEMS['gear.armour.steel_body']).toMatchObject({ acc: 0, pow: 0, grd: 9 });
    expect(ITEMS['gear.shield.willow_buckler'].grd).toBe(3);
    expect(ITEMS['gear.armour.carapace_cuirass'].grd).toBe(7);
    expect(ITEMS['gear.armour.boarhide_brigandine'].grd).toBe(6);
    expect(ITEMS['gear.armour.hemp_robes'].grd).toBe(2);
    expect(ITEMS['gear.magic.ash_focus']).toMatchObject({ acc: 8, pow: 8 });
    expect(ITEMS['gear.ranged.ash_bow']).toMatchObject({ acc: 8, pow: 8 });
    expect(ITEMS['gear.shield.serpent_targe'].grd).toBe(5);
    expect(ITEMS['gear.armour.serpent_jerkin'].grd).toBe(6);
    expect(ITEMS['gear.melee.horn_hafted_mace']).toMatchObject({ acc: 0, pow: 10, grd: 0 });
    expect(ITEMS['gear.magic.pine_focus'].sell).toBe(3);
    expect(ITEMS['gear.magic.pine_focus'].acc ?? 0).toBe(0);
    expect(gearStatText('gear.melee.steel_sword')).toBe('+10 Acc · +10 Pow');
    expect(gearStatText('gear.armour.steel_body')).toBe('+9 Grd');

    const state = newGame(0);
    state.bank['gear.shield.bronze'] = 1;
    state.bank['gear.melee.steel_spear'] = 1;
    state.bank['gear.shield.serpent_targe'] = 1;
    state.bank['gear.armour.serpent_jerkin'] = 1;
    state.bank['gear.melee.horn_hafted_mace'] = 1;
    expect(equip(state, 'gear.shield.bronze')).toBe(true);
    expect(equip(state, 'gear.melee.steel_spear')).toBe(true);
    expect(state.equipped.shield).toBeNull();
    expect(gearLocked('gear.shield.serpent_targe')).toBe(true);
    expect(equip(state, 'gear.shield.serpent_targe')).toBe(false);
    expect(equip(state, 'gear.armour.serpent_jerkin')).toBe(false);
    expect(equip(state, 'gear.melee.horn_hafted_mace')).toBe(false);
  });
});
