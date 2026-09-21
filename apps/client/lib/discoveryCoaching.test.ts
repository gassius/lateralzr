import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  canOfferFlipCoach,
  canOfferSwipeCoach,
  coachMessageKey,
  FLIP_COACH_CARD_INDEX,
  FLIP_COACH_DELAY_MS,
  INITIAL_DISCOVERY_COACHING_STATE,
  reduceDiscoveryCoaching,
  resetDiscoveryCoachingSession,
  getDiscoveryCoachingSession,
  setDiscoveryCoachingSession,
  shouldAnimateCoachPeek,
  SWIPE_COACH_IDLE_MS,
  visibleCoach,
  type DiscoveryCoachingState,
  type DiscoveryCoachingView,
} from './discoveryCoaching.ts';

function view(partial: Partial<DiscoveryCoachingView> = {}): DiscoveryCoachingView {
  return {
    cardIndex: 0,
    flipped: false,
    deckStatus: false,
    ...partial,
  };
}

function state(partial: Partial<DiscoveryCoachingState> = {}): DiscoveryCoachingState {
  return { ...INITIAL_DISCOVERY_COACHING_STATE, ...partial };
}

afterEach(() => {
  resetDiscoveryCoachingSession();
});

describe('swipe coaching', () => {
  it('does not offer before the idle threshold on the first card', () => {
    assert.equal(
      canOfferSwipeCoach(state(), view({ cardIndex: 0 }), SWIPE_COACH_IDLE_MS - 1),
      false,
    );
    assert.equal(visibleCoach(state(), view()), null);
  });

  it('offers once after idle on the first card, then stays until the first swipe', () => {
    assert.equal(
      canOfferSwipeCoach(state(), view({ cardIndex: 0 }), SWIPE_COACH_IDLE_MS),
      true,
    );

    const offered = reduceDiscoveryCoaching(state(), { type: 'offerSwipe' });
    assert.equal(offered.swipeCoachOffered, true);
    assert.equal(visibleCoach(offered, view({ cardIndex: 0 })), 'swipe');
    assert.equal(canOfferSwipeCoach(offered, view(), SWIPE_COACH_IDLE_MS * 2), false);

    const afterSwipe = reduceDiscoveryCoaching(offered, { type: 'swiped' });
    assert.equal(afterSwipe.swipeDiscovered, true);
    assert.equal(visibleCoach(afterSwipe, view({ cardIndex: 0 })), null);
    assert.equal(canOfferSwipeCoach(afterSwipe, view(), SWIPE_COACH_IDLE_MS * 2), false);
  });

  it('never offers swipe coaching if the user already swiped', () => {
    const discovered = reduceDiscoveryCoaching(state(), { type: 'swiped' });
    assert.equal(canOfferSwipeCoach(discovered, view({ cardIndex: 0 }), 60_000), false);
    assert.equal(visibleCoach(discovered, view()), null);
  });

  it('does not offer swipe coaching on later cards, while flipped, or on deck status', () => {
    assert.equal(canOfferSwipeCoach(state(), view({ cardIndex: 1 }), SWIPE_COACH_IDLE_MS), false);
    assert.equal(canOfferSwipeCoach(state(), view({ flipped: true }), SWIPE_COACH_IDLE_MS), false);
    assert.equal(canOfferSwipeCoach(state(), view({ deckStatus: true }), SWIPE_COACH_IDLE_MS), false);

    const offered = reduceDiscoveryCoaching(state(), { type: 'offerSwipe' });
    assert.equal(visibleCoach(offered, view({ flipped: true })), null);
    assert.equal(visibleCoach(offered, view({ deckStatus: true })), null);
    assert.equal(visibleCoach(offered, view({ cardIndex: 1 })), null);
  });
});

