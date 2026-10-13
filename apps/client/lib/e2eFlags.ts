/**
 * Test / Critiquito overrides that must never activate in production builds.
 */

/**
 * True in Expo `__DEV__`, when `EXPO_PUBLIC_E2E=1` is baked into the export
 * (`e2e:build` / Client E2E workflows), or when the Client E2E API base is pinned
 * (`EXPO_PUBLIC_API_URL=http://127.0.0.1:4173`). Production Vercel builds use
 * neither flag.
 */
export function isClientTestOrDevBuild(): boolean {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
  if (process.env.EXPO_PUBLIC_E2E === '1') return true;
  return process.env.EXPO_PUBLIC_API_URL === 'http://127.0.0.1:4173';
}

/**
 * `?e2ePulsePeak=1` may force a static peak breath only in test/dev builds.
 * Production web ignores the query param (Lz-40 PRR M1).
 */
export function resolveE2ePulsePeak(requested: boolean | undefined): boolean {
  return Boolean(requested) && isClientTestOrDevBuild();
}
