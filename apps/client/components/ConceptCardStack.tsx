import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  type AccessibilityActionEvent,
  type AppStateStatus,
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { ConceptCard } from './ConceptCard';
import { DeckStatusCard } from './DeckStatusCard';
import { LoadingCard } from './LoadingCard';
import { useDiscoveryCoaching } from '@/hooks/useDiscoveryCoaching';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  trackCardBackView,
  trackCardView,
  trackCardViewTime,
  trackSwipe,
  type CardFace,
} from '@/lib/analytics';
import type { ConceptItem } from '@/lib/api';
import { resolveApiBaseUrl } from '@/lib/apiBaseUrl';
import {
  buildCardAccessibilityActions,
  canRunCardAction,
  cardSurfaceIsAccessibleButton,
  cardWebTabIndex,
  ensureA11yFocusRingStyles,
  resolveRunnableAccessibilityAction,
  shouldHandleCardSurfaceKey,
  cardActionFromKey,
  complexityDirectionForAction,
  type CardAction,
} from '@/lib/cardActions';
import {
  SWIPE_EASING,
  SWIPE_RETURN_MS,
  cardSwipeFrontTransform,
  cardSwipeReturnOverlayTransform,
  swipeCommitDirection,
  swipeCommitDurationMs,
  swipeShouldSlideOutOnCommit,
} from '@/lib/cardSwipe';
import { clampComplexity } from '@/lib/complexityStorage';
import { deckSettleDurationMs, deckSettleEnterShiftPx } from '@/lib/deckSettle';
import {
  resolveNavSettleIntent,
  returnOverlayIndexForEndLoading,
} from '@/lib/deckSlotState';
import { coachMessageKey } from '@/lib/discoveryCoaching';
import { isFlipSuppressed, suppressUntil } from '@/lib/flipSuppress';
import { getActiveLocale, t } from '@/lib/i18n';
import { CARD_STACK_PADDING_TOP } from '@/lib/lateralityChrome';
import { displayMediaUrl } from '@/lib/remoteImage';

export type ConceptCardStackHandle = {
  /** Run a non-swipe action through the same commit path as gestures. */
  runAction: (action: CardAction) => void;
};

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
  /** Initial empty-deck quiet silhouette (Lz-35) — shell + control stay up. */
  showInitialLoading?: boolean;
  loadMoreError: boolean;
  onRetryLoadMore: () => void;
  /** Ignore keyboard / a11y card actions while a sheet is open. */
  sheetOpen?: boolean;
  /** Lz-32: bind app-menu Replay to the coaching hook’s reset+refresh. */
  onReplayGestureTipsReady?: (replay: () => void) => void;
  /** Lz-48: tip chip lives in the shell control region (parent), not on the card. */
  onCoachTipChange?: (
    tip: {
      text: string;
      animateAppear: boolean;
      onDismiss: () => void;
    } | null,
  ) => void;
};

const PAN_ACTIVE_OFFSET = 18;
/** Move behind peek off-screen instead of opacity:0 — opacity toggles caused a sibling alpha compositor flash on handoff. */
const BEHIND_PEEK_OFFSCREEN_X = -4096;
const CARD_ASPECT = 1.4;

