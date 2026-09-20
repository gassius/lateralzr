/** GTM / analytics event names (snake_case, GA4-friendly). */
export const AnalyticsEvent = {
  CARD_VIEW: 'card_view',
  SWIPE_LEFT: 'swipe_left',
  SWIPE_RIGHT: 'swipe_right',
  SWIPE_UP: 'swipe_up',
  SWIPE_DOWN: 'swipe_down',
  CARD_BACK_VIEW: 'card_back_view',
  CARD_VIEW_TIME: 'card_view_time',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export type CardFace = 'front' | 'back';

/** Common params attached to concept-related events. */
export type CardAnalyticsParams = {
  concept: string;
  locale: string;
  complexity?: number;
  index?: number;
  face?: CardFace;
  duration_ms?: number;
  /** Present on vertical swipes after complexity is adjusted. */
  complexity_after?: number;
};

export type AnalyticsParams = Record<string, string | number | boolean | undefined | null>;

export type TrackFn = (event: AnalyticsEventName | string, params?: AnalyticsParams) => void;

export function sanitizeAnalyticsParams(params?: AnalyticsParams): Record<string, string | number | boolean> {
  if (!params) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    out[key] = value;
  }
  return out;
}

export function createAnalyticsHelpers(track: TrackFn) {
  return {
    track,
    trackCardView(params: CardAnalyticsParams): void {
      track(AnalyticsEvent.CARD_VIEW, {
        concept: params.concept,
        locale: params.locale,
        complexity: params.complexity,
        index: params.index,
        face: params.face ?? 'front',
      });
    },
    trackSwipe(
      direction: 'left' | 'right' | 'up' | 'down',
      params: CardAnalyticsParams,
    ): void {
      const event =
        direction === 'left'
          ? AnalyticsEvent.SWIPE_LEFT
          : direction === 'right'
            ? AnalyticsEvent.SWIPE_RIGHT
            : direction === 'up'
              ? AnalyticsEvent.SWIPE_UP
              : AnalyticsEvent.SWIPE_DOWN;
      track(event, {
        concept: params.concept,
        locale: params.locale,
        complexity: params.complexity,
        index: params.index,
        complexity_after: params.complexity_after,
      });
    },
    trackCardBackView(params: CardAnalyticsParams): void {
      track(AnalyticsEvent.CARD_BACK_VIEW, {
        concept: params.concept,
        locale: params.locale,
        complexity: params.complexity,
        index: params.index,
        face: 'back',
      });
    },
    trackCardViewTime(params: CardAnalyticsParams & { duration_ms: number }): void {
      track(AnalyticsEvent.CARD_VIEW_TIME, {
        concept: params.concept,
        locale: params.locale,
        complexity: params.complexity,
        index: params.index,
        face: params.face ?? 'front',
        duration_ms: Math.max(0, Math.round(params.duration_ms)),
      });
    },
  };
}
