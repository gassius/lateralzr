# Screenshot baselines (Playwright seeds)

In-repo PNGs named `<screen>_<state>_<viewport>_<locale>.png` used by Playwright for **report-only** pixel compares during CI (1% threshold).

## Design review location

Critiquito / design review does **not** use this folder as the source of truth. Reviewers read the orphan branch:

- **PR captures:** `e2e-screenshots:pr-<n>/` (plus `diffs/`)
- **Approved baselines:** `e2e-screenshots:baselines/` (published from `main`)

The sticky PR comment links that tree and includes a diff summary table (no embedded images).

## Approval / publish

1. Critiquito reviews `e2e-screenshots:pr-<n>/` against `e2e-screenshots:baselines/`.
2. After merge to `main`, the **Client E2E baselines** job overwrites `e2e-screenshots:baselines/` from the artifact (write-scoped; no install/build).
3. On PRs, captures are compared at **1%**. Diffs are **report-only** until `E2E_STRICT_BASELINES=1` / workflow_dispatch.
4. When a PR closes, `pr-<n>/` is removed from the orphan branch.

## Demo seeds (this PR only)

See [DEMO-SEEDS.md](./DEMO-SEEDS.md). Full-size (780×1688) intentional seeds exist so Critiquito can see an over-threshold diff and an under-threshold pass. They are **not** approved product baselines.
