import { spawn, type ChildProcess } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { afterAll, describe, expect, it } from 'vitest';

declare const process: { cwd(): string };

const port = 4191;
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

describe('touches while the loop ticks', () => {
  afterAll(() => {
    server?.kill('SIGTERM');
  });

  it('keeps tab buttons and lands every touch during gathering', async () => {
    server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    await waitForServer();
    const pixel = devices['Pixel 7'];
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ...pixel, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await page.goto(`${base}?dev=1`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForSelector('[data-open-skill="Woodcutting"]');
    await page.locator('[data-open-skill="Woodcutting"]').evaluate((el) => (el as HTMLElement).click());
    await page.locator('button[data-node="mat.wood.pine"]').evaluate((el) => (el as HTMLElement).click());
    await page.waitForFunction(() => /Pine/.test(document.querySelector('[data-activity]')?.textContent ?? ''));

    const tab = await page.locator('[data-tab="inventory"]').elementHandle();
    expect(tab).toBeTruthy();
    await page.waitForTimeout(700);
    expect(await tab!.evaluate((el) => el.isConnected)).toBe(true);

    let landed = 0;
    for (let i = 0; i < 10; i += 1) {
      await page.locator('[data-tab="skills"]').evaluate((el) => (el as HTMLElement).click());
      const point = await page.locator('[data-tab="combat"]').evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      });
      const hit = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return !!el?.closest('[data-tab="combat"]');
      }, point);
      expect(hit).toBe(true);
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: Math.round(point.x), y: Math.round(point.y), id: 1 }],
      });
      await page.waitForTimeout(220);
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(40);
      if ((await page.locator('[data-tab="combat"].on').count()) > 0) landed += 1;
    }
    expect(landed).toBe(10);
    await browser.close();
  }, 60_000);
});
