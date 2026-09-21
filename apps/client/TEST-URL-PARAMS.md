# Expo web test URL params

These query params are **test/dev tooling** for the Expo web client. They let testers and agents (for example Critiquito) open a specific starting concept, restrict the journey to cards that have media, and/or force the initial concept-label complexity. They are safe for public preview URLs: no secrets.

Web preview: `https://lateralzr-client.vercel.app`

Existing locale override (unchanged): `locale=en` or `locale=es`. Device/browser locale is ignored unless `locale` is set.

## Params

| Param | Example | Effect |
| --- | --- | --- |
| `canonicalConcept` | `creativity` | Start at the concept whose language-neutral `canonical_key` matches. Combine with `locale` to show the localized label (e.g. `creatividad` when `locale=es`). |
| `localizedConcept` | `creatividad` | Start at that exact localized label for the active locale. |
| `onlyWithMedia` | `true` | Load only concepts that have a `mediaUrl`. Also applies to later “load more” batches. |
| `locale` | `es` | Already supported. UI + API locale. Use with `canonicalConcept`. |
| `complexity` | `5` | Force concept-label complexity (integer **1–5**) for **this load/session only**. Does not overwrite the stored preference. Storage updates only after an intentional swipe up/down. |
| `laterality` | `4` | Set the initial laterality grade (integer **1–5**). Drives the submenu wordmark and the relationships request. |

- Missing, blank, or unsupported values are ignored. The app cold-starts as usual (no crash).
- `complexity` must be a whole number from 1 to 5. Blank, floats (`5.5`), and out-of-range values (`0`, `6`) are ignored. A valid value is session-only: Critiquito / preview deep links do not persist it.
- An unknown concept (API 404) falls back to a normal random start. `onlyWithMedia` is kept if it was set.
- If both concept params are present, **`localizedConcept` wins** (go directly to that label).
- `onlyWithMedia` is on only for `true`, `1`, or `yes` (case-insensitive). Other values are off.
- `laterality` must be a whole integer `1`–`5`. Blank, decimals (`4.5`), and out-of-range values are ignored (default grade **3**, or the last stored grade).

## Copy-paste URLs

Production preview:

```
https://lateralzr-client.vercel.app/?canonicalConcept=mushroom
https://lateralzr-client.vercel.app/?canonicalConcept=mushroom&locale=es
https://lateralzr-client.vercel.app/?localizedConcept=seta&locale=es
https://lateralzr-client.vercel.app/?localizedConcept=mushroom
https://lateralzr-client.vercel.app/?onlyWithMedia=true
https://lateralzr-client.vercel.app/?localizedConcept=Psychedelics&onlyWithMedia=true
https://lateralzr-client.vercel.app/?canonicalConcept=mushroom&locale=en&onlyWithMedia=true
https://lateralzr-client.vercel.app/?complexity=5
https://lateralzr-client.vercel.app/?canonicalConcept=mushroom&complexity=5
https://lateralzr-client.vercel.app/?laterality=4
https://lateralzr-client.vercel.app/?canonicalConcept=mushroom&laterality=5
https://lateralzr-client.vercel.app/?laterality=1&locale=es
```

`canonicalConcept=mushroom&locale=es` should open on the Spanish card **seta**. `Psychedelics` is a production start that already has media.

`mushroom` is a known prefetched start on production. Swap in any other `canonical_key` / localized card label from Admin. Unknown values 404 and the client cold-starts.

Local Expo web (`pnpm web` from `apps/client`, default port 8081):

```
http://localhost:8081/?canonicalConcept=mushroom
http://localhost:8081/?localizedConcept=mushroom
http://localhost:8081/?onlyWithMedia=true
http://localhost:8081/?complexity=5
http://localhost:8081/?canonicalConcept=mushroom&complexity=5
http://localhost:8081/?laterality=4
http://localhost:8081/?canonicalConcept=mushroom&laterality=5
```

URL-encode spaces and punctuation in concept strings (`localizedConcept=lateral%20thinking`).

## API fields (same names)

`POST /api/concepts/relationships` accepts the same filters so the client does not have to guess:

```json
{
  "canonicalConcept": "creativity",
  "localizedConcept": "creatividad",
  "onlyWithMedia": true,
  "locale": "es",
  "complexity": 5,
  "laterality": 4,
  "limit": 12,
  "depth": 2
}
```

Aliases: `canonicalStart` for `canonicalConcept`; existing `start` / `seed` still mean a localized (or any-locale) term. Localized `start` / `localizedConcept` wins over a canonical key when both are sent.

`laterality` is optional (integer 1–5). When present, the existing relationships endpoint prefers edges closer to that grade while expanding the neighborhood. Omitting it keeps the previous strength-first walk.

If the named start is not in the prefetched graph (or has no media when `onlyWithMedia` is true), the API returns **404**. The web client then cold-starts instead of crashing.

## How to pick a concept

Use a `canonical_key` from Filament Admin → Concepts (language-neutral identity), or a localized term exactly as it appears on a card.

The production graph is prefetched. A concept that has not been generated yet will 404 and the client will fall back to a random start.
