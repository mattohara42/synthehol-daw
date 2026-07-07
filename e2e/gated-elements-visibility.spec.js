import { test, expect } from '@playwright/test';
import { dismissBossIntro } from './helpers.js';

// Scenario 3: the [hidden]-vs-display regression (CLAUDE.md's Conventions
// section) — an author CSS rule that sets `display` silently beats the
// browser's `[hidden] { display: none }` default, so `el.hidden === true`
// while the element stays visible and clickable. `el.hidden` reads `true`
// in every environment regardless of whether the bug is present; only
// real rendered visibility (what Playwright's toBeHidden/toBeVisible
// actually check) can tell the difference. src/style.test.js pins the
// known fixes at the CSS-text level — this is the rendering-level check
// that would catch a *new* instance of the same bug.
const GATED_SELECTORS = ['#lfowave-sh-btn', '#ctrl-chorus', '#tab-practice', '#tab-mixer', '#era-workspaces', '#tracks-bar'];

const GRADUATED_PROGRESS = JSON.stringify({
  currentStageIndex: 8,
  xp: 999,
  defeated: ['osc', 'filter', 'envelope', 'lfo', 'noise', 'osc2', 'delay', 'reverb', 'mimic'],
  unlockedFeatures: ['lfoSampleHold', 'chorusFx'],
});

test('gated elements are actually invisible pre-graduation, not just hidden=true in name', async ({ page }) => {
  await page.goto('/');
  await dismissBossIntro(page);
  for (const selector of GATED_SELECTORS) {
    await expect(page.locator(selector), `${selector} should be hidden pre-graduation`).toBeHidden();
  }
});

test('gated elements actually render once graduation/feature-unlock progress is present', async ({ page }) => {
  // Establish the origin first so localStorage is writable, then seed a
  // fully-graduated, fully-unlocked save before the app's own script runs.
  await page.goto('/');
  await page.evaluate((json) => localStorage.setItem('synthehol_progress', json), GRADUATED_PROGRESS);
  await page.reload();
  await dismissBossIntro(page);

  // #era-workspaces lives inside the History teach-tab (not Learn, the
  // default active one) — switching tabs is a separate concern from
  // progression-gating, so it has to happen for this element specifically
  // before toBeVisible() means anything (an ancestor being hidden is a
  // different, legitimate reason to be invisible, not the bug this test
  // is guarding against).
  await page.locator('.teach-tab[data-teachview="history"]').click();

  for (const selector of GATED_SELECTORS) {
    await expect(page.locator(selector), `${selector} should be visible once unlocked`).toBeVisible();
  }
});
