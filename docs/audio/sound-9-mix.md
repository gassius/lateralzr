# Sound 9 — mix, levels, device QA

Ticket: [1amjtrew81e](https://app.clickup.com/t/1amjtrew81e) · Epic: [1amjtrew80w](https://app.clickup.com/t/1amjtrew80w)  
Assets: Sound 3 kit (68 files) — swaps only via `apps/client/assets/audio/manifest.json`.

## Findings (starting mix)

- Cancel / resistance stay at relative `gainDb` 0 — already authored ~6 dB / ~9 dB under swipes (Sound 4 unchanged).
- Laterality snaps were soft vs the rest of the FX bed; director ear target **+2 dB** vs swipe.
- Swipe tone layers are hot as files; relative **−10 dB**.
- Reshuffle gather sits under land; relative gather **−2 dB**, land **0**.
- Card-arrive is a soft cue; relative **−2 dB**.
- Textures under beds: relative **−4 dB**. Drop-ins: **−3 dB**. Intro arrival: **+1 dB**. Beds / intro-loop: **0**.
- Retune by ear on web preview + phone speaker / earphones; change **manifest `gainDb` only**, then mirror into `SOUND_ASSETS` (native + web).

## Platform normalisation (M1)

Web Audio and the music engine clamp linear volume to **≤ 1**. A positive `gainDb` (+2 / +1) was therefore clipped on web/music while native could go above unity.

To keep the director’s relative intent and stay consistent across platforms:

- Keep the **relative** ear table (`DIRECTOR_RELATIVE_GAIN_DB` in `lib/soundMap.ts`).
- Apply **`GAIN_DB_PLATFORM_OFFSET = −2`** so the loudest asset (laterality +2) lands at **0 dB**.
- Manifest / `SOUND_ASSETS` store the **applied** values (all **≤ 0**).
- `resolveEventGain` also clamps linear gain to `[0, 1]` as a safety net.

Relative differences are unchanged (laterality still +2 vs swipe; arrival still +1 vs bed).

## Engine rules (director 2026-10-24)

| Rule | Value |
| --- | --- |
| Laterality row stagger | `laterality_step` @ t=0 → `sheet_close` −3 dB @ +80 ms → gather @ +250 ms (sheet_close ends later at ~469 ms) |
| After reshuffle land | no `card_arrived` |
| Max concurrent effects | 2; new voice cuts oldest with 30 ms fade; never cut `laterality_step` / `error_soft` |
| Same-effect retrigger | ignore within 60 ms |
| Music duck while FX | −3 dB via separate `duckEffects` multiplier (50 ms attack / 400 ms release); does not overwrite screen-reader / interruption `duck` |

## Final gain table

### Relative (director intent)

| Asset group | relative gainDb |
| --- | ---: |
| swipe / flip / cancel / resistance / sheet / error / no-match / complexity | 0 |
| laterality-snap-1..5 | +2 |
| swipe-tone-up / down | −10 |
| reshuffle-gather | −2 |
| reshuffle-land-a/b/wide | 0 |
| card-arrive-a/b | −2 |
| bed-calm / bed-bright | 0 |
| texture-* | −4 |
| dropin-01..24 | −3 |
| intro-loop | 0 |
| intro-arrival-a/b | +1 |

### Applied (manifest / play — relative − 2)

| Asset group | applied gainDb |
| --- | ---: |
| laterality-snap-1..5 | 0 |
| intro-arrival-a/b | −1 |
| swipe / flip / cancel / resistance / sheet / error / no-match / complexity / land / beds / intro-loop | −2 |
| card-arrive / reshuffle-gather | −4 |
| dropin-01..24 | −5 |
| texture-* | −6 |
| swipe-tone-up / down | −12 |

## Device QA checklist

- [ ] Web preview + iOS / Android dev build
- [ ] Phone speaker + earphones
- [ ] Seamless bed / texture / intro loops
- [ ] Triggers match Asset List (incl. laterality stagger)
- [ ] Fast-swipe stacking (max 2 FX; 60 ms retrigger)
- [ ] Master / music / effects toggles
- [ ] Silent mode, interruptions, reduced motion, screen reader (FX duck must not restore music over SR)
- [ ] `__DEV__` console: `[sound] <event> active=[…]`

## Source of truth

Manifest: `apps/client/assets/audio/manifest.json`  
Kit index: [README.md](./README.md)  
ClickUp sound design doc: https://app.clickup.com/90122060531/docs/2kxv30qk-1012
