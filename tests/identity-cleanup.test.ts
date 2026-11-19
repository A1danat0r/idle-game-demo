import { describe, expect, it } from 'vitest';
import {
  ENEMY_BY_ID,
  ITEMS,
  RECIPES,
  XP_TABLE,
  countedName,
  expectedCoinValue,
  expectedDropValue,
  itemName,
} from '../src/content';
import { deserialize, mergeLegacyItemCounts, newGame, sell, startProduce } from '../src/engine';

const REMOVED = [
  'mat.berry.meadow',
  'mat.herb.meadow_cuttings',
  'mat.moss.spell',
  'mat.part.beetle_carapace',
  'mat.wax.grub',
] as const;

function save(bank: Record<string, number>, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    saveFormat: 4,
    coins: 0,
    xp: { Woodcutting: 0 },
    owned: ['Woodcutting'],
    purchaseCount: 0,
    nodes: [],
    bank,
    equipped: { weapon: null, body: null, shield: null },
    activity: null,
    progressMs: 0,
    hp: 100,
    paused: false,
    combat: null,
    foodSlot: null,
    shop: {},
    lastCredited: 0,
    rngState: 1,
    regenMs: 0,
    stats: {
      actions: 0,
      kills: 0,
      pauses: 0,
      foodEaten: 0,
      coinsFromKills: 0,
      coinsFromSales: 0,
      lootValue: 0,
      killsByEnemy: {},
      pauseAtKill: [],
      playerSwings: 0,
      playerHits: 0,
      playerMisses: 0,
      enemyHits: 0,
    },
    mastery: {},
    enemyMastery: {},
    ...extra,
  });
}

function drop(enemyId: string, itemId: string): { itemId: string; num: number; den: number; qty: number } | undefined {
  return ENEMY_BY_ID[enemyId].drops.find((row) => row.itemId === itemId);
}

function canCraft(recipeId: string): void {
  const recipe = RECIPES.find((row) => row.id === recipeId);
  expect(recipe, recipeId).toBeTruthy();
  const state = newGame(0);
  if (!state.owned.includes(recipe!.skill)) state.owned.push(recipe!.skill);
  state.xp[recipe!.skill] = XP_TABLE[recipe!.level];
  for (const input of recipe!.inputs) state.bank[input.id] = (state.bank[input.id] ?? 0) + input.qty;
  expect(startProduce(state, recipeId), recipeId).toBe(true);
}

