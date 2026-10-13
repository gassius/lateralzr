# Client E2E (Playwright)

Deterministic screenshots of the Expo **web** export (`pnpm build` → `dist/`), served as an SPA. API responses and media come from fixtures under `e2e/fixtures/` — no live backend.

## Local run

```bash
cd apps/client
pnpm install
pnpm exec playwright install chromium   # once per machine
pnpm e2e:build
pnpm e2e
```

Stability (same as CI smoke check):

```bash
pnpm exec playwright test -c e2e/playwright.config.ts e2e/specs/smoke.spec.ts --repeat-each=2
```

Outputs:

- `e2e/screenshots/<screen>_<state>_<viewport>_<locale>.png`
- `e2e/screenshots/diffs/*` — baseline diff PNGs + notes (report-only)
- `e2e/playwright-report/` — HTML report

Determinism helpers (always on): mocked API, fixed clock, `reducedMotion: reduce`, motion-killing CSS, cleared storage, `deviceScaleFactor: 2`, UTC / en-US.

## Screenshot naming

`<screen>_<state>_<viewport>_<locale>.png`

Examples: `card-front_short-label_390x844_en.png`, `card-back_with-diagram_1280x800_en.png`, `card-back_no-description_390x844_en.png`, `status_loading_390x844_en.png`, `logo_lockup-on-orange_390x844_en.png`.

## Add a screen

1. Prefer a deep link from [TEST-URL-PARAMS.md](../TEST-URL-PARAMS.md).
2. Add or extend a fixture in `e2e/fixtures/relationships/` (images under `e2e/fixtures/images/` if needed).
3. Wire the fixture in `e2e/helpers/mockApi.ts` if the request body needs a new selector.
4. Create `e2e/specs/<screen>.spec.ts`. Use `openApp(page, query)` then `capture(page, testInfo, { screen, state, locale })`.
5. Add the spec only when the UI exists — do not leave always-skipped placeholders.

### Logo / status (Lz-23 / Lz-35 / Lz-36)

- `logo_lockup-on-orange_*` — animated intro lockup on orange at boot (same as main; held for `MIN_INTRO_LOGO_MS`)
- Empty-deck error still shows the static lockup on orange (asserted in `logo.spec.ts`)
- `status_loading-initial_*` — quiet silhouette + `findingStart` after intro (delayed first fetch)
- `status_loading_*` — quiet silhouette + `loadingMoreIdeas` at end-of-deck (Lz-36)
- Back from that loading face returns to the last concept (no route change; history untouched)
- Next card replaces loading via settle (`motion.swipeSettleMs` 260 / RM 150)
- `status_offline_*` — Lz-37 offline row (`t('offline')` + Retry) via `context.setOffline(true)`; card stays

### Typography (Lz-22)

- `typography_status-meta_*` — deck status line at meta scale (v3.3 `type.meta`, Lz-35)
- `typography_large-text-200_*` — practice chrome with test-only `?e2eTextScale=2` (joint fontSize+lineHeight; full frame, not CSS zoom)

### Card front title (Lz-26)

- `card-front_short-label_*` — left-aligned concept title at default 32 (`?canonicalConcept=mushroom`)
- `card-front_long-label_*` — wrap / shrink 32→24 / visible-hyphen front (`?canonicalConcept=long-label`)
- Spec strings: `card-front_tide_*`, `card-front_collective-intelligence_*`, `card-front_intergenerational_*`
- `typography_long-label-200_*` — long front at `?e2eTextScale=2`
- `typography` pad-band @ 320 (`?e2ePadBand=1` on short title) — B1/B2: content in `frontContentFaceH < content ≤ frontFaceH`; scroll enabled + end-marker reachability
- Art-director check: `card-front_long-label_320x568_es` — no bare mid-word breaks; no hyphen when the word fits at 24
- Ink colour fallback (<24 rendered) is covered by `lib/conceptFrontTitle.test.ts`

### Card front pattern (Lz-25)

- Production SVGs in `assets/images/pattern/` (Critiquito v3.3.1, byte-locked in `lib/patternPlacement.test.ts`)
- Product variant = `hash(conceptKey) % 3` — stable across flip / backtrack
- E2E captures use short titles + `?patternVariant=1|2|3` so clearing does not strip the placement (compare 390-wide to ticket preview PNGs):
  - `card-front_pattern-01-descending_*` — `mushroom&patternVariant=1`
  - `card-front_pattern-02-ascending_*` — `tide&patternVariant=2`
  - `card-front_pattern-03-edge_*` — `mushroom&patternVariant=3`
  - `card-front_pattern-clear-200_320x568_en` / `_es` — long-label @ `e2eTextScale=2`, resting scrollTop 0; asserts no motif in title+16