describe('flip coaching', () => {
  it('does not offer before the third card', () => {
    assert.equal(FLIP_COACH_CARD_INDEX, 2);
    assert.equal(
      canOfferFlipCoach(state(), view({ cardIndex: 1 }), FLIP_COACH_DELAY_MS),
      false,
    );
  });

  it('offers once after a short dwell on the third card, then clears after the first flip', () => {
    assert.equal(
      canOfferFlipCoach(state(), view({ cardIndex: FLIP_COACH_CARD_INDEX }), FLIP_COACH_DELAY_MS - 1),
      false,
    );
    assert.equal(
      canOfferFlipCoach(state(), view({ cardIndex: FLIP_COACH_CARD_INDEX }), FLIP_COACH_DELAY_MS),
      true,
    );

    const offered = reduceDiscoveryCoaching(state(), { type: 'offerFlip' });
    assert.equal(visibleCoach(offered, view({ cardIndex: FLIP_COACH_CARD_INDEX })), 'flip');
    assert.equal(canOfferFlipCoach(offered, view({ cardIndex: FLIP_COACH_CARD_INDEX }), 10_000), false);

    const afterFlip = reduceDiscoveryCoaching(offered, { type: 'flipped' });
    assert.equal(afterFlip.flipDiscovered, true);
    assert.equal(visibleCoach(afterFlip, view({ cardIndex: FLIP_COACH_CARD_INDEX })), null);
  });

  it('does not nag on later cards after the third-card offer', () => {
    const offered = reduceDiscoveryCoaching(state(), { type: 'offerFlip' });
    assert.equal(visibleCoach(offered, view({ cardIndex: FLIP_COACH_CARD_INDEX + 1 })), null);
    assert.equal(
      canOfferFlipCoach(offered, view({ cardIndex: FLIP_COACH_CARD_INDEX + 1 }), 10_000),
      false,
    );
  });

  it('still offers flip coaching after an early swipe if the user never flipped', () => {
    const afterSwipe = reduceDiscoveryCoaching(state(), { type: 'swiped' });
    assert.equal(visibleCoach(afterSwipe, view({ cardIndex: 0 })), null);
    assert.equal(
      canOfferFlipCoach(afterSwipe, view({ cardIndex: FLIP_COACH_CARD_INDEX }), FLIP_COACH_DELAY_MS),
      true,
    );
  });

  it('never offers flip coaching if the user already flipped', () => {
    const discovered = reduceDiscoveryCoaching(state(), { type: 'flipped' });
    assert.equal(
      canOfferFlipCoach(discovered, view({ cardIndex: FLIP_COACH_CARD_INDEX }), 10_000),
      false,
    );
    assert.equal(visibleCoach(discovered, view({ cardIndex: FLIP_COACH_CARD_INDEX })), null);
  });

  it('hides flip coaching while flipped or on deck status', () => {
    const offered = reduceDiscoveryCoaching(state(), { type: 'offerFlip' });
    assert.equal(
      visibleCoach(offered, view({ cardIndex: FLIP_COACH_CARD_INDEX, flipped: true })),
      null,
    );
    assert.equal(
      visibleCoach(offered, view({ cardIndex: FLIP_COACH_CARD_INDEX, deckStatus: true })),
      null,
    );
  });
});

describe('shouldAnimateCoachPeek', () => {
  it('skips compulsory animation when reduced motion is requested', () => {
    assert.equal(shouldAnimateCoachPeek(false), true);
    assert.equal(shouldAnimateCoachPeek(true), false);
  });
});

describe('coachMessageKey', () => {
  it('maps coach kinds to short action-oriented copy keys', () => {
    assert.equal(coachMessageKey('swipe'), 'swipeCoach');
    assert.equal(coachMessageKey('flip'), 'flipCoach');
  });
});

describe('discovery coaching session', () => {
  it('persists swipe/flip discovery for the JS session', () => {
    setDiscoveryCoachingSession(reduceDiscoveryCoaching(state(), { type: 'swiped' }));
    assert.equal(getDiscoveryCoachingSession().swipeDiscovered, true);
    resetDiscoveryCoachingSession();
    assert.deepEqual(getDiscoveryCoachingSession(), INITIAL_DISCOVERY_COACHING_STATE);
  });
});
