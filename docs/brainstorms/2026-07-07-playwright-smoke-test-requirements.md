---
date: 2026-07-07
topic: playwright-smoke-test-requirements
status: shipped
---

# Synthehol — Playwright Smoke Test Requirements

Scoping pass for the one gap the recent test-coverage work explicitly
couldn't close: a growing set of DOM-rendering modules (`keyboard.js`,
`knob.js`, `canvas.js`'s draw functions, `main.js`, `scope.js`, and the
render/wiring halves of `mixerUI.js`/`tracksUI.js`/`pianoRollUI.js`/
`clipsUI.js`/`practiceUI.js`/`eraWorkspacesUI.js`) sit at 0% coverage with
no extractable pure core — Vitest runs in a Node environment on purpose
(`vite.config.js`: `environment: 'node'`), so anything that needs a real
`getComputedStyle`, real layout, or a real `AudioContext`'s actual behavior
is structurally out of its reach. Same audit-first shape as the other
scoping docs — figure out what a browser-only tool would actually catch
here before proposing any dependency or workflow changes.

## Why this is worth a real look, not just "more coverage"

Two real regressions already shipped **specifically because no test ran in
a real browser**, both documented in `CLAUDE.md`:

1. **The `[hidden]`-vs-`display` trap** (Conventions section) — an author
   CSS rule that sets `display` silently beats the browser's `[hidden] {
   display: none }` default, so `el.hidden === true` while the element
   stays visible and clickable. This bit D1's first two gated challenges
   for a full commit each. `el.hidden` is `true` in every environment —
   Node, jsdom, or a real browser — so no amount of checking the *property*
   catches it. Only rendered layout does. (`src/style.test.js`, added this
   session, pins the four known fixes as a text-level regression guard —
   real, but a `grep`-shaped safety net, not a rendering check. It can't
   catch a *new* selector introduced with the same bug.)
2. **The Help-tab scroll-clipping bug** (`2026-07-04-mixer-view-requirements.md`'s
   addendum) — `overflow-y: auto` was set correctly, but an ancestor's
   height constraint silently clipped the tail of the content with no
   scrollbar appearing broken, just short. Caught by comparing
   `scrollHeight` against the rendered `clientHeight` **in a real
   browser** — not visible from reading the DOM or CSS source at all.

Both are exactly the shape of bug a real rendering engine catches in
seconds and no amount of unit testing — however thorough — can.

## What's already in place, unexpectedly

`main.js` already exposes three debug hooks explicitly annotated for this:

```js
// Debug/integration hooks: the project store (E1), transport (E2), and the
// polyphonic voice path (E3). Future UI (sequencer, undo) and console
// verification reach them here.
window.synthStore = store;
window.synthTransport = transport;
window.synthAudio = { engine, voiceNoteOn, voiceNoteOff, releaseAllVoices };
```

Nothing currently reads them. A Playwright suite would be the first actual
consumer of hooks the codebase already anticipated — `store.canUndo()`,
`transport.play()`, `engine.tracks.size`, etc. are all reachable from
`page.evaluate(() => window.synthStore.canUndo())` today, with zero new
production code needed to expose state for assertions.

## Current state (why this is greenfield, not "wire up the existing thing")

- No CI exists (`.github/workflows/` doesn't exist). Whatever ships here
  runs manually / in an interactive session first; wiring it into CI is a
  separate, later decision (see below).
- No Playwright (or any e2e) dependency in `package.json` — `vite`,
  `vitest`, and `@vitest/coverage-v8` are the only deps.
- `vite.config.js`'s Vitest `include: ['src/**/*.test.js']` already scopes
  Vitest away from any directory outside `src/`, so an e2e suite living in
  its own top-level directory (e.g. `e2e/`) needs zero config changes on
  the Vitest side to coexist.
- **Environment note, not a codebase fact**: *this* Claude Code web session
  has Chromium pre-installed (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`).
  That's a property of the sandbox, not of the repo — a contributor's own
  machine or a future CI runner would need `npx playwright install
  chromium` (or `@playwright/test`'s own downloader) as a real setup step.
  Don't assume the pre-installed browser travels with the repo.

## Proposed v1 scope — five scenarios, each tied to something Vitest structurally cannot verify

Deliberately small and deliberately *not* re-testing logic the 400 existing
Vitest tests already cover. Playwright's job here is narrow: prove the
browser actually renders/wires what the unit tests prove is *correct in
principle*.

1. **Boot smoke test.** Load the page, assert no console errors, assert
   `window.synthStore`/`synthTransport`/`synthAudio` exist (confirms
   `main.js`'s full init chain ran without an exception silently aborting
   it partway through — every `initXUI()` call is sequential and unguarded,
   so one throw upstream currently means everything after it silently never
   runs).
2. **Audio unlocks on first key press.** Click a keyboard key (or send the
   matching computer-keyboard keydown), then assert
   `window.synthAudio.engine.ctx` exists and its `state` isn't `'closed'`.
   Directly covers the documented constraint that `AudioContext` creation
   is gated behind a user gesture (`startAudio()` in `audio.js`) — a
   real-browser-only rule; Node has no gesture model to violate in the
   first place, so this can *only* be checked here.
3. **The `[hidden]`-vs-`display` regression, checked by rendering, not
   text.** Before graduation, assert `#lfowave-sh-btn` / `#ctrl-chorus` /
   `#tab-practice` / `#tab-mixer` / `#era-workspaces` / `#tracks-bar` are
   not just `hidden === true` but actually not in the accessibility tree /
   have zero rendered size (Playwright's `toBeHidden()` checks real
   computed visibility, exactly what `src/style.test.js` can't). Then seed
   `localStorage.synthehol_progress` with a graduated save (the same shape
   `progression.test.js` already builds for its own fixtures) and reload —
   assert the same elements are now visible. This is the *actual* bug class
   from CLAUDE.md's Conventions note, checked the only way it can be: by
   asking the browser what's really on screen.
4. **Help tab content is fully reachable.** Open the Help tab, assert
   `#help-body`'s `scrollHeight` doesn't exceed its `clientHeight` by more
   than the scrollable delta expected — i.e., the exact check that caught
   the shipped bug, turned into an assertion instead of a one-off manual
   verification. Cheap, and it's a regression guard for a bug that already
   happened once.
5. **A true end-to-end signal check.** Play a note (key press), assert the
   oscilloscope canvas (`#scope-canvas`) actually draws non-flat pixel data
   over a short window (e.g. sample two `getImageData` snapshots ~100ms
   apart and assert they differ). This is the one check that proves the
   *whole* signal chain — voice allocation → filter → mix bus → drive/EQ →
   master → scope tap — is actually connected end-to-end in a running
   browser, not just that each piece's logic is correct in isolation
   (which the Vitest suite already establishes thoroughly).

## Explicitly out of scope for v1

- **Visual regression / screenshot diffing.** A different, heavier tool
  category (pixel-diff baselines, flake-prone across font/GPU rendering
  differences) solving a different problem than "did this silently break."
  Nothing in this codebase's history motivates it yet — both real bugs
  found so far were *layout/visibility* bugs, not *appearance* bugs.
- **Re-testing per-control logic.** Filter cutoff math, ADSR shaping,
  sequencer timing, undo/redo correctness, mixer mute/solo math — all
  already covered, thoroughly, by the 400 Vitest tests across this session
  and prior work. Re-asserting any of that through a slow, real-browser
  click-and-wait cycle would be pure duplication with worse signal (a
  Playwright failure is far more expensive to debug than a Vitest one).
- **CI wiring.** No CI exists at all right now. Standing one up (a GitHub
  Actions workflow, Playwright's own `npx playwright install --with-deps`
  step since Actions runners don't ship browsers, artifact upload for
  trace/screenshot-on-failure) is a real, separate decision with its own
  cost — bundled here only as an open question, not proposed as part of
  v1's actual deliverable.
- **Mobile-viewport testing.** `style.css` has a `max-width: 1180px`
  breakpoint but nothing in the recent bug history points at
  mobile-specific layout breakage; not worth the added scenario matrix
  until something does.

## Technical plan (if this gets a go-ahead)

- Add `@playwright/test` as a devDependency (this specific package bundles
  its own test runner, assertion library, and browser management — no need
  for a separate assertion lib).
- `playwright.config.js` at repo root: `webServer` pointing at `npm run
  dev` (port 5173, matching `.claude/launch.json`'s existing config, so
  Playwright starts/stops the dev server itself rather than requiring one
  already running), single `chromium` project for v1 (Firefox/WebKit only
  worth adding if something actually needs cross-browser coverage — Web
  MIDI's own platform matrix already documented in `CLAUDE.md` is a
  reasonable future trigger for that, not a v1 need).
- Tests live in a new top-level `e2e/` directory (`e2e/*.spec.js`), kept
  fully separate from `src/**/*.test.js` so Vitest's `include` glob never
  needs to know these exist, and so `npm test` (fast, every commit) stays
  decoupled from `npm run test:e2e` (slower, browser-dependent, run less
  often).
- New npm script: `"test:e2e": "playwright test"`.

## Open questions for you

1. **Is local-only (run manually, or in a Claude Code session where
   Chromium's pre-installed) enough for now, or do you want this gated in
   CI from the start?** Affects whether the technical plan above is the
   whole deliverable or step one of two.
2. **Any appetite for scenario 5 (canvas pixel sampling) specifically?**
   It's the most valuable end-to-end check on this list but also the most
   novel technique for this codebase (nothing today asserts on rendered
   canvas *content*, only on canvas *draw-function calls* via the existing
   `canvas.js` mocking pattern in `teaching.test.js`) — happy to cut it
   from v1 and keep the other four if you'd rather start smaller.

## Recommendation

Build the five-scenario v1 above, local-only (no CI wiring), as a single
small slice — it directly closes both documented real-bug classes with the
least possible surface area, reuses debug hooks the codebase already
exposes for exactly this purpose, and deliberately avoids re-litigating
anything the 400 existing Vitest tests already cover. Estimate: comparable
in size to the mixer-view or inline-help slices already shipped — one
config file, one small devDependency addition, five focused spec files.

## Status: shipped

Both open questions above were answered by the person who asked for this
scope in the first place saying "I don't know" — resolved by taking the
recommendation verbatim rather than leaving it open: local-only, all five
scenarios kept (including canvas pixel sampling, which turned out fully
stable — 4 full runs, 24/24 passes, no flakiness observed).

Built exactly as scoped: `@playwright/test` added as a devDependency,
`playwright.config.js` at repo root (`webServer` starts `npm run dev`
itself; single `chromium` project), five spec files in a new `e2e/`
directory, `"test:e2e": "playwright test"` added to `package.json`. Vitest
untouched and unaffected — confirmed 400/400 still pass after the addition.

Two real findings while building, neither anticipated by the scoping pass:

1. **`initProgressionUI()` always shows a full-screen "Boss Incoming"
   overlay (`#boss-transition-overlay`) on load**, before any encounter's
   own effects run, and it intercepts pointer events on the entire page
   until dismissed. Every single spec that interacts with anything needed
   a shared `dismissBossIntro()` helper (`e2e/helpers.js`) called
   immediately after `page.goto()` — without it, every scenario except the
   pure boot check timed out clicking through the overlay. Not a bug (it's
   the game's actual intended first-load experience), just something a
   scoping pass reading source code rather than running the app in a
   browser had no way to predict.
2. **The dev server's missing favicon 404s on every load**, which Chromium
   surfaces as a `console.error`. `boot.spec.js`'s "no console errors"
   check needed a specific filter for `favicon.ico` rather than either
   ignoring all console errors (too weak — would hide a real regression)
   or failing on this expected, harmless one. Confirmed by logging every
   network response against a real running dev server rather than guessing.

Also resolved one detail the technical plan left implicit: this sandbox's
`@playwright/test@1.61.1` expects a newer bundled Chromium revision (1228)
than what's pre-installed here (1194) — rather than hardcoding this
sandbox's specific browser path into the committed config (wrong for
anyone else's machine), `playwright.config.js` reads an optional
`PLAYWRIGHT_CHROMIUM_PATH` env var and falls back to Playwright's normal
own-managed browser otherwise. On a machine where `npx playwright install
chromium` has been run normally, the env var is simply unset and unneeded.

Verified: 4 full suite runs (24 test executions total — 5 spec files, 6
test cases since `gated-elements-visibility.spec.js` holds two), zero
failures, ~8s per full run. Not wired into CI — none exists in this repo
yet, consistent with the scoping doc's own "explicitly out of scope for
v1" call.
