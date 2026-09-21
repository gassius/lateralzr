import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { ConceptCard } from './ConceptCard';
import { DeckStatusCard } from './DeckStatusCard';
import { useDiscoveryCoaching } from '@/hooks/useDiscoveryCoaching';
import {
  trackCardBackView,
  trackCardView,
  trackCardViewTime,
  trackSwipe,
  type CardFace,
} from '@/lib/analytics';
import type { ConceptItem } from '@/lib/api';
import { resolveApiBaseUrl } from '@/lib/apiBaseUrl';
import { clampComplexity } from '@/lib/complexityStorage';
import {
  coachMessageKey,
  SWIPE_COACH_PEEK_PX,
  type CoachKind,
} from '@/lib/discoveryCoaching';
import { getActiveLocale, t } from '@/lib/i18n';
import { displayMediaUrl } from '@/lib/remoteImage';

type ConceptCardStackProps = {
  concepts: ConceptItem[];
  currentIndex: number;
  /** Current concept complexity tier (1–5); used for analytics payloads. */
  complexity: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  /** Same forward motion as swipe left; also adjusts complexity for the next API call. */
  onSwipeForwardVertical: (direction: 'up' | 'down') => void;
  availableHeight: number;
  preloadedMediaUrls: ReadonlySet<string>;
  /** Loading / error deck card — only when user is at the true end and waiting (see HomeScreen). */
  showDeckLoading: boolean;
  loadMoreError: boolean;
  onRetryLoadMore: () => void;
};

const SWIPE_THRESHOLD = 56;
const SWIPE_VELOCITY_Y = 650;
const springConfig = { damping: 22, stiffness: 220 };
const PAN_ACTIVE_OFFSET = 18;
const MAX_ROTATION_DEG = 45;
const ENTER_OFFSET_PX = 72;
const ENTER_ROTATION_DEG = 14;
/** Smoothly seats the “return” card after swipe right; commit runs only after this finishes (no pre-reset of translateX). */
const SWIPE_RIGHT_COMMIT_DURATION_MS = 200;
/** Front card exits left before index advances; same pattern as swipe right. */
const SWIPE_LEFT_COMMIT_DURATION_MS = 200;
/** Vertical forward exits up or down before index advances. */
const SWIPE_VERTICAL_COMMIT_DURATION_MS = 220;
const CARD_ASPECT = 1.4;
/** Move behind peek off-screen instead of opacity:0 — opacity toggles caused a sibling alpha compositor flash on handoff. */
const BEHIND_PEEK_OFFSCREEN_X = -4096;

