# Lateralzr Expo client — agent context

Lateralzr is a mobile app. It is built with Expo so one simple codebase serves iOS and Android. The web build exists only as a preview that makes building faster; it is not a product target. Design, QA, and E2E target one phone viewport: **390×844**.

This is the **Expo / React Native** mobile client for Lateralzr (`apps/client` in the monorepo). Prefer mobile patterns, performance, and iOS/Android compatibility. The web export is a development/preview aid only — not a product target.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json` (this project targets **SDK 57**).
2. Fetch the matching versioned docs: https://docs.expo.dev/versions/v57.0.0/
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Agent tooling (required for Expo work)

Use Expo's official agent tooling instead of guessing from training data:

| Piece | Purpose | Setup |
| --- | --- | --- |
| **This file (`AGENTS.md`)** | Project instructions Cursor/Codex read automatically | Committed here |
| **Expo Skills** | Known-good Expo/EAS patterns (auto-discovered) | `pnpm dlx skills add expo/skills` once per machine, then reopen Cursor. Or Cursor → Settings → Rules → Add Rule → Remote Rule → `https://github.com/expo/skills.git` |
| **Expo MCP Server** | Live Expo docs, `expo install`, EAS builds/workflows, simulator screenshots | Project `.cursor/mcp.json` registers `https://mcp.expo.dev/mcp` — authenticate via Cursor Settings → Tools & MCP → Connect |
| **Local MCP capabilities** | Screenshots, tap automation, DevTools, router sitemap | Dev dep `expo-mcp`; start with `pnpm start:mcp` (sets `EXPO_UNSTABLE_MCP_SERVER=1`) |

Docs: https://docs.expo.dev/agents.md · https://docs.expo.dev/skills.md · https://docs.expo.dev/mcp.md · https://docs.expo.dev/agents/cursor.md

When an Expo MCP tool or Expo Skill applies, **use it** (docs search/read, `add_library`, builds, automation) before inventing APIs or package versions.

## Commands

This monorepo uses **pnpm**. Run these from `apps/client` (or `pnpm turbo run <script> --filter=client` from the repo root).

```bash
pnpm exec expo install <package>  # ALWAYS use instead of pnpm add — resolves SDK-compatible versions
pnpm start                        # start the dev server
pnpm web                          # Expo web
pnpm start:mcp                    # dev server with Expo MCP local capabilities
pnpm test                         # unit tests (lib/*.test.ts only — not Playwright)
pnpm typecheck                    # tsc --noEmit
pnpm e2e:build                    # expo export web with E2E API base URL
pnpm e2e                          # Playwright screenshots against dist/ (see e2e/README.md)
pnpm exec expo-doctor             # diagnose dependency and config issues
pnpm exec expo install --fix      # fix incompatible package versions
```

Run `pnpm test` and `pnpm typecheck` before declaring any client task done. For UI / layout PRs, also run `pnpm e2e:build && pnpm e2e` (or rely on the **Client E2E** GitHub Actions workflow).

API / Laravel work stays at the **repo root** and must use Sail (`./sail ...`) — see root agent context in `.cursorrules/AGENTS.md`.

