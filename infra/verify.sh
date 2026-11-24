#!/usr/bin/env bash
# Full local gate matching required CI quality checks (lint / typecheck / unit tests).
# Agents MUST keep this green before every commit/push (see AGENTS.md and
# .cursor/rules/verify-before-push.mdc). Lefthook pre-push runs `pnpm verify`.
#
# For UI / capture-tooling changes, also run web preview capture locally before push:
#   pnpm web-preview:capture
set -euo pipefail
cd "$(dirname "$0")/.."

sail_ready() {
  [[ -x ./sail ]] || return 1
  command -v docker >/dev/null 2>&1 || return 1
  docker info >/dev/null 2>&1 || return 1
  # Require at least one running Sail container for this compose project.
  local ids
  ids="$(./sail ps -q 2>/dev/null || true)"
  [[ -n "${ids}" ]]
}

run_api_pint() {
  if sail_ready; then
    ./sail pint --test
    return
  fi
  if [[ -x ./vendor/bin/pint ]]; then
    echo "note: Sail/Docker unavailable — using ./vendor/bin/pint --test"
    ./vendor/bin/pint --test
    return
  fi
  echo "skip: API Pint (neither Sail nor ./vendor/bin/pint available)" >&2
}

run_api_tests() {
  if sail_ready; then
    ./sail test
    return
  fi
  if command -v php >/dev/null 2>&1 && [[ -f artisan ]]; then
    echo "note: Sail/Docker unavailable — using php artisan test"
    php artisan test
    return
  fi
  echo "skip: API PHPUnit (neither Sail nor php artisan available)" >&2
}

echo "==> API Pint (--test)"
run_api_pint

echo "==> API PHPUnit"
run_api_tests

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

echo "==> Client E2E passthrough unit tests"
node --test .github/scripts/client-e2e-passthrough.test.mjs

echo ""
echo "verify OK"
