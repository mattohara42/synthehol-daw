import { test, expect } from '@playwright/test';
import { dismissBossIntro } from './helpers.js';

// Scenario 5: the one check that proves the *whole* signal chain — voice
// allocation -> filter -> mix bus -> drive/EQ -> master -> scope tap — is
// actually connected end-to-end in a running browser, not just that each
// piece's logic is correct in isolation (which the ~400 Vitest tests
// already establish thoroughly). Flagged in the scoping doc as the most
// valuable scenario here and also the most novel technique for this repo
// (nothing today asserts on rendered canvas *content*) — first to cut if
// it proves flaky in practice.
test('playing a note produces changing pixel data on the oscilloscope canvas', async ({ page }) => {
  await page.goto('/');
  await dismissBossIntro(page);

  const key = page.locator('.key[data-note="C"]');
  const box = await key.boundingBox();
  if (!box) throw new Error('keyboard key not found/visible');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();

  // Let a few animation frames of real signal accumulate before sampling.
  await page.waitForTimeout(200);
  const sampleA = await samplePixels(page);
  await page.waitForTimeout(150);
  const sampleB = await samplePixels(page);

  await page.mouse.up();

  expect(sampleA.length).toBeGreaterThan(0);
  expect(sampleA).not.toEqual(sampleB);
});

async function samplePixels(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('scope-canvas');
    const ctx = canvas.getContext('2d');
    return Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
  });
}