export const ConceptCardStack = forwardRef<ConceptCardStackHandle, ConceptCardStackProps>(function ConceptCardStack({
  concepts,
  currentIndex,
  complexity,
  onSwipeLeft,
  onSwipeRight,
  onSwipeForwardVertical,
  availableHeight,
  preloadedMediaUrls,
  showDeckLoading,
  showInitialLoading = false,
  loadMoreError,
  onRetryLoadMore,
  sheetOpen = false,
  onReplayGestureTipsReady,
  onCoachTipChange,
}, ref) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const enterX = useSharedValue(0);
  const enterOpacity = useSharedValue(1);
  /** Multiplies front opacity during RM commit cross-fade (1 → 0). */
  const frontCommitOpacity = useSharedValue(1);
  /** Peer (behind / return overlay) opacity during RM commit cross-fade (0 → 1). */
  const peerCommitOpacity = useSharedValue(0);
  const swipeAnimating = useSharedValue(false);
  const canSwipeRightSV = useSharedValue(0);
  const showDeckStatusSV = useSharedValue(0);
  const cardWidthSV = useSharedValue(360);
  const cardHeightSV = useSharedValue(400);
  /** 1 = force return overlay invisible (avoids one frame where React cleared the lock but UI thread still had translateX > 0). */
  const returnOverlaySuppressSV = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);
  const [containerW, setContainerW] = useState<number>(0);
  const reduceMotion = useReducedMotion();
  const reduceMotionSV = useSharedValue(reduceMotion ? 1 : 0);
  /** While swipe-right commit runs, pin overlay to this index so it doesn't jump when currentIndex updates before translateX resets. */
  const [returnOverlayLockedIndex, setReturnOverlayLockedIndex] = useState<number | null>(null);
  /** While swipe-left commit runs, pin behind card to this index (the “next” card under the front) before index advances. */
  const [behindLockedIndex, setBehindLockedIndex] = useState<number | null>(null);
  const currentIndexRef = useRef(currentIndex);
  const navIntentRef = useRef<'forward' | 'backward' | 'backwardGesture' | null>(null);
  /** Previous paint's deck-status flag — used to settle when loading clears without a swipe intent (Lz-36). */
  const wasDeckStatusRef = useRef(false);
  /** Index before the latest layout pass — pairs with wasDeckStatusRef for loading→card settle direction. */
  const loadingClearPrevIndexRef = useRef(currentIndex);
  const conceptsRef = useRef(concepts);
  const complexityRef = useRef(complexity);
  const flippedRef = useRef(flipped);
  const showDeckStatusRef = useRef(false);
  /** Ignore stack tap→flip briefly after wiki / credit press (AC: links must not flip). */
  const suppressFlipUntilRef = useRef(0);
  const dwellStartedAtRef = useRef<number>(Date.now());
  const dwellFaceRef = useRef<CardFace>('front');
  const dwellConceptRef = useRef<string | null>(null);
  const dwellIndexRef = useRef<number>(-1);
  const coachPeekX = useSharedValue(0);
  const flipPeek = useSharedValue(0);

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

  const sheetOpenRef = useRef(sheetOpen);
  useEffect(() => {
    sheetOpenRef.current = sheetOpen;
  }, [sheetOpen]);

  useEffect(() => {
    reduceMotionSV.value = reduceMotion ? 1 : 0;
  }, [reduceMotion, reduceMotionSV]);

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

  const {
    coach,
    animateAppear,
    noteInteraction,
    noteTapped,
    noteSwipedHorizontal,
    noteSwipedVertical,
    dismissTip,
    a11yHint,
    replayGestureTips,
  } = useDiscoveryCoaching({
    cardIndex: currentIndex,
    flipped: flipped || concepts.length === 0,
    deckStatus: showDeckStatus,
  });

  useEffect(() => {
    onReplayGestureTipsReady?.(replayGestureTips);
  }, [onReplayGestureTipsReady, replayGestureTips]);

  useEffect(() => {
    // §12.3: tips sit on the shell — never peek the card.
    coachPeekX.value = 0;
    flipPeek.value = 0;
  }, [coachPeekX, flipPeek]);

  useEffect(() => {
    if (coach == null) {
      onCoachTipChange?.(null);
      return;
    }
    onCoachTipChange?.({
      text: t(coachMessageKey(coach)),
      animateAppear,
      onDismiss: dismissTip,
    });
  }, [animateAppear, coach, dismissTip, onCoachTipChange]);

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
    // Lz-36: back from end-of-deck loading must work even on a single-card deck (index 0).
    canSwipeRightSV.value = currentIndex > 0 || showDeckStatus ? 1 : 0;
  }, [canSwipeRightSV, currentIndex, showDeckStatus]);

  useEffect(() => {
    showDeckStatusSV.value = showDeckStatus ? 1 : 0;
  }, [showDeckStatus, showDeckStatusSV]);

  // Layout effect: reset gesture + enter state before paint so the new top card never flashes with the
  // previous commit’s translateX (useEffect runs too late and causes a one-frame blink).
  useLayoutEffect(() => {
    // Lz-36: loading → concept without a swipe intent (append settle, or back cleared pending).
    const intent = resolveNavSettleIntent({
      navIntent: navIntentRef.current,
      wasDeckStatus: wasDeckStatusRef.current,
      showDeckStatus,
      prevIndex: loadingClearPrevIndexRef.current,
      index: currentIndex,
    });
    navIntentRef.current = null;

    wasDeckStatusRef.current = showDeckStatus;
    loadingClearPrevIndexRef.current = currentIndex;

    returnOverlaySuppressSV.value = 1;

    runOnUI(() => {
      'worklet';
      translateX.value = 0;
      translateY.value = 0;
      swipeAnimating.value = false;
      coachPeekX.value = 0;
      flipPeek.value = 0;
      frontCommitOpacity.value = 1;
      peerCommitOpacity.value = 0;
    })();
    translateX.value = 0;
    translateY.value = 0;
    swipeAnimating.value = false;
    coachPeekX.value = 0;
    flipPeek.value = 0;
    frontCommitOpacity.value = 1;
    peerCommitOpacity.value = 0;
    setFlipped(false);

    const rm = reduceMotionSV.value > 0.5;
    if (intent === 'forward' || intent === 'backward' || intent === 'backwardGesture') {
      // RM / backwardGesture: cross-fade or return overlay already completed — land settled.
      // Full motion: fade 0→1 + ±8 → 0 over settle token (260 ms; Lz-36 loading replace).
      if (rm || intent === 'backwardGesture') {
        enterX.value = 0;
        enterOpacity.value = 1;
      } else {
        const forward = intent === 'forward';
        const shift = deckSettleEnterShiftPx(false, forward);
        const duration = deckSettleDurationMs(false);
        enterX.value = shift;
        enterOpacity.value = 0;
        enterX.value = withTiming(0, { duration, easing: SWIPE_EASING });
        enterOpacity.value = withTiming(1, { duration, easing: SWIPE_EASING });
      }
    } else {
      enterX.value = 0;
      enterOpacity.value = 1;
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
  }, [currentIndex, showDeckStatus]);

  const commitSwipeLeft = useCallback(() => {
    noteSwipedHorizontal();
    const ctx = analyticsContextForIndex(currentIndexRef.current);
    if (ctx) trackSwipe('left', ctx);
    navIntentRef.current = 'forward';
    onSwipeLeft();
  }, [analyticsContextForIndex, noteSwipedHorizontal, onSwipeLeft]);

  const commitSwipeVertical = useCallback(
    (direction: 'up' | 'down') => {
      noteSwipedVertical();
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
    [analyticsContextForIndex, noteSwipedVertical, onSwipeForwardVertical],
  );

  const commitSwipeRight = useCallback(() => {
    noteSwipedHorizontal();
    const ctx = analyticsContextForIndex(currentIndexRef.current);
    if (ctx) trackSwipe('right', ctx);
    // Lz-36: back from end-of-deck loading has no return-overlay peer — settle the revealed card.
    // Normal backtrack: gesture already animated the previous card; skip enter replay.
    navIntentRef.current = resolveNavSettleIntent({
      navIntent: null,
      wasDeckStatus: wasDeckStatusRef.current,
      showDeckStatus: showDeckStatusRef.current,
      prevIndex: loadingClearPrevIndexRef.current,
      index: currentIndexRef.current,
      commitFromStatus: showDeckStatusRef.current,
    });
    onSwipeRight();
  }, [analyticsContextForIndex, noteSwipedHorizontal, onSwipeRight]);

  const noteBackInteractivePress = useCallback(() => {
    suppressFlipUntilRef.current = suppressUntil(Date.now());
  }, []);

  // RNGH Tap owns the card surface on web and can steal presses from RN Text.
  // Capture-phase pointerdown on wiki arms the suppress window before Tap.onEnd.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onPointerDownCapture = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-testid="card-back-wikipedia"]')) {
        noteBackInteractivePress();
      }
    };
    document.addEventListener('pointerdown', onPointerDownCapture, true);
    return () => document.removeEventListener('pointerdown', onPointerDownCapture, true);
  }, [noteBackInteractivePress]);

  const toggleFlip = useCallback(() => {
    if (isFlipSuppressed(Date.now(), suppressFlipUntilRef.current)) return;
    const wasFlipped = flippedRef.current;
    const next = !wasFlipped;
    const item = conceptsRef.current[currentIndexRef.current];
    if (item && !showDeckStatusRef.current) {
      if (next) {
        noteTapped();
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
  }, [flushDwell, noteTapped]);

  const lockReturnOverlayIndexForRightCommit = useCallback(() => {
    const i = currentIndexRef.current - 1;
    if (i >= 0) setReturnOverlayLockedIndex(i);
  }, []);

  const lockBehindIndexForLeftCommit = useCallback(() => {
    const i = currentIndexRef.current;
    const next = Math.min(i + 1, concepts.length - 1);
    if (next !== i) setBehindLockedIndex(next);
  }, [concepts.length]);

  const actionGate = useCallback(
    () => ({
      currentIndex: currentIndexRef.current,
      sheetOpen: sheetOpenRef.current,
      animating: swipeAnimating.value,
      showDeckStatus: showDeckStatusRef.current,
    }),
    [swipeAnimating],
  );

  /** Animate then call the same commit* helpers gestures use (respects Lz-34 RM). */
  const animateThenCommit = useCallback(
    (kind: 'next' | 'previous' | 'complexityUp' | 'complexityDown') => {
      if (swipeAnimating.value) return;
      swipeAnimating.value = true;
      coachPeekX.value = 0;
      flipPeek.value = 0;
      const rm = reduceMotion;
      const commitMs = swipeCommitDurationMs(rm);
      const slide = swipeShouldSlideOutOnCommit(rm);

      if (kind === 'previous') {
        lockReturnOverlayIndexForRightCommit();
        if (!slide) {
          translateX.value = 0;
          translateY.value = 0;
          frontCommitOpacity.value = 1;
          peerCommitOpacity.value = 0;
          frontCommitOpacity.value = withTiming(0, { duration: commitMs, easing: SWIPE_EASING });
          peerCommitOpacity.value = withTiming(1, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
            if (finished) runOnJS(commitSwipeRight)();
          });
          return;
        }
        const w = Math.max(1, cardWidthSV.value);
        translateX.value = withTiming(w, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
          if (finished) runOnJS(commitSwipeRight)();
        });
        return;
      }

      lockBehindIndexForLeftCommit();
      if (kind === 'next') {
        if (!slide) {
          translateX.value = 0;
          translateY.value = 0;
          frontCommitOpacity.value = 1;
          peerCommitOpacity.value = 0;
          frontCommitOpacity.value = withTiming(0, { duration: commitMs, easing: SWIPE_EASING });
          peerCommitOpacity.value = withTiming(1, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
            if (finished) runOnJS(commitSwipeLeft)();
          });
          return;
        }
        const w = Math.max(1, cardWidthSV.value);
        translateX.value = withTiming(-(w + 120), { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
          if (finished) runOnJS(commitSwipeLeft)();
        });
        return;
      }

      const vertical = complexityDirectionForAction(kind);
      if (!slide) {
        translateX.value = 0;
        translateY.value = 0;
        frontCommitOpacity.value = 1;
        peerCommitOpacity.value = 0;
        frontCommitOpacity.value = withTiming(0, { duration: commitMs, easing: SWIPE_EASING });
        peerCommitOpacity.value = withTiming(1, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
          if (finished) runOnJS(commitSwipeVertical)(vertical);
        });
        return;
      }
      const h = Math.max(1, cardHeightSV.value);
      const target = vertical === 'up' ? -(h + 140) : h + 140;
      translateY.value = withTiming(target, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
        if (finished) runOnJS(commitSwipeVertical)(vertical);
      });
    },
    [
      commitSwipeLeft,
      commitSwipeRight,
      commitSwipeVertical,
      lockBehindIndexForLeftCommit,
      lockReturnOverlayIndexForRightCommit,
      reduceMotion,
      cardWidthSV,
      cardHeightSV,
      coachPeekX,
      flipPeek,
      frontCommitOpacity,
      peerCommitOpacity,
      swipeAnimating,
      translateX,
      translateY,
    ],
  );

  const runAction = useCallback(
    (action: CardAction) => {
      if (!canRunCardAction(action, actionGate())) return;
      noteInteraction();
      if (action === 'flip') {
        toggleFlip();
        return;
      }
      animateThenCommit(action);
    },
    [actionGate, animateThenCommit, noteInteraction, toggleFlip],
  );

  useImperativeHandle(ref, () => ({ runAction }), [runAction]);

  const activeLocale = getActiveLocale();
  const accessibilityActions = useMemo(
    () => buildCardAccessibilityActions(t),
    // Labels must refresh when the catalog locale switches.
    [activeLocale, currentIndex, showDeckStatus],
  );

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const action = resolveRunnableAccessibilityAction(
        event.nativeEvent.actionName,
        actionGate(),
      );
      if (action == null) return;
      runAction(action);
    },
    [actionGate, runAction],
  );

  const onCardKeyDown = useCallback(
    (event: NativeSyntheticEvent<{ key: string }>) => {
      const domEvent = event as unknown as {
        target?: EventTarget | null;
        currentTarget?: EventTarget | null;
        preventDefault?: () => void;
      };
      // Nested controls (back-face Wikipedia link) must keep Enter/Space.
      if (!shouldHandleCardSurfaceKey(domEvent.target, domEvent.currentTarget)) {
        return;
      }
      const key = event.nativeEvent.key;
      const action = cardActionFromKey(key);
      if (action == null) return;
      domEvent.preventDefault?.();
      runAction(action);
    },
    [runAction],
  );

  useLayoutEffect(() => {
    if (Platform.OS === 'web') ensureA11yFocusRingStyles();
  }, []);

  const webCardFocusProps =
    Platform.OS === 'web'
      ? ({
          tabIndex: cardWebTabIndex({
            sheetOpen,
            showDeckStatus,
            currentIndex,
          }),
          onKeyDown: onCardKeyDown,
        } as Record<string, unknown>)
      : {};

  const surfaceIsButton = cardSurfaceIsAccessibleButton({
    showDeckStatus,
    flipped,
  });

  const cancelCoachPeek = () => {
    'worklet';
    coachPeekX.value = 0;
    flipPeek.value = 0;
  };

  // maxDeltaY so a vertical ScrollView drag on the back fails the tap (no accidental flip).
  const tap = Gesture.Tap()
    .maxDistance(14)
    .maxDeltaY(10)
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
        const w = Math.max(1, cardWidthSV.value);
        const direction = swipeCommitDirection(e.translationX, e.velocityX, w);
        const rm = reduceMotionSV.value > 0.5;
        const commitMs = swipeCommitDurationMs(rm);

        if (direction < 0) {
          if (showDeckStatusSV.value === 1) {
            translateX.value = withTiming(0, {
              duration: SWIPE_RETURN_MS,
              easing: SWIPE_EASING,
            });
            return;
          }
          swipeAnimating.value = true;
          runOnJS(lockBehindIndexForLeftCommit)();
          if (!swipeShouldSlideOutOnCommit(rm)) {
            // RM: snap drag, cross-fade outgoing → incoming (no slide-out / no 8 px shift).
            translateX.value = 0;
            frontCommitOpacity.value = 1;
            peerCommitOpacity.value = 0;
            frontCommitOpacity.value = withTiming(0, { duration: commitMs, easing: SWIPE_EASING });
            peerCommitOpacity.value = withTiming(1, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
              if (finished) runOnJS(commitSwipeLeft)();
            });
            return;
          }
          const target = -(w + 120);
          translateX.value = withTiming(target, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
            if (finished) runOnJS(commitSwipeLeft)();
          });
          return;
        }
        if (direction > 0) {
          if (canSwipeRightSV.value === 0) {
            translateX.value = withTiming(0, {
              duration: SWIPE_RETURN_MS,
              easing: SWIPE_EASING,
            });
            return;
          }
          // Lz-36: back from loading — slide/fade the silhouette away; no return-overlay mount
          // (mounting a peer ConceptCard under LoadingCard raced peerCommitOpacity and flaked
          // deck-status-line vs laterality-rail bbox asserts in Client E2E).
          if (showDeckStatusSV.value === 1) {
            swipeAnimating.value = true;
            if (!swipeShouldSlideOutOnCommit(rm)) {
              translateX.value = 0;
              frontCommitOpacity.value = 1;
              peerCommitOpacity.value = 0;
              frontCommitOpacity.value = withTiming(0, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
                if (finished) runOnJS(commitSwipeRight)();
              });
              return;
            }
            translateX.value = withTiming(w, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
              if (finished) runOnJS(commitSwipeRight)();
            });
            return;
          }
          swipeAnimating.value = true;
          runOnJS(lockReturnOverlayIndexForRightCommit)();
          if (!swipeShouldSlideOutOnCommit(rm)) {
            translateX.value = 0;
            frontCommitOpacity.value = 1;
            peerCommitOpacity.value = 0;
            frontCommitOpacity.value = withTiming(0, { duration: commitMs, easing: SWIPE_EASING });
            peerCommitOpacity.value = withTiming(1, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
              if (finished) runOnJS(commitSwipeRight)();
            });
            return;
          }
          translateX.value = withTiming(w, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
            if (finished) runOnJS(commitSwipeRight)();
          });
          return;
        }
        translateX.value = withTiming(0, {
          duration: SWIPE_RETURN_MS,
          easing: SWIPE_EASING,
        });
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
        const h = Math.max(1, cardHeightSV.value);
        const direction = swipeCommitDirection(e.translationY, e.velocityY, h);
        if (direction === 0) {
          translateY.value = withTiming(0, {
            duration: SWIPE_RETURN_MS,
            easing: SWIPE_EASING,
          });
          return;
        }
        const vertical: 'up' | 'down' = direction < 0 ? 'up' : 'down';

        if (showDeckStatusSV.value === 1) {
          translateY.value = withTiming(0, {
            duration: SWIPE_RETURN_MS,
            easing: SWIPE_EASING,
          });
          return;
        }
        swipeAnimating.value = true;
        runOnJS(lockBehindIndexForLeftCommit)();
        const rm = reduceMotionSV.value > 0.5;
        const commitMs = swipeCommitDurationMs(rm);
        if (!swipeShouldSlideOutOnCommit(rm)) {
          translateY.value = 0;
          frontCommitOpacity.value = 1;
          peerCommitOpacity.value = 0;
          frontCommitOpacity.value = withTiming(0, { duration: commitMs, easing: SWIPE_EASING });
          peerCommitOpacity.value = withTiming(1, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
            if (finished) runOnJS(commitSwipeVertical)(vertical);
          });
          return;
        }
        const target = vertical === 'up' ? -(h + 140) : h + 140;
        translateY.value = withTiming(target, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
          if (finished) runOnJS(commitSwipeVertical)(vertical);
        });
      },
    );

  const composed = showDeckStatus
    ? Gesture.Exclusive(panX, panY)
    : flipped
      ? Gesture.Exclusive(tap, panX)
      : Gesture.Exclusive(tap, panX, panY);

  /** Current / top-of-deck card — translate only (quiet 1:1 drag). */
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const ty = translateY.value;
    const peekX = coachPeekX.value;
    const tx = (translateX.value < 0 ? translateX.value : 0) + peekX;
    const x = enterX.value + tx;
    return {
      opacity: enterOpacity.value * frontCommitOpacity.value,
      transform: cardSwipeFrontTransform(x, ty),
    };
  });

  /** Preload peer — invisible except during RM commit cross-fade. */
  const behindAnimatedStyle = useAnimatedStyle(() => {
    const peer = peerCommitOpacity.value;
    const showForRm = reduceMotionSV.value > 0.5 && peer > 0.001;
    return {
      opacity: showForRm ? peer : 0,
      transform: [{ translateX: showForRm ? 0 : BEHIND_PEEK_OFFSCREEN_X }],
    };
  });

  /**
   * Previous card sliding in from the left ON TOP when swiping right.
   * Translate only; RM commit cross-fades in place via peerCommitOpacity.
   */
  const returnOverlayStyle = useAnimatedStyle(() => {
    const w = Math.max(1, cardWidthSV.value);
    const active = translateX.value > 0;
    const suppressed = returnOverlaySuppressSV.value > 0.5;
    const rmPeer = reduceMotionSV.value > 0.5 && peerCommitOpacity.value > 0.001;
    if (rmPeer) {
      return {
        opacity: suppressed ? 0 : peerCommitOpacity.value,
        transform: cardSwipeReturnOverlayTransform(0),
      };
    }
    const tx = active ? -w + translateX.value : -w;
    const baseOpacity = active && !suppressed ? 1 : 0;
    return {
      opacity: baseOpacity,
      transform: cardSwipeReturnOverlayTransform(tx),
    };
  });

  if (concepts.length === 0) {
    if (!showInitialLoading) return null;
    return (
      <View
        style={styles.outer}
        onLayout={(e) => {
          setContainerW(e.nativeEvent.layout.width);
        }}
      >
        <View style={[styles.cardWrap, { height: cardAreaHeight }]}>
          <View style={styles.gestureFill}>
            <View style={styles.frontWrap}>
              <LoadingCard />
            </View>
          </View>
        </View>
      </View>
    );
  }

  const nextIndex = Math.min(currentIndex + 1, concepts.length - 1);
  const behindDisplayIndex =
    behindLockedIndex !== null ? behindLockedIndex : nextIndex;
  // Do not require behindDisplayIndex !== currentIndex: when the next card becomes the front, that equality
  // would unmount the behind layer while the front updates to the same item — duplicate mount churn = blink.
  // Behind stays under the front (z-index); duplicate content is invisible but keeps one ConceptCard instance stable.
  const showBehindNext =
    !showDeckStatus && behindDisplayIndex >= 0 && behindDisplayIndex < concepts.length;
  const prevIndex = currentIndex - 1;
  // Under the loading silhouette the resting underlay is the current last card (not N-1).
  const restingUnderlayIndex = showDeckStatus
    ? returnOverlayIndexForEndLoading(currentIndex)
    : prevIndex >= 0
      ? prevIndex
      : -1;
  const returnOverlayIndex =
    returnOverlayLockedIndex !== null ? returnOverlayLockedIndex : restingUnderlayIndex;
  // Never mount return-overlay under the loading face at rest (Lz-36 back uses slide/fade + settle).
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
      <View style={[styles.cardWrap, { height: cardAreaHeight }]}>
        <GestureDetector gesture={composed}>
          <View style={styles.gestureFill}>
          {showBehindNext ? (
            <Animated.View
              style={[styles.behindWrap, behindAnimatedStyle]}
              pointerEvents="none"
              accessibilityElementsHidden
            >
              <ConceptCardForIndex
                concepts={concepts}
                currentIndex={behindDisplayIndex}
                flipped={false}
                reduceMotion={reduceMotion}
                preloadedMediaUrls={preloadedMediaUrls}
              />
            </Animated.View>
          ) : null}

          <Animated.View
            key={showDeckStatus ? `deck-${deckStatusVariant}-${currentIndex}` : 'front-card'}
            style={[styles.frontWrap, frontAnimatedStyle]}
          >
            <View
              style={styles.a11ySurface}
              testID="card-a11y-surface"
              accessible={surfaceIsButton}
              accessibilityRole={surfaceIsButton ? 'button' : undefined}
              accessibilityLabel={
                surfaceIsButton ? concepts[currentIndex]?.concept : undefined
              }
              accessibilityHint={
                a11yHint
                  ? t(coachMessageKey(a11yHint))
                  : surfaceIsButton
                    ? t('actionTurn')
                    : undefined
              }
              accessibilityActions={surfaceIsButton ? accessibilityActions : undefined}
              onAccessibilityAction={surfaceIsButton ? onAccessibilityAction : undefined}
              accessibilityState={{
                disabled: showDeckStatus || sheetOpen,
              }}
              {...webCardFocusProps}
            >
              {showDeckStatus ? (
                deckStatusVariant === 'loading' ? (
                  <LoadingCard />
                ) : (
                  <DeckStatusCard variant="error" onRetry={onRetryLoadMore} />
                )
              ) : (
                <ConceptCardForIndex
                  concepts={concepts}
                  currentIndex={currentIndex}
                  flipped={flipped}
                  reduceMotion={reduceMotion}
                  preloadedMediaUrls={preloadedMediaUrls}
                  flipPeek={flipPeek}
                  exposeFrontTitleTestId
                  onBackInteractivePress={noteBackInteractivePress}
                />
              )}
            </View>
          </Animated.View>

          {showReturnOverlay ? (
            <Animated.View
              style={[styles.returnOverlay, returnOverlayStyle]}
              pointerEvents="none"
            >
              <ConceptCardForIndex
                concepts={concepts}
                currentIndex={returnOverlayIndex}
                flipped={false}
                reduceMotion={reduceMotion}
                preloadedMediaUrls={preloadedMediaUrls}
              />
            </Animated.View>
          ) : null}
          </View>
        </GestureDetector>
      </View>
    </View>
  );
});