- Title clear = spacer + line metrics (remeasured on layout/scale) + ink width + 16 px; intersecting motifs are hidden (never moved)

### Laterality sheet (Lz-31)

- `laterality-sheet_open_*` — sheet open from laterality label (`?laterality=4`), en + es

### App menu (Lz-32)

- `app-menu_open_*` — sheet open from ellipsis, en + es (Replay row only)
- `app-menu_open-200_*` — ES at 200% text, 320 + 390

### Coach tips (Lz-48 §12.3)

- `coach_tip-tap_320x568_es` / `coach_tip-swipe_320x568_es` / `coach_tip-complexity_320x568_es` — Spanish sequence at 320
- `coach_tip-tap-reduced_320x568_es` — tipTap with app Motion=Reduced

### Status — Lz-38 loading / failure / missing-content

- `status_neighbourhood-loading_*` — laterality swap held open; status in control row
- `status_fetch-failed_*` — load-more abort; `fetchFailed` + Retry; card stays
- `status_no-next-idea_*` — empty batches exhaust 1.5/3/6 s backoff; `noNextIdea` + Adjust

### Pending screens (add when UI ships)

- Language / complexity / motion / about pickers
- End-of-deck (non-loading) if distinct from `status_loading`

Smoke runs on **all four** viewports (390×844, 320×568, 430×932, 1280×800).

## Design review (UI/UX and Art Supervisor (gasnet-art-director))

Screenshots for review live on the orphan Git branch **`e2e-screenshots`** (not embedded in the PR comment). Vercel previews are disabled for that branch (`apps/client/vercel.json`).

| Path | Meaning |
| --- | --- |
| `e2e-screenshots:pr-<n>/` | Latest captures for open PR `#n` (overwritten each CI run) + `diffs/` |
| `e2e-screenshots:baselines/` | UI/UX and Art Supervisor (gasnet-art-director)-approved references published from `main` |

**Review flow:** open `pr-<n>/`, compare against `baselines/`, use the sticky PR comment’s **diff summary table** (screen, % changed, pass / over-threshold, link to diff image). The sticky comment is text-only (run link, SHA, tree link, table) — no inline images.

When a PR closes, CI removes `pr-<n>/` from the orphan branch (see `.github/workflows/client-e2e-cleanup.yml`).

Also see [baselines/README.md](./baselines/README.md).

## Baselines / pixel compare

- CI **syncs** `e2e-screenshots:baselines/` into `e2e/baselines/` before Playwright runs (read-only). If that orphan folder is empty, in-repo [DEMO seeds](./baselines/DEMO-SEEDS.md) are the fallback.
- Compares at 1% pixel ratio; diffs are **report-only** unless `E2E_STRICT_BASELINES=1`.
- Color sensitivity is `PIXELMATCH_COLOR_THRESHOLD` (`0.01` in `e2e/helpers/pngDiff.ts`) — not the library default `0.1`, which hid low-contrast motif / watermark changes as `0.00%` changed.
- Before pixelmatch, `CHANNEL_NOISE_FLOOR` (`3`) equalizes per-channel deltas ≤ 3/255 so encoder noise does not inflate `% changed`.
- Smoke stability runs `--repeat-each=2` and additionally asserts ≥1 capture is pixel-identical across two passes.

## CI security split

`.github/workflows/client-e2e.yml`:

1. **Client E2E screenshots** — `contents: read`, `persist-credentials: false`, assert empty `http.https://github.com/.extraheader`, sync orphan baselines, build + test + upload artifact. The job always reports (required check). Path filter (`dorny/paths-filter`) skips capture when the PR does not touch `apps/client/**` or E2E workflow/config. Client PRs (draft or ready) run a 390px / English subset (mapped specs or a fixed smoke set); draft vs ready does not change the plan. Adding the `run-full-screenshots` label starts the full viewport/locale matrix and posts **Client E2E full screenshots** on the commit it tested (other labels are ignored and do not cancel in-progress runs). A synchronize event removes that label. Push to `main` / `workflow_dispatch` still run the full matrix. Expo `dist/` and Playwright browsers are cached.
2. **Client E2E PR comment** (`pull_request` only) — write scopes; downloads artifact; fetches publish script from **`pull_request.base.sha` only** (never head / merge SHA); publishes to `e2e-screenshots:pr-<n>/` + short sticky comment. Same publish path for subset and full capture runs.
3. **Client E2E baselines** (`push` to main) — write scopes; downloads artifact; publishes to `e2e-screenshots:baselines/`. Full-run publish layout is unchanged.

Cleanup: `.github/workflows/client-e2e-cleanup.yml` removes `pr-<n>/` when the PR closes (cleanup script also from **base** SHA only).
