import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AnalyticsEvent,
  createAnalyticsHelpers,
  sanitizeAnalyticsParams,
} from './analyticsTypes';

test('AnalyticsEvent names are snake_case GTM-friendly', () => {
  assert.equal(AnalyticsEvent.CARD_VIEW, 'card_view');
  assert.equal(AnalyticsEvent.SWIPE_LEFT, 'swipe_left');
  assert.equal(AnalyticsEvent.SWIPE_RIGHT, 'swipe_right');
  assert.equal(AnalyticsEvent.SWIPE_UP, 'swipe_up');
  assert.equal(AnalyticsEvent.SWIPE_DOWN, 'swipe_down');
  assert.equal(AnalyticsEvent.CARD_BACK_VIEW, 'card_back_view');
  assert.equal(AnalyticsEvent.CARD_VIEW_TIME, 'card_view_time');
});

test('sanitizeAnalyticsParams drops nullish values', () => {
  assert.deepEqual(
    sanitizeAnalyticsParams({
      concept: 'Gravity',
      locale: 'en',
      complexity: undefined,
      index: null,
      face: 'front',
    }),
    { concept: 'Gravity', locale: 'en', face: 'front' },
  );
});

test('createAnalyticsHelpers emits expected events and params', () => {
  const calls: Array<{ event: string; params?: Record<string, unknown> }> = [];
  const api = createAnalyticsHelpers((event, params) => {
    calls.push({ event, params });
  });

  api.trackCardView({ concept: 'Orbit', locale: 'es', complexity: 2, index: 0 });
  api.trackSwipe('left', { concept: 'Orbit', locale: 'es', index: 0 });
  api.trackSwipe('up', { concept: 'Orbit', locale: 'es', complexity: 2, complexity_after: 3 });
  api.trackCardBackView({ concept: 'Orbit', locale: 'en', index: 1 });
  api.trackCardViewTime({
    concept: 'Orbit',
    locale: 'en',
    face: 'back',
    duration_ms: 1234.6,
  });

  assert.equal(calls.length, 5);
  assert.equal(calls[0]?.event, 'card_view');
  assert.equal(calls[0]?.params?.face, 'front');
  assert.equal(calls[1]?.event, 'swipe_left');
  assert.equal(calls[2]?.event, 'swipe_up');
  assert.equal(calls[2]?.params?.complexity_after, 3);
  assert.equal(calls[3]?.event, 'card_back_view');
  assert.equal(calls[3]?.params?.face, 'back');
  assert.equal(calls[4]?.event, 'card_view_time');
  assert.equal(calls[4]?.params?.duration_ms, 1235);
});
