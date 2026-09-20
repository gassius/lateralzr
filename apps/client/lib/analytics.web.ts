/**
 * Web analytics transport — Google Tag Manager via `window.dataLayer`.
 *
 * SPA (`web.output: "single"`) does not emit `app/+html.tsx`, so the GTM
 * bootstrap is injected at runtime from {@link ensureGtmWebLoaded}. Event
 * pushes always go to dataLayer so tags can be tested even before the
 * container ID is assigned (snippet load is gated; pushes are always safe).
 *
 * Env (never hardcode IDs — Vercel / local .env):
 * - EXPO_PUBLIC_GTM_WEB
 */
import {
  createAnalyticsHelpers,
  sanitizeAnalyticsParams,
  type AnalyticsEventName,
  type AnalyticsParams,
} from './analyticsTypes';
import { injectGtmWeb, parseGtmWebId } from './gtmWeb';

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
  return parseGtmWebId(process.env.EXPO_PUBLIC_GTM_WEB);
}

/** True when `EXPO_PUBLIC_GTM_WEB` is a GTM-XXXX container ID. */
export function isAnalyticsConfigured(): boolean {
  return resolveWebGtmId() != null;
}

export function getGtmContainerId(): string | undefined {
  return resolveWebGtmId();
}

/**
 * Load `gtm.js` once when a valid web container ID is present.
 * Metro never ships this file to native iOS/Android.
 */
export function ensureGtmWebLoaded(): boolean {
  return injectGtmWeb(resolveWebGtmId());
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
