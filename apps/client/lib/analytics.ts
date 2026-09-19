/**
 * Native analytics transport (Android / iOS).
 *
 * GTM on mobile typically sits on Firebase Analytics. Until Firebase + GTM
 * container binaries are wired via a development/EAS build, this module:
 * - resolves the platform container ID from env
 * - no-ops safely when unset
 * - logs in __DEV__ when a container ID is present so instrumentation can be verified
 *
 * Env:
 * - EXPO_PUBLIC_GTM_ANDROID (e.g. GTM-N7TRWH3Z)
 * - EXPO_PUBLIC_GTM_IOS (placeholder until ticket provides an ID)
 */
import { Platform } from 'react-native';
import {
  createAnalyticsHelpers,
  sanitizeAnalyticsParams,
  type AnalyticsEventName,
  type AnalyticsParams,
} from './analyticsTypes';

export {
  AnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsParams,
  type CardAnalyticsParams,
  type CardFace,
} from './analyticsTypes';

function resolveNativeGtmId(): string | undefined {
  const raw =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_GTM_IOS
      : process.env.EXPO_PUBLIC_GTM_ANDROID;
  const id = raw?.trim();
  return id && id.length > 0 ? id : undefined;
}

/** True when the platform GTM container env var is set. */
export function isAnalyticsConfigured(): boolean {
  return resolveNativeGtmId() != null;
}

export function getGtmContainerId(): string | undefined {
  return resolveNativeGtmId();
}

/**
 * Push a named event. Safe no-op when GTM/Firebase is not configured.
 * Native Firebase/GTM SDK integration can replace the __DEV__ log path later
 * without changing call sites.
 */
export function track(event: AnalyticsEventName | string, params?: AnalyticsParams): void {
  const containerId = resolveNativeGtmId();
  if (!containerId) return;

  const payload = sanitizeAnalyticsParams(params);
  // Firebase Analytics → GTM is not linked in Expo Go. Keep the public API ready.
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.debug(`[analytics:${containerId}]`, event, payload);
  }
}

const helpers = createAnalyticsHelpers(track);

export const trackCardView = helpers.trackCardView;
export const trackSwipe = helpers.trackSwipe;
export const trackCardBackView = helpers.trackCardBackView;
export const trackCardViewTime = helpers.trackCardViewTime;
