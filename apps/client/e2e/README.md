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
- Compares at 1%; diffs are **report-only** unless `E2E_STRICT_BASELINES=1`.
- Smoke stability runs `--repeat-each=2` and additionally asserts ≥1 capture is pixel-identical across two passes.

## CI security split

`.github/workflows/client-e2e.yml`:

1. **Client E2E screenshots** — `contents: read`, `persist-credentials: false`, assert empty `http.https://github.com/.extraheader`, sync orphan baselines, build + test + upload artifact.
2. **Client E2E PR comment** (`pull_request` only) — write scopes; downloads artifact; fetches publish script from **`pull_request.base.sha` only** (never head / merge SHA); publishes to `e2e-screenshots:pr-<n>/` + short sticky comment.
3. **Client E2E baselines** (`push` to main) — write scopes; downloads artifact; publishes to `e2e-screenshots:baselines/`.

Cleanup: `.github/workflows/client-e2e-cleanup.yml` removes `pr-<n>/` when the PR closes (cleanup script also from **base** SHA only).
