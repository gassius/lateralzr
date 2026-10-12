import appJson from '../app.json';

/** `expo.version` from `apps/client/app.json` — About fallback and tests share this. */
export function expoVersionFromAppJson(): string {
  return appJson.expo.version;
}

/**
 * App version shown on About. Prefer Expo config when present (pass
 * `Constants.expoConfig?.version`); otherwise `app.json` so a bump cannot
 * stale a hardcoded fallback.
 */
export function readAppVersion(expoVersion?: string): string {
  return expoVersion ?? expoVersionFromAppJson();
}
