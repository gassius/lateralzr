import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  coachMessageKey,
  flipCoachContextReady,
  FLIP_COACH_CARD_INDEX,
  FLIP_COACH_DELAY_MS,
  INITIAL_DISCOVERY_COACHING_STATE,
  reduceDiscoveryCoaching,
  resetDiscoveryCoachingSession,
  getDiscoveryCoachingSession,
  scheduleCoachOffer,
  setDiscoveryCoachingSession,
  shouldAnimateCoachPeek,
  swipeCoachContextReady,
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

type TimerHandle = ReturnType<typeof setTimeout>;

function createFakeClock() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();

  const timers = {
    setTimeout(fn: () => void, delay?: number) {
      const id = nextId++;
      pending.set(id, { at: now + (delay ?? 0), fn });
      return id as unknown as TimerHandle;
    },
    clearTimeout(id: TimerHandle) {
      pending.delete(id as unknown as number);
    },
  } as Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'>;

  function advance(ms: number) {
    now += ms;
    const due = [...pending.entries()]
      .filter(([, item]) => item.at <= now)
      .sort((a, b) => a[1].at - b[1].at);
    for (const [id, item] of due) {
      if (!pending.has(id)) continue;
      pending.delete(id);
      item.fn();
    }
  }

  return { timers, advance };
}

describe('swipe coaching', () => {
  it('does not offer before the idle threshold on the first card', () => {
    assert.equal(SWIPE_COACH_IDLE_MS, 5000);
    assert.equal(swipeCoachContextReady(state(), view({ cardIndex: 0 })), true);
    assert.equal(visibleCoach(state(), view()), null);
  });

  it('offers once after idle on the first card, then stays until the first swipe', () => {
    assert.equal(swipeCoachContextReady(state(), view({ cardIndex: 0 })), true);

    const offered = reduceDiscoveryCoaching(state(), { type: 'offerSwipe' });
    assert.equal(offered.swipeCoachOffered, true);
    assert.equal(visibleCoach(offered, view({ cardIndex: 0 })), 'swipe');
    assert.equal(swipeCoachContextReady(offered, view()), false);

    const afterSwipe = reduceDiscoveryCoaching(offered, { type: 'swiped' });
    assert.equal(afterSwipe.swipeDiscovered, true);
    assert.equal(visibleCoach(afterSwipe, view({ cardIndex: 0 })), null);
    assert.equal(swipeCoachContextReady(afterSwipe, view()), false);
  });

  it('never offers swipe coaching if the user already swiped', () => {
    const discovered = reduceDiscoveryCoaching(state(), { type: 'swiped' });
    assert.equal(swipeCoachContextReady(discovered, view({ cardIndex: 0 })), false);
    assert.equal(visibleCoach(discovered, view()), null);
  });

  it('does not offer swipe coaching on later cards, while flipped, or on deck status', () => {
    assert.equal(swipeCoachContextReady(state(), view({ cardIndex: 1 })), false);
    assert.equal(swipeCoachContextReady(state(), view({ flipped: true })), false);
    assert.equal(swipeCoachContextReady(state(), view({ deckStatus: true })), false);

    const offered = reduceDiscoveryCoaching(state(), { type: 'offerSwipe' });
    assert.equal(visibleCoach(offered, view({ flipped: true })), null);
    assert.equal(visibleCoach(offered, view({ deckStatus: true })), null);
    assert.equal(visibleCoach(offered, view({ cardIndex: 1 })), null);
  });
});

