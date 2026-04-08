import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { ConceptCard } from './ConceptCard';
import { DeckStatusCard } from './DeckStatusCard';
import type { ConceptItem } from '@/lib/api';

type ConceptCardStackProps = {
  concepts: ConceptItem[];
  currentIndex: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  availableHeight: number;
  preloadedMediaUrls: ReadonlySet<string>;
  loadingMore: boolean;
  loadMoreError: boolean;
  onRetryLoadMore: () => void;
};

const SWIPE_THRESHOLD = 56;
const springConfig = { damping: 22, stiffness: 220 };
const PAN_ACTIVE_OFFSET = 18;
const MAX_ROTATION_DEG = 45;
const ENTER_OFFSET_PX = 72;
const ENTER_ROTATION_DEG = 14;
/** Smoothly seats the “return” card after swipe right; commit runs only after this finishes (no pre-reset of translateX). */
const SWIPE_RIGHT_COMMIT_DURATION_MS = 200;
/** Front card exits left before index advances; same pattern as swipe right. */
const SWIPE_LEFT_COMMIT_DURATION_MS = 200;
const CARD_ASPECT = 1.4;
/** Move behind peek off-screen instead of opacity:0 — opacity toggles caused a sibling alpha compositor flash on handoff. */
const BEHIND_PEEK_OFFSCREEN_X = -4096;

export function ConceptCardStack({
  concepts,
  currentIndex,
  onSwipeLeft,
  onSwipeRight,
  availableHeight,
  preloadedMediaUrls,
  loadingMore,
  loadMoreError,
  onRetryLoadMore,
}: ConceptCardStackProps) {
  const translateX = useSharedValue(0);
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

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const cardWidth = Math.max(0, containerW);
  const desiredCardHeight = cardWidth > 0 ? cardWidth * CARD_ASPECT : 0;
  const cardAreaHeight = Math.max(260, Math.min(availableHeight * 0.78, desiredCardHeight || availableHeight * 0.78));

  useEffect(() => {
    cardWidthSV.value = Math.max(1, cardWidth);
    cardHeightSV.value = cardAreaHeight;
  }, [cardAreaHeight, cardWidth, cardWidthSV, cardHeightSV]);

  const isLastCard = concepts.length > 0 && currentIndex === concepts.length - 1;
  const showDeckStatus = useMemo(
    () => isLastCard && (loadingMore || loadMoreError),
    [isLastCard, loadingMore, loadMoreError],
  );

  const deckStatusVariant = loadMoreError ? 'error' : 'loading';

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
      swipeAnimating.value = false;
    })();
    translateX.value = 0;
    swipeAnimating.value = false;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when deck index changes
  }, [currentIndex]);

  // Clear overlay/behind locks + suppression after paint so Reanimated and native have applied translateX = 0
  // before we drop the lock (same cadence as swipe-right path).
  useEffect(() => {
    setReturnOverlayLockedIndex(null);
    setBehindLockedIndex(null);
    returnOverlaySuppressSV.value = 0;
    behindPeekSuppressSV.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirror currentIndex layout reset
  }, [currentIndex]);

  const commitSwipeLeft = useCallback(() => {
    navIntentRef.current = 'forward';
    onSwipeLeft();
  }, [onSwipeLeft]);

  const commitSwipeRight = useCallback(() => {
    // Gesture already animated the previous card into place; do not replay backward enter on index change.
    navIntentRef.current = 'backwardGesture';
    onSwipeRight();
  }, [onSwipeRight]);

  const toggleFlip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  const lockReturnOverlayIndexForRightCommit = useCallback(() => {
    const i = currentIndexRef.current - 1;
    if (i >= 0) setReturnOverlayLockedIndex(i);
  }, []);

  const lockBehindIndexForLeftCommit = useCallback(() => {
    const i = currentIndexRef.current;
    const next = Math.min(i + 1, concepts.length - 1);
    if (next !== i) setBehindLockedIndex(next);
  }, [concepts.length]);

  const tap = Gesture.Tap()
    .maxDistance(14)
    .onEnd(() => {
      if (swipeAnimating.value) return;
      runOnJS(toggleFlip)();
    });

  const pan = Gesture.Pan()
    .activeOffsetX([-PAN_ACTIVE_OFFSET, PAN_ACTIVE_OFFSET])
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

  const composed = showDeckStatus ? pan : Gesture.Exclusive(tap, pan);

  /** Current / top-of-deck card — only moves & tilts when swiping left (forward). */
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const w = Math.max(1, cardWidthSV.value);
    const h = cardHeightSV.value;
    const tx = translateX.value < 0 ? translateX.value : 0;
    const rotBase =
      translateX.value < 0
        ? Math.max(
            -MAX_ROTATION_DEG,
            Math.min(MAX_ROTATION_DEG, (translateX.value / Math.max(1, w / 2)) * MAX_ROTATION_DEG),
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
}: {
  concepts: ConceptItem[];
  currentIndex: number;
  flipped: boolean;
  preloadedMediaUrls: ReadonlySet<string>;
}) {
  const item = concepts[currentIndex]!;
  const mediaUri = item.mediaUrl?.trim() ?? '';
  const isMediaPrefetched = mediaUri !== '' && preloadedMediaUrls.has(mediaUri);
  return <ConceptCard item={item} flipped={flipped} isMediaPrefetched={isMediaPrefetched} />;
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
