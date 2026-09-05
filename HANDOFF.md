# HANDOFF — synthehol-daw

Short-lived "where we left off" notes. Not a design doc — `CLAUDE.md` and
`docs/*backlog*.md` stay the source of truth.

---

## Test coverage worth salvaging (PR #33 closed 2026-09-05)

There is a Playwright e2e suite and six unit-test files that `master` has never
had. They were written 2026-07-07, sat on `origin` with no PR, and were briefly
opened as **PR #33 — now closed unmerged.**

**The branch must not be merged.** It is ~2 months and 25+ commits behind, and
merging it into `master` would delete work that landed since:

| Would be deleted | Why that's wrong |
|---|---|
| `src/skinUI.js` | The skeuomorphic skin toggle — **still imported by `src/main.js`**. Deleting it breaks boot. |
| `src/uiLayout.test.js` | A live test |
| `.github/workflows/deploy.yml` | CI |
| `CHANGELOG.md`, `scripts/dev-live.sh` | Both post-date the branch |

Plus 365 lines of `src/style.css` reverted. Net: 42 files, −974 lines.

### The salvage: 14 files, all pure additions

```bash
git checkout -b test-coverage-salvage master
git checkout claude/test-coverage-analysis-vldujq -- \
  e2e/ playwright.config.js docs/brainstorms/2026-07-07-playwright-smoke-test-requirements.md \
  src/controls.test.js src/notes.test.js src/presets.test.js \
  src/sequencerUI.test.js src/style.test.js src/transport.test.js
npm test
```

That takes: the five e2e specs (`boot`, `audio-unlock`, `signal-chain`,
`gated-elements-visibility`, `help-tab-scroll`) plus `e2e/helpers.js` and
`playwright.config.js`, the requirements doc, and six unit-test files.

**Two caveats, both load-bearing:**

1. **Do not take `src/hoverPreview.js` or `src/hoverPreview.test.js`.** They
   look like additions only because the module was *deliberately deleted* from
   `master` — `CLAUDE.md` records it was removed at Matt's request, because the
   hover-triggered audio read as random noise. Taking them undoes that.
2. **These tests have never run against current `master`.** Expect failures from
   renamed exports and changed DOM ids rather than real bugs. Treat it as a
   starting point to fix up, not a drop-in suite.
   `e2e/gated-elements-visibility.spec.js` is worth keeping whatever else goes:
   it guards the `[hidden]` + `display` trap that `CLAUDE.md` says cost a full
   commit twice.

Branch `claude/test-coverage-analysis-vldujq` (`547f4b5`) is kept until the
salvage lands, then delete it.

---

## Branch cleanup (from the 2026-08-31 audit)

Seven stale branches to delete. All either content-identical to `master` or
already merged via a PR. SHAs recorded so any deletion is reversible
(`git push origin <sha>:refs/heads/<branch>`):

```
git push origin --delete claude/claude-md-docs-maiu6v          # was 1f43f74
git push origin --delete claude/create-release-0ccb2v          # was 2308f38
git push origin --delete claude/design-overhaul-status-plc2gv  # was 5e88e0e
git push origin --delete claude/lfo-mobile-height-wysneu       # was 826fafb
git push origin --delete claude/skeuomorphic-ui-option-m3rh1t  # was 7775ed8
git push origin --delete claude/ui-tweaks-tests-vohnox         # was e5f68e7
git push origin --delete claude/mobile-layout-canvas-overflow  # was c6f78f1
```

The last one is PR #32 (the mobile canvas/page-overflow fix), merged
2026-08-31 as `4e0904e`.

**Left alone deliberately:** `archive/documents-act2-3-4` (51 commits). It has
no merge base with `master` — an artifact of a history rewrite, not lost work —
and the name suggests a deliberate archive.

Enabling **Settings → General → "Automatically delete head branches"** would
stop the stale refs accumulating again.

---

## A note on how the audit above was produced

The 2026-08-31 audit that opened PR #33 also opened two sibling PRs in other
repos on the claim that they carried unlanded work. **Both claims were wrong**,
caught on a later pass, and both PRs were closed unmerged. The errors were the
same shape each time: a grep that looked like evidence but wasn't (a
case-sensitive pattern that couldn't match the symbol it was searching for; a
whole-repo file count that was really counting documentation).

This repo's PR #33 was the one case where the content genuinely was absent —
verified by listing files, not grepping for strings. Worth remembering which
check held up: **`git ls-tree` / `git merge-tree` answer "is this in the tree",
`grep` only answers "did my pattern match".**
