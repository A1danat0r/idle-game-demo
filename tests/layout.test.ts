import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { equip, newGame, type Save } from '../src/engine';
import { activityHtml, headerHtml, mainHtml, shellHtml, tabsHtml, type View } from '../src/ui';

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

const view: View = {
  tab: 'skills',
  skill: 'Woodcutting',
  filter: 'all',
  selected: null,
  area: 'Meadow verge',
  style: null,
  message: '',
};

describe('activity bar placement', () => {
  it('sits directly above the tab bar', async () => {
    const state = newGame(0);
    const html = shellHtml(headerHtml(state, false), '', '<p>Skills</p>', activityHtml(state), tabsHtml(view));
    const activityAt = html.indexOf('data-activity');
    const mainAt = html.indexOf('<main>');
    const tabsAt = html.indexOf('class="tabs"');
    expect(mainAt).toBeGreaterThan(0);
    expect(activityAt).toBeGreaterThan(mainAt);
    expect(tabsAt).toBeGreaterThan(activityAt);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div id="app">${html}</div></body></html>`);
    const bar = await page.locator('[data-activity]').boundingBox();
    const tabs = await page.locator('nav.tabs').boundingBox();
    const main = await page.locator('main').boundingBox();
    await browser.close();
    expect(bar).toBeTruthy();
    expect(tabs).toBeTruthy();
    expect(main).toBeTruthy();
    expect(main!.y + main!.height).toBeLessThanOrEqual(bar!.y + 1);
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(tabs!.y + 1);
    expect(tabs!.y - (bar!.y + bar!.height)).toBeLessThan(12);
  });
});

describe('equipment rows', () => {
  it('keeps gear names and stat lines inside the row at 390px', async () => {
    const state = newGame(0);
    state.bank['gear.melee.bronze_spear'] = 1;
    state.bank['gear.melee.iron_spear'] = 1;
    state.bank['gear.armour.bronze_body'] = 1;
    state.bank['gear.armour.iron_body'] = 1;
    state.bank['gear.shield.bronze'] = 1;
    equip(state, 'gear.melee.bronze_spear');
    equip(state, 'gear.armour.bronze_body');
    const equippedView: View = { ...view, tab: 'equipment' };
    const html = shellHtml(
      headerHtml(state, false),
      '',
      mainHtml(state, equippedView, 0),
      activityHtml(state),
      tabsHtml(equippedView),
    );
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div id="app">${html}</div></body></html>`);
    const report = await page.locator('button.gearpick').evaluateAll((buttons) =>
      buttons.map((button) => {
        const style = getComputedStyle(button);
        const texts = [button, ...Array.from(button.querySelectorAll('b, small'))].map((node) => ({
          text: node.textContent ?? '',
          overflow: node.scrollWidth - node.clientWidth,
        }));
        return {
          text: button.textContent,
          equipped: button.classList.contains('on'),
          background: style.backgroundColor,
          color: style.color,
          texts,
        };
      }),
    );
    await browser.close();
    expect(report.length).toBeGreaterThanOrEqual(5);
    expect(report.some((row) => row.equipped)).toBe(true);
    expect(report.some((row) => !row.equipped)).toBe(true);
    for (const row of report) {
      expect(row.background, row.text ?? '').not.toBe('rgb(255, 255, 255)');
      expect(row.color, row.text ?? '').not.toBe('rgb(0, 0, 0)');
      for (const piece of row.texts) {
        expect(piece.overflow, piece.text).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('combat figures at 390×844', () => {
  it('keeps both figures above the activity bar on Meadow and Woodland', async () => {
    const meadow = combatSave();
    const woodland = combatSave();
    woodland.enemyKills['meadow.beetle'] = 1;
    await expectFiguresAboveBar(meadow, { ...view, tab: 'combat', area: 'Meadow verge', selected: 'meadow.hare', style: 'Strength' });
    await expectFiguresAboveBar(woodland, { ...view, tab: 'combat', area: 'Woodland edge', selected: 'wood.fox', style: 'Strength' });
  });
});

function combatSave(): Save {
  const state = newGame(0);
  state.owned.push('Attack', 'Strength', 'Defence', 'Hitpoints');
  state.xp.Attack = 0;
  state.xp.Strength = 0;
  state.xp.Defence = 0;
  state.xp.Hitpoints = 0;
  return state;
}

async function expectFiguresAboveBar(state: Save, screen: View): Promise<void> {
  const html = shellHtml(headerHtml(state, false), '', mainHtml(state, screen, 0), activityHtml(state), tabsHtml(screen));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div id="app">${html}</div></body></html>`);
  const bar = await page.locator('[data-activity]').boundingBox();
  const figures = await page.locator('.fight .fighter').all();
  expect(bar).toBeTruthy();
  expect(figures).toHaveLength(2);
  for (const figure of figures) {
    const box = await figure.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.height).toBeGreaterThan(40);
    expect(box!.y + box!.height).toBeLessThanOrEqual(bar!.y);
  }
  await browser.close();
}
