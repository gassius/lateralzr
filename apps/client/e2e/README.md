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

Examples: `card-front_short-label_390x844_en.png`, `card-back_with-diagram_1280x800_en.png`, `status_loading_390x844_en.png`.

## Add a screen

1. Prefer a deep link from [TEST-URL-PARAMS.md](../TEST-URL-PARAMS.md).
2. Add or extend a fixture in `e2e/fixtures/relationships/` (images under `e2e/fixtures/images/` if needed).
3. Wire the fixture in `e2e/helpers/mockApi.ts` if the request body needs a new selector.
4. Create `e2e/specs/<screen>.spec.ts`. Use `openApp(page, query)` then `capture(page, testInfo, { screen, state, locale })`.
5. Add the spec only when the UI exists — do not leave always-skipped placeholders.

### Pending screens (add when UI ships)

- Laterality sheet open
- App menu open
- Language / complexity / motion / about pickers
- Coaching tooltip steps
- Offline line
- “No next idea” empty state
- End-of-deck (non-loading) if distinct from `status_loading`

Smoke runs on **all three** viewports (390×844, 320×568, 1280×800).

## Baselines / Critiquito

See [baselines/README.md](./baselines/README.md).

- PRs compare at 1% (`maxDiffPixelRatio` 0.01); diffs are **report-only** unless `E2E_STRICT_BASELINES=1`.
- Pushes to `main` publish captures into `e2e/baselines/` via a write-scoped job that only downloads the artifact (never runs `pnpm` / Expo with write tokens).

## CI security split

`.github/workflows/client-e2e.yml`:

1. **Client E2E screenshots** — `contents: read`, `persist-credentials: false`, assert empty `http.https://github.com/.extraheader`, build + test + upload artifact.
2. **Client E2E PR comment** (`pull_request` only) — write scopes; downloads artifact; fetches publish script via API (**no repo checkout**); orphan branch + sticky comment.
3. **Client E2E baselines** (`push` to main) — write scopes; downloads artifact; commits baselines.
