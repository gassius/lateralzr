# Screenshot baselines (Playwright compare set)

In-repo folder used by Playwright for **report-only** pixel compares (1% threshold).

## Source of truth

| Source | When used |
| --- | --- |
| Orphan `e2e-screenshots:baselines/` | CI syncs these into this folder when the orphan folder has PNGs (Critiquito-approved). |
| In-repo [DEMO-SEEDS.md](./DEMO-SEEDS.md) | Fallback only while the orphan `baselines/` folder is empty. |

Design review still reads captures on `e2e-screenshots:pr-<n>/` and approved refs on `e2e-screenshots:baselines/` (sticky comment links the tree + diff table; no embeds).

## Approval / publish

1. Critiquito reviews `e2e-screenshots:pr-<n>/` against `e2e-screenshots:baselines/`.
2. After merge to `main`, the **Client E2E baselines** job overwrites `e2e-screenshots:baselines/` from the artifact.
3. Subsequent PRs sync that orphan folder into this path before comparing.
4. When a PR closes, `pr-<n>/` is removed from the orphan branch (cleanup workflow; script from **base** SHA only).
