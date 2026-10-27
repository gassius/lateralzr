# Android swipe perf — root cause (post-#160)

**Repo:** [gassius/lateralzr](https://github.com/gassius/lateralzr)  
**Tree under diagnosis:** `cursor/revert-160-swipe` (pre-#160 motion restored; AGENTS.md native-first rule kept)  
**Question:** Expo limitation vs our code?  
**Verdict:** **Our code** (Android render/compositor + mid-drag React cost). Not an Expo platform bug. Not a debug-build artefact.

---

## 0. Build-type facts (Hermes-confirmed — locked)

| Claim | Status | Evidence |
| --- | --- | --- |
| Release APK path | **Confirmed** | Hermes: `./gradlew assembleRelease`, Metro/`devEnabled=false` / `--dev false` |
| `__DEV__` | **false** | Release JS bundle |
| Hermes | **On + bytecode in APK** | Hermes machine build |
| R8 minify | Off | Irrelevant to frame time |
| Dev-build / debug APK as jank cause | **Ruled out** | Jank is real on the release path above |
| Expo Go as perf signal | **Ignore** | Expo Go is always dev-mode JS — do not use it for swipe FPS conclusions |

Agent VM here has **no phone / no Hermes adb**. Measurement script for Hermes: [`apps/client/scripts/android-swipe-gfxinfo.sh`](https://github.com/gassius/lateralzr/blob/cursor/revert-160-swipe/apps/client/scripts/android-swipe-gfxinfo.sh) (uses `~/builds/build-apk.sh` when present).

Prior speculative note that the APK “might be debug” is **withdrawn**.

---

## 1. What #160 proved (negative experiment)

#160 froze elevation, removed 3D tilt (translate-only), and dropped React `frontWrapMoving` elevation:40. Carlos: **still sluggish**, motion flat/lame.

| #160 change | Still janky after? | Implication |
| --- | --- | --- |
| Freeze `elevation` / lift shadow during drag | Yes | Elevation interpolation is **not sufficient** as sole root cause (may still amplify) |
| Lite transforms (no perspective/rotate) | Yes | 3D tilt is **not sufficient** as sole root cause; **must keep** in the real fix (original design) |
| Remove `frontWrapMoving` style swap | Yes | Pan-start React elevation hitch alone did not explain the jank |
| Unchanged: `PatternLayer` `SvgXml`, up to 3 `ConceptCard` trees, `setDeckMoving` → HomeScreen `elevation: 40`, mid-drag behind-index `runOnJS`/`setState` | Still present | **Primary suspects** for the remaining jank |

So: do **not** ship another “flatten the animation” fix. Keep original tilt/lift design; attack layer cost + React remounts.

---

## 2. Ranked root causes (code evidence on reverted tree)

### Rank 1 — Large `SvgXml` PatternLayers under transforming parents (our code)

Up to **three** full `ConceptCard` trees mount during drag (behind / front / return overlay). Each front face paints `PatternLayer` → `SvgXml` of a **32–37 KB** vector:

| Asset | Bytes |
| --- | --- |
| `lateralzr-pattern-network-ascending-v3.4.svg` | 33482 |
| `lateralzr-pattern-network-descending-v3.4-study.svg` | 37160 |
| `lateralzr-pattern-network-edge-v3.4.svg` | 32069 |
| `pattern-master-v3.4.png` (unused on native path today) | 976733 |

Evidence: `PatternLayer.tsx` (~173–178) `<SvgXml xml={built.xml} … />`; stack mounts `ConceptCardForIndex` ×3 (`ConceptCardStack.tsx` ~1448–1557). Neither `ConceptCard` nor `ConceptCardForIndex` is `React.memo`.

**Dual-face cost (Hermes static audit, unmeasured):** current + next cards mount together (`ConceptCardStack.tsx` ~1448–1534). Each `ConceptCard` always mounts **front and back** faces (`ConceptCard.tsx` ~1198–1229) — so “2 cards” ≈ **4 face trees** (+ patterns/media), not 2.

**Why Android, not web:** RN-SVG + Fabric re-raster under transform/elevation vs CSS/Skia web path. Same phone’s web export being smooth fits this, not “Expo can’t animate.”

**#160 left this untouched** → strongest explanation for residual jank.

### Rank 1b — Whole-deck media prefetch storms (our code, unmeasured)

`useConceptMediaPreload.ts` ~89–110: after debounce, `Promise.all(urls.map(prefetchOne))` over **every** deck media URL on each `concepts` / `requestWidth` change. URL list is deduped within a batch (`uniqueMediaUrls`), but there is **no concurrency cap**, and as the session deck grows the batch grows. Contends with swipe frames for JS + network + image decode — isolate with Perfetto / by temporarily no-oping the batch effect.

### Rank 2 — Mid-drag / pan-start JS-thread React work (our code)

Drag **pose** is UI-thread (Reanimated shared values + `useAnimatedStyle`). But React still wakes:

| Trigger | When | Effect |
| --- | --- | --- |
| `runOnJS(markDeckMoving)(true)` | pan `onStart` | `setPulseDragging` + parent `setDeckMoving` → **ConceptCardStack + HomeScreen** re-render |
| HomeScreen `deckMoving` | same | `deckStackLayerMoving` / `deckMovingGroup` **`elevation: 40`** (`app/index.tsx` ~1648–1669); pointerEvents flips across chrome |
| `runOnJS(lockBehindIndexForRightCommit)` / `unlockBehindIndex` | panX `onUpdate` (edge crossings) | `setBehindLockedIndex` → underlay index swap / remount **while finger moves** |

Static counts on reverted tree:

- `runOnJS(` in `ConceptCardStack.tsx`: **32** total
- panX `onUpdate` bridges: **`lockBehindIndexForRightCommit`**, **`unlockBehindIndex`** (not per-frame translate — event-driven, but remount cost is large)
- panY `onUpdate`: **0** `runOnJS`
- `deckMoving` references in `app/index.tsx`: **14**

**Render storm estimate (not instrumented on device yet):** ≥1 full HomeScreen + stack commit on every pan start/end; +1–N commits on right↔left lock flips. Card subtree is heavy (pattern SVG + media + flip tree) → each commit is expensive even if rare vs 60 fps.

### Rank 3 — Per-frame elevation + shadow + 3D on the moving wrap (our code, amplifier)

Restored (pre-#160) `frontAnimatedStyle` still does, every frame:

- `cardSwipeLiftShadowStyle(shadowLift)` → mutates **`elevation`** (`cardSwipe.ts` ~447–459)
- `cardSwipeFrontTransform` → **perspective + rotate\*** when `!reduceMotion` (`shouldUseCardSwipe3d` → `!reduceMotion`)
- Android opaque fill while lifted (`cardSwipeAndroidLiftFill`)
- React `frontWrapMoving` `{ elevation: 40 }` when `pulseDragging` (`ConceptCardStack.tsx` ~1479, 1672–1675)

#160 removed these and jank remained → treat as **amplifiers**, not the only lever. Real fix should **keep visual design** (tilt + perceived lift) without per-frame Android `elevation` thrash (e.g. static elevation + transform/opacity lift, or pre-baked shadow).

### Rank 3b — Audio / expo-audio main-queue contention (our code, unmeasured)

Swipe commit/cancel/resistance call `soundEvent` → `soundEngine` play path (`soundEngine.ts` ~632–690). On Android, expo-audio player ops go through **`runBlocking` on the main queue** (`AudioModule.kt` ~459–480, 939–940). That can hitch UI frames when SFX fire at swipe end — **not** per-drag-frame, but can show up in gfxinfo bout averages. Isolate with the **`sound-off`** gfxinfo A/B variant (patches `lib/sound.ts` `soundEvent` to early-return).

### Rank 4 — `borderRadius` + `overflow: 'hidden'` on large faces; no `renderToHardwareTextureAndroid` (our code)

- Card faces: `overflow: 'hidden'` + `borderRadius` (`ConceptCard.tsx` face/media styles ~1254–1323)
- Front wrap: `borderRadius` + `overflow: 'visible'` (`ConceptCardStack.tsx` ~1661–1675)
- **`renderToHardwareTextureAndroid`:** **absent** anywhere under `apps/client` (grep = 0)
- Logo already uses `needsOffscreenAlphaCompositing` on Android (`LateralzrLogo.tsx`) — pattern/card path does not

Clipping + radius on a transforming SVG-heavy subtree forces offscreen buffers; missing hardware-texture hint makes Android redo that work cheaply less often.

### Rank 5 — Expo / New Architecture / Reanimated environment (context, not root cause)

| Item | Evidence |
| --- | --- |
| Expo SDK 57 / RN 0.86.3 | `package.json` |
| Reanimated **4.5.1** + `react-native-worklets` **0.10.1** | resolved deps |
| Babel worklets plugin | `babel-preset-expo` auto-adds `react-native-worklets/plugin` when package present (`babel-preset-expo/build/configs/expo.js` ~96–100). No local `babel.config.js` — Expo default. |
| New Architecture | RN 0.86: cannot disable (`ReactRootProjectPlugin` warns `newArchEnabled=false` unsupported). `app.json` has no override. |
| Hermes | Default; Hermes release build confirmed bytecode |
| `expo-build-properties` | Only `usesCleartextTraffic: true` — no hermes/minify/arch knobs |

This stack is **working as designed**. Web smooth on the same device argues against “Expo can’t do 60 fps swipes.” Cost is **what we put under the animated node**.

---

## 3. Ruled out / not swipe jank

1. **Debug / `__DEV__` / missing Hermes bytecode** — Hermes-confirmed release.  
2. **Expo Go jank as evidence** — always dev-mode; ignore.  
3. **“Migrate to Reanimated”** — already Reanimated 4 + RNGH v2 worklets for drag pose.  
4. **Per-frame `setState` of translate** — false; shared values.  
5. **Per-frame audio** — SFX only on commit/cancel/resistance (still may hitch at those moments — see Rank 3b / `sound-off`).  
6. **Expo limitation as primary** — no; our layer tree + React chrome.  
7. **Launch / first-paint delay** — **intentional ~3s brand intro** (`app/index.tsx` ~421–428, `remainingIntroMs` after fonts). **Not** swipe jank. Wait for intro to finish before gfxinfo bouts.

---

## 4. gfxinfo A/B plan (Hermes, release only)

Script: `apps/client/scripts/android-swipe-gfxinfo.sh` on branch `cursor/revert-160-swipe` (dirty-tree refuse before EXIT trap; PATCHED=1-gated revert; INT/TERM → exit 130/143; AGP `|| true`; `//` patch tag).

```bash
# On Hermes, phone via adb, checkout cursor/revert-160-swipe:
./apps/client/scripts/android-swipe-gfxinfo.sh all
# → /tmp/lateralzr-swipe-gfxinfo/{baseline,no-svg,no-shadow,sound-off}.{apk,summary,gfxinfo*}.txt
```

| Variant | Patch | If janky % / p90 drops vs baseline → |
| --- | --- | --- |
| `baseline` | none (original motion) | reference |
| `no-svg` | `PatternLayer` returns null | **Rank 1 confirmed** |
| `no-shadow` | `cardSwipeLiftShadowStyle(0)` only | Rank 3 elevation amplifier |
| `sound-off` | `sound.ts` `soundEvent` early-return | Rank 3b expo-audio / `runBlocking` |

Capture: `adb shell dumpsys gfxinfo <pkg> framestats` after 12× `adb input swipe`. Record **Janky frames %**, **p90**, **p99**. Start bout **after** the 3s intro gate.

Optional follow-ups (same script pattern): no-`setDeckMoving`, no mid-drag behind lock, no whole-deck `Promise.all` prefetch, `renderToHardwareTextureAndroid` on front wrap.

**Pass bar for a later fix PR:** release APK janky-frame % down ≥50% vs baseline **or** sustained UI ≥50 fps, **with original tilt/lift design preserved**.

### 4.1 Perfetto (no phone on this agent — Hermes/Carlos)

When adb is available, capture a 15s swipe bout alongside gfxinfo:

```bash
PKG=<applicationId>   # from build-meta or AndroidManifest / applicationId
adb shell "perfetto --txt -c - -o /data/misc/perfetto-traces/swipe.perfetto-trace" <<'EOF'
buffers: { size_kb: 65536 }
duration_ms: 15000
data_sources: {
  config {
    name: "linux.ftrace"
    ftrace_config {
      ftrace_events: "sched/sched_switch"
      ftrace_events: "sched/sched_wakeup"
      ftrace_events: "gfx/gpu_mem_total"
    }
  }
}
data_sources: { config { name: "linux.process_stats" } }
EOF
# In another shell, while the trace runs: launch app (past intro) + swipe bout
adb pull /data/misc/perfetto-traces/swipe.perfetto-trace ./swipe.perfetto-trace
```

Open in https://ui.perfetto.dev — look for main-thread blocks during drag aligned with: image decode / Yoga / `react-native-svg`, `runBlocking`/audio, React `commitRoot`. Pair with `sound-off` and `no-svg` APKs.

---

## 5. Fix plan (keep original animation design)

Ordered by expected impact × design fidelity:

1. **Rasterize pattern on native** — `expo-image` / pre-rendered PNG from `pattern-master-v3.4.png` (or per-variant PNG). Prefer one raster path (native-first).  
2. **Stop mid-drag React remounts** — pre-mount previous+next underlays; remove `runOnJS(lockBehindIndex*)` from `onUpdate` (or shared-value visibility only).  
3. **Drive “moving” chrome without HomeScreen `setDeckMoving`** — animated z only; drop React `frontWrapMoving` elevation:40 hitch.  
4. **Cap / stage media prefetch** — concurrency limit; don’t `Promise.all` the whole growing deck on every change.  
5. **Perceived lift without per-frame `elevation` thrash** — rest §23 elevation; lift via transform/opacity or static shadow image.  
6. **Keep 3D tilt** — do not re-lite. Optional `renderToHardwareTextureAndroid` on moving wrap.  
7. **Audio** — if `sound-off` wins, move player ops off the critical path / debounce SFX; do not silence product audio without measurement.  
8. **`React.memo` cards** — secondary after (2)/(3). Optionally defer mounting the hidden face until flip.

Do **not** reintroduce #160’s translate-only product path.

---

## 6. Expo limitation vs our code — one line

**Our code:** too much per-frame compositor work (vector patterns × N cards, elevation/clipping) plus JS-thread React commits during drag, on a correctly configured Expo 57 / RN New Arch / Hermes **release** build. Expo is the host; the cost is ours.

---

## 7. Artefacts

| Item | Path |
| --- | --- |
| This doc | `docs/android-swipe-perf-root-cause.md` |
| Prior Phase-1 notes (pre-#160; partly superseded) | `docs/android-swipe-jank-diagnosis.md` |
| Revert branch | `cursor/revert-160-swipe` |
| Hermes gfxinfo A/B script | `apps/client/scripts/android-swipe-gfxinfo.sh` (`baseline` / `no-svg` / `no-shadow` / `sound-off`) |
