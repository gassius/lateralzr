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
  AccessibilityInfo,
  AppState,
  type AccessibilityActionEvent,
  type AppStateStatus,
  type NativeSyntheticEvent,
  findNodeHandle,
  PixelRatio,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { ConceptCard } from './ConceptCard';
import { LoadingCard } from './LoadingCard';
import { useConceptMediaPreload } from '@/hooks/useConceptMediaPreload';
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
import { CARD_STACK_GUTTER, cardRadius, resolveCardAspectLayout } from '@/lib/cardLayout';
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
  DECK_NEXT_VISIBLE_AT_REST,
  SWIPE_BACK_FACE_SCROLL_HANDOFF_PX,
  SWIPE_EASING,
  SWIPE_RETURN_SPRING,
  applyStartOfHistoryResistance,
  backFaceVerticalHandoffOrigin,
  cardCoveredScale,
  cardCoveredTint,
  cardSwipeFollowY,
  cardSwipeFrontTransform,
  cardSwipeAndroidLiftFill,
  cardSwipeLiftShadowPx,
  cardSwipeLiftShadowStyle,
  cardSwipeReturnOverlayTransform,
  cardSwipeTiltZDeg,
  cardSwipeTranslationAfterHandoff,
  deckBehindDisplayIndex,
  deckBehindLockIndexForRightDrag,
  deckCommitCrossfadeProgress,
  deckFrontWrapZIndex,
  deckLayerVisibility,
  deckPreviousCovering,
  deckReducedMotionFadesOutgoingFront,
  deckReducedMotionUnderlayPeer,
  deckReturnOverlayElevation,
  deckReturnOverlayOpacity,
  deckReturnOverlayTranslateX,
  deckReturnOverlayZIndex,
  deckUnderlayCommittedSideMatchesReveal,
  deckUnderlayDragProgress,
  deckUnderlayReveal,
  deckUnderlayTransform,
  swipeAxisProgress,
  swipeCommitDirection,
  swipeCommitDurationMs,
  swipeShouldSlideOutOnCommit,
} from '@/lib/cardSwipe';
import { flipDurationMs } from '@/lib/cardFlip';
import { clampComplexity } from '@/lib/complexityStorage';
import { deckEnterLandsSettled, deckSettleDurationMs, deckSettleEnterShiftPx } from '@/lib/deckSettle';
import {
  resolveNavSettleIntent,
  returnOverlayIndexForEndLoading,
} from '@/lib/deckSlotState';
import { coachMessageKey } from '@/lib/discoveryCoaching';
import { isFlipSuppressed, suppressUntil } from '@/lib/flipSuppress';
import { getActiveLocale, t } from '@/lib/i18n';
import { requestedMediaWidth, resolveCardMediaUrl } from '@/lib/remoteImage';
import { color } from '@/theme/tokens';

export type ConceptCardStackHandle = {
  /** Run a non-swipe action through the same commit path as gestures. */
  runAction: (action: CardAction) => void;
  /** Move AT / keyboard focus to the dealt card after a laterality reshuffle. */
  focusCard: () => void;
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
  /** End-of-deck loading silhouette — only when waiting for more (see HomeScreen). */
  showDeckLoading: boolean;
  /** Initial empty-deck quiet silhouette (Lz-35) — shell + control stay up. */
  showInitialLoading?: boolean;
  /** Lz-38: when true, keep the card face (failure/no-next live on DeckStatusLine). */
  loadMoreError: boolean;
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
  /** Lz-56: chrome lock + raise stack while dragging or exiting. */
  onDeckMotionChange?: (moving: boolean) => void;
  /** Lz-57: ignore card taps/swipes while the laterality cue is covering the wait. */
  inputLocked?: boolean;
};

const PAN_ACTIVE_OFFSET = 18;

function conceptTintRgba(alpha: number): string {
  'worklet';
  return `rgba(19,91,119,${alpha})`;
}

/** In-app RM cross-fade: do not let OS Reduce Motion skip the 150 ms timing. */
function rmCrossfadeTiming(duration: number) {
  'worklet';
  return {
    duration,
    easing: SWIPE_EASING,
    reduceMotion: ReduceMotion.Never,
  };
}

