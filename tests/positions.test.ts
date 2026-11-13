import { spawn, type ChildProcess } from 'node:child_process';
import { chromium, type Locator } from 'playwright';
import { afterAll, describe, expect, it } from 'vitest';

declare const process: { cwd(): string };

const port = 4194;
const base = `http://127.0.0.1:${port}/idle-game-demo/`;
let server: ChildProcess | null = null;

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      // The dev server is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('vite did not start');
}

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('missing box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function closer(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): 'a' | 'b' {
  const da = (point.x - a.x) ** 2 + (point.y - a.y) ** 2;
  const db = (point.x - b.x) ** 2 + (point.y - b.y) ** 2;
  return da < db ? 'a' : 'b';
}

describe('combat numbers sit on the figure that was hit', () => {
  afterAll(() => {
    server?.kill('SIGTERM');
  });

  it('puts player hits over the enemy and enemy hits over the player', async () => {
    server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    await waitForServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${base}?dev=1`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.locator('[data-dev-open]').click();
    await page.locator('[data-set-skill]').fill('Attack');
    await page.locator('[data-set-level]').fill('30');
    await page.locator('[data-apply-level]').click();
    await page.locator('[data-dev-close]').click();
    await page.locator('[data-tab="combat"]').click();
    await page.locator('[data-fight]').click();

    const playerHit = page.locator('.floater.player').first();
    await playerHit.waitFor({ timeout: 12000 });
    const playerAvatar = page.locator('.fight .fighter svg').nth(0);
    const enemyAvatar = page.locator('.fight .fighter svg').nth(1);
    const hitAt = await center(playerHit);
    expect(closer(hitAt, await center(playerAvatar), await center(enemyAvatar))).toBe('b');
    expect(await playerHit.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    expect(await playerHit.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap');

    const enemyNumber = page.locator('.floater.enemy, .floater.heal').first();
    await enemyNumber.waitFor({ timeout: 12000 });
    const enemyAt = await center(enemyNumber);
    expect(closer(enemyAt, await center(playerAvatar), await center(enemyAvatar))).toBe('a');

    const wide = await page.evaluate(() => {
      const column = document.querySelector<HTMLElement>('#floaters .float-col');
      const enemy = document.querySelectorAll('#app .fight .fighter svg')[1];
      if (!column || !enemy) return null;
      const el = document.createElement('div');
      el.className = 'floater anchored player';
      el.textContent = '-1,234';
      column.appendChild(el);
      const host = column.getBoundingClientRect();
      const rect = enemy.getBoundingClientRect();
      el.style.left = `${rect.left - host.left + rect.width / 2}px`;
      el.style.top = `${rect.top - host.top + rect.height / 2}px`;
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        text: el.textContent,
        nowrap: style.whiteSpace,
        lines: el.getClientRects().length,
        fits: el.scrollWidth <= el.clientWidth + 1,
        overlapsEnemy: box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top,
      };
    });
    expect(wide).toEqual({
      text: '-1,234',
      nowrap: 'nowrap',
      lines: 1,
      fits: true,
      overlapsEnemy: true,
    });
    await browser.close();
  }, 60_000);
});
