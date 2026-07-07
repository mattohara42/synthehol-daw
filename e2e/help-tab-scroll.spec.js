import { test, expect } from '@playwright/test';
import { dismissBossIntro } from './helpers.js';

// Scenario 4: the Help-tab scroll-clipping bug (2026-07-04-mixer-view-
// requirements.md's addendum) — #help-body's own `overflow-y: auto` was
// set correctly, but an ancestor never stretched to give it any bounded
// height to scroll *within*, so the tail of the content was silently
// clipped with no visibly broken scrollbar. Caught originally by comparing
// scrollHeight against the rendered clientHeight in a real browser — this
// turns that one-off check into a standing regression guard, plus verifies
// the overflow is actually reachable by scrolling, not just present.
test('the Help tab gets a real bounded height and its full content is reachable by scrolling', async ({ page }) => {
  await page.goto('/');
  await dismissBossIntro(page);
  await page.locator('#tab-help').click();
  await expect(page.locator('#view-help')).toBeVisible();

  const helpBody = page.locator('#help-body');
  await expect(helpBody).toBeVisible();

  const metrics = await helpBody.evaluate((el) => ({
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }));

  // A collapsed ancestor (the regressed state) leaves clientHeight tiny
  // regardless of how much real content the Help tab has; a healthy
  // container fills a real fraction of the viewport.
  expect(metrics.clientHeight).toBeGreaterThan(200);

  if (metrics.scrollHeight > metrics.clientHeight) {
    // There's more content than fits — prove it's actually scrollable to
    // the true end, not just nominally overflow:auto while an ancestor
    // clips the extra invisibly.
    const reachedBottom = await helpBody.evaluate((el) => {
      el.scrollTop = el.scrollHeight - el.clientHeight;
      return Math.abs(el.scrollTop - (el.scrollHeight - el.clientHeight)) < 2;
    });
    expect(reachedBottom).toBe(true);
  }
});
