import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibleNavRow } from '@/components/AccessibleNavRow';
import { AppMenuSheet } from '@/components/AppMenuSheet';
import { AppMenuTrigger } from '@/components/AppMenuTrigger';
import { CoachHint } from '@/components/CoachHint';
import { ComplexityCue, ComplexitySessionMark } from '@/components/ComplexityCue';
import {
  ConceptCardStack,
  type ConceptCardStackHandle,
} from '@/components/ConceptCardStack';
import { DeckStatusLine } from '@/components/DeckStatusLine';
import { LateralityControl } from '@/components/LateralityControl';
import { LateralitySheet } from '@/components/LateralitySheet';
import { LateralzrLogo } from '@/components/LateralzrLogo';
import { useWebPhoneFrameSize } from '@/components/WebPhoneFrame';
import { useAccessibleNavVisible } from '@/hooks/useAccessibleNavVisible';
import { useConceptMediaPreload } from '@/hooks/useConceptMediaPreload';
import { useConnectivity } from '@/hooks/useConnectivity';
import { MotionPreferenceProvider } from '@/hooks/motionPreferenceContext';
import { ApiError, fetchConceptRelationships, type ConceptItem, DEFAULT_CONCEPT_COMPLEXITY } from '@/lib/api';
import { ACCESSIBLE_NAV_ROW_MIN_HEIGHT } from '@/lib/cardActions';
import { applyAppendedBatch, applyComplexityTreeSwap, graphToDeckItems, planLoadMoreMerge } from '@/lib/conceptDeck';
import { resolveDeckChromeStatus } from '@/lib/deckChromeStatus';
import { reduceSwipeRight, resolveDeckSlotState } from '@/lib/deckSlotState';
import {
  applyEmptyBatchToCycle,
  conceptsUnchangedOnFetchFailure,
  initialEmptyRetryCycle,
  resetEmptyRetryCycleState,
  type EmptyRetryCycleState,
  type EmptyRetryResetReason,
} from '@/lib/emptyBatchRetry';
import { color } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';
import {
  complexityCueHoldMs,
  resolveSessionComplexityToAnnounce,
  shouldAnnounceComplexity,
  shouldKeepSessionComplexityMark,
} from '@/lib/complexityFeedback';
import { applyMenuComplexitySelection } from '@/lib/complexityMenu';
import { clampComplexity, loadStoredComplexity, persistComplexity } from '@/lib/complexityStorage';
import {
  getActiveLocale,
  setActiveLocale,
  t,
  type AppLocale,
} from '@/lib/i18n';
import {
  DEFAULT_MOTION_PREFERENCE,
  loadStoredMotionPreference,
  persistMotionPreference,
  type MotionPreference,
} from '@/lib/motionStorage';
import { remainingIntroMs } from '@/lib/introLogo';
import {
  applyLateralityTreeSwap,
  clampLaterality,
  DEFAULT_LATERALITY,
  resolveInitialLaterality,
  shouldPersistLateralityAfterSwap,
  type LateralityGrade,
} from '@/lib/laterality';
import { coachHintSlotHeight } from '@/lib/coachHintPresentation';
import {
  cardStackAvailableHeight,
  LATERALITY_CONTROL_HEIGHT,
  lateralityCardGap,
} from '@/lib/lateralityChrome';
import { loadStoredLaterality, persistLaterality } from '@/lib/lateralityStorage';
import { applyResolvedLocale } from '@/lib/locale';
import { loadStoredLocale, persistLocale, selectLocale } from '@/lib/localeStorage';
import {
  APP_MENU_TRIGGER_ENABLED,
  PRACTICE_COLUMN_MAX_WIDTH,
  practiceMenuChromeHeight,
  practiceScreenGutter,
} from '@/lib/practiceLayout';
import {
  applyJourneyTestDeck,
  journeyStartOptions,
  parseComplexityParam,
  readJourneyTestParams,
  resolveInitialComplexity,
  resolveJourneyStartFallback,
  shouldPersistComplexity,
  type JourneyFetchOptions,
} from '@/lib/testQueryParams';

/**
 * Prefetch the next API batch when at most this many concepts remain **ahead** of the
 * current card (not counting the card you're on). So with 2: when you still have two
 * cards to swipe to that you haven't opened yet, we already request more.
 */
