# DEMO baseline seeds (fallback only)

These in-repo PNGs are **intentional demo baselines** used only when orphan
`e2e-screenshots:baselines/` is missing or empty (see CI “Sync orphan … baselines”
step). They are **not** Critiquito-approved product baselines.

| File | Intent |
| --- | --- |
| `card-front_short-label_390x844_en.png` | Full-size (780×1688) with a red block (~1.71% > 1% threshold) → over-threshold + diff image |
| `laterality-bar_grade-3_390x844_en.png` | Full-size with a tiny green block (~0.07% < 1%) → pass |

## Real compare flow

1. **CI (read-only test job)** clones orphan `e2e-screenshots` and, if `baselines/` has PNGs, copies them into this folder (replacing demo seeds for that run).
2. Playwright `capture()` compares against whatever is in `e2e/baselines/` (report-only at 1%).
3. After merge to `main`, the write-scoped baselines job publishes real captures to `e2e-screenshots:baselines/`. Once that folder is non-empty, demo seeds are no longer used for CI compares and should be deleted from the repo.
