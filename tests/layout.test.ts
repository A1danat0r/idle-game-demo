import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import css from '../src/style.css?raw';
import { newGame } from '../src/engine';
import { activityHtml, headerHtml, shellHtml, tabsHtml, type View } from '../src/ui';

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
