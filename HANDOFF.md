# HANDOFF — synthehol-daw

Short-lived "where we left off" notes. Not a design doc — `CLAUDE.md` and
`docs/*backlog*.md` stay the source of truth.

---

## Pending from the 2026-08-31 branch audit

A cross-repo audit of unmerged branches ran on 2026-08-31. Two things are
outstanding here.

### 1. PR #33 — test coverage — needs a decision before it can land

https://github.com/mattohara42/synthehol-daw/pull/33 (draft)

Six commits from 2026-07-07 that were sitting on `origin` with no PR — the
largest piece of genuinely unlanded work in the repo. ~1,891 insertions
across 26 files:

- **Playwright e2e** (new `e2e/` directory): `boot.spec.js`,
  `audio-unlock.spec.js`, `signal-chain.spec.js`,
  `gated-elements-visibility.spec.js`, `help-tab-scroll.spec.js`
- **Unit:** `controls.test.js`, `notes.test.js`, `presets.test.js`,
  `sequencerUI.test.js`, `style.test.js`, `transport.test.js`, plus
  extensions to `stages.test.js` / `wavRender.test.js`

`gated-elements-visibility.spec.js` is the one worth keeping: it's a
regression guard for the `[hidden]` + `display` trap documented in
`CLAUDE.md`, which cost a full commit twice.

**Two blockers, both needing a human call:**

1. It conflicts with `master` (the branch is 25 commits behind).
2. **`src/hoverPreview.test.js` must be dropped before this lands.** The
   branch predates the removal of `hoverPreview.js`; `CLAUDE.md` records
   that the module and its test were deliberately deleted. Merging as-is
   would resurrect a test for a module that no longer exists.

### 2. Seven stale branches to delete

All are either content-identical to `master` or already merged via a PR.
SHAs recorded so any deletion is reversible
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

**Left alone deliberately:** `archive/documents-act2-3-4` (51 commits). It
has no merge base with `master` — an artifact of a history rewrite, not
lost work — and the name suggests it's a deliberate archive.

Enabling **Settings → General → "Automatically delete head branches"**
would stop the stale refs accumulating again.
