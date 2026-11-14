import { spawn, type ChildProcess } from 'node:child_process';
import { chromium } from 'playwright';
import { afterAll, describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/content';
import { newGame } from '../src/engine';
import { enemyFigure } from '../src/icons';
import { devToolsEnabled, devToolsRequested } from '../src/provisional';
import { mainHtml, type View } from '../src/ui';

declare const process: { cwd(): string };

const skillsView: View = {
  tab: 'skills',
  skill: 'Woodcutting',
  filter: 'all',
  selected: null,
  area: 'Meadow verge',
  style: null,
  message: '',
};

describe('skills order and enemy placeholders', () => {
  it('lists Attack, Strength, Defence and Hitpoints before the other skills', () => {
    const fresh = mainHtml(newGame(0), skillsView, 0);
    const locked = ['Attack', 'Strength', 'Defence', 'Woodcutting', 'Fishing', 'Cooking', 'Mining', 'Smithing'];
    let at = -1;
    for (const name of locked) {
      const next = fresh.indexOf(`<b>${name}`);
      expect(next, name).toBeGreaterThan(at);
      at = next;
    }
    expect(fresh).not.toContain('>Hitpoints');

    const owned = newGame(0);
    owned.owned.push('Attack', 'Hitpoints');
    const html = mainHtml(owned, skillsView, 0);
    const order = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Woodcutting'];
    at = -1;
    for (const name of order) {
      const next = html.indexOf(`<b>${name}`);
      expect(next, name).toBeGreaterThan(at);
      at = next;
    }
  });

  it('gives every enemy a different placeholder', () => {
    const figures = ENEMIES.map((enemy) => enemyFigure(enemy.id));
    expect(new Set(figures).size).toBe(ENEMIES.length);
    for (const enemy of ENEMIES) {
      expect(enemyFigure(enemy.id)).toContain(`data-art="${enemy.id}"`);
    }
    const state = newGame(0);
    state.owned.push('Strength');
    const meadow = mainHtml(state, { ...skillsView, tab: 'combat', area: 'Meadow verge' }, 0);
    const wood = mainHtml(state, { ...skillsView, tab: 'combat', area: 'Woodland edge', selected: 'wood.fox' }, 0);
    expect(meadow).toContain('data-art="meadow.hare"');
    expect(meadow).toContain('data-art="meadow.beetle"');
    expect(meadow).not.toContain('data-art="wood.fox"');
    expect(wood).toContain('data-art="wood.fox"');
    expect(wood).toContain('data-art="wood.poacher"');
  });
});

describe('dev tools switch', () => {
  it('turns on for ?dev=1 or a remembered 1, and stays off when neither is set', () => {
    expect(devToolsRequested('?dev=1')).toBe(true);
    expect(devToolsRequested('')).toBe(false);
    expect(devToolsEnabled('?dev=1', null)).toBe(true);
    expect(devToolsEnabled('?dev=1', '0')).toBe(true);
    expect(devToolsEnabled('', '1')).toBe(true);
    expect(devToolsEnabled('', null)).toBe(false);
    expect(devToolsEnabled('', '0')).toBe(false);
  });
});

const port = 4197;
const base = `http://127.0.0.1:${port}/idle-game-demo/`;
let server: ChildProcess | null = null;

describe('profile debug toggle', () => {
  afterAll(() => {
    server?.kill('SIGTERM');
  });

  it('remembers Debug across a reload without ?dev=1', async () => {
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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    expect(await page.locator('[data-dev-open]').count()).toBe(0);
    await page.locator('[data-tab="profile"]').click();
    await page.locator('[data-debug-toggle]').click();
    await page.locator('[data-dev-open]').waitFor();
    expect(await page.locator('[data-debug-toggle]').innerText()).toContain('Debug on');
    await page.reload();
    await page.locator('[data-dev-open]').waitFor();
    await page.locator('[data-tab="profile"]').click();
    await page.locator('[data-debug-toggle]').click();
    await page.locator('[data-dev-open]').waitFor({ state: 'detached' });
    expect(await page.evaluate(() => localStorage.getItem('idle-game-demo-dev'))).toBe('0');
    await page.goto(`${base}?dev=1`);
    await page.locator('[data-dev-open]').waitFor();
    expect(await page.evaluate(() => localStorage.getItem('idle-game-demo-dev'))).toBe('1');
    await page.locator('[data-tab="profile"]').click();
    await page.locator('[data-debug-toggle]').click();
    await page.locator('[data-dev-open]').waitFor({ state: 'detached' });
    expect(page.url()).not.toContain('dev=1');
    expect(await page.evaluate(() => localStorage.getItem('idle-game-demo-dev'))).toBe('0');
    await browser.close();
  }, 60_000);
});