Repo-wide **Agent attribution** (commit trailers, PR footers, review headers) is defined in [`.cursorrules/AGENTS.md`](../../.cursorrules/AGENTS.md#agent-attribution) and applies to client work as well.

## Test / UI/UX and Art Supervisor (gasnet-art-director) URL params (Expo web)

Testers can deep-link the web preview with query params. **Do not treat this as product UX.** Full table and copy-paste URLs: [TEST-URL-PARAMS.md](./TEST-URL-PARAMS.md).

| Param | Purpose |
| --- | --- |
| `canonicalConcept=<key>` | Start at a canonical concept; pair with `locale` |
| `localizedConcept=<label>` | Start at that localized card label |
| `onlyWithMedia=true` | Restrict the deck to concepts that have media |
| `locale=en\|es` | Existing locale override |
| `complexity=1-5` | Force complexity for this load/session only (does not persist) |
| `laterality=1-5` | Force laterality for this load/session only (does not persist) |

Example: `https://lateralzr-client.vercel.app/?canonicalConcept=mushroom&onlyWithMedia=true&complexity=5`

## Playwright E2E + UI/UX and Art Supervisor (gasnet-art-director) screenshots

Deterministic captures of the static web export live in [`e2e/`](./e2e/). Full local / CI / “add a screen” notes: [`e2e/README.md`](./e2e/README.md). Baseline approval: [`e2e/baselines/README.md`](./e2e/baselines/README.md).

- Fixtures only (no live API): `e2e/fixtures/relationships/*.json` + `e2e/fixtures/images/*`
- Viewport: **390×844** only (design / QA / E2E target)
- CI: `.github/workflows/client-e2e.yml` → artifact + sticky PR comment
- Pending screens (sheet, menu, pickers, offline, …) are listed in [`e2e/README.md`](./e2e/README.md) — add specs when UI ships, no always-skipped placeholders

## Navigation & Routing

- Use **Expo Router**. Routes live in `app/` (not `src/app/`). Keep non-route code in `components/`, `hooks/`, `lib/`, `constants/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit (`eas build`, `eas submit`) and for OTA updates (`eas update`) when native apps are needed. Prefer `pnpm exec eas-cli@latest` / `npx eas-cli@latest` over a bare `eas` if the CLI is not installed globally.
Docs: https://docs.expo.dev/eas/index.md

When native builds need GTM, map the same **names** from GitHub Environment `prod` into EAS secrets/env (see Analytics / GTM below). Do not paste container IDs into the repo.

## Sound / expo-audio (native development build)

`expo-audio` is a native module. **Expo Go cannot play Lateralzr sounds** — use a development build after installing or upgrading `expo-audio`.

Local (device / simulator):

```bash
cd apps/client
pnpm exec expo run:ios      # or: pnpm exec expo run:android
```

EAS development client:

```bash
cd apps/client
pnpm exec eas-cli@latest build --profile development --platform ios
# or --platform android
```

Public API (Sound 1 / Sound 8): `lib/sound.ts` / `lib/sound.web.ts` export `soundEvent`, `setSoundPreferences`, `isSoundAvailable`, and `notifySoundFirstCardReady`. Screens announce typed events only; never `require` audio files at call sites. From Reanimated worklets: `runOnJS(soundEvent)(event)`. Web uses Web Audio behind the same API: silent until first `pointerdown`/`keydown`, music deferred until `notifySoundFirstCardReady`, failures are silent no-ops. Looping sets `loopEnd` from manifest / `getSoundAssetDurationMs` `durationMs` (never decoded buffer length — AAC padding). `isSoundAvailable()` is true when `AudioContext` exists.

Sound 3 assets: `assets/audio/{music,sfx}/*.{m4a,web.m4a}`, index `docs/audio/README.md`, machine manifest `assets/audio/manifest.json` (`path` / `nativePath`, `durationMs`, `loop`, optional `level` / `placeholder`). Typed `require` map + variant groups: `lib/soundAssets.ts` (+ `.web.ts`). `music-texture-tonedrift-c` is a placeholder (`placeholder: true`). CI: `.github/scripts/audio-budget.mjs` (≤8 MiB native / ≤3 MiB web).

Sound 7 system behaviour (native only — session code stays out of `sound.web.ts`): `playsInSilentMode: false`, `interruptionMode: 'mixWithOthers'` (do not duck other apps), no `UIBackgroundModes: audio`. AppState **`background`** stops all sound; foreground restarts the music bed with fade-in via hooks Sound 6 registers (`registerSoundMusicHooks`). iOS **`inactive` is ignored** (must not stop audio). expo-audio handles call/alarm pause/resume natively and exposes **no JS interruption event** — `notifySoundInterruption` is a Sound 6 hook only, not wired to the OS in Sound 7. Screen reader → music ducks very low, effects muted, drop-ins paused; `DeckStatusLine` wraps AT copy with `beginSoundAnnouncement` / `endSoundAnnouncement` so reshuffle SFX do not cover “Loading a new neighborhood”. Skip starting music when other audio is already playing if a probe is set (`setOtherAudioPlayingProbe`). Thin `pauseSoundMusic` / `resumeSoundMusic` / `duckSoundMusic` / `stopAllSound` / `canStartMusic` are placeholders until Sound 6.

## Build switches (reference links / media credits)

v3.4 §9.5. Both default **On**. There is no in-app setting. Do **not** add `eas.json` or `app.config.*` for these — Expo inlines `EXPO_PUBLIC_*` at bundle time from the environment (EAS env for native builds; Vercel project env for the web preview). Record each build’s values in its release notes.

| Variable | Default | Effect when `"false"` or `"0"` |
| --- | --- | --- |
| `EXPO_PUBLIC_SHOW_REFERENCE_LINKS` | On (unset / invalid → On) | Hide the Wikipedia row and its 20–24 px gap |
| `EXPO_PUBLIC_SHOW_MEDIA_CREDITS` | On (unset / invalid → On) | Hide the media credit row |

Missing, blank, or any value other than `false` / `0` is On. Credits Off does not strip provenance from the API; the licence-guard for a credits-Off build is deferred.

Test/dev only: `?e2eShowReferenceLinks=0` and `?e2eShowMediaCredits=0` (honoured when `EXPO_PUBLIC_E2E=1` or `__DEV__`).

## Analytics / GTM

Client analytics reads these **at build time** (Expo `EXPO_PUBLIC_*`). Never commit real container IDs (keep `.env.example` empty).

| Variable | Where it lives |
| --- | --- |
| `EXPO_PUBLIC_GTM_WEB` | **Vercel** Production (and Preview if set) dashboard — web only |
| `EXPO_PUBLIC_GTM_ANDROID` | GitHub Environment **`prod`** (or EAS) — native Android builds later |
| `EXPO_PUBLIC_GTM_IOS` | GitHub Environment **`prod`** (or EAS) — native iOS builds later |

- Production / Preview web deploys: **Vercel Git integration** (not a GitHub Actions client deploy workflow).
- Do **not** put Android/iOS GTM IDs on Vercel (native only).
- Local: leave unset, or copy values privately into `apps/client/.env` (gitignored).
- Expo SPA (`web.output: "single"`) does **not** emit `app/+html.tsx` into the static HTML served on Vercel. Keep the GTM snippet in `+html.tsx` for non-SPA modes, but **always inject `gtm.js` at runtime** (`lib/gtmWeb.ts` via `ensureGtmWebLoaded` in the root layout / `analytics.web.ts`). Same pitfall as the letterbox CSS in `WebPhoneFrame.web.tsx`.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `pnpm exec expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check available Expo Skills / MCP before adding dependencies.
- Web preview is phone-framed for convenience; design and test at **390×844**. Preserve existing client patterns unless the task asks otherwise.
