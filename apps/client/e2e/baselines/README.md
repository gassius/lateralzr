# Screenshot baselines

Committed PNG baselines (per viewport folder: `390x844`, `320x568`, `1280x800`) are compared with a small threshold (`maxDiffPixelRatio` 0.01).

## Approval process

1. Critiquito reviews the plain screenshots on the PR (sticky comment + artifact).
2. After **Pass** for a screen, copy that PNG from `e2e/screenshots/<viewport>/` into this tree and commit it on a labelled / explicit follow-up.
3. Until a baseline exists for a screen, only the plain capture runs (no compare).
4. Diffs are **report-only** by default (CI stays green; notes land in `e2e/screenshots/diffs/` and the PR comment).
5. Set `E2E_STRICT_BASELINES=1` (or Client E2E workflow_dispatch → `strict_baselines=true`) to fail CI on diffs after Critiquito has approved the set.

Do not regenerate baselines casually — only via an explicit labelled run or `workflow_dispatch` once the art-direction guide is applied.
