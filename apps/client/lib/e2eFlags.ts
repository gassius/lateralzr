/**
 * Test / Critiquito overrides that must never activate in production builds.
 */

/**
 * True in Expo `__DEV__` or when the Client E2E export env is set
 * (`EXPO_PUBLIC_E2E=1` on `e2e:build` / Client E2E workflows).
 */
export function isClientTestOrDevBuild(): boolean {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
  return process.env.EXPO_PUBLIC_E2E === '1';
}

/**
 * `?e2ePulsePeak=1` may force a static peak breath only in test/dev builds.
 * Production web ignores the query param (Lz-40 PRR M1).
 */
export function resolveE2ePulsePeak(requested: boolean | undefined): boolean {
  return Boolean(requested) && isClientTestOrDevBuild();
}
