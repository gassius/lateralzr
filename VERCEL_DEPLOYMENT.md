# Vercel Deployment - Lateralzr Client (Expo Web)

This document describes the Vercel deployment configuration for the Lateralzr Expo client as a static web application.

## Vercel Project Details

- **Project Name**: `lateralzr-client`
- **Team**: `gassius-projects`
- **Dashboard**: https://vercel.com/gassius-projects/lateralzr-client
- **Root Directory**: `apps/client` (already configured)
- **Framework**: None (Static Expo web export)

## Build Configuration

### Build Command
The build is handled by Turbo in the monorepo root. The Vercel project is configured with:

```bash
# Build command (in apps/client/vercel.json):
cd ../.. && pnpm install && pnpm turbo run build --filter=client

# This runs: expo export --platform web
```

### Output Directory
- **Directory**: `dist/`
- The Expo web export outputs static files to the `dist/` directory
- Configured in `apps/client/app.json` with `web.output: "static"`

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

### Local Development
For local development, developers use:
```
EXPO_PUBLIC_API_URL=http://localhost
```
(or leave unset for localhost default)

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
├── apps/
│   └── client/              # Expo app (THIS is the Root Directory)
│       ├── vercel.json      # Vercel configuration
│       ├── package.json     # includes @expo/metro-runtime
│       ├── app.json         # Expo config (web.output: static)
│       ├── lib/
│       │   └── apiBaseUrl.ts  # Reads EXPO_PUBLIC_API_URL
│       └── .env.example     # Documents env vars
├── package.json             # Root workspace
├── pnpm-workspace.yaml      # Monorepo config
└── turbo.json               # Turborepo config
```

## Vercel Configuration File

**Location**: `apps/client/vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd ../.. && pnpm install && pnpm turbo run build --filter=client",
  "outputDirectory": "dist",
  "installCommand": "echo 'Skipping default install - handled in buildCommand'",
  "framework": null,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Key Configuration Notes:

1. **buildCommand**: Navigates to monorepo root to run pnpm install and turbo build
2. **installCommand**: Skipped because install is handled in buildCommand
3. **framework**: null (prevents Vercel from auto-detecting and using wrong build commands)
4. **rewrites**: SPA routing - all routes serve index.html for client-side navigation

## Dependencies

### Critical Build Dependencies

The following dependency is required for successful Expo web builds on Vercel:

```json
"@expo/metro-runtime": "~4.0.1"
```

This package is required by Metro bundler during `expo export --platform web`. It was added explicitly to fix build failures on Vercel.

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
