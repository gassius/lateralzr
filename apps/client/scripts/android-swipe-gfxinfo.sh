#!/usr/bin/env bash
# Hermes (Ubuntu) — gfxinfo A/B on RELEASE APKs for Android card-swipe jank.
#
# Build-type facts (Hermes-confirmed — do not treat Expo Go as a signal):
#   - APK via ./gradlew assembleRelease with Metro --dev false → __DEV__ false
#   - Hermes on + bytecode in APK
#   - R8 minify off (irrelevant to frame perf)
# Prefer Hermes ~/builds/build-apk.sh when present; this script falls back to
# expo prebuild + assembleRelease and applies temporary A/B patches.
#
# Usage (from monorepo root or apps/client), on Hermes with phone via adb:
#   ./apps/client/scripts/android-swipe-gfxinfo.sh baseline
#   ./apps/client/scripts/android-swipe-gfxinfo.sh no-svg
#   ./apps/client/scripts/android-swipe-gfxinfo.sh no-shadow
#   ./apps/client/scripts/android-swipe-gfxinfo.sh all
#
# Env:
#   PKG             Android applicationId (auto-detected after prebuild)
#   OUT_DIR         default /tmp/lateralzr-swipe-gfxinfo
#   SWIPE_COUNT     default 12
#   DEVICE_SERIAL   optional adb -s
#   BUILD_APK_SH    override path to Hermes build-apk.sh (default ~/builds/build-apk.sh)
#   SKIP_BUILD=1    reuse existing release APK
#   SKIP_INSTALL=1  capture only
#
# Requires: adb, JDK, Android SDK, pnpm, unlocked device.
set -euo pipefail

VARIANT="${1:-baseline}"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLIENT="$ROOT/apps/client"
OUT_DIR="${OUT_DIR:-/tmp/lateralzr-swipe-gfxinfo}"
SWIPE_COUNT="${SWIPE_COUNT:-12}"
ADB=(adb)
if [[ -n "${DEVICE_SERIAL:-}" ]]; then
  ADB=(adb -s "$DEVICE_SERIAL")
fi

mkdir -p "$OUT_DIR"
cd "$CLIENT"

log() { printf '[swipe-gfxinfo] %s\n' "$*"; }
die() { printf '[swipe-gfxinfo] ERROR: %s\n' "$*" >&2; exit 1; }

require_device() {
  "${ADB[@]}" wait-for-device
  local state
  state="$("${ADB[@]}" get-state 2>/dev/null || true)"
  [[ "$state" == "device" ]] || die "adb device not ready (state=$state)"
}

