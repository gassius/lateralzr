# Screenshot baselines

Baselines are PNG files named `<screen>_<state>_<viewport>_<locale>.png`.

## Approval / publish

1. Critiquito reviews PR screenshots (sticky comment + artifact).
2. After merge to `main`, the **Client E2E baselines** job copies the latest captures into this folder and commits them (write-scoped job; never runs install/build with write tokens).
3. On PRs, captures are compared at `maxDiffPixelRatio` 0.01. Diffs are **report-only** (CI stays green) until `E2E_STRICT_BASELINES=1` / workflow_dispatch.
4. Diff images land in the artifact under `screenshots/diffs/` and are summarized on the sticky PR comment.

## Intentional demo baseline

`card-front_short-label_390x844_en.png` is intentionally a solid placeholder so this PR demonstrates report-only diffs. It will be replaced when main publishes real baselines.
