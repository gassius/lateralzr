import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ComplexityCue } from '@/components/ComplexityCue';
import { ConceptCardStack } from '@/components/ConceptCardStack';
import { LateralitySubmenu } from '@/components/LateralitySubmenu';
import { LateralzrLogo } from '@/components/LateralzrLogo';
import { useWebPhoneFrameSize } from '@/components/WebPhoneFrame';
import { useConceptMediaPreload } from '@/hooks/useConceptMediaPreload';
import { ApiError, fetchConceptRelationships, type ConceptItem, DEFAULT_CONCEPT_COMPLEXITY } from '@/lib/api';
import { applyAppendedBatch, applyComplexityTreeSwap, graphToDeckItems, planLoadMoreMerge } from '@/lib/conceptDeck';
import { Palette } from '@/constants/Colors';
import { shouldAnnounceComplexity } from '@/lib/complexityFeedback';
import { clampComplexity, loadStoredComplexity, persistComplexity } from '@/lib/complexityStorage';
import { getActiveLocale, t } from '@/lib/i18n';
import { remainingIntroMs } from '@/lib/introLogo';
import {
  applyLateralityTreeSwap,
  DEFAULT_LATERALITY,
  resolveHydratedLaterality,
  shouldPersistLaterality,
  stepLaterality,
  type LateralityGrade,
} from '@/lib/laterality';
import {
  cardStackAvailableHeight,
  LATERALITY_CARD_GAP,
} from '@/lib/lateralityChrome';
import { loadStoredLaterality, persistLaterality } from '@/lib/lateralityStorage';
import { applyResolvedLocale } from '@/lib/locale';
import {
  applyJourneyTestDeck,
  journeyStartOptions,
  readJourneyTestParams,
  resolveHydratedComplexity,
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

const INITIAL_EMPTY_RETRY_MS = 1500;
const MAX_EMPTY_RETRY_MS = 30_000;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
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
  const [complexityCue, setComplexityCue] = useState<{ grade: number; token: number } | null>(null);
  const [laterality, setLaterality] = useState<LateralityGrade>(DEFAULT_LATERALITY);
  const [lateralityHydrated, setLateralityHydrated] = useState(false);
  const [swappingLaterality, setSwappingLaterality] = useState(false);
  const [localeReady, setLocaleReady] = useState(false);

  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  /** True only after the user swipes forward from the last card while waiting for more items. */
  const [pendingEndDeckLoad, setPendingEndDeckLoad] = useState(false);

  const conceptsRef = useRef(concepts);
  const currentIndexRef = useRef(currentIndex);
  const loadMoreInFlightRef = useRef(false);
  const fetchGenRef = useRef(0);
  const emptyRetryDelayRef = useRef(INITIAL_EMPTY_RETRY_MS);
  const emptyRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreConceptsRef = useRef<() => Promise<void>>(async () => {});
  const pendingEndDeckLoadRef = useRef(false);
  const complexityRef = useRef(complexity);
  const lateralityRef = useRef(laterality);
  const announcedSessionComplexityRef = useRef(false);
  const lateralitySwapGenRef = useRef(0);
  const journeyTestParamsRef = useRef(readJourneyTestParams());

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
    applyResolvedLocale();
    setLocaleReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadStoredComplexity().then((stored) => {
      if (cancelled) return;
      const hydrated = resolveHydratedComplexity(journeyTestParamsRef.current, stored);
      complexityRef.current = hydrated.complexity;
      setComplexity(hydrated.complexity);
      if (hydrated.persist && shouldPersistComplexity('hydrate')) {
        void persistComplexity(hydrated.complexity);
      }
      setComplexityHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadStoredLaterality().then((stored) => {
      if (cancelled) return;
      const hydrated = resolveHydratedLaterality(journeyTestParamsRef.current.laterality, stored);
      lateralityRef.current = hydrated.laterality;
      setLaterality(hydrated.laterality);
      if (hydrated.persist && shouldPersistLaterality('hydrate')) {
        void persistLaterality(hydrated.laterality);
      }
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
          if (shouldPersistComplexity('fallback')) {
            void persistComplexity(DEFAULT_CONCEPT_COMPLEXITY);
          }
          return data;
        }
        throw e;
      }
    },
    [setComplexity],
  );

  function clearEmptyRetry() {
    if (emptyRetryTimerRef.current != null) {
      clearTimeout(emptyRetryTimerRef.current);
      emptyRetryTimerRef.current = null;
    }
  }

  useEffect(
    () => () => {
      clearEmptyRetry();
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
    clearEmptyRetry();
    emptyRetryDelayRef.current = INITIAL_EMPTY_RETRY_MS;
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
    } catch (e) {
      if (gen !== fetchGenRef.current) return;
      setError(e instanceof Error ? e.message : t('failedToLoadConcepts'));
    } finally {
      if (gen === fetchGenRef.current) {
        setLoading(false);
      }
    }
  }, [fetchBatch]);

  useEffect(() => {
    if (!complexityHydrated || !lateralityHydrated || !localeReady) return;
    void loadConcepts();
  }, [complexityHydrated, lateralityHydrated, localeReady, loadConcepts]);

  const loadMoreConcepts = useCallback(async () => {
    if (loadMoreInFlightRef.current) return;

    clearEmptyRetry();

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
        const delay = emptyRetryDelayRef.current;
        emptyRetryTimerRef.current = setTimeout(() => {
          emptyRetryTimerRef.current = null;
          void loadMoreConceptsRef.current();
        }, delay);
        emptyRetryDelayRef.current = Math.min(delay * 2, MAX_EMPTY_RETRY_MS);
        return;
      }

      emptyRetryDelayRef.current = INITIAL_EMPTY_RETRY_MS;
      clearEmptyRetry();

      const applied = applyAppendedBatch(conceptsRef.current, plan.add, pendingEndDeckLoadRef.current);
      conceptsRef.current = applied.concepts;
      pendingEndDeckLoadRef.current = applied.pendingEndDeckLoad;
      setConcepts(applied.concepts);
      setPendingEndDeckLoad(applied.pendingEndDeckLoad);
      if (applied.nextIndex != null) {
        currentIndexRef.current = applied.nextIndex;
        setCurrentIndex(applied.nextIndex);
      }
    } catch {
      if (stillCurrent()) setLoadMoreError(true);
    } finally {
      loadMoreInFlightRef.current = false;
      if (stillCurrent()) {
        setLoadingMore(false);
      }
    }
  }, [fetchBatch]);

  useEffect(() => {
    loadMoreConceptsRef.current = loadMoreConcepts;
  }, [loadMoreConcepts]);

  const retryLoadMore = useCallback(() => {
    setLoadMoreError(false);
    emptyRetryDelayRef.current = INITIAL_EMPTY_RETRY_MS;
    void loadMoreConcepts();
  }, [loadMoreConcepts]);

  useEffect(() => {
    if (loading || concepts.length === 0) return;
    if (loadMoreError) return;

    const unvisitedAhead = concepts.length - 1 - currentIndex;
    if (unvisitedAhead > UNVISITED_AHEAD_PREFETCH_AT) return;

    void loadMoreConcepts();
  }, [loading, concepts.length, currentIndex, loadMoreError, loadMoreConcepts]);

  const onSwipeLeft = useCallback(() => {
    const len = conceptsRef.current.length;
    const i = currentIndexRef.current;
    if (len === 0) return;
    if (i < len - 1) {
      pendingEndDeckLoadRef.current = false;
      setPendingEndDeckLoad(false);
      currentIndexRef.current = i + 1;
      setCurrentIndex(i + 1);
      return;
    }
    // Stuck on last card: show deck loading UI immediately (do not require loadingMore yet — avoids empty gap).
    pendingEndDeckLoadRef.current = true;
    setPendingEndDeckLoad(true);
    // Index does not change, so the prefetch effect will not re-run; request more explicitly.
    queueMicrotask(() => {
      void loadMoreConceptsRef.current();
    });
  }, []);

  const onSwipeRight = useCallback(() => {
    pendingEndDeckLoadRef.current = false;
    setPendingEndDeckLoad(false);
    setCurrentIndex((i) => Math.max(i - 1, 0));
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
    setSwappingLaterality(true);

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
    } catch {
      // Keep the visible tree; the new laterality still applies to later fetches.
    } finally {
      if (stillCurrent()) setSwappingLaterality(false);
    }
  }, [fetchBatch]);

  const onChangeLaterality = useCallback((delta: -1 | 1) => {
    const next = stepLaterality(lateralityRef.current, delta);
    if (next === lateralityRef.current) return;
    lateralityRef.current = next;
    setLaterality(next);
    if (shouldPersistLaterality('control')) {
      void persistLaterality(next);
    }
    if (conceptsRef.current.length === 0) return;
    void prefetchLateralityTree();
  }, [prefetchLateralityTree]);

  const dismissComplexityCue = useCallback(() => {
    setComplexityCue(null);
  }, []);

  const announceComplexity = useCallback((grade: number) => {
    setComplexityCue({ grade, token: Date.now() });
  }, []);

  useEffect(() => {
    if (announcedSessionComplexityRef.current) return;
    if (!complexityHydrated || !lateralityHydrated || !localeReady || !introGateOpen) return;
    if (loading && concepts.length === 0) return;
    if (error && concepts.length === 0) return;

    const sessionComplexity = readJourneyTestParams().complexity;
    if (sessionComplexity == null) {
      announcedSessionComplexityRef.current = true;
      return;
    }
    if (!shouldAnnounceComplexity({ reason: 'session-url', complexity: sessionComplexity })) return;

    announcedSessionComplexityRef.current = true;
    announceComplexity(complexity);
  }, [
    announceComplexity,
    complexity,
    complexityHydrated,
    concepts.length,
    error,
    introGateOpen,
    lateralityHydrated,
    loading,
    localeReady,
  ]);

  const onSwipeForwardVertical = useCallback(
    (direction: 'up' | 'down') => {
      const previous = complexityRef.current;
      const next = clampComplexity(previous + (direction === 'up' ? 1 : -1));
      complexityRef.current = next;
      setComplexity(next);
      if (shouldAnnounceComplexity({ reason: 'swipe', previous, next })) {
        announceComplexity(next);
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

  const isLastCard = concepts.length > 0 && currentIndex === concepts.length - 1;
  /** Deck status card while waiting at the end — pending alone must show UI before loadingMore flips true. */
  const showDeckLoading = isLastCard && (loadMoreError || pendingEndDeckLoad);

  const usableHeight = layoutHeight - insets.top - insets.bottom;

  // Keep the animated logo up until data is ready AND the min intro duration has elapsed.
  // Errors skip the intro gate so failures are not delayed.
  const showIntroLogo =
    !complexityHydrated ||
    !lateralityHydrated ||
    !localeReady ||
    (loading && concepts.length === 0) ||
    (!error && concepts.length > 0 && !introGateOpen);

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
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={() => loadConcepts()} style={styles.retryBtn}>
          <Text style={styles.retryText}>{t('tapToRetry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
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
      <View style={[styles.stackShell, { minHeight: usableHeight, flex: 1 }]}>
        <View style={styles.cardLateralityGroup} testID="card-laterality-group">
          <ConceptCardStack
            concepts={concepts}
            currentIndex={currentIndex}
            complexity={complexity}
            onSwipeLeft={onSwipeLeft}
            onSwipeRight={onSwipeRight}
            onSwipeForwardVertical={onSwipeForwardVertical}
            availableHeight={cardStackAvailableHeight(usableHeight)}
            preloadedMediaUrls={preloadedMediaUrls}
            showDeckLoading={showDeckLoading}
            loadMoreError={loadMoreError}
            onRetryLoadMore={retryLoadMore}
          />
          <LateralitySubmenu
            laterality={laterality}
            swapping={swappingLaterality}
            onDecrease={() => onChangeLaterality(-1)}
            onIncrease={() => onChangeLaterality(1)}
          />
        </View>
        {complexityCue ? (
          <ComplexityCue
            grade={complexityCue.grade}
            token={complexityCue.token}
            onHidden={dismissComplexityCue}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Palette.orange,
    paddingHorizontal: 24,
  },
  mainRoot: {
    backgroundColor: Palette.darkBlue,
    width: '100%',
  },
  stackShell: {
    width: '100%',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  cardLateralityGroup: {
    width: '100%',
    gap: LATERALITY_CARD_GAP,
  },
  error: {
    color: Palette.black,
    textAlign: 'center',
    fontSize: 16,
    marginTop: 20,
    opacity: 0.9,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  retryText: {
    color: Palette.black,
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
