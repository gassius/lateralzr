# Client E2E (Playwright)

Deterministic screenshots of the Expo **web** export (`pnpm build` → `dist/`), served as an SPA. API responses and media come from fixtures under `e2e/fixtures/` — no live backend.

## Local run

```bash
cd apps/client
pnpm install
pnpm exec playwright install chromium   # once per machine
EXPO_PUBLIC_API_URL=http://127.0.0.1:4173 pnpm build
pnpm e2e
```

Outputs:

- `e2e/screenshots/<viewport>/*.png` — full-page captures (390×844, 320×568, 1280×800)
- `e2e/playwright-report/` — HTML report

Determinism helpers (always on): mocked API, fixed clock, `reducedMotion: reduce`, motion-killing CSS, cleared storage, `deviceScaleFactor: 2`, UTC / en-US.

Two consecutive runs should be pixel-identical for the same `dist/` build.

## Add a screen

1. Prefer a deep link from [TEST-URL-PARAMS.md](../TEST-URL-PARAMS.md).
2. Add or extend a fixture in `e2e/fixtures/relationships/` (and images under `e2e/fixtures/images/` if needed).
3. Wire the fixture in `e2e/helpers/mockApi.ts` if the request body needs a new selector.
4. Create `e2e/specs/<screen>.spec.ts` (one concern per file). Use `openApp(page, query)` then `capture(page, testInfo, 'kebab-name')`.
5. If the UI is not on `main` yet, keep `test.skip(true, 'reason')` so the epic PR can flip it on.

Smoke (card render / flip / swipe / no console errors) lives in `specs/smoke.spec.ts` (390×844 only).

## Baselines / Critiquito

See [baselines/README.md](./baselines/README.md). Diffs are report-only until Critiquito approves and baselines are committed.

## CI

`.github/workflows/client-e2e.yml` builds the export, runs this suite, uploads the artifact, and posts/updates one sticky PR comment (primary 390×844 embeds via the `e2e-screenshots` orphan branch; fork PRs get the artifact link only).