const UNVISITED_AHEAD_PREFETCH_AT = 2;

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const routeParams = useLocalSearchParams<{ complexity?: string | string[] }>();
  const routeComplexity = parseComplexityParam(firstSearchParam(routeParams.complexity));
  const { height: windowHeight } = useWindowDimensions();
  // Web phone frame reports its inner size; native hook is a no-op (null).
  const phoneFrame = useWebPhoneFrameSize();
  const layoutHeight = phoneFrame?.height ?? windowHeight;
  const [concepts, setConcepts] = useState<ConceptItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** False until the intro logo has been on screen for at least one animation cycle (~3s). */
  const [introGateOpen, setIntroGateOpen] = useState(false);
  const introStartedAtRef = useRef(Date.now());

  const [complexity, setComplexity] = useState(DEFAULT_CONCEPT_COMPLEXITY);
  const [complexityHydrated, setComplexityHydrated] = useState(false);
  const [complexityCue, setComplexityCue] = useState<{
    grade: number;
    token: number;
    holdMs: number;
  } | null>(null);
  const [laterality, setLaterality] = useState<LateralityGrade>(DEFAULT_LATERALITY);
  const [lateralityHydrated, setLateralityHydrated] = useState(false);
  /** Gates laterality controls while the neighborhood tree prefetches — no swirl overlay (Lz-33). */
  const [lateralitySwap, setLateralitySwap] = useState<{ token: number } | null>(null);
  /** Measured laterality control height (grows when the label wraps at large text). */
  const [lateralityControlHeight, setLateralityControlHeight] = useState(LATERALITY_CONTROL_HEIGHT);
  const [lateralitySheetOpen, setLateralitySheetOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [motionPreference, setMotionPreference] =
    useState<MotionPreference>(DEFAULT_MOTION_PREFERENCE);
  const lateralityLabelRef = useRef<View | null>(null);
  const cardStackRef = useRef<ConceptCardStackHandle | null>(null);
  const accessibleNavVisible = useAccessibleNavVisible();
  const [accessibleNavHeight, setAccessibleNavHeight] = useState<number>(ACCESSIBLE_NAV_ROW_MIN_HEIGHT);
  const appMenuTriggerRef = useRef<View | null>(null);
  const replayGestureTipsRef = useRef<() => void>(() => {});
  /** React state mirrors activeLocale so menu / chrome re-render on pick. */
  const [locale, setLocale] = useState<AppLocale>(() => applyResolvedLocale());
  /** §12.3 tip chip — in-flow between card and Laterality, never on the card. */
  const [coachTip, setCoachTip] = useState<{
    text: string;
    animateAppear: boolean;
    onDismiss: () => void;
  } | null>(null);
  /** Measured tip band height; falls back to 2-line reserve until laid out. */
  const [coachTipBandHeight, setCoachTipBandHeight] = useState(0);
  const [localeReady, setLocaleReady] = useState(false);

  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  /** Lz-38: empty-batch cycle exhausted — status line + Adjust (not on the card). */
  const [noNextIdea, setNoNextIdea] = useState(false);
  /** True only after the user swipes forward from the last card while waiting for more items. */
  const [pendingEndDeckLoad, setPendingEndDeckLoad] = useState(false);
  const {
    offline,
    shouldAnnounce: shouldAnnounceOffline,
    beginRetry: beginOfflineRetry,
    reportRetrySucceeded,
    reportRetryFailed,
    consumeAnnounce: consumeOfflineAnnounce,
  } = useConnectivity();
  const offlineRef = useRef(false);

  const conceptsRef = useRef(concepts);
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    offlineRef.current = offline;
    if (offline) {
      // Offline line owns Retry — do not leave a load-more error face on the card.
      setLoadMoreError(false);
    }
  }, [offline]);
  const loadMoreInFlightRef = useRef(false);
  const fetchGenRef = useRef(0);
  /** Bounded empty-retry cycle (Lz-38) — attempt count + exhausted flag. */
  const emptyRetryCycleRef = useRef<EmptyRetryCycleState>(initialEmptyRetryCycle());
  const emptyRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreConceptsRef = useRef<() => Promise<void>>(async () => {});
  const pendingEndDeckLoadRef = useRef(false);
  const complexityRef = useRef(complexity);
  const lateralityRef = useRef(laterality);
  const announcedSessionComplexityRef = useRef(false);
  const lateralitySwapGenRef = useRef(0);
  const lateralitySwapTokenRef = useRef(0);
  const lateralitySwapActiveRef = useRef(false);
  const committedLateralityRef = useRef<LateralityGrade>(DEFAULT_LATERALITY);
  const journeyTestParamsRef = useRef(readJourneyTestParams());
  /** State (not a ref) so a late hydrate re-fires the session-cue effect. */
  const [pendingSessionComplexity, setPendingSessionComplexity] = useState<number | null>(null);
  const [showSessionComplexityMark, setShowSessionComplexityMark] = useState(false);

  useEffect(() => {
    complexityRef.current = complexity;
  }, [complexity]);

  useEffect(() => {
    lateralityRef.current = laterality;
  }, [laterality]);

  useEffect(() => {
    conceptsRef.current = concepts;
  }, [concepts]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    let cancelled = false;
    void loadStoredLocale().then((stored) => {
      if (cancelled) return;
      const hydrated = applyResolvedLocale({ storedLocale: stored });
      setLocale(hydrated);
      setLocaleReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadStoredComplexity().then((stored) => {
      if (cancelled) return;
      const latest = readJourneyTestParams();
      const params = {
        ...journeyTestParamsRef.current,
        ...latest,
        complexity:
          latest.complexity ?? journeyTestParamsRef.current.complexity ?? routeComplexity,
      };
      journeyTestParamsRef.current = params;
      const hydrated = resolveInitialComplexity(params, stored);
      complexityRef.current = hydrated;
      setComplexity(hydrated);
      if (
        shouldAnnounceComplexity({
          reason: params.complexity != null ? 'session-url' : 'hydrate-stored',
          complexity: hydrated,
        })
      ) {
        setPendingSessionComplexity(hydrated);
        if (shouldKeepSessionComplexityMark('session-url')) {
          setShowSessionComplexityMark(true);
        }
      }
      setComplexityHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadStoredMotionPreference().then((stored) => {
      if (!cancelled) setMotionPreference(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadStoredLaterality().then((stored) => {
      if (cancelled) return;
      const hydrated = resolveInitialLaterality(journeyTestParamsRef.current.laterality, stored);
      lateralityRef.current = hydrated;
      committedLateralityRef.current = hydrated;
      setLaterality(hydrated);
      setLateralityHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hold the brand logo for one full pulse cycle even when the API is fast.
  useEffect(() => {
    const remaining = remainingIntroMs(introStartedAtRef.current, Date.now());
    const timer = setTimeout(() => setIntroGateOpen(true), remaining);
    return () => clearTimeout(timer);
  }, []);

  const { preloadedMediaUrls } = useConceptMediaPreload(concepts, currentIndex);

  const fetchBatch = useCallback(
    async (
      requestedComplexity: number,
      options?: JourneyFetchOptions,
      behavior?: { fallbackToDefaultComplexity?: boolean },
    ) => {
      const trimmedSeed = options?.start?.trim() ?? '';
      const start = trimmedSeed !== '' ? trimmedSeed : undefined;
      const canonicalStart = options?.canonicalStart?.trim() || undefined;
      const onlyWithMedia = options?.onlyWithMedia || undefined;
      const fallbackToDefaultComplexity = behavior?.fallbackToDefaultComplexity !== false;
      try {
        return await fetchConceptRelationships({
          start,
          canonicalStart,
          onlyWithMedia,
          limit: 12,
          depth: 2,
          complexity: requestedComplexity,
          laterality: lateralityRef.current,
          locale: getActiveLocale(),
        });
      } catch (e) {
        // Backend only has prefetched data for some complexities (often just 2).
        // If the requested complexity isn't prefetched yet, fall back to the default tier.
        if (
          fallbackToDefaultComplexity &&
          e instanceof ApiError &&
          e.status === 404 &&
          requestedComplexity !== DEFAULT_CONCEPT_COMPLEXITY
        ) {
          const data = await fetchConceptRelationships({
            start,
            canonicalStart,
            onlyWithMedia,
            limit: 12,
            depth: 2,
            complexity: DEFAULT_CONCEPT_COMPLEXITY,
            laterality: lateralityRef.current,
            locale: getActiveLocale(),
          });
          complexityRef.current = DEFAULT_CONCEPT_COMPLEXITY;
          setComplexity(DEFAULT_CONCEPT_COMPLEXITY);
          return data;
        }
        throw e;
      }
    },
    [setComplexity],
  );

  function clearEmptyRetryTimer() {
    if (emptyRetryTimerRef.current != null) {
      clearTimeout(emptyRetryTimerRef.current);
      emptyRetryTimerRef.current = null;
    }
  }

  function resetEmptyRetryCycle(reason: EmptyRetryResetReason) {
    clearEmptyRetryTimer();
    emptyRetryCycleRef.current = resetEmptyRetryCycleState(reason);
    setNoNextIdea(false);
  }

  useEffect(
    () => () => {
      clearEmptyRetryTimer();
    },
    [],
  );

  const loadConcepts = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    setLoading(true);
    setError(null);
    setLoadMoreError(false);
    pendingEndDeckLoadRef.current = false;
    setPendingEndDeckLoad(false);
    resetEmptyRetryCycle('reload');
    try {
      const testParams = journeyTestParamsRef.current;
      const startOptions = journeyStartOptions(testParams);
      let data: Awaited<ReturnType<typeof fetchConceptRelationships>>;
      try {
        data = await fetchBatch(complexityRef.current, startOptions);
      } catch (e) {
        const fallback = resolveJourneyStartFallback(testParams, e);
        if (fallback == null) throw e;
        data = await fetchBatch(complexityRef.current, fallback);
      }
      if (gen !== fetchGenRef.current) return;
      const list: ConceptItem[] = applyJourneyTestDeck(graphToDeckItems(data), testParams);
      conceptsRef.current = list;
      currentIndexRef.current = 0;
      setConcepts(list);
      setCurrentIndex(0);
      reportRetrySucceeded();
    } catch (e) {
      if (gen !== fetchGenRef.current) return;
      setError(e instanceof Error ? e.message : t('failedToLoadConcepts'));
      reportRetryFailed();
    } finally {
      if (gen === fetchGenRef.current) {
        setLoading(false);
      }
    }
  }, [fetchBatch, reportRetryFailed, reportRetrySucceeded]);

  useEffect(() => {
    if (!complexityHydrated || !lateralityHydrated || !localeReady) return;
    void loadConcepts();
  }, [complexityHydrated, lateralityHydrated, localeReady, loadConcepts]);

  const loadMoreConcepts = useCallback(async () => {
    if (loadMoreInFlightRef.current) return;

    clearEmptyRetryTimer();

    const list = conceptsRef.current;
    if (list.length === 0) return;

    const gen = fetchGenRef.current;
    const stillCurrent = () => gen === fetchGenRef.current;

    loadMoreInFlightRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);

    try {
      // Continue the chain from the last *walk-ordered* card (frontier), not DB-order last.
      const seed = list[list.length - 1]?.concept?.trim() ?? '';
      let didUseSeed = seed.length > 0;
      const mediaFilter = journeyTestParamsRef.current.onlyWithMedia
        ? { onlyWithMedia: true as const }
        : {};
      let data: Awaited<ReturnType<typeof fetchConceptRelationships>>;
      try {
        data = await fetchBatch(complexityRef.current, {
          ...(didUseSeed ? { start: seed } : {}),
          ...mediaFilter,
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          data = await fetchBatch(complexityRef.current, mediaFilter);
          didUseSeed = false;
        } else {
          throw e;
        }
      }

      if (!stillCurrent()) return;

      let incoming = applyJourneyTestDeck(graphToDeckItems(data), {
        ...journeyTestParamsRef.current,
        localizedConcept: undefined,
        canonicalConcept: undefined,
      });
      let plan = planLoadMoreMerge(conceptsRef.current, incoming, didUseSeed);

      // Same neighborhood as the first batch (common when seed was the original start):
      // cold-start a different random component instead of retrying the same seed forever.
      if (plan.action === 'coldStart') {
        data = await fetchBatch(complexityRef.current, mediaFilter);
        if (!stillCurrent()) return;
        incoming = applyJourneyTestDeck(graphToDeckItems(data), {
          ...journeyTestParamsRef.current,
          localizedConcept: undefined,
          canonicalConcept: undefined,
        });
        plan = planLoadMoreMerge(conceptsRef.current, incoming, false);
      }

      if (plan.action !== 'append') {
        // Lz-38: bounded empty retry — 1.5s / 3s / 6s, then No next idea + Adjust.
        const { cycle, decision } = applyEmptyBatchToCycle(emptyRetryCycleRef.current);
        emptyRetryCycleRef.current = cycle;
        if (decision.action === 'exhausted') {
          pendingEndDeckLoadRef.current = false;
          setPendingEndDeckLoad(false);
          setNoNextIdea(true);
          return;
        }
        emptyRetryTimerRef.current = setTimeout(() => {
          emptyRetryTimerRef.current = null;
          void loadMoreConceptsRef.current();
        }, decision.delayMs);
        return;
      }

      resetEmptyRetryCycle('successfulAppend');

      const applied = applyAppendedBatch(conceptsRef.current, plan.add, pendingEndDeckLoadRef.current);
      conceptsRef.current = applied.concepts;
      pendingEndDeckLoadRef.current = applied.pendingEndDeckLoad;
      setConcepts(applied.concepts);
      setPendingEndDeckLoad(applied.pendingEndDeckLoad);
      if (applied.nextIndex != null) {
        currentIndexRef.current = applied.nextIndex;
        setCurrentIndex(applied.nextIndex);
      }
      reportRetrySucceeded();
    } catch {
      if (stillCurrent()) {
        // Lz-38: failure never resets history — keep the walk, surface Retry in the row.
        const preserved = conceptsUnchangedOnFetchFailure(
          conceptsRef.current,
          currentIndexRef.current,
        );
        conceptsRef.current = [...preserved.concepts];
        currentIndexRef.current = preserved.currentIndex;
        if (!offlineRef.current) setLoadMoreError(true);
        reportRetryFailed();
      }
    } finally {
      loadMoreInFlightRef.current = false;
      if (stillCurrent()) {
        setLoadingMore(false);
      }
    }
  }, [fetchBatch, reportRetryFailed, reportRetrySucceeded]);

  useEffect(() => {
    loadMoreConceptsRef.current = loadMoreConcepts;
  }, [loadMoreConcepts]);

  const retryLoadMore = useCallback(() => {
    setLoadMoreError(false);
    resetEmptyRetryCycle('manualRetry');
    void loadMoreConcepts();
  }, [loadMoreConcepts]);

  const onOfflineRetry = useCallback(() => {
    beginOfflineRetry();
    if (conceptsRef.current.length === 0) {
      void loadConcepts();
      return;
    }
    retryLoadMore();
  }, [beginOfflineRetry, loadConcepts, retryLoadMore]);

  useEffect(() => {
    if (offline) return;
    if (loading || concepts.length === 0) return;
    if (loadMoreError || noNextIdea) return;

    const unvisitedAhead = concepts.length - 1 - currentIndex;
    if (unvisitedAhead > UNVISITED_AHEAD_PREFETCH_AT) return;

    void loadMoreConcepts();
  }, [
    offline,
    loading,
    concepts.length,
    currentIndex,
    loadMoreError,
    noNextIdea,
    loadMoreConcepts,
  ]);

  const onSwipeLeft = useCallback(() => {
    const len = conceptsRef.current.length;
    const i = currentIndexRef.current;
    if (len === 0) return;
    // Lz-38: manual forward swipe resets the empty-retry counter.
    resetEmptyRetryCycle('manualForwardSwipe');
    setLoadMoreError(false);
    if (i < len - 1) {
      pendingEndDeckLoadRef.current = false;
      setPendingEndDeckLoad(false);
      currentIndexRef.current = i + 1;
      setCurrentIndex(i + 1);
      return;
    }
    // Offline: keep the last card; status line Retry owns the refetch (Lz-37).
    if (offlineRef.current) return;
    // Stuck on last card: show deck loading UI immediately (do not require loadingMore yet — avoids empty gap).
    pendingEndDeckLoadRef.current = true;
    setPendingEndDeckLoad(true);
    // Index does not change, so the prefetch effect will not re-run; request more explicitly.
    queueMicrotask(() => {
      void loadMoreConceptsRef.current();
    });
  }, []);

  const onSwipeRight = useCallback(() => {
    // Lz-36: back from end-of-deck loading returns to the same last card — do not
    // pop history / walk index (see reduceSwipeRight).
    const next = reduceSwipeRight({
      index: currentIndexRef.current,
      pending: pendingEndDeckLoadRef.current,
    });
    pendingEndDeckLoadRef.current = next.pending;
    setPendingEndDeckLoad(next.pending);
    if (next.index !== currentIndexRef.current) {
      currentIndexRef.current = next.index;
      setCurrentIndex(next.index);
    }
  }, []);

  const prefetchComplexityTree = useCallback(
    async (nextComplexity: number) => {
      const list = conceptsRef.current;
      if (list.length === 0) return;

      const gen = ++fetchGenRef.current;
      const stillCurrent = () => gen === fetchGenRef.current;
      const current = list[currentIndexRef.current];
      const seed = current?.concept?.trim() ?? '';
      const mediaFilter = journeyTestParamsRef.current.onlyWithMedia
        ? { onlyWithMedia: true as const }
        : {};

      try {
        let data: Awaited<ReturnType<typeof fetchConceptRelationships>>;
        let usedSeed = seed.length > 0;
        try {
          data = await fetchBatch(
            nextComplexity,
            {
              ...(usedSeed ? { start: seed } : {}),
              ...mediaFilter,
            },
            { fallbackToDefaultComplexity: false },
          );
        } catch (e) {
          if (e instanceof ApiError && e.status === 404 && usedSeed) {
            data = await fetchBatch(nextComplexity, mediaFilter, {
              fallbackToDefaultComplexity: false,
            });
            usedSeed = false;
          } else {
            throw e;
          }
        }

        if (!stillCurrent()) return;

        const incoming = applyJourneyTestDeck(graphToDeckItems(data), {
          ...journeyTestParamsRef.current,
          localizedConcept: usedSeed ? seed : undefined,
          canonicalConcept: undefined,
        });
        const swapped = applyComplexityTreeSwap(
          conceptsRef.current,
          currentIndexRef.current,
          incoming,
        );

        conceptsRef.current = swapped.concepts;
        setConcepts(swapped.concepts);
        if (swapped.currentIndex !== currentIndexRef.current) {
          currentIndexRef.current = swapped.currentIndex;
          setCurrentIndex(swapped.currentIndex);
        }
        if (swapped.clearedEndDeckLoad) {
          pendingEndDeckLoadRef.current = false;
          setPendingEndDeckLoad(false);
        }
      } catch {
        // Keep the stale tree; the user can keep swiping.
      }
    },
    [fetchBatch],
  );

  const prefetchLateralityTree = useCallback(async () => {
    const gen = ++lateralitySwapGenRef.current;
    // Invalidate in-flight load-more so it cannot append the previous laterality.
    fetchGenRef.current += 1;
    const stillCurrent = () => gen === lateralitySwapGenRef.current;
    const token = ++lateralitySwapTokenRef.current;
    setLateralitySwap({ token });
    // Lz-38: Laterality change resets the empty-retry counter.
    resetEmptyRetryCycle('laterality');
    setLoadMoreError(false);

    const current = conceptsRef.current[currentIndexRef.current];
    const mediaFilter = journeyTestParamsRef.current.onlyWithMedia
      ? { onlyWithMedia: true as const }
      : {};

    try {
      let data: Awaited<ReturnType<typeof fetchConceptRelationships>>;
      try {
        data = await fetchBatch(complexityRef.current, {
          ...(current?.concept ? { start: current.concept } : {}),
          ...mediaFilter,
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          data = await fetchBatch(complexityRef.current, mediaFilter);
        } else {
          throw e;
        }
      }
      if (!stillCurrent()) return;

      const incoming = applyJourneyTestDeck(graphToDeckItems(data), {
        ...journeyTestParamsRef.current,
        localizedConcept: undefined,
        canonicalConcept: undefined,
      });
      const swap = applyLateralityTreeSwap(
        conceptsRef.current,
        incoming,
        currentIndexRef.current,
      );
      conceptsRef.current = swap.concepts;
      currentIndexRef.current = swap.currentIndex;
      pendingEndDeckLoadRef.current = false;
      setConcepts(swap.concepts);
      setCurrentIndex(swap.currentIndex);
      setPendingEndDeckLoad(false);
      setLoadMoreError(false);
      if (shouldPersistLateralityAfterSwap('control', 'success')) {
        void persistLaterality(lateralityRef.current);
      }
      committedLateralityRef.current = lateralityRef.current;
      lateralitySwapActiveRef.current = false;
      setLateralitySwap(null);
    } catch {
      if (!stillCurrent()) return;
      lateralityRef.current = committedLateralityRef.current;
      setLaterality(committedLateralityRef.current);
      lateralitySwapActiveRef.current = false;
      setLateralitySwap(null);
    }
  }, [fetchBatch]);

  const onSelectLaterality = useCallback((grade: LateralityGrade) => {
    if (lateralitySwapActiveRef.current || lateralitySwap != null) return;
    const next = clampLaterality(grade);
    if (next === lateralityRef.current) return;
    lateralityRef.current = next;
    setLaterality(next);
    if (conceptsRef.current.length === 0) {
      if (shouldPersistLateralityAfterSwap('control', 'success')) {
        void persistLaterality(next);
      }
      committedLateralityRef.current = next;
      return;
    }
    lateralitySwapActiveRef.current = true;
    void prefetchLateralityTree();
  }, [lateralitySwap, prefetchLateralityTree]);

  const openLateralitySheet = useCallback(() => {
    if (lateralitySwap != null) return;
    setLateralitySheetOpen(true);
  }, [lateralitySwap]);

  /** Lz-38: Adjust opens the Laterality sheet and resets the empty-retry cycle. */
  const onAdjustNoNextIdea = useCallback(() => {
    resetEmptyRetryCycle('adjust');
    setLoadMoreError(false);
    openLateralitySheet();
  }, [openLateralitySheet]);

  const dismissLateralitySheet = useCallback(() => {
    setLateralitySheetOpen(false);
  }, []);

  const openAppMenu = useCallback(() => {
    setAppMenuOpen(true);
  }, []);

  const dismissAppMenu = useCallback(() => {
    setAppMenuOpen(false);
  }, []);

  const onMotionPreferenceChange = useCallback((pref: MotionPreference) => {
    setMotionPreference(pref);
    void persistMotionPreference(pref);
  }, []);

  const onReplayGestureTipsReady = useCallback((replay: () => void) => {
    replayGestureTipsRef.current = replay;
  }, []);

  const onReplayGestureTips = useCallback(() => {
    replayGestureTipsRef.current();
  }, []);

  const onSelectLocale = useCallback((next: AppLocale) => {
    selectLocale(next, {
      setActive: (locale) => {
        setActiveLocale(locale);
        setLocale(locale);
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          document.title = t('webTitle');
        }
      },
      persist: persistLocale,
    });
  }, []);

  const onCoachTipChange = useCallback(
    (
      tip: {
        text: string;
        animateAppear: boolean;
        onDismiss: () => void;
      } | null,
    ) => {
      if (tip == null) setCoachTipBandHeight(0);
      setCoachTip(tip);
    },
    [],
  );

  const dismissComplexityCue = useCallback(() => {
    setComplexityCue(null);
  }, []);

  const announceComplexity = useCallback((
    grade: number,
    reason: 'session-url' | 'swipe',
  ) => {
    setComplexityCue({
      grade,
      token: Date.now(),
      holdMs: complexityCueHoldMs(reason),
    });
  }, []);

  const onSwipeForwardVertical = useCallback(
    (direction: 'up' | 'down') => {
      const previous = complexityRef.current;
      const next = clampComplexity(previous + (direction === 'up' ? 1 : -1));
      complexityRef.current = next;
      setComplexity(next);
      // Lz-38: Complexity change resets the empty-retry counter.
      resetEmptyRetryCycle('complexity');
      setLoadMoreError(false);
      if (shouldAnnounceComplexity({ reason: 'swipe', previous, next })) {
        announceComplexity(next, 'swipe');
      }
      if (shouldPersistComplexity('swipe')) {
        void persistComplexity(next);
      }

      // Advance like a forward swipe when there is a next card, but do not kick
      // the end-of-deck loader — the complexity prefetch will swap upcoming cards.
      const len = conceptsRef.current.length;
      const i = currentIndexRef.current;
      pendingEndDeckLoadRef.current = false;
      setPendingEndDeckLoad(false);
      if (len > 0 && i < len - 1) {
        currentIndexRef.current = i + 1;
        setCurrentIndex(i + 1);
      }

      void prefetchComplexityTree(next);
    },
    [announceComplexity, prefetchComplexityTree],
  );

  /**
   * Menu Complexity picker (Lz-45): same state as vertical swipe, but keep the
   * current card — do not advance currentIndex.
   */
  const onSelectComplexity = useCallback(
    (grade: number) => {
      const result = applyMenuComplexitySelection(
        {
          complexity: complexityRef.current,
          currentIndex: currentIndexRef.current,
        },
        grade,
      );
      // Menu picker never advances the deck — only complexity may change.
      if (result.complexityChanged) {
        complexityRef.current = result.complexity;
        setComplexity(result.complexity);
        // Lz-38: Complexity change resets the empty-retry counter.
        resetEmptyRetryCycle('complexity');
        setLoadMoreError(false);
        void persistComplexity(result.complexity);
        void prefetchComplexityTree(result.complexity);
      }
    },
    [prefetchComplexityTree],
  );

  const isLastCard = concepts.length > 0 && currentIndex === concepts.length - 1;
  /** Deck slot while waiting at the end — pending alone must show UI before loadingMore flips true (Lz-36). */
  const deckSlotState = resolveDeckSlotState({
    isLastCard,
    pendingEndDeckLoad,
    loadMoreError,
    noNextIdea,
  });
  // Lz-38: only the loading face replaces the card; failure / no-next keep the card readable.
  const showDeckLoading = deckSlotState === 'loading';
  const prefsReady = complexityHydrated && lateralityHydrated && localeReady;

  const menuChromeHeight = practiceMenuChromeHeight();
  const usableHeight = layoutHeight - insets.top - insets.bottom - menuChromeHeight;

  // Intro lockup matches main (animated 4-dot pulse + MIN_INTRO_LOGO_MS). Errors skip the gate.
  // After the intro gate opens, a still-empty deck uses the quiet silhouette (not more logo).
  const showIntroLogo =
    !complexityHydrated ||
    !lateralityHydrated ||
    !localeReady ||
    (!error && !introGateOpen);

  /** Lz-35: after intro, empty deck → quiet silhouette (no decorative pulse on the card). */
  const showInitialLoading = prefsReady && introGateOpen && concepts.length === 0 && !error;
  const showMainDeck = !showIntroLogo && !(error && concepts.length === 0);
  const chromeStatus = resolveDeckChromeStatus({
    offline,
    noNextIdea,
    loadMoreError,
    lateralitySwapping: lateralitySwap != null,
    showInitialLoading,
    showDeckLoading,
  });
  const deckStatusMessage =
    chromeStatus.kind === 'noNextIdea'
      ? t('noNextIdea')
      : chromeStatus.kind === 'fetchFailed'
        ? t('fetchFailed')
        : chromeStatus.kind === 'neighbourhoodLoading'
          ? t('loadingLateralNeighborhood')
          : chromeStatus.kind === 'findingStart'
            ? t('findingStart')
            : chromeStatus.kind === 'loadingMore'
              ? t('loadingMoreIdeas')
              : null;
  const statusActionLabel =
    chromeStatus.kind === 'offline' || chromeStatus.kind === 'fetchFailed'
      ? t('retry')
      : chromeStatus.kind === 'noNextIdea'
        ? t('adjust')
        : undefined;
  const statusActionHandler =
    chromeStatus.kind === 'offline'
      ? onOfflineRetry
      : chromeStatus.kind === 'fetchFailed'
        ? retryLoadMore
        : chromeStatus.kind === 'noNextIdea'
          ? onAdjustNoNextIdea
          : undefined;
  const statusActionTestID =
    chromeStatus.kind === 'noNextIdea' ? 'deck-status-adjust' : 'deck-status-retry';
  const showStatusSlot = offline || deckStatusMessage != null;
  // AD #119: one message in the control region — hide coach tip on failure / no-next.
  const suppressCoachTip =
    chromeStatus.kind === 'fetchFailed' || chromeStatus.kind === 'noNextIdea';
  const visibleCoachTip = suppressCoachTip ? null : coachTip;

  useEffect(() => {
    if (!showMainDeck) return;
    const pending = resolveSessionComplexityToAnnounce({
      alreadyAnnounced: announcedSessionComplexityRef.current,
      pending: pendingSessionComplexity,
      routeComplexity,
      rememberedComplexity:
        readJourneyTestParams().complexity ?? journeyTestParamsRef.current.complexity,
    });
    if (pending == null) return;
    announcedSessionComplexityRef.current = true;
    setPendingSessionComplexity(null);
    if (shouldKeepSessionComplexityMark('session-url')) {
      setShowSessionComplexityMark(true);
    }
    announceComplexity(pending, 'session-url');
  }, [announceComplexity, pendingSessionComplexity, routeComplexity, showMainDeck]);

  if (showIntroLogo) {
    return (
      <View style={[styles.loadingRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar style="light" />
        <LateralzrLogo animate />
      </View>
    );
  }

  if (error && concepts.length === 0) {
    return (
      <View style={[styles.loadingRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar style="light" />
        <LateralzrLogo animate={false} />
        <Text style={[styles.error, textStyle('body')]}>{error}</Text>
        <Pressable onPress={() => loadConcepts()} style={styles.retryBtn}>
          <Text style={[styles.retryText, textStyle('row')]}>{t('retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <MotionPreferenceProvider value={motionPreference}>
    <View
      style={[
        styles.mainRoot,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          minHeight: layoutHeight,
          height: layoutHeight,
        },
      ]}
    >
      <StatusBar style="light" />
      {/* §4.5 / AD: ellipsis in its own petrol band above the card (not overlaid). */}
      {APP_MENU_TRIGGER_ENABLED ? (
        <View
          style={[styles.menuChrome, { height: menuChromeHeight }]}
          testID="app-menu-chrome"
          pointerEvents="box-none"
        >
          <AppMenuTrigger ref={appMenuTriggerRef} onPress={openAppMenu} />
        </View>
      ) : null}
      {(() => {
        const controlGap = lateralityCardGap(usableHeight);
        const tipBand = visibleCoachTip
          ? Math.max(coachTipBandHeight, coachHintSlotHeight())
          : 0;
        // Shrink the card by tip band + one flex gap so Laterality stays put (AD Lz-48).
        const tipReserve = visibleCoachTip ? tipBand + controlGap : 0;
        const cardLateralityGroup = (
          <View
            style={[styles.cardLateralityGroup, { gap: controlGap }]}
            testID="card-laterality-group"
          >
            <ConceptCardStack
              ref={cardStackRef}
              concepts={concepts}
              currentIndex={currentIndex}
              complexity={complexity}
              onSwipeLeft={onSwipeLeft}
              onSwipeRight={onSwipeRight}
              onSwipeForwardVertical={onSwipeForwardVertical}
              availableHeight={
                cardStackAvailableHeight(usableHeight, lateralityControlHeight) -
                (accessibleNavVisible ? accessibleNavHeight : 0) -
                tipReserve
              }
              preloadedMediaUrls={preloadedMediaUrls}
              showDeckLoading={showDeckLoading}
              showInitialLoading={showInitialLoading}
              loadMoreError={loadMoreError || noNextIdea}
              sheetOpen={lateralitySheetOpen || appMenuOpen}
              onReplayGestureTipsReady={onReplayGestureTipsReady}
              onCoachTipChange={onCoachTipChange}
            />
            {accessibleNavVisible ? (
              <AccessibleNavRow
                currentIndex={currentIndex}
                showDeckStatus={showDeckLoading}
                sheetOpen={lateralitySheetOpen || appMenuOpen}
                onHeightChange={setAccessibleNavHeight}
                onAction={(action) => {
                  cardStackRef.current?.runAction(action);
                }}
              />
            ) : null}
            {visibleCoachTip ? (
              <View
                style={styles.coachTipSlot}
                testID="coach-tip-slot"
                onLayout={(e) => setCoachTipBandHeight(e.nativeEvent.layout.height)}
              >
                <CoachHint
                  text={visibleCoachTip.text}
                  animateAppear={visibleCoachTip.animateAppear}
                  surface="shell"
                  onDismiss={visibleCoachTip.onDismiss}
                />
              </View>
            ) : null}
            <LateralityControl
              laterality={laterality}
              swapping={lateralitySwap != null}
              onSelectLaterality={onSelectLaterality}
              onHeightChange={setLateralityControlHeight}
              onPressLabel={openLateralitySheet}
              labelRef={lateralityLabelRef}
              statusSlot={
                showStatusSlot ? (
                  <DeckStatusLine
                    message={deckStatusMessage}
                    offline={offline}
                    offlineLabel={t('offline')}
                    actionLabel={statusActionLabel}
                    onAction={statusActionHandler}
                    actionTestID={statusActionTestID}
                    shouldAnnounceOffline={shouldAnnounceOffline}
                    onOfflineAnnounced={consumeOfflineAnnounce}
                  />
                ) : undefined
              }
            />
            {complexityCue ? (
              <View
                style={[
                  styles.complexityCueSlot,
                  {
                    bottom:
                      lateralityControlHeight + (visibleCoachTip ? tipBand + controlGap : 4),
                  },
                ]}
                pointerEvents="none"
              >
                <ComplexityCue
                  grade={complexityCue.grade}
                  token={complexityCue.token}
                  holdMs={complexityCue.holdMs}
                  onHidden={dismissComplexityCue}
                />
              </View>
            ) : showSessionComplexityMark && !visibleCoachTip ? (
              <View
                style={[styles.complexityCueSlot, { bottom: lateralityControlHeight + 4 }]}
                pointerEvents="none"
              >
                <ComplexitySessionMark grade={complexity} />
              </View>
            ) : null}
          </View>
        );
        const a11yHide =
          lateralitySheetOpen || appMenuOpen ? 'no-hide-descendants' : 'auto';
        // Scroll only when the assistive row is on (wrap 3+2) so laterality stays reachable.
        // Keep a plain View for the default gesture shell so shared captures stay unchanged.
        if (accessibleNavVisible) {
          return (
            <ScrollView
              style={[styles.practiceColumn, { maxHeight: usableHeight, flex: 1 }]}
              contentContainerStyle={{ minHeight: usableHeight }}
              testID="practice-column"
              importantForAccessibility={a11yHide}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {cardLateralityGroup}
            </ScrollView>
          );
        }
        return (
          <View
            style={[styles.practiceColumn, { minHeight: usableHeight, flex: 1 }]}
            testID="practice-column"
            importantForAccessibility={a11yHide}
          >
            {cardLateralityGroup}
          </View>
        );
      })()}
      <LateralitySheet
        visible={lateralitySheetOpen}
        laterality={laterality}
        onDismiss={dismissLateralitySheet}
        onSelectLaterality={onSelectLaterality}
        returnFocusRef={lateralityLabelRef}
      />
      <AppMenuSheet
        visible={appMenuOpen}
        onDismiss={dismissAppMenu}
        onReplayGestureTips={onReplayGestureTips}
        locale={locale}
        onSelectLocale={onSelectLocale}
        currentComplexity={complexity}
        onSelectComplexity={onSelectComplexity}
        returnFocusRef={appMenuTriggerRef}
        motionPreference={motionPreference}
        onMotionPreferenceChange={onMotionPreferenceChange}
      />
    </View>
    </MotionPreferenceProvider>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: color.front,
    paddingHorizontal: 24,
  },
  mainRoot: {
    backgroundColor: color.shell,
    width: '100%',
  },
  /** Top-right ellipsis band on petrol — card starts below (Lz-32 Art Director). */
  menuChrome: {
    width: '100%',
    maxWidth: PRACTICE_COLUMN_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: practiceScreenGutter(),
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 30,
  },
  /** Centred practice column for tablets / wide native; web phone frame already ≤430. */
  practiceColumn: {
    width: '100%',
    maxWidth: PRACTICE_COLUMN_MAX_WIDTH,
    alignSelf: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  cardLateralityGroup: {
    width: '100%',
    position: 'relative',
  },
  /** Above the laterality control, never on that row. */
  complexityCueSlot: {
    position: 'absolute',
    left: practiceScreenGutter(),
    right: practiceScreenGutter(),
    alignItems: 'center',
    zIndex: 20,
    elevation: 20,
  },
  /** §12.3 tip chip — in-flow between card and Laterality (flex gap ≥ 8px clear). */
  coachTipSlot: {
    width: '100%',
    paddingHorizontal: practiceScreenGutter(),
    alignItems: 'center',
  },
  error: {
    color: color.ink,
    textAlign: 'center',
    marginTop: 20,
    opacity: 0.9,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  retryText: {
    color: color.ink,
    textDecorationLine: 'underline',
  },
});
