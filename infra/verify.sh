#!/usr/bin/env bash
# Full local gate matching required CI quality checks (lint / typecheck / unit tests).
# Agents MUST keep this green before every commit/push (see AGENTS.md and
# .cursor/rules/verify-before-push.mdc). Lefthook pre-push runs `pnpm verify`.
#
# For UI / capture-tooling changes, also run web preview capture locally before push:
#   pnpm web-preview:capture
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> API Pint (--test)"
./sail pint --test

echo "==> API PHPUnit"
./sail test

echo "==> Client typecheck"
pnpm --filter client exec tsc --noEmit

echo "==> Client unit tests"
pnpm --filter client test

echo "==> Audio size budget"
node .github/scripts/audio-budget.mjs

echo "==> Baked pattern assets"
node .github/scripts/assert-pattern-baked.mjs

echo "==> Prod storage binds"
bash tests/scripts/assert-prod-storage-binds.sh
bash tests/scripts/assert-compose-storage-bind.sh

echo "==> Web-preview route map + paint unit tests"
node --test scripts/web-preview-capture/map-changed-screens.test.mjs
node --test scripts/web-preview-capture/capture-screens.paint.test.mjs

echo ""
echo "verify OK"
