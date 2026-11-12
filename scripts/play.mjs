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

await page.goto(base);
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await page.reload();
await page.waitForSelector('[data-coins]');
await page.waitForSelector('text=Woodcutting');
await shot('01-skills');

await click('[data-open-skill="Woodcutting"]');
await click('[data-node="mat.wood.pine"]');
await page.waitForFunction(() => document.querySelector('[data-activity]')?.textContent?.includes('Pine'));
await shot('02-skill');

await click('[data-dev-open]');
await page.waitForSelector('[data-dev-panel]');
await click('[data-ff="108000000"]');
await page.waitForSelector('[data-catchup]');
await shot('06-catchup');
const report = await page.locator('[data-catchup]').innerText();
if (!/Away/.test(report) || !/Credited/.test(report) || !/Actions/.test(report)) {
  throw new Error(`catch-up missing fields:\n${report}`);
}
await click('[data-catchup-close]');
await click('[data-dev-close]');

await click('[data-tab="inventory"]');
await click('[data-select="mat.wood.pine"]');
await click('[data-sell="all"]');
const coins = () => page.locator('[data-coins]').innerText().then((text) => Number(text.replace(/[^\d]/g, '')));
const afterSell = await coins();
if (afterSell < 3000) throw new Error(`expected a few thousand coins from pine, saw ${afterSell}`);

await click('[data-tab="skills"]');
await click('[data-buy-skill="Fishing"]');
await click('[data-buy-skill="Strength"]');
await click('[data-open-skill="Woodcutting"]');
await click('[data-buy-node="mat.wood.maple"]');
await page.waitForFunction(() => document.body.innerText.includes('Owned') || document.body.innerText.includes('Start') || document.body.innerText.includes('Active'));
await shot('02-skill-node');

await click('[data-tab="combat"]');
await click('[data-style="Strength"]');
await click('[data-enemy="meadow.beetle"]');
await click('[data-fight="meadow.beetle"]');
await page.waitForFunction(() => /beetle|Combat/i.test(document.querySelector('[data-activity]')?.textContent ?? ''));
await page.waitForTimeout(1200);
await shot('03-combat');

await click('[data-tab="inventory"]');
await page.waitForSelector('[data-shop-buy="mat.meat.hare"]');
await click('[data-shop-buy="mat.meat.hare"]');
await shot('04-inventory');

await click('[data-tab="equipment"]');
await page.waitForSelector('text=Bronze sword');
await shot('05-equipment');

await click('[data-tab="skill"]');
await click('[data-node="mat.wood.pine"]');
await click('[data-dev-open]');
await page.waitForSelector('[data-export]');
const exported = await page.locator('[data-export]').inputValue();
if (!exported.includes('"saveFormat": 1')) throw new Error('export missing saveFormat');
if (!exported.includes('playerMisses') && !exported.includes('playerSwings')) {
  throw new Error('export missing the swing stats log');
}
await shot('07-dev');

const before = await page.locator('[data-coins]').innerText();
await page.reload();
await page.waitForSelector('[data-coins]');
const after = await page.locator('[data-coins]').innerText();
if (before.replace(/\s/g, '') !== after.replace(/\s/g, '')) {
  throw new Error(`save/load coins changed:\n${before}\n->\n${after}`);
}

const second = await context.newPage();
await second.goto(base);
await second.waitForTimeout(400);
const notice = await second.locator('body').innerText();
if (!notice.includes('Already open')) throw new Error(`second tab did not show the notice:\n${notice.slice(0, 400)}`);
await second.close();

if (errors.length) throw new Error(errors.join('\n'));
console.log('play ok', { afterSell, report: report.split('\n').slice(0, 6).join(' | ') });
await browser.close();