describe('identity cleanup', () => {
  it('keeps one catalogue id for each merged name', () => {
    for (const id of REMOVED) expect(ITEMS[id]).toBeUndefined();
    for (const recipe of RECIPES) {
      for (const stack of [...recipe.inputs, ...recipe.outputs]) {
        expect(REMOVED).not.toContain(stack.id);
      }
    }
    for (const enemy of Object.values(ENEMY_BY_ID)) {
      for (const row of enemy.drops) expect(REMOVED).not.toContain(row.itemId);
    }
    expect(Object.values(ITEMS).filter((item) => item.name === 'Meadow berries')).toHaveLength(1);
    expect(Object.values(ITEMS).filter((item) => item.name === 'Meadow-herb cuttings')).toHaveLength(1);
    expect(Object.values(ITEMS).filter((item) => item.name === 'Spell moss')).toHaveLength(1);
    expect(Object.values(ITEMS).filter((item) => item.name === 'Beetle carapace fragments')).toHaveLength(1);
    expect(Object.values(ITEMS).filter((item) => item.name === 'Grub wax')).toHaveLength(1);
  });

  it('folds old bank counts on load and leaves mastery alone', () => {
    const mastery = {
      'mat.fruit.berries': 40,
      'mat.berry.meadow': 9,
      'forage.woodland': 28,
    };
    const enemyMastery = { 'wood.jay': 204 };
    const loaded = deserialize(save(
      {
        'mat.fruit.berries': 5,
        'mat.berry.meadow': 7,
        'mat.wax.grub': 2,
        'mat.moss.spell': 0,
      },
      { mastery, enemyMastery },
    ));
    expect(loaded).not.toBeNull();
    expect(loaded!.saveFormat).toBe(4);
    expect(loaded!.bank).toEqual({
      'mat.fruit.berries': 12,
      'mat.combat.grub_wax': 2,
    });
    expect(loaded!.mastery).toEqual(mastery);
    expect(loaded!.enemyMastery).toEqual(enemyMastery);

    const plain = deserialize(save({ 'mat.wood.pine': 3 }, { mastery: { 'mat.wood.pine': 26 }, enemyMastery: { 'meadow.hare': 102 } }));
    expect(plain!.bank).toEqual({ 'mat.wood.pine': 3 });
    expect(plain!.mastery).toEqual({ 'mat.wood.pine': 26 });
    expect(plain!.enemyMastery).toEqual({ 'meadow.hare': 102 });

    const gained = { 'mat.berry.meadow': 7, 'mat.fruit.berries': 5, 'mat.moss.spell': 0 };
    const consumed = { 'mat.wax.grub': 2, 'mat.herb.meadow_cuttings': 4 };
    mergeLegacyItemCounts(gained);
    mergeLegacyItemCounts(consumed);
    expect(gained).toEqual({ 'mat.fruit.berries': 12 });
    expect(consumed).toEqual({ 'mat.combat.grub_wax': 2, 'mat.cutting.meadow_herb': 4 });
  });

  it('cooks either berry source into the bowl, which sells for 14 and heals 100', () => {
    expect(ITEMS['mat.fruit.berries'].sell).toBe(3);
    expect(ITEMS['food.shrimp_berry_bowl']).toMatchObject({ sell: 14, heal: 100 });
    expect(countedName(1, 'mat.fruit.berries')).toBe('1 Meadow berry');
    expect(drop('wood.jay', 'mat.fruit.berries')).toEqual({ itemId: 'mat.fruit.berries', num: 1, den: 4, qty: 12 });
    expect(drop('wood.boar', 'mat.fruit.berries')).toEqual({ itemId: 'mat.fruit.berries', num: 1, den: 4, qty: 6 });
    expect(drop('wood.poacher', 'mat.fruit.berries')).toEqual({ itemId: 'mat.fruit.berries', num: 1, den: 4, qty: 6 });
    expect(expectedDropValue(ENEMY_BY_ID['wood.jay'].drops)).toBeCloseTo(12, 5);
    expect(expectedDropValue(ENEMY_BY_ID['wood.poacher'].drops) + expectedCoinValue(ENEMY_BY_ID['wood.poacher'])).toBeCloseTo(15.5, 5);
    const state = newGame(0);
    state.bank['mat.fruit.berries'] = 12;
    expect(sell(state, 'mat.fruit.berries', 12)).toBe(true);
    expect(state.coins).toBe(36);
    canCraft('recipe.food.shrimp_berry_bowl');
  });

  it('plants tortoise cuttings and prices the tortoise kill at 10', () => {
    expect(ITEMS['mat.cutting.meadow_herb'].sell).toBe(3);
    expect(countedName(1, 'mat.cutting.meadow_herb')).toBe('1 Meadow-herb cutting');
    expect(drop('wood.tortoise', 'mat.cutting.meadow_herb')).toEqual({
      itemId: 'mat.cutting.meadow_herb',
      num: 1,
      den: 4,
      qty: 8,
    });
    expect(expectedDropValue(ENEMY_BY_ID['wood.tortoise'].drops)).toBeCloseTo(10, 5);
    expect(expectedDropValue(ENEMY_BY_ID['wood.tortoise'].drops) * 0.1).toBeCloseTo(1, 5);
    canCraft('recipe.farm.meadow_herb');
  });

  it('uses spell moss from the crawler and the grub in every moss recipe', () => {
    expect(ITEMS['mat.reagent.spell_moss']).toMatchObject({ name: 'Spell moss', sell: 1 });
    expect(itemName('mat.reagent.spell_moss')).toBe('Spell moss');
    expect(countedName(1, 'mat.reagent.spell_moss')).toBe('1 Spell moss');
    expect(drop('meadow.moss', 'mat.reagent.spell_moss')).toEqual({ itemId: 'mat.reagent.spell_moss', num: 1, den: 4, qty: 24 });
    expect(drop('wood.grub', 'mat.reagent.spell_moss')).toEqual({ itemId: 'mat.reagent.spell_moss', num: 1, den: 4, qty: 8 });
    expect(expectedDropValue(ENEMY_BY_ID['meadow.moss'].drops)).toBeCloseTo(6, 5);
    expect(expectedDropValue(ENEMY_BY_ID['wood.grub'].drops)).toBeCloseTo(10, 5);
    const recipes = RECIPES.filter((recipe) => recipe.inputs.some((input) => input.id === 'mat.reagent.spell_moss'));
    expect(recipes.map((recipe) => recipe.id)).toEqual(expect.arrayContaining([
      'recipe.gear.magic.pine_focus',
      'recipe.reagent.spell.spark',
      'recipe.reagent.enchant.binding',
    ]));
    for (const recipe of recipes) canCraft(recipe.id);
  });

  it('uses beetle carapace fragments from the thorn beetle in the carapace recipes', () => {
    expect(ITEMS['mat.combat.beetle_carapace'].sell).toBe(10);
    expect(countedName(1, 'mat.combat.beetle_carapace')).toBe('1 Beetle carapace fragment');
    expect(drop('meadow.beetle', 'mat.combat.beetle_carapace')).toEqual({
      itemId: 'mat.combat.beetle_carapace',
      num: 1,
      den: 8,
      qty: 1,
    });
    const beetle = ENEMY_BY_ID['meadow.beetle'];
    expect(expectedDropValue(beetle.drops) + expectedCoinValue(beetle)).toBeCloseTo(6.25, 5);
    expect((expectedDropValue(beetle.drops) + expectedCoinValue(beetle)) * 0.1).toBeCloseTo(0.625, 5);
    for (const id of [
      'recipe.mat.powder.chitin_grit',
      'recipe.potion.physical_protection.1',
      'recipe.gear.head.carapace_helm',
      'recipe.gear.legs.carapace_shinguards',
      'recipe.gear.feet.carapace_boots',
      'recipe.gear.armour.carapace_cuirass',
    ]) canCraft(id);
  });

  it('uses grub wax from the resin grub in waxed linen, piercing potion and shellguard paste', () => {
    expect(ITEMS['mat.combat.grub_wax']).toMatchObject({ name: 'Grub wax', sell: 16 });
    expect(countedName(1, 'mat.combat.grub_wax')).toBe('1 Grub wax');
    expect(drop('wood.grub', 'mat.combat.grub_wax')).toEqual({ itemId: 'mat.combat.grub_wax', num: 1, den: 8, qty: 1 });
    expect(expectedDropValue(ENEMY_BY_ID['wood.grub'].drops)).toBeCloseTo(10, 5);
    for (const id of [
      'recipe.mat.cloth.waxed_linen',
      'recipe.potion.ranged_damage.1',
      'recipe.supply.paste.shellguard',
    ]) canCraft(id);
  });
});
