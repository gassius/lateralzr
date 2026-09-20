# Lateralzr Expo client — agent context

This is the **Expo / React Native** app client for Lateralzr (`apps/client` in the monorepo). Prefer mobile-first patterns, performance, and cross-platform compatibility. The app is shipped today as an Expo **web** export and is intended for native iOS/Android builds when needed.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json` (this project targets **SDK 54**).
2. Fetch the matching versioned docs: https://docs.expo.dev/versions/v54.0.0/
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Agent tooling (required for Expo work)

Use Expo's official agent tooling instead of guessing from training data:

| Piece | Purpose | Setup |
| --- | --- | --- |
| **This file (`AGENTS.md`)** | Project instructions Cursor/Codex read automatically | Committed here |
| **Expo Skills** | Known-good Expo/EAS patterns (auto-discovered) | `pnpm dlx skills add expo/skills` once per machine, then reopen Cursor. Or Cursor → Settings → Rules → Add Rule → Remote Rule → `https://github.com/expo/skills.git` |
| **Expo MCP Server** | Live Expo docs, `expo install`, EAS builds/workflows, simulator screenshots | Project `.cursor/mcp.json` registers `https://mcp.expo.dev/mcp` — authenticate via Cursor Settings → Tools & MCP → Connect |
| **Local MCP capabilities** | Screenshots, tap automation, DevTools, router sitemap (SDK 54+) | Dev dep `expo-mcp`; start with `pnpm start:mcp` (sets `EXPO_UNSTABLE_MCP_SERVER=1`) |

Docs: https://docs.expo.dev/agents.md · https://docs.expo.dev/skills.md · https://docs.expo.dev/mcp.md · https://docs.expo.dev/agents/cursor.md

When an Expo MCP tool or Expo Skill applies, **use it** (docs search/read, `add_library`, builds, automation) before inventing APIs or package versions.

## Commands

This monorepo uses **pnpm**. Run these from `apps/client` (or `pnpm turbo run <script> --filter=client` from the repo root).

```bash
pnpm exec expo install <package>  # ALWAYS use instead of pnpm add — resolves SDK-compatible versions
pnpm start                        # start the dev server
pnpm web                          # Expo web
pnpm start:mcp                    # dev server with Expo MCP local capabilities
pnpm test                         # unit tests
pnpm typecheck                    # tsc --noEmit
pnpm exec expo-doctor             # diagnose dependency and config issues
pnpm exec expo install --fix      # fix incompatible package versions
```

Run `pnpm test` and `pnpm typecheck` before declaring any client task done.

API / Laravel work stays at the **repo root** and must use Sail (`./sail ...`) — see root agent context in `.cursorrules/AGENTS.md`.

## Navigation & Routing

- Use **Expo Router**. Routes live in `app/` (not `src/app/`). Keep non-route code in `components/`, `hooks/`, `lib/`, `constants/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit (`eas build`, `eas submit`) and for OTA updates (`eas update`) when native apps are needed. Prefer `pnpm exec eas-cli@latest` / `npx eas-cli@latest` over a bare `eas` if the CLI is not installed globally.
Docs: https://docs.expo.dev/eas/index.md

When native builds need GTM, map the same **names** from GitHub Environment `prod` into EAS secrets/env (see Analytics / GTM below). Do not paste container IDs into the repo.

## Analytics / GTM

Client analytics reads these **at build time** (Expo `EXPO_PUBLIC_*`). Never commit real container IDs (keep `.env.example` empty).

| Variable | Where it lives |
| --- | --- |
| `EXPO_PUBLIC_GTM_WEB` | **Vercel Production** env (dashboard, manual) — web only |
| `EXPO_PUBLIC_GTM_ANDROID` | GitHub Environment **`prod`** (or EAS) — native Android builds |
| `EXPO_PUBLIC_GTM_IOS` | GitHub Environment **`prod`** (or EAS) — native iOS builds |

- Do **not** put Android/iOS GTM IDs on Vercel (native only).
- Optional Actions deploy: `.github/workflows/deploy-client.yml` — pulls Vercel Production env (including `EXPO_PUBLIC_GTM_WEB`) via `vercel pull`.
- Local: leave unset, or copy values privately into `apps/client/.env` (gitignored).

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `pnpm exec expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check available Expo Skills / MCP before adding dependencies.
- Web preview uses a phone-frame layout on large viewports; preserve existing client patterns unless the task asks otherwise.