export const ConceptCardStack = forwardRef<ConceptCardStackHandle, ConceptCardStackProps>(function ConceptCardStack({
  concepts,
  currentIndex,
  complexity,
  onSwipeLeft,
  onSwipeRight,
  onSwipeForwardVertical,
  availableHeight,
  showDeckLoading,
  showInitialLoading = false,
  loadMoreError,
  sheetOpen = false,
  onReplayGestureTipsReady,
  onCoachTipChange,
  onDeckMotionChange,
  inputLocked = false,
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
  /** Lz-40: card finished settle enter — pulse may start. */
  const [cardSettled, setCardSettled] = useState(true);
  /** Lz-40: pan active — kill pulse within one frame. */
  const [pulseDragging, setPulseDragging] = useState(false);
  /** Lz-40: AppState active (stop when backgrounded). */
  const [appActive, setAppActive] = useState(
    () => AppState.currentState === 'active',
  );
  const reduceMotion = useReducedMotion();
  const reduceMotionSV = useSharedValue(reduceMotion ? 1 : 0);
  const flippedSV = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const exitingSV = useSharedValue(0);
  const exitProgressSV = useSharedValue(0);
  const releaseTiltZSV = useSharedValue(0);
  const exitSignSV = useSharedValue(0);
  /** 0 none, −1 next underlay, 1 previous overlay (RM commit cross-fade). */
  const rmPeerLayerSV = useSharedValue(0);
  /** 1 = JS already locked the underlay to Previous for this right drag. */
  const behindRightLockSV = useSharedValue(0);
  /** 1 when committed `behindDisplayIndex === currentIndex - 1` (layout effect). */
  const behindShowsPrevSV = useSharedValue(0);
  const handoffOriginY = useSharedValue(0);
  const backScrollY = useSharedValue(0);
  const backScrollContentH = useSharedValue(0);
  const backScrollViewportH = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  /** 1 = finger Y at the scroll edge is latched in edgeStartY. */
  const edgeLatched = useSharedValue(0);
  const edgeStartY = useSharedValue(0);
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
    flippedSV.value = flipped ? 1 : 0;
  }, [flipped, flippedSV]);

  const sheetOpenRef = useRef(sheetOpen);
  useEffect(() => {
    sheetOpenRef.current = sheetOpen;
  }, [sheetOpen]);
  const inputLockedRef = useRef(inputLocked);
  const a11ySurfaceRef = useRef<View>(null);
  useEffect(() => {
    inputLockedRef.current = inputLocked;
  }, [inputLocked]);

  useEffect(() => {
    reduceMotionSV.value = reduceMotion ? 1 : 0;
  }, [reduceMotion, reduceMotionSV]);

  const cardLayout = resolveCardAspectLayout({
    columnWidth: containerW,
    availableHeight,
  });
  const cardWidth = cardLayout.width;
  const cardAreaHeight = cardLayout.height;
  const mediaRequestWidth =
    cardLayout.width > 0 ? requestedMediaWidth(cardLayout.width, PixelRatio.get()) : 0;
  const { preloadedMediaUrls } = useConceptMediaPreload(
    concepts,
    currentIndex,
    mediaRequestWidth,
  );

  useEffect(() => {
    cardWidthSV.value = Math.max(1, cardWidth);
    cardHeightSV.value = cardAreaHeight;
  }, [cardAreaHeight, cardWidth, cardWidthSV, cardHeightSV]);

  const isLastCard = concepts.length > 0 && currentIndex === concepts.length - 1;
  // Lz-38: fetch failure / no-next stay on the card face; only end-deck loading
  // replaces the card with the quiet silhouette. Status copy lives on DeckStatusLine.
  const showDeckStatus = useMemo(
    () => isLastCard && showDeckLoading && !loadMoreError,
    [isLastCard, showDeckLoading, loadMoreError],
  );

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

  // Flush dwell when app backgrounds or stack unmounts; Lz-40 stops pulse off-active.
  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      setAppActive(next === 'active');
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

  useLayoutEffect(() => {
    const display = deckBehindDisplayIndex(behindLockedIndex, currentIndex);
    behindShowsPrevSV.value = display === currentIndex - 1 ? 1 : 0;
  }, [behindLockedIndex, behindShowsPrevSV, currentIndex]);

  // Layout effect: reset gesture + enter state before paint so the new top card never flashes with the
  // previous commit’s translateX (useEffect runs too late and causes a one-frame blink).
  useLayoutEffect(() => {
    // Lz-36: loading → concept without a swipe intent (append settle, or back cleared pending).
    const committedNavIntent = navIntentRef.current;
    const intent = resolveNavSettleIntent({
      navIntent: committedNavIntent,
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
      exitingSV.value = 0;
      handoffOriginY.value = 0;
      edgeLatched.value = 0;
      coachPeekX.value = 0;
      flipPeek.value = 0;
      frontCommitOpacity.value = 1;
      peerCommitOpacity.value = 0;
      flipProgress.value = 0;
      exitProgressSV.value = 0;
      releaseTiltZSV.value = 0;
      exitSignSV.value = 0;
      rmPeerLayerSV.value = 0;
      behindRightLockSV.value = 0;
    })();
    translateX.value = 0;
    translateY.value = 0;
    swipeAnimating.value = false;
    exitingSV.value = 0;
    handoffOriginY.value = 0;
    edgeLatched.value = 0;
    coachPeekX.value = 0;
    flipPeek.value = 0;
    frontCommitOpacity.value = 1;
    peerCommitOpacity.value = 0;
    flipProgress.value = 0;
    exitProgressSV.value = 0;
    releaseTiltZSV.value = 0;
    exitSignSV.value = 0;
    rmPeerLayerSV.value = 0;
    behindRightLockSV.value = 0;
    setFlipped(false);

    const rm = reduceMotionSV.value > 0.5;
    if (intent === 'forward' || intent === 'backward' || intent === 'backwardGesture') {
      // Underlay-revealed Next/Complexity, RM, Previous overlay: already on screen — land settled.
      // Loading-replace (derived forward / back-from-status): fade 0→1 + ±8 → 0 over 260 ms.
      if (deckEnterLandsSettled(rm, intent, committedNavIntent)) {
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

  // Lz-40: pulse starts only after settle completes (or immediately when there is no enter motion).
  useEffect(() => {
    setCardSettled(false);
    setPulseDragging(false);
    onDeckMotionChange?.(false);
    const ms = reduceMotion ? 0 : deckSettleDurationMs(false);
    if (ms <= 0) {
      setCardSettled(true);
      return;
    }
    const timer = setTimeout(() => setCardSettled(true), ms);
    return () => clearTimeout(timer);
  }, [currentIndex, showDeckStatus, reduceMotion, onDeckMotionChange]);

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
    flippedSV.value = next ? 1 : 0;
    flipProgress.value = withTiming(
      next ? 1 : 0,
      reduceMotion
        ? {
            duration: flipDurationMs(true),
            easing: Easing.out(Easing.cubic),
            reduceMotion: ReduceMotion.Never,
          }
        : {
            duration: flipDurationMs(false),
            easing: Easing.out(Easing.cubic),
          },
    );
    setFlipped(next);
  }, [flushDwell, noteTapped, reduceMotion, flippedSV, flipProgress]);

  const lockReturnOverlayIndexForRightCommit = useCallback(() => {
    const i = currentIndexRef.current - 1;
    if (i >= 0) setReturnOverlayLockedIndex(i);
  }, []);

  const lockBehindIndexForRightCommit = useCallback(() => {
    const i = deckBehindLockIndexForRightDrag(currentIndexRef.current);
    if (i !== null) setBehindLockedIndex(i);
  }, []);

  const unlockBehindIndex = useCallback(() => {
    setBehindLockedIndex(null);
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
      inputLocked: inputLockedRef.current,
    }),
    [swipeAnimating],
  );

  const startHorizontalExit = (sign: number) => {
    'worklet';
    const w = Math.max(1, cardWidthSV.value);
    const rm = reduceMotionSV.value > 0.5;
    releaseTiltZSV.value = cardSwipeTiltZDeg(translateX.value, w, rm);
    exitSignSV.value = sign;
    exitProgressSV.value = 0;
    exitingSV.value = 1;
    exitProgressSV.value = withTiming(1, {
      duration: swipeCommitDurationMs(rm),
      easing: SWIPE_EASING,
    });
  };

  const focusCard = useCallback(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const surface = document.querySelector('[data-testid="card-a11y-surface"]');
      if (surface instanceof HTMLElement) {
        surface.focus();
      }
      return;
    }
    const node = findNodeHandle(a11ySurfaceRef.current);
    if (node != null) {
      AccessibilityInfo.setAccessibilityFocus(node);
    }
  }, []);

  /** Animate then call the same commit* helpers gestures use (respects Lz-34 RM). */
  const animateThenCommit = useCallback(
    (kind: 'next' | 'previous' | 'complexityUp' | 'complexityDown') => {
      if (swipeAnimating.value) return;
      swipeAnimating.value = true;
      coachPeekX.value = 0;
      flipPeek.value = 0;
      setPulseDragging(true);
      onDeckMotionChange?.(true);
      const rm = reduceMotion;
      const commitMs = swipeCommitDurationMs(rm);
      const slide = swipeShouldSlideOutOnCommit(rm);

      if (kind === 'previous') {
        lockReturnOverlayIndexForRightCommit();
        exitingSV.value = 1;
        if (!slide) {
          rmPeerLayerSV.value = 1;
          frontCommitOpacity.value = 1;
          peerCommitOpacity.value = 0;
          if (deckReducedMotionFadesOutgoingFront('right')) {
            frontCommitOpacity.value = withTiming(0, rmCrossfadeTiming(commitMs));
          }
          peerCommitOpacity.value = withTiming(1, rmCrossfadeTiming(commitMs), (finished) => {
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
        releaseTiltZSV.value = cardSwipeTiltZDeg(translateX.value, Math.max(1, cardWidthSV.value), rm);
        exitSignSV.value = -1;
        exitProgressSV.value = 0;
        exitingSV.value = 1;
        exitProgressSV.value = withTiming(1, { duration: commitMs, easing: SWIPE_EASING });
        if (!slide) {
          rmPeerLayerSV.value = -1;
          frontCommitOpacity.value = 1;
          peerCommitOpacity.value = 0;
          frontCommitOpacity.value = withTiming(0, rmCrossfadeTiming(commitMs));
          peerCommitOpacity.value = withTiming(1, rmCrossfadeTiming(commitMs), (finished) => {
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
      exitingSV.value = 1;
      if (!slide) {
        rmPeerLayerSV.value = -1;
        frontCommitOpacity.value = 1;
        peerCommitOpacity.value = 0;
        frontCommitOpacity.value = withTiming(0, rmCrossfadeTiming(commitMs));
        peerCommitOpacity.value = withTiming(1, rmCrossfadeTiming(commitMs), (finished) => {
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
      onDeckMotionChange,
      exitingSV,
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

  useImperativeHandle(ref, () => ({ runAction, focusCard }), [runAction, focusCard]);

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

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      const surface = document.querySelector('[data-testid="card-a11y-surface"]');
      if (!(surface instanceof Element)) return;
      const active = document.activeElement;
      if (active == null) return;
      const surfaceFocused = active === surface;
      const nestedFocus = surface.contains(active);
      if (!surfaceFocused && !nestedFocus) return;
      if (!surfaceFocused && !shouldHandleCardSurfaceKey(event.target, surface)) return;
      const action = cardActionFromKey(event.key);
      if (action == null) return;
      event.preventDefault();
      event.stopPropagation();
      runAction(action);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [runAction]);

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
            inputLocked,
          }),
        } as Record<string, unknown>)
      : { onKeyDown: onCardKeyDown };

  const surfaceIsButton = cardSurfaceIsAccessibleButton({
    showDeckStatus,
    flipped,
  });

  /** Lz-40: front card only; PatternLayer also gates RM + scroll. */
  const pulseGateActive =
    cardSettled &&
    !flipped &&
    !pulseDragging &&
    !sheetOpen &&
    !inputLocked &&
    appActive &&
    !showDeckStatus;

  const cancelCoachPeek = () => {
    'worklet';
    coachPeekX.value = 0;
    flipPeek.value = 0;
  };

  // maxDeltaY so a vertical ScrollView drag on the back fails the tap (no accidental flip).
  const tap = Gesture.Tap()
    .enabled(!inputLocked)
    .maxDistance(14)
    .maxDeltaY(10)
    .onEnd(() => {
      if (swipeAnimating.value) return;
      cancelCoachPeek();
      runOnJS(noteInteraction)();
      runOnJS(toggleFlip)();
    });

  const markDeckMoving = useCallback(
    (active: boolean) => {
      setPulseDragging(active);
      onDeckMotionChange?.(active);
    },
    [onDeckMotionChange],
  );

  const springHome = () => {
    'worklet';
    const spring = {
      damping: SWIPE_RETURN_SPRING.damping,
      stiffness: SWIPE_RETURN_SPRING.stiffness,
      overshootClamping: true as const,
    };
    exitProgressSV.value = 0;
    exitingSV.value = 0;
    releaseTiltZSV.value = 0;
    exitSignSV.value = 0;
    rmPeerLayerSV.value = 0;
    if (behindRightLockSV.value > 0.5) {
      behindRightLockSV.value = 0;
      runOnJS(unlockBehindIndex)();
    }
    translateX.value = withSpring(0, spring);
    translateY.value = withSpring(0, spring, (finished) => {
      if (finished) runOnJS(markDeckMoving)(false);
    });
  };

  const panX = Gesture.Pan()
    .enabled(!inputLocked)
    .activeOffsetX([-PAN_ACTIVE_OFFSET, PAN_ACTIVE_OFFSET])
    .failOffsetY([-PAN_ACTIVE_OFFSET, PAN_ACTIVE_OFFSET])
    .onStart(() => {
      cancelCoachPeek();
      runOnJS(noteInteraction)();
      runOnJS(markDeckMoving)(true);
    })
    .onUpdate((e: { translationX: number; translationY: number }) => {
      if (swipeAnimating.value) return;
      const canGoBack = canSwipeRightSV.value > 0.5;
      let tx = applyStartOfHistoryResistance(e.translationX, canGoBack);
      if (showDeckStatusSV.value === 1 && tx < 0) tx = 0;
      translateX.value = tx;
      translateY.value = cardSwipeFollowY(e.translationY, reduceMotionSV.value > 0.5);
      if (tx > 0 && canGoBack) {
        if (behindRightLockSV.value < 0.5) {
          behindRightLockSV.value = 1;
          runOnJS(lockBehindIndexForRightCommit)();
        }
      } else if (behindRightLockSV.value > 0.5) {
        behindRightLockSV.value = 0;
        runOnJS(unlockBehindIndex)();
      }
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
            springHome();
            return;
          }
          swipeAnimating.value = true;
          startHorizontalExit(-1);
          runOnJS(lockBehindIndexForLeftCommit)();
          if (!swipeShouldSlideOutOnCommit(rm)) {
            rmPeerLayerSV.value = -1;
            frontCommitOpacity.value = 1;
            peerCommitOpacity.value = 0;
            frontCommitOpacity.value = withTiming(0, rmCrossfadeTiming(commitMs));
            peerCommitOpacity.value = withTiming(1, rmCrossfadeTiming(commitMs), (finished) => {
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
            springHome();
            return;
          }
          if (showDeckStatusSV.value === 1) {
            swipeAnimating.value = true;
            exitingSV.value = 1;
            if (!swipeShouldSlideOutOnCommit(rm)) {
              frontCommitOpacity.value = 1;
              peerCommitOpacity.value = 0;
              frontCommitOpacity.value = withTiming(0, rmCrossfadeTiming(commitMs), (finished) => {
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
          exitingSV.value = 1;
          runOnJS(lockReturnOverlayIndexForRightCommit)();
          runOnJS(lockBehindIndexForRightCommit)();
          if (!swipeShouldSlideOutOnCommit(rm)) {
            rmPeerLayerSV.value = 1;
            frontCommitOpacity.value = 1;
            peerCommitOpacity.value = 0;
            if (deckReducedMotionFadesOutgoingFront('right', translateX.value)) {
              frontCommitOpacity.value = withTiming(0, rmCrossfadeTiming(commitMs));
            }
            peerCommitOpacity.value = withTiming(1, rmCrossfadeTiming(commitMs), (finished) => {
              if (finished) runOnJS(commitSwipeRight)();
            });
            return;
          }
          translateX.value = withTiming(w, { duration: commitMs, easing: SWIPE_EASING }, (finished) => {
            if (finished) runOnJS(commitSwipeRight)();
          });
          return;
        }
        springHome();
      },
    );

  const panY = Gesture.Pan()
    .enabled(!inputLocked)
    .manualActivation(true)
    .onTouchesDown((e) => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      touchStartX.value = touch.absoluteX;
      touchStartY.value = touch.absoluteY;
      edgeLatched.value = 0;
      handoffOriginY.value = 0;
    })
    .onTouchesMove((e, manager) => {
      if (swipeAnimating.value) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dy = touch.absoluteY - touchStartY.value;
      const dx = touch.absoluteX - touchStartX.value;
      if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > PAN_ACTIVE_OFFSET) {
        manager.fail();
        return;
      }
      const flippedFace = flippedSV.value > 0.5;
      const contentH = backScrollContentH.value;
      const viewportH = backScrollViewportH.value;
      const canScroll = flippedFace && contentH > viewportH + 1;
      if (!canScroll) {
        if (Math.abs(dy) > PAN_ACTIVE_OFFSET) manager.activate();
        return;
      }
      const atTop = backScrollY.value <= 1;
      const atBottom = backScrollY.value + viewportH >= contentH - 1;
      const atEdge = atTop || atBottom;
      if (!atEdge) {
        edgeLatched.value = 0;
        return;
      }
      if (edgeLatched.value === 0) {
        edgeStartY.value = touch.absoluteY;
        edgeLatched.value = 1;
      }
      const origin = backFaceVerticalHandoffOrigin(
        dy,
        edgeStartY.value - touchStartY.value,
        atTop,
        atBottom,
        SWIPE_BACK_FACE_SCROLL_HANDOFF_PX,
      );
      if (origin != null) {
        handoffOriginY.value = origin;
        manager.activate();
      }
    })
    .onStart(() => {
      translateX.value = 0;
      cancelCoachPeek();
      runOnJS(noteInteraction)();
      runOnJS(markDeckMoving)(true);
    })
    .onUpdate((e: { translationY: number }) => {
      if (swipeAnimating.value) return;
      if (showDeckStatusSV.value === 1) {
        translateY.value = 0;
        return;
      }
      const origin = handoffOriginY.value;
      translateY.value =
        origin !== 0 ? cardSwipeTranslationAfterHandoff(e.translationY, origin) : e.translationY;
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
        const origin = handoffOriginY.value;
        const ty =
          origin !== 0 ? cardSwipeTranslationAfterHandoff(e.translationY, origin) : e.translationY;
        const direction = swipeCommitDirection(ty, e.velocityY, h);
        if (direction === 0 || showDeckStatusSV.value === 1) {
          springHome();
          return;
        }
        const vertical: 'up' | 'down' = direction < 0 ? 'up' : 'down';
        swipeAnimating.value = true;
        exitingSV.value = 1;
        runOnJS(lockBehindIndexForLeftCommit)();
        const rm = reduceMotionSV.value > 0.5;
        const commitMs = swipeCommitDurationMs(rm);
        if (!swipeShouldSlideOutOnCommit(rm)) {
          rmPeerLayerSV.value = -1;
          frontCommitOpacity.value = 1;
          peerCommitOpacity.value = 0;
          frontCommitOpacity.value = withTiming(0, rmCrossfadeTiming(commitMs));
          peerCommitOpacity.value = withTiming(1, rmCrossfadeTiming(commitMs), (finished) => {
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
    : Gesture.Exclusive(tap, panX, panY);

  /** Current / top-of-deck card — directional tilt + translation. */
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const ty = translateY.value;
    const peekX = coachPeekX.value;
    const rawTx = translateX.value;
    const tx = (rawTx < 0 ? rawTx : 0) + peekX;
    const x = enterX.value + tx;
    const w = Math.max(1, cardWidthSV.value);
    const h = Math.max(1, cardHeightSV.value);
    const rm = reduceMotionSV.value > 0.5;
    const covering = deckPreviousCovering(rawTx, rmPeerLayerSV.value);
    const coverP = rawTx > 0 ? swipeAxisProgress(rawTx, w) : 0;
    const scale = cardCoveredScale(coverP, rm);
    const lift = cardSwipeLiftShadowPx(
      Math.max(swipeAxisProgress(tx, w), swipeAxisProgress(ty, h), coverP),
      rm,
    );
    // Covered card (right / Previous) stays at rest z + rest elevation so the
    // incoming overlay paints on top. Left / Next still raise via moving z.
    const shadowLift = covering ? 0 : lift;
    const moving = swipeAnimating.value || exitingSV.value > 0.5 || rawTx < 0 || ty !== 0;
    const androidFill = cardSwipeAndroidLiftFill({
      liftPx: shadowLift,
      flipProgress: flipProgress.value,
      flipPeek: flipPeek.value,
      showDeckStatus: showDeckStatusSV.value > 0.5,
    });
    return {
      opacity: enterOpacity.value * frontCommitOpacity.value,
      transform: [
        ...cardSwipeFrontTransform(
          x,
          ty,
          w,
          h,
          rm,
          exitProgressSV.value,
          releaseTiltZSV.value,
          exitSignSV.value,
        ),
        { scale },
      ],
      ...cardSwipeLiftShadowStyle(shadowLift),
      zIndex: deckFrontWrapZIndex(covering, moving),
      backgroundColor:
        Platform.OS === 'android' && androidFill ? color.front : 'transparent',
    };
  });

  const frontTintStyle = useAnimatedStyle(() => {
    const w = Math.max(1, cardWidthSV.value);
    const coverP = translateX.value > 0 ? swipeAxisProgress(translateX.value, w) : 0;
    const tint = cardCoveredTint(coverP);
    return {
      backgroundColor: conceptTintRgba(tint),
      opacity: tint > 0 ? 1 : 0,
    };
  });

  /** Next-card underlay — hidden at rest, revealed by drag / RM peer fade. */
  const behindAnimatedStyle = useAnimatedStyle(() => {
    const w = Math.max(1, cardWidthSV.value);
    const h = Math.max(1, cardHeightSV.value);
    const rm = reduceMotionSV.value > 0.5;
    const dragP = deckUnderlayDragProgress(translateX.value, translateY.value, w, h);
    const peer = deckReducedMotionUnderlayPeer(
      rmPeerLayerSV.value,
      translateX.value,
      peerCommitOpacity.value,
    );
    const revealP = deckCommitCrossfadeProgress(dragP, peer);
    const reveal = deckUnderlayReveal(revealP, rm, DECK_NEXT_VISIBLE_AT_REST);
    const sideMatches = deckUnderlayCommittedSideMatchesReveal(
      behindShowsPrevSV.value,
      translateX.value,
      translateY.value,
      rmPeerLayerSV.value,
    );
    const hidden = reveal.opacity <= 0 || !sideMatches;
    return {
      opacity: hidden ? 0 : reveal.opacity,
      visibility: deckLayerVisibility(hidden),
      transform: deckUnderlayTransform(reveal.scale, reveal.offsetY, rm, hidden),
    };
  });

  const behindTintStyle = useAnimatedStyle(() => {
    const w = Math.max(1, cardWidthSV.value);
    const h = Math.max(1, cardHeightSV.value);
    const rm = reduceMotionSV.value > 0.5;
    const dragP = deckUnderlayDragProgress(translateX.value, translateY.value, w, h);
    const peer = deckReducedMotionUnderlayPeer(
      rmPeerLayerSV.value,
      translateX.value,
      peerCommitOpacity.value,
    );
    const revealP = deckCommitCrossfadeProgress(dragP, peer);
    const reveal = deckUnderlayReveal(revealP, rm, DECK_NEXT_VISIBLE_AT_REST);
    return {
      backgroundColor: conceptTintRgba(reveal.tint),
      opacity: reveal.opacity > 0 && reveal.tint > 0 ? 1 : 0,
    };
  });

  /**
   * Previous card sliding in from the left ON TOP when swiping right.
   * Starts at −10° Z / −3° Y; RM commit cross-fades in place via peerCommitOpacity.
   */
  const returnOverlayStyle = useAnimatedStyle(() => {
    const w = Math.max(1, cardWidthSV.value);
    const h = Math.max(1, cardHeightSV.value);
    const rm = reduceMotionSV.value > 0.5;
    const overlayPeer = rmPeerLayerSV.value > 0 ? peerCommitOpacity.value : 0;
    const covering = deckPreviousCovering(translateX.value, rmPeerLayerSV.value);
    const active = translateX.value > 0 || overlayPeer > 0;
    const suppressed = returnOverlaySuppressSV.value > 0.5;
    const progress = Math.min(1, swipeAxisProgress(translateX.value, w));
    const tx = deckReturnOverlayTranslateX(translateX.value, w, overlayPeer);
    const hidden = !active || suppressed;
    return {
      opacity: deckReturnOverlayOpacity(hidden, translateX.value, overlayPeer),
      visibility: deckLayerVisibility(hidden),
      zIndex: deckReturnOverlayZIndex(covering),
      elevation: deckReturnOverlayElevation(covering),
      transform: cardSwipeReturnOverlayTransform(tx, h, progress, rm),
    };
  });

  if (concepts.length === 0) {
    if (!showInitialLoading) return null;
    return (
      <View
        style={[styles.outer, { paddingTop: cardLayout.topSurplus }]}
        onLayout={(e) => {
          setContainerW(e.nativeEvent.layout.width);
        }}
      >
        <View
          style={[
            styles.cardWrap,
            { height: cardAreaHeight, width: cardWidth > 0 ? cardWidth : '100%' },
          ]}
        >
          <View style={styles.gestureFill}>
            <View style={styles.frontWrap}>
              <LoadingCard />
            </View>
          </View>
        </View>
      </View>
    );
  }

  const behindDisplayIndex = deckBehindDisplayIndex(behindLockedIndex, currentIndex);
  const nextCardReady =
    behindDisplayIndex >= 0 && behindDisplayIndex < concepts.length;
  // One underlay always mounts (never blank shell). Hidden at rest via underlay opacity.
  const showBehindNext = !showDeckStatus;
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
      style={[styles.outer, { paddingTop: cardLayout.topSurplus }]}
      onLayout={(e) => {
        setContainerW(e.nativeEvent.layout.width);
      }}
    >
      <View
        style={[
          styles.cardWrap,
          { height: cardAreaHeight, width: cardWidth > 0 ? cardWidth : '100%' },
        ]}
      >
        <GestureDetector gesture={composed}>
          <View style={styles.gestureFill}>
          {showBehindNext ? (
            <Animated.View
              style={[styles.behindWrap, behindAnimatedStyle]}
              pointerEvents="none"
              testID="deck-underlay"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as Record<string, unknown>) : null)}
            >
              {nextCardReady ? (
                <ConceptCardForIndex
                  concepts={concepts}
                  currentIndex={behindDisplayIndex}
                  flipped={false}
                  reduceMotion={reduceMotion}
                  preloadedMediaUrls={preloadedMediaUrls}
                  facePadding={cardLayout.padding}
                  mediaRequestWidth={mediaRequestWidth}
                />
              ) : (
                <LoadingCard exposeTestId={false} />
              )}
              <Animated.View
                pointerEvents="none"
                style={[styles.tintOverlay, behindTintStyle]}
              />
            </Animated.View>
          ) : null}

          <Animated.View
            key={showDeckStatus ? `deck-loading-${currentIndex}` : 'front-card'}
            style={[styles.frontWrap, pulseDragging ? styles.frontWrapMoving : null, frontAnimatedStyle]}
          >
            <View
              ref={a11ySurfaceRef}
              style={styles.a11ySurface}
              testID="card-a11y-surface"
              {...(Platform.OS === 'web'
                ? ({
                    dataSet: {
                      flipped: flipped ? 'true' : 'false',
                      lateralityGrade:
                        concepts[currentIndex]?.grade != null
                          ? String(concepts[currentIndex]?.grade)
                          : '',
                    },
                  } as Record<string, unknown>)
                : null)}
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
                disabled: showDeckStatus || sheetOpen || inputLocked,
              }}
              {...webCardFocusProps}
            >
              {showDeckStatus ? (
                <LoadingCard />
              ) : (
                <ConceptCardForIndex
                  concepts={concepts}
                  currentIndex={currentIndex}
                  flipped={flipped}
                  reduceMotion={reduceMotion}
                  preloadedMediaUrls={preloadedMediaUrls}
                  flipPeek={flipPeek}
                  flipProgress={flipProgress}
                  exposeFrontTitleTestId
                  onBackInteractivePress={noteBackInteractivePress}
                  pulseGateActive={pulseGateActive}
                  facePadding={cardLayout.padding}
                  mediaRequestWidth={mediaRequestWidth}
                  backScrollOffsetY={backScrollY}
                  backScrollContentH={backScrollContentH}
                  backScrollViewportH={backScrollViewportH}
                />
              )}
            </View>
            <Animated.View pointerEvents="none" style={[styles.tintOverlay, frontTintStyle]} />
          </Animated.View>

          {showReturnOverlay ? (
            <Animated.View
              style={[styles.returnOverlay, returnOverlayStyle]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as Record<string, unknown>) : null)}
            >
              <ConceptCardForIndex
                concepts={concepts}
                currentIndex={returnOverlayIndex}
                flipped={false}
                reduceMotion={reduceMotion}
                preloadedMediaUrls={preloadedMediaUrls}
                facePadding={cardLayout.padding}
                mediaRequestWidth={mediaRequestWidth}
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
  flipProgress,
  exposeFrontTitleTestId = false,
  onBackInteractivePress,
  pulseGateActive = false,
  facePadding,
  mediaRequestWidth,
  backScrollOffsetY,
  backScrollContentH,
  backScrollViewportH,
}: {
  concepts: ConceptItem[];
  currentIndex: number;
  flipped: boolean;
  reduceMotion?: boolean;
  preloadedMediaUrls: ReadonlySet<string>;
  flipPeek?: SharedValue<number>;
  flipProgress?: SharedValue<number>;
  exposeFrontTitleTestId?: boolean;
  onBackInteractivePress?: () => void;
  pulseGateActive?: boolean;
  facePadding: number;
  mediaRequestWidth: number;
  backScrollOffsetY?: SharedValue<number>;
  backScrollContentH?: SharedValue<number>;
  backScrollViewportH?: SharedValue<number>;
}) {
  const item = concepts[currentIndex]!;
  const mediaUri =
    mediaRequestWidth > 0
      ? resolveCardMediaUrl({
          mediaUrl: item.mediaUrl,
          platform: Platform.OS,
          apiBaseUrl: resolveApiBaseUrl(),
          requestWidth: mediaRequestWidth,
        })
      : '';
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
      pulseGateActive={pulseGateActive}
      facePadding={facePadding}
      mediaRequestWidth={mediaRequestWidth}
      backScrollOffsetY={backScrollOffsetY}
      backScrollContentH={backScrollContentH}
      backScrollViewportH={backScrollViewportH}
      flipProgress={flipProgress}
    />
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    // Agreed exception (Lz-21 / Lz-24 AD): keep 12 here, not layout.screenGutter 16.
    paddingHorizontal: CARD_STACK_GUTTER,
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
    ...StyleSheet.absoluteFill,
  },
  tintOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: cardRadius(),
    zIndex: 4,
  },
  /** Next-card underlay (Lz-56) — opacity/scale driven by behindAnimatedStyle. */
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
    borderRadius: cardRadius(),
    overflow: 'visible',
  },
  /** Raised z for left / Next only; covering Previous overrides to rest z 2. */
  frontWrapMoving: {
    zIndex: 40,
    elevation: 40,
    overflow: 'visible',
  },
  a11ySurface: {
    ...StyleSheet.absoluteFill,
    // The outer focus outline follows both faces without clipping its 2 px offset.
    borderRadius: cardRadius(),
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
