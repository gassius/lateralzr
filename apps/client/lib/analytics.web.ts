/**
 * Web analytics transport — Google Tag Manager via `window.dataLayer`.
 *
 * Inject the GTM snippet from `app/+html.tsx` when `EXPO_PUBLIC_GTM_WEB` is set.
 * Event pushes always go to dataLayer so tags can be tested even before the
 * container ID is assigned (snippet load is gated; pushes are always safe).
 *
 * Env:
 * - EXPO_PUBLIC_GTM_WEB (placeholder until ticket provides an ID)
 */
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

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function resolveWebGtmId(): string | undefined {
  const id = process.env.EXPO_PUBLIC_GTM_WEB?.trim();
  return id && id.length > 0 ? id : undefined;
}

/** True when the web GTM container env var is set (snippet will load). */
export function isAnalyticsConfigured(): boolean {
  return resolveWebGtmId() != null;
}

export function getGtmContainerId(): string | undefined {
  return resolveWebGtmId();
}

/**
 * Push a named event onto `window.dataLayer` for GTM.
 * No-ops during SSR / when `window` is unavailable.
 */
export function track(event: AnalyticsEventName | string, params?: AnalyticsParams): void {
  if (typeof window === 'undefined') return;

  const payload = sanitizeAnalyticsParams(params);
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event,
    ...payload,
  });

  if (__DEV__ && !resolveWebGtmId()) {
    // eslint-disable-next-line no-console
    console.debug('[analytics:dataLayer]', event, payload);
  }
}

const helpers = createAnalyticsHelpers(track);

export const trackCardView = helpers.trackCardView;
export const trackSwipe = helpers.trackSwipe;
export const trackCardBackView = helpers.trackCardBackView;
export const trackCardViewTime = helpers.trackCardViewTime;