export function ConceptCardStack({
  concepts,
  currentIndex,
  complexity,
  onSwipeLeft,
  onSwipeRight,
  onSwipeForwardVertical,
  availableHeight,
  preloadedMediaUrls,
  showDeckLoading,
  loadMoreError,
  onRetryLoadMore,
}: ConceptCardStackProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const enterX = useSharedValue(0);
  const enterR = useSharedValue(0);
  const swipeAnimating = useSharedValue(false);
  const canSwipeRightSV = useSharedValue(0);
  const showDeckStatusSV = useSharedValue(0);
  const cardWidthSV = useSharedValue(360);
  const cardHeightSV = useSharedValue(400);
  /** 1 = force return overlay invisible (avoids one frame where React cleared the lock but UI thread still had translateX > 0). */
  const returnOverlaySuppressSV = useSharedValue(0);
  /** 1 = hide behind peek during index handoff (same race as return overlay, translateX < 0 vs nextIndex jump). */
  const behindPeekSuppressSV = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);
  const [containerW, setContainerW] = useState<number>(0);
  /** While swipe-right commit runs, pin overlay to this index so it doesn't jump when currentIndex updates before translateX resets. */
  const [returnOverlayLockedIndex, setReturnOverlayLockedIndex] = useState<number | null>(null);
  /** While swipe-left commit runs, pin behind card to this index (the “next” card under the front) before index advances. */
  const [behindLockedIndex, setBehindLockedIndex] = useState<number | null>(null);
  const currentIndexRef = useRef(currentIndex);
  const navIntentRef = useRef<'forward' | 'backward' | 'backwardGesture' | null>(null);
  const conceptsRef = useRef(concepts);
  const complexityRef = useRef(complexity);
  const flippedRef = useRef(flipped);
  const showDeckStatusRef = useRef(false);
  const dwellStartedAtRef = useRef<number>(Date.now());
  const dwellFaceRef = useRef<CardFace>('front');
  const dwellConceptRef = useRef<string | null>(null);
  const dwellIndexRef = useRef<number>(-1);
  const coachPeekX = useSharedValue(0);
  const flipPeek = useSharedValue(0);
  const peekedKindRef = useRef<CoachKind | null>(null);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    conceptsRef.current = concepts;
  }, [concepts]);

  useEffect(() => {
    complexityRef.current = complexity;
  }, [complexity]);

  useEffect(() => {
    flippedRef.current = flipped;
  }, [flipped]);

  const cardWidth = Math.max(0, containerW);
  const desiredCardHeight = cardWidth > 0 ? cardWidth * CARD_ASPECT : 0;
  const cardAreaHeight = Math.max(260, Math.min(availableHeight * 0.78, desiredCardHeight || availableHeight * 0.78));

  useEffect(() => {
    cardWidthSV.value = Math.max(1, cardWidth);
    cardHeightSV.value = cardAreaHeight;
  }, [cardAreaHeight, cardWidth, cardWidthSV, cardHeightSV]);

  const isLastCard = concepts.length > 0 && currentIndex === concepts.length - 1;
  const showDeckStatus = useMemo(
    () => isLastCard && (showDeckLoading || loadMoreError),
    [isLastCard, showDeckLoading, loadMoreError],
  );

  const deckStatusVariant = loadMoreError ? 'error' : 'loading';

  const { coach, peekEnabled, noteInteraction, noteSwiped, noteFlipped } = useDiscoveryCoaching({
    cardIndex: currentIndex,
    flipped: flipped || concepts.length === 0,
    deckStatus: showDeckStatus,
  });

  useEffect(() => {
    if (!coach || !peekEnabled) {
      coachPeekX.value = 0;
      flipPeek.value = 0;
      return;
    }
    if (peekedKindRef.current === coach) return;
    peekedKindRef.current = coach;
    if (coach === 'swipe') {
      flipPeek.value = 0;
      coachPeekX.value = withSequence(
        withTiming(-SWIPE_COACH_PEEK_PX, {
          duration: 520,
          easing: Easing.inOut(Easing.cubic),
        }),
        withTiming(0, { duration: 560, easing: Easing.out(Easing.cubic) }),
      );
    } else {
      coachPeekX.value = 0;
      flipPeek.value = withSequence(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) }),
      );
    }
  }, [coach, peekEnabled, coachPeekX, flipPeek]);

  const flushDwell = useCallback((nextFace?: CardFace, nextConcept?: string | null, nextIndex?: number) => {
    const concept = dwellConceptRef.current;
    const startedAt = dwellStartedAtRef.current;
    const face = dwellFaceRef.current;
    const index = dwellIndexRef.current;
    if (concept != null && startedAt > 0) {
      const durationMs = Date.now() - startedAt;
      if (durationMs >= 0) {
        trackCardViewTime({
          concept,
          locale: getActiveLocale(),
          complexity: complexityRef.current,
          index,
          face,
          duration_ms: durationMs,
        });
      }
    }
    dwellStartedAtRef.current = Date.now();
    if (nextFace != null) dwellFaceRef.current = nextFace;
    if (nextConcept !== undefined) dwellConceptRef.current = nextConcept;
    if (nextIndex !== undefined) dwellIndexRef.current = nextIndex;
  }, []);

  const analyticsContextForIndex = useCallback((index: number) => {
    const item = conceptsRef.current[index];
    if (!item) return null;
    return {
      concept: item.concept,
      locale: getActiveLocale(),
      complexity: complexityRef.current,
      index,
    };
  }, []);

  // Card view + dwell: start when landing on a concept; flush previous on index / deck-status change.
  const activeConcept = !showDeckStatus ? concepts[currentIndex]?.concept : undefined;
  useEffect(() => {
    if (showDeckStatus) {
      showDeckStatusRef.current = true;
      flushDwell('front', null, -1);
      return;
    }
    showDeckStatusRef.current = false;
    if (activeConcept == null) return;

    const prevConcept = dwellConceptRef.current;
    const prevIndex = dwellIndexRef.current;
    if (prevConcept != null && (prevConcept !== activeConcept || prevIndex !== currentIndex)) {
      flushDwell('front', activeConcept, currentIndex);
    } else {
      dwellConceptRef.current = activeConcept;
      dwellIndexRef.current = currentIndex;
      dwellFaceRef.current = 'front';
      dwellStartedAtRef.current = Date.now();
    }

    trackCardView({
      concept: activeConcept,
      locale: getActiveLocale(),
      complexity: complexityRef.current,
      index: currentIndex,
      face: 'front',
    });
  }, [activeConcept, currentIndex, showDeckStatus, flushDwell]);

  // Flush dwell when app backgrounds or stack unmounts.
  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        flushDwell(dwellFaceRef.current, dwellConceptRef.current, dwellIndexRef.current);
        dwellStartedAtRef.current = 0;
      } else if (next === 'active' && dwellConceptRef.current != null) {
        dwellStartedAtRef.current = Date.now();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      sub.remove();
      flushDwell();
    };
  }, [flushDwell]);

  useEffect(() => {
    canSwipeRightSV.value = currentIndex > 0 ? 1 : 0;
  }, [canSwipeRightSV, currentIndex]);

  useEffect(() => {
    showDeckStatusSV.value = showDeckStatus ? 1 : 0;
  }, [showDeckStatus, showDeckStatusSV]);

  // Layout effect: reset gesture + enter state before paint so the new top card never flashes with the
  // previous commit’s translateX / tilt (useEffect runs too late and causes a one-frame blink).
  useLayoutEffect(() => {
    const intent = navIntentRef.current;
    navIntentRef.current = null;

    returnOverlaySuppressSV.value = 1;
    // Swipe right never blinks because the return overlay stays mounted over the front until commit.
    // Swipe left must not unmount the behind peek when it shows the same card as the new front (it sits under z-index).
    // Suppressing behind only for non-forward intents avoids off-screen → snap that reads as an alpha flash.
    behindPeekSuppressSV.value = intent === 'forward' ? 0 : 1;

    runOnUI(() => {
      'worklet';
      translateX.value = 0;
      translateY.value = 0;
      swipeAnimating.value = false;
      coachPeekX.value = 0;
      flipPeek.value = 0;
    })();
    translateX.value = 0;
    translateY.value = 0;
    swipeAnimating.value = false;
    coachPeekX.value = 0;
    flipPeek.value = 0;
    setFlipped(false);

    if (intent === 'forward' || intent === 'backwardGesture') {
      enterX.value = 0;
      enterR.value = 0;
    } else if (intent === 'backward') {
      enterX.value = -ENTER_OFFSET_PX;
      enterR.value = -ENTER_ROTATION_DEG;
      enterX.value = withTiming(0, { duration: 220 });
      enterR.value = withTiming(0, { duration: 220 });
    } else {
      enterX.value = 0;
      enterR.value = 0;
    }
    // Also when showDeckStatus toggles (e.g. deck loading UI) without index change — forward swipe from last
    // left translateX/Y off-screen; reset so the status card is visible and not stuck on blue background.
  }, [currentIndex, showDeckStatus]);

  // Clear overlay/behind locks + suppression after paint so Reanimated and native have applied translateX = 0
  // before we drop the lock (same cadence as swipe-right path).
  useEffect(() => {
    setReturnOverlayLockedIndex(null);
    setBehindLockedIndex(null);
    returnOverlaySuppressSV.value = 0;
    behindPeekSuppressSV.value = 0;
  }, [currentIndex, showDeckStatus]);

  const commitSwipeLeft = useCallback(() => {
    noteSwiped();
    const ctx = analyticsContextForIndex(currentIndexRef.current);
    if (ctx) trackSwipe('left', ctx);
    navIntentRef.current = 'forward';
    onSwipeLeft();
  }, [analyticsContextForIndex, noteSwiped, onSwipeLeft]);

  const commitSwipeVertical = useCallback(
    (direction: 'up' | 'down') => {
      noteSwiped();
      const ctx = analyticsContextForIndex(currentIndexRef.current);
      if (ctx) {
        const complexityAfter = clampComplexity(
          complexityRef.current + (direction === 'up' ? 1 : -1),
        );
        trackSwipe(direction, { ...ctx, complexity_after: complexityAfter });
      }
      navIntentRef.current = 'forward';
      onSwipeForwardVertical(direction);
    },
    [analyticsContextForIndex, noteSwiped, onSwipeForwardVertical],
  );

  const commitSwipeRight = useCallback(() => {
    noteSwiped();
    const ctx = analyticsContextForIndex(currentIndexRef.current);
    if (ctx) trackSwipe('right', ctx);
    // Gesture already animated the previous card into place; do not replay backward enter on index change.
    navIntentRef.current = 'backwardGesture';
    onSwipeRight();
  }, [analyticsContextForIndex, noteSwiped, onSwipeRight]);

  const toggleFlip = useCallback(() => {
    const wasFlipped = flippedRef.current;
    const next = !wasFlipped;
    const item = conceptsRef.current[currentIndexRef.current];
    if (item && !showDeckStatusRef.current) {
      if (next) {
        noteFlipped();
        flushDwell('back', item.concept, currentIndexRef.current);
        trackCardBackView({
          concept: item.concept,
          locale: getActiveLocale(),
          complexity: complexityRef.current,
          index: currentIndexRef.current,
        });
      } else {
        flushDwell('front', item.concept, currentIndexRef.current);
        trackCardView({
          concept: item.concept,
          locale: getActiveLocale(),
          complexity: complexityRef.current,
          index: currentIndexRef.current,
          face: 'front',
        });
      }
    }
    setFlipped(next);
  }, [flushDwell, noteFlipped]);

  const lockReturnOverlayIndexForRightCommit = useCallback(() => {
    const i = currentIndexRef.current - 1;
    if (i >= 0) setReturnOverlayLockedIndex(i);
  }, []);

  const lockBehindIndexForLeftCommit = useCallback(() => {
    const i = currentIndexRef.current;
    const next = Math.min(i + 1, concepts.length - 1);
    if (next !== i) setBehindLockedIndex(next);
  }, [concepts.length]);

  const cancelCoachPeek = () => {
    'worklet';
    coachPeekX.value = 0;
    flipPeek.value = 0;
  };

  const tap = Gesture.Tap()
    .maxDistance(14)
    .onEnd(() => {
      if (swipeAnimating.value) return;
      cancelCoachPeek();
      runOnJS(noteInteraction)();
      runOnJS(toggleFlip)();
    });

  const panX = Gesture.Pan()
    .activeOffsetX([-PAN_ACTIVE_OFFSET, PAN_ACTIVE_OFFSET])
    .failOffsetY([-PAN_ACTIVE_OFFSET, PAN_ACTIVE_OFFSET])
    .onStart(() => {
      translateY.value = 0;
      cancelCoachPeek();
      runOnJS(noteInteraction)();
    })
    .onUpdate((e: { translationX: number }) => {
      if (swipeAnimating.value) return;
      let tx = e.translationX;
      if (canSwipeRightSV.value === 0 && tx > 0) tx = 0;
      if (showDeckStatusSV.value === 1 && tx < 0) tx = 0;
      translateX.value = tx;
    })
    .onEnd(
      (e: {
        translationX: number;
        translationY: number;
        velocityX: number;
        velocityY: number;
      }) => {
        if (swipeAnimating.value) return;
        const goLeft = e.translationX < -SWIPE_THRESHOLD || e.velocityX < -180;
        const goRight = e.translationX > SWIPE_THRESHOLD || e.velocityX > 180;

        if (goLeft) {
          if (showDeckStatusSV.value === 1) {
            translateX.value = withSpring(0, springConfig);
            return;
          }
          swipeAnimating.value = true;
          runOnJS(lockBehindIndexForLeftCommit)();
          const w = Math.max(1, cardWidthSV.value);
          const target = -(w + 120);
          translateX.value = withTiming(target, { duration: SWIPE_LEFT_COMMIT_DURATION_MS }, (finished) => {
            if (finished) {
              runOnJS(commitSwipeLeft)();
            }
          });
          return;
        }
        if (goRight) {
          if (canSwipeRightSV.value === 0) {
            translateX.value = withSpring(0, springConfig);
            return;
          }
          swipeAnimating.value = true;
          runOnJS(lockReturnOverlayIndexForRightCommit)();
          const w = Math.max(1, cardWidthSV.value);
          translateX.value = withTiming(w, { duration: SWIPE_RIGHT_COMMIT_DURATION_MS }, (finished) => {
            if (finished) {
              runOnJS(commitSwipeRight)();
            }
          });
          return;
        }
        translateX.value = withSpring(0, springConfig);
      },
    );

  const panY = Gesture.Pan()
    .activeOffsetY([-PAN_ACTIVE_OFFSET, PAN_ACTIVE_OFFSET])
    .failOffsetX([-PAN_ACTIVE_OFFSET, PAN_ACTIVE_OFFSET])
    .onStart(() => {
      translateX.value = 0;
      cancelCoachPeek();
      runOnJS(noteInteraction)();
    })
    .onUpdate((e: { translationY: number }) => {
      if (swipeAnimating.value) return;
      if (showDeckStatusSV.value === 1) {
        translateY.value = 0;
        return;
      }
      translateY.value = e.translationY;
    })
    .onEnd(
      (e: {
        translationX: number;
        translationY: number;
        velocityX: number;
        velocityY: number;
      }) => {
        if (swipeAnimating.value) return;
        const goUp = e.translationY < -SWIPE_THRESHOLD || e.velocityY < -SWIPE_VELOCITY_Y;
        const goDown = e.translationY > SWIPE_THRESHOLD || e.velocityY > SWIPE_VELOCITY_Y;
        if (!goUp && !goDown) {
          translateY.value = withSpring(0, springConfig);
          return;
        }
        let direction: 'up' | 'down';
        if (goUp && goDown) {
          direction = e.velocityY < 0 || (e.velocityY === 0 && e.translationY < 0) ? 'up' : 'down';
        } else if (goUp) {
          direction = 'up';
        } else {
          direction = 'down';
        }

        if (showDeckStatusSV.value === 1) {
          translateY.value = withSpring(0, springConfig);
          return;
        }
        swipeAnimating.value = true;
        runOnJS(lockBehindIndexForLeftCommit)();
        const h = Math.max(1, cardHeightSV.value);
        const target = direction === 'up' ? -(h + 140) : h + 140;
        translateY.value = withTiming(target, { duration: SWIPE_VERTICAL_COMMIT_DURATION_MS }, (finished) => {
          if (finished) {
            runOnJS(commitSwipeVertical)(direction);
          }
        });
      },
    );

  const composed = showDeckStatus
    ? Gesture.Exclusive(panX, panY)
    : flipped
      ? Gesture.Exclusive(tap, panX)
      : Gesture.Exclusive(tap, panX, panY);

  /** Current / top-of-deck card — horizontal forward: tilt + X; vertical forward: Y only. */
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const w = Math.max(1, cardWidthSV.value);
    const h = cardHeightSV.value;
    const ty = translateY.value;
    const peekX = coachPeekX.value;
    if (Math.abs(ty) > 0.5) {
      return {
        transform: [{ translateX: enterX.value + peekX }, { translateY: ty }],
      };
    }
    const tx = (translateX.value < 0 ? translateX.value : 0) + peekX;
    const rotBase =
      tx < 0
        ? Math.max(
            -MAX_ROTATION_DEG,
            Math.min(MAX_ROTATION_DEG, (tx / Math.max(1, w / 2)) * MAX_ROTATION_DEG),
          )
        : 0;
    const rot = rotBase + enterR.value;
    return {
      transform: [
        { translateX: enterX.value + tx },
        { translateY: h / 2 },
        { rotateZ: `${rot}deg` },
        { translateY: -h / 2 },
      ],
    };
  });

  /**
   * Previous card sliding in from the left ON TOP when swiping right.
   * Same pivot + rotation sign as the backward enter animation (bottom-center, small negative tilt → 0).
   * Horizontal motion is the full drag; commit uses backwardGesture so we do not replay enter timing.
   */
  const returnOverlayStyle = useAnimatedStyle(() => {
    const w = Math.max(1, cardWidthSV.value);
    const h = cardHeightSV.value;
    const active = translateX.value > 0;
    const suppressed = returnOverlaySuppressSV.value > 0.5;
    const tx = active ? -w + translateX.value : -w;
    const p = active ? Math.min(1, translateX.value / w) : 0;
    const rot = active ? -ENTER_ROTATION_DEG * (1 - p) : 0;
    const baseOpacity = active && !suppressed ? 1 : 0;
    return {
      opacity: baseOpacity,
      transform: [
        { translateX: tx },
        { translateY: h / 2 },
        { rotateZ: `${rot}deg` },
        { translateY: -h / 2 },
      ],
    };
  });

  /** Name kept as behindFadeStyle for stable references; hides peek via translateX (not opacity) to avoid compositor flash. */
  const behindFadeStyle = useAnimatedStyle(() => {
    const suppressed = behindPeekSuppressSV.value > 0.5;
    const hideForRightSwipe = translateX.value > 0;
    const hide = suppressed || hideForRightSwipe;
    return {
      transform: [{ translateX: hide ? BEHIND_PEEK_OFFSCREEN_X : 0 }],
    };
  });

  if (concepts.length === 0) return null;

  const nextIndex = Math.min(currentIndex + 1, concepts.length - 1);
  const behindDisplayIndex =
    behindLockedIndex !== null ? behindLockedIndex : nextIndex;
  // Do not require behindDisplayIndex !== currentIndex: when the next card becomes the front, that equality
  // would unmount the behind layer while the front updates to the same item — duplicate mount churn = blink.
  // Behind stays under the front (z-index); duplicate content is invisible but keeps one ConceptCard instance stable.
  const showBehindNext =
    !showDeckStatus && behindDisplayIndex >= 0 && behindDisplayIndex < concepts.length;
  const prevIndex = currentIndex - 1;
  const returnOverlayIndex =
    returnOverlayLockedIndex !== null ? returnOverlayLockedIndex : prevIndex >= 0 ? prevIndex : -1;
  const showReturnOverlay =
    !showDeckStatus &&
    returnOverlayIndex >= 0 &&
    (currentIndex > 0 || returnOverlayLockedIndex !== null);

  return (
    <View
      style={styles.outer}
      onLayout={(e) => {
        setContainerW(e.nativeEvent.layout.width);
      }}
    >
      <GestureDetector gesture={composed}>
        <View style={[styles.cardWrap, { height: cardAreaHeight }]}>
          {showBehindNext ? (
            <Animated.View style={[styles.behindWrap, behindFadeStyle]} pointerEvents="none">
              <ConceptCardForIndex
                concepts={concepts}
                currentIndex={behindDisplayIndex}
                flipped={false}
                preloadedMediaUrls={preloadedMediaUrls}
              />
              <View style={styles.behindOverlay} pointerEvents="none" />
            </Animated.View>
          ) : null}

          <Animated.View
            key={showDeckStatus ? `deck-${deckStatusVariant}-${currentIndex}` : 'front-card'}
            style={[styles.frontWrap, frontAnimatedStyle]}
          >
            {showDeckStatus ? (
              <DeckStatusCard
                variant={deckStatusVariant}
                onRetry={loadMoreError ? onRetryLoadMore : undefined}
              />
            ) : (
              <ConceptCardForIndex
                concepts={concepts}
                currentIndex={currentIndex}
                flipped={flipped}
                preloadedMediaUrls={preloadedMediaUrls}
                coachHint={coach ? t(coachMessageKey(coach)) : null}
                animateCoachAppear={peekEnabled}
                flipPeek={flipPeek}
              />
            )}
          </Animated.View>

          {showReturnOverlay ? (
            <Animated.View style={[styles.returnOverlay, returnOverlayStyle]} pointerEvents="none">
              <ConceptCardForIndex
                concepts={concepts}
                currentIndex={returnOverlayIndex}
                flipped={false}
                preloadedMediaUrls={preloadedMediaUrls}
              />
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

function ConceptCardForIndex({
  concepts,
  currentIndex,
  flipped,
  preloadedMediaUrls,
  coachHint,
  animateCoachAppear,
  flipPeek,
}: {
  concepts: ConceptItem[];
  currentIndex: number;
  flipped: boolean;
  preloadedMediaUrls: ReadonlySet<string>;
  coachHint?: string | null;
  animateCoachAppear?: boolean;
  flipPeek?: SharedValue<number>;
}) {
  const item = concepts[currentIndex]!;
  const mediaUri = displayMediaUrl(item.mediaUrl, Platform.OS, resolveApiBaseUrl());
  const isMediaPrefetched = mediaUri !== '' && preloadedMediaUrls.has(mediaUri);
  return (
    <ConceptCard
      item={item}
      flipped={flipped}
      isMediaPrefetched={isMediaPrefetched}
      coachHint={coachHint}
      animateCoachAppear={animateCoachAppear}
      flipPeek={flipPeek}
    />
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 8,
    justifyContent: 'flex-start',
  },
  cardWrap: {
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  /** Same size as front (no scale) so the next card never “grows” when it becomes the top card. Depth reads from the tint overlay only. */
  behindWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  behindOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(19,91,119,0.10)',
  },
  frontWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  returnOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
  },
});
