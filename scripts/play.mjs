import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4173/idle-game-demo/?dev=1';
const out = new URL('../docs/screenshots/', import.meta.url);

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

async function shot(name) {
  await page.screenshot({ path: new URL(`${name}.png`, out).pathname });
}
async function click(selector) {
  await page.locator(selector).first().click();
}
async function assertBar(where) {
  const bar = await page.locator('[data-activity]').boundingBox();
  const tabs = await page.locator('nav.tabs').boundingBox();
  const main = await page.locator('main').boundingBox();
  if (!bar || !tabs || !main) throw new Error(`missing layout boxes on ${where}`);
  if (main.y + main.height > bar.y + 2) throw new Error(`${where}: activity bar is not below the page`);
  if (bar.y + bar.height > tabs.y + 2) throw new Error(`${where}: activity bar overlaps the tabs`);
  const gap = tabs.y - (bar.y + bar.height);
  if (gap > 16) throw new Error(`${where}: activity bar is ${gap}px above the tabs`);
}
function saveActions() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('idle-game-demo-save')).stats.actions);
}

await page.goto(base);
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await page.reload();
await page.waitForSelector('[data-coins]');
await assertBar('skills');
await shot('01-skills');

await click('[data-open-skill="Woodcutting"]');
await click('[data-node="mat.wood.pine"]');
await page.waitForFunction(() => document.querySelector('[data-activity]')?.textContent?.includes('Pine'));
await page.waitForTimeout(3000);
const beforeRewind = await saveActions();
if (beforeRewind < 1) throw new Error(`pine did not start, actions ${beforeRewind}`);
await page.evaluate(() => {
  const real = Date.now.bind(Date);
  // @ts-expect-error test hook
  Date.now = () => real() - 3_600_000;
});
await page.waitForTimeout(4500);
const afterRewind = await saveActions();
if (afterRewind <= beforeRewind) throw new Error(`progress stalled after a backwards clock: ${beforeRewind} -> ${afterRewind}`);
if (await page.locator('[data-catchup-close]').count()) await click('[data-catchup-close]');
await page.waitForTimeout(1500);
const stillGoing = await saveActions();
if (stillGoing <= afterRewind) throw new Error(`progress stopped after the backwards reset: ${afterRewind} -> ${stillGoing}`);
await assertBar('skill');
await shot('02-skill');
await shot('08-after-rewind');

await click('[data-dev-open]');
await click('[data-ff="108000000"]');
await page.waitForSelector('[data-catchup]');
const pineReport = await page.locator('[data-catchup]').innerText();
if (!pineReport.includes('24.00 h')) throw new Error(`expected a 24h credit:\n${pineReport}`);
await click('[data-catchup-close]');
await click('[data-dev-close]');

await click('[data-tab="inventory"]');
await click('[data-select="mat.wood.pine"]');
await click('[data-sell="all"]');
await click('[data-tab="skills"]');
await click('[data-buy-skill="Fishing"]');
await click('[data-buy-skill="Strength"]');
await click('[data-open-skill="Woodcutting"]');
await click('[data-buy-node="mat.wood.maple"]');
await assertBar('node');
await shot('02-skill-node');

await click('[data-tab="combat"]');
await click('[data-style="Strength"]');
await click('[data-enemy="meadow.beetle"]');
await click('[data-fight="meadow.beetle"]');
await page.waitForFunction(() => /beetle|Combat/i.test(document.querySelector('[data-activity]')?.textContent ?? ''));
await page.waitForTimeout(1200);
await assertBar('combat');
await shot('03-combat');

await click('[data-dev-open]');
await page.locator('[data-ff-custom]').fill('1');
await click('[data-ff-apply]');
await page.waitForSelector('[data-catchup]');
const xp = await page.locator('[data-catchup] dd').nth(5).innerText();
if (/\d\.\d/.test(xp)) throw new Error(`catch-up XP is not rounded down: ${xp}`);
if (!/Hitpoints \d/.test(xp) && !/Strength \d/.test(xp)) throw new Error(`catch-up XP missing: ${xp}`);
await shot('06-catchup');
await click('[data-catchup-close]');
await click('[data-dev-close]');

await click('[data-tab="inventory"]');
await page.waitForSelector('[data-shop-buy="mat.meat.hare"]');
await click('[data-shop-buy="mat.meat.hare"]');
await assertBar('inventory');
await shot('04-inventory');

await click('[data-tab="equipment"]');
await page.waitForSelector('text=Bronze sword');
await assertBar('equipment');
await shot('05-equipment');

await click('[data-dev-open]');
await page.waitForSelector('[data-export]');
const exported = await page.locator('[data-export]').inputValue();
if (!exported.includes('"saveFormat": 1')) throw new Error('export missing saveFormat');
await shot('07-dev');

if (errors.length) throw new Error(errors.join('\n'));
console.log('play ok', { beforeRewind, afterRewind, xp });
await browser.close();