function ConceptCardForIndex({
  concepts,
  currentIndex,
  flipped,
  reduceMotion = false,
  preloadedMediaUrls,
  flipPeek,
  exposeFrontTitleTestId = false,
  onBackInteractivePress,
}: {
  concepts: ConceptItem[];
  currentIndex: number;
  flipped: boolean;
  reduceMotion?: boolean;
  preloadedMediaUrls: ReadonlySet<string>;
  flipPeek?: SharedValue<number>;
  exposeFrontTitleTestId?: boolean;
  onBackInteractivePress?: () => void;
}) {
  const item = concepts[currentIndex]!;
  const mediaUri = displayMediaUrl(item.mediaUrl, Platform.OS, resolveApiBaseUrl());
  const isMediaPrefetched = mediaUri !== '' && preloadedMediaUrls.has(mediaUri);
  return (
    <ConceptCard
      item={item}
      flipped={flipped}
      reduceMotion={reduceMotion}
      isMediaPrefetched={isMediaPrefetched}
      flipPeek={flipPeek}
      exposeFrontTitleTestId={exposeFrontTitleTestId}
      onBackInteractivePress={onBackInteractivePress}
    />
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    // Agreed exception (Lz-21 / Lz-24 AD): keep 12 here, not layout.screenGutter 16.
    // 16 narrows the front at 320 and regresses ES long-label title fit until Lz-26.
    // Screen gutter 16 applies to the control row; revisit after #84 lands title fit.
    paddingHorizontal: 12,
    paddingTop: CARD_STACK_PADDING_TOP,
    justifyContent: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
  },
  cardWrap: {
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  gestureFill: {
    ...StyleSheet.absoluteFillObject,
  },
  /** Flat preload peer — no depth tint; visibility driven by behindAnimatedStyle (Lz-33). */
  behindWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  frontWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  a11ySurface: {
    ...StyleSheet.absoluteFillObject,
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
