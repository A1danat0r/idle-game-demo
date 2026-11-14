import { spawn, type ChildProcess } from 'node:child_process';
import { chromium } from 'playwright';
import { afterAll, describe, expect, it } from 'vitest';
import { ENEMY_BY_ID, XP_TABLE, expectedEnemyHitDamage } from '../src/content';
import { newGame } from '../src/engine';
import { foodFree } from '../src/route';

declare const process: { cwd(): string };

describe('food-free damage', () => {
  it('uses the ×10 enemy hit, not (max hit + 1) / 2', () => {
    const hare = ENEMY_BY_ID['meadow.hare'].maxHit;
    const poacher = ENEMY_BY_ID['wood.poacher'].maxHit;
    expect(hare).toBe(10);
    expect(poacher).toBe(40);
    expect(expectedEnemyHitDamage(hare)).toBeCloseTo(10, 5);
    expect(expectedEnemyHitDamage(hare)).toBeGreaterThan((hare + 1) / 2);
    expect(expectedEnemyHitDamage(poacher)).toBeCloseTo(25, 2);
    expect(expectedEnemyHitDamage(poacher)).toBeGreaterThan((poacher + 1) / 2);

    // Defence 30, Attack 30, Strength 1, bronze sword. Regen is 10 HP per 6s, so this hare is food-free.
    // The same setup with 1 HP per 6s is not: damage is about 2.7 and that regen is about 2.7.
    const state = newGame(0);
    state.owned.push('Strength', 'Attack', 'Defence', 'Hitpoints');
    state.xp.Strength = 0;
    state.xp.Attack = XP_TABLE[30];
    state.xp.Defence = XP_TABLE[30];
    expect(foodFree('meadow.hare', state)).toBe(true);
  });

  it('uses 10 HP per 6s for the poacher, so a safe loadout is food-free', () => {
    const state = newGame(0);
    state.owned.push('Strength', 'Attack', 'Defence', 'Hitpoints');
    state.xp.Strength = XP_TABLE[30];
    state.xp.Attack = XP_TABLE[30];
    state.xp.Defence = XP_TABLE[30];
    state.bank['gear.melee.iron_spear'] = 1;
    state.equipped.weapon = 'gear.melee.iron_spear';
    expect(foodFree('wood.poacher', state)).toBe(true);
    state.xp.Defence = 0;
    expect(foodFree('wood.poacher', state)).toBe(false);
  });
});

const port = 4196;
const base = `http://127.0.0.1:${port}/idle-game-demo/`;
let server: ChildProcess | null = null;

describe('dev Hitpoints cap', () => {
  afterAll(() => {
    server?.kill('SIGTERM');
  });

  it('keeps current HP up to 100 + 20 × level', async () => {
    server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    for (let i = 0; i < 40; i += 1) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {
        // The dev server is still booting.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (i === 39) throw new Error('vite did not start');
    }
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${base}?dev=1`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.locator('[data-dev-open]').click();
    await page.locator('[data-set-skill]').fill('Hitpoints');
    await page.locator('[data-set-level]').fill('30');
    await page.locator('[data-apply-level]').click();
    await page.locator('[data-export-fill]').click();
    const atThirty = JSON.parse(await page.locator('[data-export]').inputValue()) as { hp: number };
    expect(atThirty.hp).toBe(120);

    await page.locator('[data-set-level]').fill('1');
    await page.locator('[data-apply-level]').click();
    await page.locator('[data-export-fill]').click();
    const atOne = JSON.parse(await page.locator('[data-export]').inputValue()) as { hp: number };
    expect(atOne.hp).toBe(120);
    await browser.close();
  }, 60_000);
});