describe('flip coaching', () => {
  it('does not offer before the third card', () => {
    assert.equal(FLIP_COACH_CARD_INDEX, 2);
    assert.equal(flipCoachContextReady(state(), view({ cardIndex: 1 })), false);
  });

  it('offers once after a short dwell on the third card, then clears after the first flip', () => {
    assert.equal(FLIP_COACH_DELAY_MS, 800);
    assert.equal(
      flipCoachContextReady(state(), view({ cardIndex: FLIP_COACH_CARD_INDEX })),
      true,
    );

    const offered = reduceDiscoveryCoaching(state(), { type: 'offerFlip' });
    assert.equal(visibleCoach(offered, view({ cardIndex: FLIP_COACH_CARD_INDEX })), 'flip');
    assert.equal(
      flipCoachContextReady(offered, view({ cardIndex: FLIP_COACH_CARD_INDEX })),
      false,
    );

    const afterFlip = reduceDiscoveryCoaching(offered, { type: 'flipped' });
    assert.equal(afterFlip.flipDiscovered, true);
    assert.equal(visibleCoach(afterFlip, view({ cardIndex: FLIP_COACH_CARD_INDEX })), null);
  });

  it('does not nag on later cards after the third-card offer', () => {
    const offered = reduceDiscoveryCoaching(state(), { type: 'offerFlip' });
    assert.equal(visibleCoach(offered, view({ cardIndex: FLIP_COACH_CARD_INDEX + 1 })), null);
    assert.equal(
      flipCoachContextReady(offered, view({ cardIndex: FLIP_COACH_CARD_INDEX + 1 })),
      false,
    );
  });

  it('still offers flip coaching after an early swipe if the user never flipped', () => {
    const afterSwipe = reduceDiscoveryCoaching(state(), { type: 'swiped' });
    assert.equal(visibleCoach(afterSwipe, view({ cardIndex: 0 })), null);
    assert.equal(
      flipCoachContextReady(afterSwipe, view({ cardIndex: FLIP_COACH_CARD_INDEX })),
      true,
    );
  });

  it('never offers flip coaching if the user already flipped', () => {
    const discovered = reduceDiscoveryCoaching(state(), { type: 'flipped' });
    assert.equal(
      flipCoachContextReady(discovered, view({ cardIndex: FLIP_COACH_CARD_INDEX })),
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

describe('scheduleCoachOffer', () => {
  it('fires swipe idle exactly at SWIPE_COACH_IDLE_MS and not 1 ms before', () => {
    const { timers, advance } = createFakeClock();
    let offers = 0;
    scheduleCoachOffer(
      swipeCoachContextReady(state(), view({ cardIndex: 0 })),
      SWIPE_COACH_IDLE_MS,
      () => {
        offers += 1;
      },
      timers,
    );

    advance(SWIPE_COACH_IDLE_MS - 1);
    assert.equal(offers, 0);
    advance(1);
    assert.equal(offers, 1);
  });

  it('resets interaction by cancel + reschedule and fires only after a second full idle', () => {
    const { timers, advance } = createFakeClock();
    let offers = 0;
    const offer = () => {
      offers += 1;
    };
    const ready = swipeCoachContextReady(state(), view({ cardIndex: 0 }));

    const cancel = scheduleCoachOffer(ready, SWIPE_COACH_IDLE_MS, offer, timers);
    advance(4000);
    assert.equal(offers, 0);

    cancel();
    scheduleCoachOffer(ready, SWIPE_COACH_IDLE_MS, offer, timers);

    advance(1000);
    assert.equal(offers, 0);
    advance(SWIPE_COACH_IDLE_MS - 1000);
    assert.equal(offers, 1);
  });

  it('fires flip dwell at FLIP_COACH_DELAY_MS and not 799 ms', () => {
    const { timers, advance } = createFakeClock();
    let offers = 0;
    scheduleCoachOffer(
      flipCoachContextReady(state(), view({ cardIndex: FLIP_COACH_CARD_INDEX })),
      FLIP_COACH_DELAY_MS,
      () => {
        offers += 1;
      },
      timers,
    );

    advance(799);
    assert.equal(offers, 0);
    advance(1);
    assert.equal(offers, 1);
  });

  it('schedules nothing when swipe or flip context is not ready', () => {
    const { timers, advance } = createFakeClock();
    let offers = 0;
    const offer = () => {
      offers += 1;
    };
    const alreadyOffered = state({ swipeCoachOffered: true });
    const alreadyDiscovered = state({ swipeDiscovered: true });

    scheduleCoachOffer(
      swipeCoachContextReady(state(), view({ cardIndex: 1 })),
      SWIPE_COACH_IDLE_MS,
      offer,
      timers,
    );
    scheduleCoachOffer(
      swipeCoachContextReady(state(), view({ flipped: true })),
      SWIPE_COACH_IDLE_MS,
      offer,
      timers,
    );
    scheduleCoachOffer(
      swipeCoachContextReady(alreadyOffered, view()),
      SWIPE_COACH_IDLE_MS,
      offer,
      timers,
    );
    scheduleCoachOffer(
      swipeCoachContextReady(alreadyDiscovered, view()),
      SWIPE_COACH_IDLE_MS,
      offer,
      timers,
    );
    scheduleCoachOffer(
      flipCoachContextReady(state({ flipDiscovered: true }), view({ cardIndex: FLIP_COACH_CARD_INDEX })),
      FLIP_COACH_DELAY_MS,
      offer,
      timers,
    );

    advance(SWIPE_COACH_IDLE_MS);
    advance(FLIP_COACH_DELAY_MS);
    assert.equal(offers, 0);
  });

  it('does not fire late after cancel (flip / deck-status cleanup)', () => {
    const { timers, advance } = createFakeClock();
    let offers = 0;
    const cancel = scheduleCoachOffer(
      swipeCoachContextReady(state(), view()),
      SWIPE_COACH_IDLE_MS,
      () => {
        offers += 1;
      },
      timers,
    );

    cancel();
    advance(SWIPE_COACH_IDLE_MS + 100);
    assert.equal(offers, 0);
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

  it('replay reset clears offered + discovered flags for a new coaching sequence', () => {
    setDiscoveryCoachingSession({
      swipeDiscovered: true,
      flipDiscovered: true,
      swipeCoachOffered: true,
      flipCoachOffered: true,
    });
    resetDiscoveryCoachingSession();
    assert.deepEqual(getDiscoveryCoachingSession(), INITIAL_DISCOVERY_COACHING_STATE);
    assert.equal(
      swipeCoachContextReady(getDiscoveryCoachingSession(), view({ cardIndex: 0 })),
      true,
    );
  });
});
