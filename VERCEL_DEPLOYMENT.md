# Vercel Deployment - Lateralzr Client (Expo Web)

This document describes the Vercel deployment configuration for the Lateralzr Expo client as a static web application.

## Vercel Project Details

- **Project Name**: `lateralzr-client`
- **Team**: `gassius-projects`
- **Dashboard**: https://vercel.com/gassius-projects/lateralzr-client
- **Root Directory**: `apps/client` (already configured)
- **Framework**: None (Static Expo web export)

## Build Configuration

### Approach: Botore Parity

This deployment mirrors the **working Botore Expo web setup** (`gassius/botore` → `apps/game` → Vercel project `botore-game`), adapted for Lateralzr's Expo SDK 54 + expo-router.

**Key alignment with Botore:**
- Root `.npmrc` uses `auto-install-peers=true` and `resolution-mode=highest` for pnpm peer dependency handling
- Turbo filter uses dependency closure syntax: `--filter=client...`
- Web output mode: `"single"` (matches Botore; creates single-page bundle)

**Lateralzr differences from Botore:**
- Expo SDK **~54** (vs Botore's SDK 52)
- Uses **expo-router** for file-based routing (Botore game app does not)
- Additional navigation dependencies: `@expo/metro-runtime@~6.1.2`, `expo-modules-core@~3.0.30`, `@react-navigation/core@^7.14.0`

### Build Command
The build is handled by Turbo in the monorepo root. The Vercel project is configured with:

```bash
# Build command (in apps/client/vercel.json):
cd ../.. && pnpm install && pnpm turbo run build --filter=client...

# This runs: expo export --platform web
```

The `...` suffix includes dependencies in the build scope (Turbo dependency closure).

### Output Directory
- **Directory**: `dist/`
- The Expo web export outputs a single-page bundle to the `dist/` directory
- Configured in `apps/client/app.json` with `web.output: "single"` (matches Botore)
- Single-page mode bundles the entire app into one HTML file with embedded assets

### Ignore Build
```bash
npx turbo-ignore client
```
This ensures builds only trigger when the client or its dependencies change.

## Environment Variables

### Required: EXPO_PUBLIC_API_URL

**Already configured in Vercel dashboard** for both Production and Preview environments:

```
EXPO_PUBLIC_API_URL=https://api.lateralzr.com
```

This environment variable is:
- Read by the Expo client at build time (static builds bake in env vars)
- Used by `apps/client/lib/apiBaseUrl.ts` to determine the API endpoint
- Required for browser-based API calls from the deployed web app

### GTM: EXPO_PUBLIC_GTM_* (no hardcoded IDs)

| Variable | Where |
| --- | --- |
| `EXPO_PUBLIC_GTM_WEB` | **Vercel** Production (dashboard; Preview optional) — baked into Git-integration web builds |
| `EXPO_PUBLIC_GTM_ANDROID` | GitHub Environment **`prod`** or EAS later — native only; **not** on Vercel |
| `EXPO_PUBLIC_GTM_IOS` | GitHub Environment **`prod`** or EAS later — native only; **not** on Vercel |

Do **not** commit real container IDs.

Web Production / Preview deploys use **Vercel Git integration** (push to the linked branch). Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_GTM_WEB` on the Vercel project dashboard — there is no GitHub Actions client deploy workflow.

### Local Development
For local development, developers use:
```
EXPO_PUBLIC_API_URL=http://localhost
```
(or leave unset for localhost default)

Leave `EXPO_PUBLIC_GTM_*` empty locally unless you are deliberately testing analytics.

## API and CORS Configuration

### Backend API
- **Production API**: https://api.lateralzr.com
- **Hosted**: Hetzner VPS (Laravel API)

### CORS Setup
The Laravel backend has been configured to allow browser requests from:
- `https://lateralzr.com` (future production domain)
- `https://*.vercel.app` (Vercel preview and production deployments)

**Backend Configuration** (`/config/cors.php`):
```php
'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', '*')),
```

**Backend Environment** (`.env` on VPS):
```
CORS_ALLOWED_ORIGINS="https://lateralzr.com,https://*.vercel.app"
```

This must be set in the production `.env` file on the VPS at `/home/cgonzalez/lateralzr/.env`.

## Repository Structure

```
lateralzr/
├── .npmrc                   # Botore-style pnpm config (auto-install-peers, resolution-mode)
├── apps/
│   └── client/              # Expo app (THIS is the Root Directory)
│       ├── vercel.json      # Vercel configuration (mirrors Botore apps/game)
│       ├── package.json     # includes Expo SDK 54 + expo-router deps
│       ├── app.json         # Expo config (web.output: single)
│       ├── lib/
│       │   └── apiBaseUrl.ts  # Reads EXPO_PUBLIC_API_URL
│       └── .env.example     # Documents env vars
├── package.json             # Root workspace
├── pnpm-workspace.yaml      # Monorepo config
└── turbo.json               # Turborepo config
```

## Vercel Configuration File

**Location**: `apps/client/vercel.json`

Mirrors **Botore** `apps/game/vercel.json` structure:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd ../.. && pnpm install && pnpm turbo run build --filter=client...",
  "outputDirectory": "dist",
  "installCommand": "echo 'Skipping default install, using buildCommand'"
}
```

### Key Configuration Notes:

1. **buildCommand**: Navigates to monorepo root, runs pnpm install, then turbo build with dependency closure
2. **installCommand**: Skipped because install is handled in buildCommand (matches Botore)
3. **No framework override**: Removed (not needed; Botore doesn't set it)
4. **No rewrites**: Removed; single-page output mode handles routing internally

## pnpm Configuration

**Location**: `/.npmrc` (monorepo root)

Mirrors **Botore's working configuration** with additional hoisting for expo-router:

```
strict-peer-dependencies=false
auto-install-peers=true
resolution-mode=highest
shamefully-hoist=true
```

### Why This Matters:

- **auto-install-peers=true**: Automatically installs missing peer dependencies
- **strict-peer-dependencies=false**: Allows pnpm to proceed with peer dependency warnings
- **resolution-mode=highest**: Always resolves to highest compatible version
- **shamefully-hoist=true**: **Critical for expo-router** - hoists ALL packages to root node_modules

**expo-router 6.0.24 + Metro bundler requirement**: Unlike Botore's simpler game app, Lateralzr uses expo-router which has a deep dependency tree (`@react-navigation/*`, `use-latest-callback`, `react-native-is-edge-to-edge`, etc.). Metro bundler needs direct access to ALL transitive dependencies. Botore's `auto-install-peers` alone is insufficient; `shamefully-hoist=true` is required for Vercel builds to succeed.

## Dependencies

### Critical Build Dependencies

The following dependencies are explicitly declared for Expo SDK 54 + expo-router compatibility:

```json
"@babel/runtime": "^7.25.0"
"@expo/metro-runtime": "~6.1.2"
"expo-modules-core": "~3.0.30"
"@react-navigation/core": "^7.14.0"
"use-latest-callback": "^0.2.4"
```

**Why explicit dependencies?**
- **@babel/runtime**: Required by react-native-web (Botore also declares this explicitly)
- **@expo/metro-runtime**: Required by Metro bundler and expo-router@6.0.23
- **expo-modules-core**: SDK 54 runtime (tag: sdk-54)
- **@react-navigation/core**: Ensures Metro can resolve navigation dependencies
- **use-latest-callback**: expo-router navigation dependency

Even with `shamefully-hoist=true`, these packages must be declared in `apps/client/package.json` to ensure pnpm includes them in the install tree. Botore's simpler app (no expo-router) needs fewer explicit declarations.

## Testing the Deployment

### Preview Deployments
- Every push to a branch creates a preview deployment
- Preview URL format: `https://lateralzr-client-*.vercel.app`
- Preview deployments use `EXPO_PUBLIC_API_URL=https://api.lateralzr.com`

### Production Deployment
- Merges to `main` trigger production deployment
- Production URL: TBD (will be assigned by Vercel or custom domain)
- Uses `EXPO_PUBLIC_API_URL=https://api.lateralzr.com`

### Manual Testing Checklist

After deployment, verify:

1. **App loads**: Visit the Vercel URL
2. **API connectivity**: 
   - Open browser DevTools → Network
   - Trigger an API call in the app
   - Verify requests go to `https://api.lateralzr.com`
   - Check for CORS errors (should be none)
3. **Routing**: Navigate between app routes (client-side routing should work)
4. **Console**: Check for errors in browser console

### Test API Endpoint

```bash
# Test API is accessible
curl https://api.lateralzr.com/api/hello

# Expected response:
{
  "message": "Hello, Lateralzr API is running!",
  "status": "ok"
}
```

## Troubleshooting

### Build Fails with Missing Package
If build fails with missing `@expo/metro-runtime` or similar:
- Ensure `apps/client/package.json` includes the dependency
- Check pnpm-lock.yaml is committed
- Verify monorepo build command is correct

### CORS Errors in Browser
If browser shows CORS errors when calling API:
1. Verify backend CORS configuration on VPS
2. Check `.env` on VPS includes `CORS_ALLOWED_ORIGINS`
3. Restart Laravel services: `docker compose -f docker-compose.prod.yml restart`

### App Shows Wrong API URL
If app calls wrong API endpoint:
1. Check Vercel environment variables in dashboard
2. Verify `EXPO_PUBLIC_API_URL=https://api.lateralzr.com`
3. Trigger a new deployment to rebake the env var

### Routing Issues (404s)
If direct navigation to routes shows 404:
- Verify `vercel.json` includes the rewrite rule
- Check that SPA mode is properly configured

## Future: Custom Domain

When ready to add a custom domain:

1. **Add domain in Vercel**: `lateralzr.com` or `app.lateralzr.com`
2. **Update DNS**: Add CNAME or A record as instructed by Vercel
3. **Update CORS**: Add the custom domain to backend CORS_ALLOWED_ORIGINS
4. **Test**: Verify API calls work from custom domain

## Mobile Apps (iOS/Android)

This deployment is **web-only**. The Expo client also supports:
- **iOS**: Via Expo Go or native build
- **Android**: Via Expo Go or native build

Mobile apps use the same `EXPO_PUBLIC_API_URL` but typically connect to:
- Local development: Auto-detected LAN IP via Metro
- Production: https://api.lateralzr.com (when built with prod config)

See `apps/client/lib/apiBaseUrl.ts` for platform-specific resolution logic.

## Related Documentation

- [Main Deployment Docs](../../DEPLOYMENT.md) - Laravel API production deployment
- [Production Quickstart](../../PRODUCTION-QUICKSTART.md) - VPS setup guide
- [Client README](../../README.md#monorepo) - Local development setup

## Support

- **Repository**: https://github.com/gassius/lateralzr
- **ClickUp Task**: https://app.clickup.com/t/869f2z7fe
- **Vercel Dashboard**: https://vercel.com/gassius-projects/lateralzr-client
