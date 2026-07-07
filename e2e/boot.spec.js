import { test, expect } from '@playwright/test';
import { dismissBossIntro } from './helpers.js';

// Scenario 1 (docs/brainstorms/2026-07-07-playwright-smoke-test-requirements.md):
// every initXUI() call in main.js runs sequentially and unguarded, so one
// throw partway through currently means everything after it silently never
// runs. A clean load with the debug hooks present is the cheapest possible
// proof the whole init chain actually completed.
test('loads with no console/page errors and exposes the debug hooks main.js promises', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    // favicon.ico 404s regardless of app correctness — this dev setup has
    // no favicon configured. Every other console error is a real signal.
    if (msg.type() === 'error' && !msg.location()?.url?.includes('favicon.ico')) errors.push(msg.text());
  });

  await page.goto('/');
  await dismissBossIntro(page);
  await expect(page.locator('#keyboard')).toBeVisible();

  const hooks = await page.evaluate(() => ({
    hasStore: typeof window.synthStore?.get === 'function',
    hasTransport: typeof window.synthTransport?.play === 'function',
    hasAudio: typeof window.synthAudio?.voiceNoteOn === 'function',
  }));
  expect(hooks).toEqual({ hasStore: true, hasTransport: true, hasAudio: true });

  expect(errors, `unexpected console/page errors: ${errors.join('\n')}`).toEqual([]);
});
