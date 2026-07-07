// Shared across every spec: initProgressionUI() always shows a full-screen
// "Boss Incoming" overlay (#boss-transition-overlay) on load before any
// encounter's own effects run, and it intercepts pointer events on
// everything underneath until dismissed. Every spec needs to get past it
// before interacting with anything else on the page.
export async function dismissBossIntro(page) {
  const btn = page.locator('#boss-transition-btn');
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
  }
}
