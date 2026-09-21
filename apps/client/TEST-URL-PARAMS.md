# Expo web test URL params

These query params are **test/dev tooling** for the Expo web client. They let testers and agents (for example Critiquito) open a specific starting concept and/or restrict the journey to cards that have media. They are safe for public preview URLs: no secrets.

Web preview: `https://lateralzr-client.vercel.app`

Existing locale override (unchanged): `locale=en` or `locale=es`. Device/browser locale is ignored unless `locale` is set.

## Params

| Param | Example | Effect |
| --- | --- | --- |
| `canonicalConcept` | `creativity` | Start at the concept whose language-neutral `canonical_key` matches. Combine with `locale` to show the localized label (e.g. `creatividad` when `locale=es`). |
| `localizedConcept` | `creatividad` | Start at that exact localized label for the active locale. |
| `onlyWithMedia` | `true` | Load only concepts that have a `mediaUrl`. Also applies to later “load more” batches. |
| `locale` | `es` | Already supported. UI + API locale. Use with `canonicalConcept`. |

- Missing, blank, or unsupported values are ignored. The app cold-starts as usual (no crash).
- An unknown concept (API 404) falls back to a normal random start. `onlyWithMedia` is kept if it was set.
- If both concept params are present, **`localizedConcept` wins** (go directly to that label).
- `onlyWithMedia` is on only for `true`, `1`, or `yes` (case-insensitive). Other values are off.

## Copy-paste URLs

Production preview:

```
https://lateralzr-client.vercel.app/?canonicalConcept=creativity
https://lateralzr-client.vercel.app/?canonicalConcept=creativity&locale=es
https://lateralzr-client.vercel.app/?localizedConcept=creatividad&locale=es
https://lateralzr-client.vercel.app/?onlyWithMedia=true
https://lateralzr-client.vercel.app/?localizedConcept=creativity&onlyWithMedia=true
https://lateralzr-client.vercel.app/?canonicalConcept=creativity&locale=es&onlyWithMedia=true
```

Local Expo web (`pnpm web` from `apps/client`, default port 8081):

```
http://localhost:8081/?canonicalConcept=creativity
http://localhost:8081/?localizedConcept=creatividad&locale=es
http://localhost:8081/?onlyWithMedia=true
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
  "limit": 12,
  "depth": 2
}
```

Aliases: `canonicalStart` for `canonicalConcept`; existing `start` / `seed` still mean a localized (or any-locale) term. Localized `start` / `localizedConcept` wins over a canonical key when both are sent.

If the named start is not in the prefetched graph (or has no media when `onlyWithMedia` is true), the API returns **404**. The web client then cold-starts instead of crashing.

## How to pick a concept

Use a `canonical_key` from Filament Admin → Concepts (language-neutral identity), or a localized term exactly as it appears on a card.

The production graph is prefetched. A concept that has not been generated yet will 404 and the client will fall back to a random start.
