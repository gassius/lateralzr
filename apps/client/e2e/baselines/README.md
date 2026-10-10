# Screenshot baselines

Baselines are PNG files named `<screen>_<state>_<viewport>_<locale>.png`.

## Approval / publish

1. Critiquito reviews PR screenshots (sticky comment + artifact).
2. After merge to `main`, the **Client E2E baselines** job copies the latest captures into this folder and commits them (write-scoped job; never runs install/build with write tokens).
3. On PRs, captures are compared at **1%** (`maxDiffPixelRatio` / pixel ratio `0.01`). Diffs are **report-only** (CI stays green) until `E2E_STRICT_BASELINES=1` / workflow_dispatch.
4. Diff images + `diffs/summary.json` land in the artifact; the sticky PR comment includes a summary table.

## Demo seeds (this PR only)

See [DEMO-SEEDS.md](./DEMO-SEEDS.md). Full-size (780×1688) intentional baselines exist so Critiquito can see:

- one **over-threshold** diff with a `.diff.png`
- one **under-threshold** pass

They are **not** Critiquito-approved product baselines. The main publish job overwrites them with real captures after merge.
