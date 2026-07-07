import { test, expect } from '@playwright/test';
import { dismissBossIntro } from './helpers.js';

// Scenario 2: AudioContext creation is gated behind a real user gesture
// (audio.js's startAudio(), called from keyboard.js's pressKey()) — a rule
// that only exists in a real browser; Node has no gesture model to violate
// in the first place, so this can only be checked here.
test('AudioContext does not exist before any interaction, and unlocks on the first key press', async ({ page }) => {
  await page.goto('/');
  await dismissBossIntro(page);

  const before = await page.evaluate(() => window.synthAudio.engine.ctx);
  expect(before).toBeNull();

  const cKey = page.locator('.key[data-note="C"]');
  await cKey.click();

  await expect.poll(() => page.evaluate(() => window.synthAudio.engine.ctx?.state)).not.toBeUndefined();
  const state = await page.evaluate(() => window.synthAudio.engine.ctx.state);
  expect(['running', 'suspended']).toContain(state); // never 'closed' right after creation
});
