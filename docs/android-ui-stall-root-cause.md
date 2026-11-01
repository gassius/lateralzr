# Android UI-thread stalls / ANR — root-cause diagnosis

**Ticket:** [1amjtrex67j](https://app.clickup.com/t/1amjtrex67j)  
**Evidence tree:** `main` @ `1807a16` (Release APK, Hermes, Samsung Galaxy A50 / Android 11)  
**Stack:** RN **0.86.3**, Reanimated **4.5.1**, worklets **0.10.1**, react-native-svg **15.15.4**  
**Phase:** diagnosis + A/B switches only — **not** a product fix. Animations unchanged.

Project-store copy (same diagnosis): `/cursor/stores/bc-67a50fc6-bb2a-58d9-83f1-a488e9c558ca/docs/android-ui-stall-root-cause.md`

---

## Verdict

Hermes’s ANR stack matches a **known Reanimated 4.5.x / RN 0.86 bug**: reflective `MountingManager.updatePropsSynchronously` throws on stale (unmounted) tags; the `catch` logs the **full throwable on the UI thread**. That path is entered from **react-native-svg** during draw (`VirtualView.setClientRect` → Fabric event → Reanimated `synchronouslyUpdateUIProps`). Our card patterns amplify it: large `SvgXml` trees with hundreds of `<use>` nodes, mounted on up to three non-virtualized `ConceptCard` trees.

Audio-off and Expo Go are correctly non-signals (Hermes).

---

## 1. Reanimated 4.5.x × RN 0.86 `updatePropsSynchronously`

**Yes — known failure, fixed upstream.**

| Item | Detail |
| --- | --- |
| Bug | On RN ≥ 0.86, Reanimated reflects into `MountingManager.updatePropsSynchronously` (avoids seeding RN’s sync mount-props cache). That path **does not** check `getViewExists`. Stale tags throw `RetryableMountingLayerException` → `InvocationTargetException`. |
| Stall mechanism | `NativeProxy.synchronouslyUpdateUIProps` catches and `Log.w(..., e)` with the **full stack** on the UI thread (our tree: `NativeProxy.kt:258`). Repeated during SVG `onDraw` → jank / ANR. |
| Issues | [\#10280](https://github.com/software-mansion/react-native-reanimated/issues/10280), [\#10434](https://github.com/software-mansion/react-native-reanimated/issues/10434) — same SVG draw → sync-props → `Log.w` chain as Hermes. |
| Fix | [PR \#10435](https://github.com/software-mansion/react-native-reanimated/pull/10435): `getViewExists` guard + concise log. |
| Fixed version | **Reanimated 4.7.1** changelog: “Skip synchronous Android prop updates for unmounted views … (\#10435)”. |
| Our pin | `apps/client/package.json`: `react-native-reanimated` `~4.5.1` — **unpatched**. Local `NativeProxy.kt` matches issue (lines 249–258). |
| Upgrade note | 4.7.x pairs with Worklets **0.13.x** and drops older RN — not a cheap drop-in. Diagnostic A/B uses a **4.5.1 surgical patch** (`DIAG_APPLY_REANIMATED_SYNC_PROPS_PATCH`) instead of a full upgrade. |

Exact exception text still to capture on device (`Reanimated:W`); expected cause: `Unable to find SurfaceMountingManager for tag: […]`.

---

## 2. Which of our components put SVGs (`SvgXml` / `<use>`) in trees that hit Fabric layout + Reanimated

| Site | Role | File:line |
| --- | --- | --- |
| **Card front pattern (primary)** | `SvgXml` of pattern master (135–180 `<use>` per variant) under every mounted front face | `apps/client/components/brand/PatternLayer.tsx` (~173–178 `SvgXml`); built via `buildPatternSvgXml` |
| Pattern `<use>` assets | Motif instances → RNSVG `UseView` (Hermes stack: `UseView.draw`) | `apps/client/assets/images/pattern/lateralzr-pattern-0{1,2,3}-*.svg` (descending **180** `<use>`, ascending **150**, edge **135**) |
| Connector glow overlay | Second `SvgXml` while pulse armed | `PatternLayer.tsx` (`ConnectorGlowOverlay`) |
| Mount under stack | Behind / front / return overlay each mount `ConceptCard` → front `PatternLayer` | `ConceptCard.tsx` (~543–553); `ConceptCardStack.tsx` (~1451–1551) |
| Other `SvgXml` (secondary) | Logo, loading silhouette, emboss — not the ANR `UseView` pattern path | `LateralzrLogo.tsx`, `LoadingCard.tsx`, `NoMediaEmboss.tsx`, `AppMenuSheet.tsx` |

**Trigger chain (Hermes + upstream issues):**  
`SvgView.onDraw` → `GroupView` / `UseView.draw` → `VirtualView.setClientRect` → Fabric layout event → Reanimated `NodesManager.onEventDispatch` → `synchronouslyUpdateUIProps` → reflective update → throw → **UI-thread `Log.w`**.

---

## 3. Why ~1230 attached Android views

Not a virtualized deck: the stack always mounts **up to three full `ConceptCard` trees** (behind underlay, front, return overlay) — see `ConceptCardStack.tsx` (~1405–1420, ~1441–1553). Comment: “One underlay always mounts (never blank shell).”

Each `ConceptCard` always mounts **front and back** face trees (`ConceptCard.tsx` ~1198–1229). Front faces each mount `PatternLayer` → one large `SvgXml`. Pattern SVGs are almost entirely `<use href="#motif-…">` instances (135–180 per card). react-native-svg creates native views per virtual node (`UseView`, groups, etc.).

**Rough lower bound:** 3 fronts × ~150 `UseView` ≈ **450** SVG use-nodes alone, plus groups/defs, dual faces (ScrollViews, text, media, chrome), tints, HomeScreen chrome → **~1230 attached views** and ~364 MB native heap are consistent. There is **no** FlatList/windowing of cards or SVG motifs.

---

## 4. Diagnostic A/B (this branch)

| Variant | How | Default |
| --- | --- | --- |
| Baseline | Branch tip, no diag env | production behaviour |
| SVG stub | `EXPO_PUBLIC_DIAG_STUB_CARD_SVG=1` — same-size `View` placeholders instead of card `SvgXml` | off |
| Reanimated patch | `DIAG_APPLY_REANIMATED_SYNC_PROPS_PATCH=1` → `postinstall` / `scripts/diag-maybe-apply-reanimated-patch.cjs` applies \#10435-style guard on 4.5.1 | off |

Does **not** change animations. Do **not** merge as a product fix.

### Hermes: `~/builds/build-apk.sh`

That script force-checkouts the ref and wipes uncommitted patches. Use this **committed branch** plus **env vars** (they survive checkout). After install, ensure the Reanimated opt-in script runs when that env is set (`pnpm install` postinstall, or explicit `node apps/client/scripts/diag-maybe-apply-reanimated-patch.cjs` before Gradle if install was cached without the env).

```bash
# A — baseline (production behaviour)
~/builds/build-apk.sh cursor/lz-android-svg-stall-ab-6738

# B — SVG stub (card PatternLayer SvgXml → same-size Views)
EXPO_PUBLIC_DIAG_STUB_CARD_SVG=1 \
  ~/builds/build-apk.sh cursor/lz-android-svg-stall-ab-6738

# C — Reanimated 4.5.1 sync-props guard (#10435-style); keep animations
DIAG_APPLY_REANIMATED_SYNC_PROPS_PATCH=1 \
  ~/builds/build-apk.sh cursor/lz-android-svg-stall-ab-6738

# Optional: B+C together
EXPO_PUBLIC_DIAG_STUB_CARD_SVG=1 \
DIAG_APPLY_REANIMATED_SYNC_PROPS_PATCH=1 \
  ~/builds/build-apk.sh cursor/lz-android-svg-stall-ab-6738
```

If `build-apk.sh` does not re-run `pnpm install` when `node_modules` exists, for variant C run after checkout / before Gradle:

```bash
export DIAG_APPLY_REANIMATED_SYNC_PROPS_PATCH=1
node apps/client/scripts/diag-maybe-apply-reanimated-patch.cjs
```

Measure: same device/deck, fixed 10-swipe / 5-flip, `gfxinfo` reset after first screen; capture `Reanimated:W` on baseline.
