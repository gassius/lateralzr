/**
 * Build-time On/Off switches for reference links and media credits (v3.4 §9.5).
 * Missing or invalid env values fall back to On. There is no user setting.
 */

import { isClientTestOrDevBuild } from './e2eFlags';
import type { JourneyTestParams } from './testQueryParams';

export function parseBuildSwitch(value: string | undefined | null): boolean {
  if (value == null) return true;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '') return true;
  return normalized !== 'false' && normalized !== '0';
}

export const BUILD_SHOW_REFERENCE_LINKS = parseBuildSwitch(
  process.env.EXPO_PUBLIC_SHOW_REFERENCE_LINKS,
);
export const BUILD_SHOW_MEDIA_CREDITS = parseBuildSwitch(
  process.env.EXPO_PUBLIC_SHOW_MEDIA_CREDITS,
);

function overrideOrBuild(
  override: boolean | undefined,
  buildValue: boolean,
): boolean {
  if (override !== undefined && isClientTestOrDevBuild()) {
    return override;
  }
  return buildValue;
}

/** Wikipedia row. E2E/dev query overrides are ignored in production builds. */
export function resolveShowReferenceLinks(params?: JourneyTestParams): boolean {
  return overrideOrBuild(params?.e2eShowReferenceLinks, BUILD_SHOW_REFERENCE_LINKS);
}

/** Credit row. E2E/dev query overrides are ignored in production builds. */
export function resolveShowMediaCredits(params?: JourneyTestParams): boolean {
  return overrideOrBuild(params?.e2eShowMediaCredits, BUILD_SHOW_MEDIA_CREDITS);
}
