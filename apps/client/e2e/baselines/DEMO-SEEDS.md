# DEMO baseline seeds (not Critiquito-approved)

These files are **intentional demo baselines** for PR #75 so Critiquito can see report-only pixel diffs.
They must **not** be treated as approved product baselines.

| File | Intent |
| --- | --- |
| `card-front_short-label_390x844_en.png` | Full-size (780×1688) with a red block (~1.7% > 1% threshold) → over-threshold + diff image |
| `laterality-bar_grade-3_390x844_en.png` | Full-size with a tiny green block (~0.07% < 1%) → pass |

After merge, the **Client E2E baselines** job on `main` overwrites these with real captures from the artifact.
