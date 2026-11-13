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
  let last = `missing layout boxes on ${where}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const bar = await page.locator('[data-activity]').boundingBox();
    const tabs = await page.locator('nav.tabs').boundingBox();
    const main = await page.locator('main').boundingBox();
    if (!bar || !tabs || !main) {
      last = `missing layout boxes on ${where}`;
    } else if (main.y + main.height > bar.y + 2) {
      last = `${where}: activity bar is not below the page`;
    } else if (bar.y + bar.height > tabs.y + 2) {
      last = `${where}: activity bar overlaps the tabs`;
    } else if (tabs.y - (bar.y + bar.height) > 16) {
      last = `${where}: activity bar is ${tabs.y - (bar.y + bar.height)}px above the tabs`;
    } else {
      return;
    }
    await page.waitForTimeout(80);
  }
  throw new Error(last);
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

await page.evaluate(() => {
  localStorage.setItem = () => {};
  localStorage.clear();
  sessionStorage.clear();
});
await page.goto('about:blank');
await page.goto(base);
await page.waitForSelector('[data-coins]');
async function devOpen() {
  if (await page.locator('[data-catchup-close]').count()) await click('[data-catchup-close]');
  await click('[data-dev-open]');
}
async function devClose() {
  await click('[data-dev-close]');
}
async function devLevel(skill, level) {
  await devOpen();
  await page.locator('[data-set-skill]').fill(skill);
  await page.locator('[data-set-level]').fill(String(level));
  await click('[data-apply-level]');
  await devClose();
}
async function devGive(id, qty) {
  await devOpen();
  await page.locator('[data-give-id]').fill(id);
  await page.locator('[data-give-qty]').fill(String(qty));
  await click('[data-apply-give]');
  await devClose();
}
await devLevel('Smithing', 3);
await devLevel('Strength', 5);
await devLevel('Defence', 14);
await devLevel('Hitpoints', 10);
await devGive('mat.bar.bronze', 7);
await devGive('mat.wood.pine', 2);
await click('[data-tab="skills"]');
await click('[data-open-skill="Smithing"]');
await page.waitForSelector('[data-recipe="recipe.gear.armour.bronze_body"]');
const recipes = await page.locator('main').innerText();
if (!recipes.includes('+3 Grd') || !recipes.includes('+2 Acc') || !recipes.includes('+2 Grd')) {
  throw new Error(`smithing recipes are missing gear stats:\n${recipes.slice(0, 800)}`);
}
await assertBar('recipes');
await shot('09-recipes');

async function craft(recipe, itemId) {
  await click(`[data-recipe="${recipe}"]`);
  await page.waitForFunction(
    (id) => (JSON.parse(localStorage.getItem('idle-game-demo-save')).bank[id] ?? 0) > 0,
    itemId,
    { timeout: 20000 },
  );
}
await craft('recipe.gear.melee.bronze_spear', 'gear.melee.bronze_spear');
await craft('recipe.gear.armour.bronze_body', 'gear.armour.bronze_body');
await craft('recipe.gear.shield.bronze', 'gear.shield.bronze');
const equippedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('idle-game-demo-save')).equipped);
if (equippedBefore.weapon !== 'gear.melee.bronze_sword' || equippedBefore.body || equippedBefore.shield) {
  throw new Error(`crafted gear was auto-equipped: ${JSON.stringify(equippedBefore)}`);
}

await click('[data-tab="equipment"]');
await click('[data-equip="gear.melee.bronze_spear"]');
await click('[data-equip="gear.armour.bronze_body"]');
await click('[data-equip="gear.shield.bronze"]');
await page.waitForFunction(() => {
  const worn = JSON.parse(localStorage.getItem('idle-game-demo-save')).equipped;
  return worn.weapon === 'gear.melee.bronze_spear' && worn.body === 'gear.armour.bronze_body' && worn.shield === 'gear.shield.bronze';
});
const gearText = await page.locator('main').innerText();
if (!gearText.includes('+3 Acc') || !gearText.includes('+3 Grd') || !gearText.includes('+2 Grd')) {
  throw new Error(`equipment slots are missing stats:\n${gearText}`);
}
await assertBar('gear');
await shot('10-equipment');

await click('[data-tab="combat"]');
await click('[data-area="Woodland edge"]');
await click('[data-enemy="wood.fox"]');
await click('[data-style="Strength"]');
await click('[data-fight="wood.fox"]');
await page.waitForFunction(() => /fox/i.test(document.querySelector('[data-activity]')?.textContent ?? ''));
const foxLine = await page.locator('main').innerText();
if (!foxLine.includes('Lv 8') || !foxLine.includes('50 HP')) throw new Error(`fox panel:\n${foxLine}`);
await assertBar('fox');
await shot('11-fox');

await page.reload();
await page.waitForSelector('[data-coins]');
if (await page.locator('[data-catchup-close]').count()) await click('[data-catchup-close]');
await click('[data-tab="equipment"]');
const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('idle-game-demo-save')).equipped);
if (afterReload.weapon !== 'gear.melee.bronze_spear' || afterReload.body !== 'gear.armour.bronze_body' || afterReload.shield !== 'gear.shield.bronze') {
  throw new Error(`gear did not survive reload: ${JSON.stringify(afterReload)}`);
}
await click('[data-tab="combat"]');
await click('[data-area="Woodland edge"]');
await click('[data-enemy="wood.fox"]');
if (!/fox/i.test(await page.locator('[data-activity]').innerText())) await click('[data-fight="wood.fox"]');
await devOpen();
await click('[data-ff="60000"]');
await page.waitForSelector('[data-catchup]');
const gearedReport = await page.locator('[data-catchup]').innerText();
if (!/Combat · Forest fox/.test(gearedReport)) throw new Error(`catch-up was not the fox fight:\n${gearedReport}`);
if (!/Strength \d/.test(gearedReport)) throw new Error(`catch-up XP missing:\n${gearedReport}`);
await shot('12-catchup-gear');
await click('[data-catchup-close]');
await devClose();

if (errors.length) throw new Error(errors.join('\n'));
console.log('play ok', { beforeRewind, afterRewind, xp, gearedReport });
await browser.close();