detect_pkg() {
  if [[ -n "${PKG:-}" ]]; then
    printf '%s\n' "$PKG"
    return
  fi
  local manifest="$CLIENT/android/app/src/main/AndroidManifest.xml"
  [[ -f "$manifest" ]] || die "no AndroidManifest yet — run a build first or set PKG="
  local pkg
  pkg="$(grep -oE 'package="[^"]+"' "$manifest" | head -1 | sed 's/package="//;s/"$//')"
  if [[ -z "$pkg" ]]; then
    # AGP 8+ often omits package= on manifest; read namespace / applicationId
    local gradle="$CLIENT/android/app/build.gradle"
    [[ -f "$gradle" ]] || gradle="$CLIENT/android/app/build.gradle.kts"
    pkg="$(grep -oE 'applicationId\s*[\"'\''][^\"'\'']+[\"'\'']' "$gradle" | head -1 | sed -E 's/.*[\"'\'']([^\"'\'']+)[\"'\''].*/\1/')"
  fi
  [[ -n "$pkg" ]] || die "could not detect applicationId; export PKG=com.example..."
  printf '%s\n' "$pkg"
}

apk_path() {
  local release="$CLIENT/android/app/build/outputs/apk/release/app-release.apk"
  local unsigned="$CLIENT/android/app/build/outputs/apk/release/app-release-unsigned.apk"
  if [[ -f "$release" ]]; then
    printf '%s\n' "$release"
  elif [[ -f "$unsigned" ]]; then
    printf '%s\n' "$unsigned"
  else
    die "release APK missing under android/app/build/outputs/apk/release/"
  fi
}

# --- reversible A/B patches (same animation; strip cost) ---------------------
PATCH_TAG="# ANDROID_SWIPE_GFXINFO_PATCH"

apply_no_svg() {
  local f="$CLIENT/components/brand/PatternLayer.tsx"
  grep -q "$PATCH_TAG" "$f" && return 0
  python3 - "$f" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
src = path.read_text()
needle = "  if (!ready || built == null) {\n    return null;\n  }"
insert = """  if (!ready || built == null) {\n    return null;\n  }\n  // ANDROID_SWIPE_GFXINFO_PATCH no-svg: skip SvgXml to isolate pattern cost\n  if (process.env.EXPO_PUBLIC_SWIPE_PERF_AB === 'no-svg' || true) {\n    return null;\n  }"""
if needle not in src:
    raise SystemExit('PatternLayer patch point not found')
path.write_text(src.replace(needle, insert, 1))
PY
}

apply_no_shadow() {
  local f="$CLIENT/components/ConceptCardStack.tsx"
  grep -q "$PATCH_TAG" "$f" && return 0
  python3 - "$f" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
src = path.read_text()
old = "...cardSwipeLiftShadowStyle(shadowLift),"
new = "...cardSwipeLiftShadowStyle(0), // ANDROID_SWIPE_GFXINFO_PATCH no-shadow"
if old not in src:
    raise SystemExit('shadowLift patch point not found — is this the reverted (pre-#160-flat) tree?')
path.write_text(src.replace(old, new, 1))
PY
}

revert_patches() {
  cd "$CLIENT"
  git checkout -- components/brand/PatternLayer.tsx components/ConceptCardStack.tsx 2>/dev/null || true
}

build_release() {
  local label="$1"
  local hermes_build="${BUILD_APK_SH:-$HOME/builds/build-apk.sh}"
  log "assembleRelease ($label) — Hermes-confirmed: __DEV__ false, Hermes bytecode, not Expo Go"
  {
    echo "variant=$label"
    echo "hermes_build_apk_sh=$hermes_build"
    echo "hermes_build_apk_sh_exists=$([[ -x $hermes_build ]] && echo yes || echo no)"
    echo "confirmed=__DEV__ false; Hermes bytecode; R8 minify off; jank observed on this release path"
    echo "app_json_jsEngine=$(node -e "const c=require('@expo/config').getConfig('.',{skipSDKVersionCheck:true});console.log(c.exp.jsEngine||'unset-default-hermes')")"
    echo "app_json_newArch=$(node -e "const c=require('@expo/config').getConfig('.',{skipSDKVersionCheck:true});console.log(c.exp.newArchEnabled ?? 'unset-RN0.86-always-on')" )"
    date -u +%Y-%m-%dT%H:%M:%SZ
  } >"$OUT_DIR/${label}.build-meta.txt"

  if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
    if [[ -x "$hermes_build" ]]; then
      log "using Hermes $hermes_build"
      # Expect script to leave a release APK under apps/client/android/.../release/
      (cd "$ROOT" && "$hermes_build")
    else
      log "Hermes build-apk.sh missing — fallback expo prebuild + gradlew assembleRelease"
      pnpm exec expo prebuild --platform android --no-install
      (cd android && ./gradlew :app:assembleRelease --quiet)
    fi
  fi
  local apk
  apk="$(apk_path)"
  cp -f "$apk" "$OUT_DIR/${label}.apk"
  log "APK → $OUT_DIR/${label}.apk"
}

install_apk() {
  local label="$1"
  local apk="$OUT_DIR/${label}.apk"
  [[ -f "$apk" ]] || apk="$(apk_path)"
  if [[ "${SKIP_INSTALL:-0}" == "1" ]]; then
    log "SKIP_INSTALL=1"
    return
  fi
  require_device
  log "adb install -r $apk"
  "${ADB[@]}" install -r "$apk"
}

launch_app() {
  local pkg="$1"
  "${ADB[@]}" shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
  sleep 3
}

swipe_bout() {
  local pkg="$1"
  local label="$2"
  require_device
  local size w h x1 x2 y
  size="$("${ADB[@]}" shell wm size | tr -d '\r' | awk -F': ' 'END{print $2}')"
  w="${size%x*}"
  h="${size#*x}"
  x1="$(python3 -c "print(int($w*0.75))")"
  x2="$(python3 -c "print(int($w*0.20))")"
  y="$(python3 -c "print(int($h*0.45))")"

  log "gfxinfo reset + $SWIPE_COUNT left swipes (${x1},${y})→(${x2},${y}) on ${w}x${h}"
  "${ADB[@]}" shell dumpsys gfxinfo "$pkg" reset >/dev/null
  sleep 0.5
  local i
  for i in $(seq 1 "$SWIPE_COUNT"); do
    "${ADB[@]}" shell input swipe "$x1" "$y" "$x2" "$y" 280
    sleep 0.5
  done
  sleep 1
  "${ADB[@]}" shell dumpsys gfxinfo "$pkg" framestats >"$OUT_DIR/${label}.gfxinfo.txt"
  "${ADB[@]}" shell dumpsys gfxinfo "$pkg" >"$OUT_DIR/${label}.gfxinfo-full.txt"
  python3 - "$OUT_DIR/${label}.gfxinfo-full.txt" "$OUT_DIR/${label}.summary.txt" <<'PY'
import re, sys
text = open(sys.argv[1], encoding='utf-8', errors='ignore').read()
out = open(sys.argv[2], 'w', encoding='utf-8')
def grab(pat, default='?'):
    m = re.search(pat, text)
    return m.group(1).strip() if m else default
janky = grab(r'Janky frames:\s*([^\n]+)')
p50 = grab(r'50th percentile:\s*([^\n]+)')
p90 = grab(r'90th percentile:\s*([^\n]+)')
p95 = grab(r'95th percentile:\s*([^\n]+)')
p99 = grab(r'99th percentile:\s*([^\n]+)')
total = grab(r'Total frames rendered:\s*([^\n]+)')
print(f'Total frames: {total}', file=out)
print(f'Janky frames: {janky}', file=out)
print(f'p50: {p50}', file=out)
print(f'p90: {p90}', file=out)
print(f'p95: {p95}', file=out)
print(f'p99: {p99}', file=out)
print(f'Total frames: {total}')
print(f'Janky frames: {janky}')
print(f'p90: {p90}  p99: {p99}')
PY
  log "summary → $OUT_DIR/${label}.summary.txt"
}

run_variant() {
  local label="$1"
  log "=== VARIANT $label ==="
  revert_patches
  case "$label" in
    baseline) ;;
    no-svg) apply_no_svg ;;
    no-shadow) apply_no_shadow ;;
    *) die "unknown variant $label (baseline|no-svg|no-shadow|all)" ;;
  esac
  build_release "$label"
  local pkg
  pkg="$(detect_pkg)"
  echo "pkg=$pkg" >>"$OUT_DIR/${label}.build-meta.txt"
  install_apk "$label"
  launch_app "$pkg"
  log "Manual settle: wait until first card is visible, then press Enter"
  if [[ -t 0 ]]; then
    read -r _
  else
    log "non-interactive: sleeping 8s"
    sleep 8
  fi
  swipe_bout "$pkg" "$label"
  revert_patches
}

case "$VARIANT" in
  all)
    for v in baseline no-svg no-shadow; do
      run_variant "$v"
    done
    log "Compare $OUT_DIR/*.summary.txt — if no-svg wins, PatternLayer SvgXml is primary; if no-shadow wins, elevation lift is primary."
    ;;
  baseline|no-svg|no-shadow)
    run_variant "$VARIANT"
    ;;
  *)
    die "usage: $0 baseline|no-svg|no-shadow|all"
    ;;
esac

log "done. Artifacts in $OUT_DIR"
