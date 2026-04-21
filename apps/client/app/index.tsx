import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConceptCardStack } from '@/components/ConceptCardStack';
import { LateralzrLogo } from '@/components/LateralzrLogo';
import { useConceptMediaPreload } from '@/hooks/useConceptMediaPreload';
import { ApiError, fetchConceptRelationships, type ConceptItem, DEFAULT_CONCEPT_COMPLEXITY } from '@/lib/api';
import { mergeUniqueRelated } from '@/lib/mergeConcepts';
import { Palette } from '@/constants/Colors';
import { clampComplexity, loadStoredComplexity, persistComplexity } from '@/lib/complexityStorage';

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
  const [concepts, setConcepts] = useState<ConceptItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [complexity, setComplexity] = useState(DEFAULT_CONCEPT_COMPLEXITY);
  const [complexityHydrated, setComplexityHydrated] = useState(false);

  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  /** True only after the user swipes forward from the last card while waiting for more items. */
  const [pendingEndDeckLoad, setPendingEndDeckLoad] = useState(false);

  const conceptsRef = useRef(concepts);
  const currentIndexRef = useRef(currentIndex);
  const loadMoreInFlightRef = useRef(false);
  const emptyRetryDelayRef = useRef(INITIAL_EMPTY_RETRY_MS);
  const emptyRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreConceptsRef = useRef<() => Promise<void>>(async () => {});
  const pendingEndDeckLoadRef = useRef(false);
  const complexityRef = useRef(complexity);

  useEffect(() => {
    complexityRef.current = complexity;
  }, [complexity]);

  useEffect(() => {
    conceptsRef.current = concepts;
  }, [concepts]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    pendingEndDeckLoadRef.current = pendingEndDeckLoad;
  }, [pendingEndDeckLoad]);

  useEffect(() => {
    let cancelled = false;
    void loadStoredComplexity().then((c) => {
      if (!cancelled) {
        setComplexity(c);
        setComplexityHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { preloadedMediaUrls } = useConceptMediaPreload(concepts, currentIndex);

  const fetchBatch = useCallback(
    async (requestedComplexity: number, seed?: string) => {
      const trimmedSeed = seed?.trim() ?? '';
      try {
        return await fetchConceptRelationships({
          seed: trimmedSeed !== '' ? trimmedSeed : undefined,
          count: 5,
          complexity: requestedComplexity,
        });
      } catch (e) {
        // Backend only has prefetched data for some complexities (often just 2).
        // If the requested complexity isn't prefetched yet, fall back to the default tier.
        if (e instanceof ApiError && e.status === 404 && requestedComplexity !== DEFAULT_CONCEPT_COMPLEXITY) {
          const data = await fetchConceptRelationships({
            seed: trimmedSeed !== '' ? trimmedSeed : undefined,
            count: 5,
            complexity: DEFAULT_CONCEPT_COMPLEXITY,
          });
          complexityRef.current = DEFAULT_CONCEPT_COMPLEXITY;
          setComplexity(DEFAULT_CONCEPT_COMPLEXITY);
          void persistComplexity(DEFAULT_CONCEPT_COMPLEXITY);
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
    setLoading(true);
    setError(null);
    setLoadMoreError(false);
    setPendingEndDeckLoad(false);
    pendingEndDeckLoadRef.current = false;
    clearEmptyRetry();
    emptyRetryDelayRef.current = INITIAL_EMPTY_RETRY_MS;
    try {
      // Initial load: never send a seed (cold start)
      const data = await fetchBatch(complexityRef.current);
      const list: ConceptItem[] = [data.seed, ...data.related_concepts];
      setConcepts(list);
      setCurrentIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load concepts');
    } finally {
      setLoading(false);
    }
  }, [fetchBatch]);

  useEffect(() => {
    if (!complexityHydrated) return;
    void loadConcepts();
  }, [complexityHydrated, loadConcepts]);

  const loadMoreConcepts = useCallback(async () => {
    if (loadMoreInFlightRef.current) return;

    clearEmptyRetry();

    const list = conceptsRef.current;
    if (list.length === 0) return;

    loadMoreInFlightRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);

    try {
      // Load more: try to continue the chain using the last card as the next seed.
      // If that seed has no prefetched relationships yet (404), fall back to cold start.
      const seed = list[list.length - 1]?.concept?.trim() ?? '';
      let data: Awaited<ReturnType<typeof fetchConceptRelationships>>;
      try {
        data = await fetchBatch(complexityRef.current, seed);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          data = await fetchBatch(complexityRef.current);
        } else {
          throw e;
        }
      }

      const batch: ConceptItem[] = [data.seed, ...(data.related_concepts ?? [])];
      const existing = conceptsRef.current;
      const seen = new Set(existing.map((c) => c.concept.trim().toLowerCase()));
      const freshBatch = batch.filter((c) => {
        const k = c.concept.trim().toLowerCase();
        return k.length > 0 && !seen.has(k);
      });

      const merged = freshBatch.length > 0 ? freshBatch : [];

      if (merged.length === 0) {
        const delay = emptyRetryDelayRef.current;
        emptyRetryTimerRef.current = setTimeout(() => {
          emptyRetryTimerRef.current = null;
          void loadMoreConceptsRef.current();
        }, delay);
        emptyRetryDelayRef.current = Math.min(delay * 2, MAX_EMPTY_RETRY_MS);
      } else {
        emptyRetryDelayRef.current = INITIAL_EMPTY_RETRY_MS;
        clearEmptyRetry();
        setConcepts((prev) => {
          const nextSeen = new Set(prev.map((c) => c.concept.trim().toLowerCase()));
          const add = merged.filter((c) => {
            const k = c.concept.trim().toLowerCase();
            return k.length > 0 && !nextSeen.has(k);
          });
          if (add.length === 0) return prev;
          const next = [...prev, ...add];
          if (pendingEndDeckLoadRef.current) {
            queueMicrotask(() => {
              setCurrentIndex(prev.length);
              pendingEndDeckLoadRef.current = false;
              setPendingEndDeckLoad(false);
            });
          }
          return next;
        });
      }
    } catch {
      setLoadMoreError(true);
    } finally {
      loadMoreInFlightRef.current = false;
      setLoadingMore(false);
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

  const onSwipeForwardVertical = useCallback(
    (direction: 'up' | 'down') => {
      const next = clampComplexity(complexityRef.current + (direction === 'up' ? 1 : -1));
      complexityRef.current = next;
      setComplexity(next);
      void persistComplexity(next);
      onSwipeLeft();
    },
    [onSwipeLeft],
  );

  const isLastCard = concepts.length > 0 && currentIndex === concepts.length - 1;
  /** Deck status card while waiting at the end — pending alone must show UI before loadingMore flips true. */
  const showDeckLoading = isLastCard && (loadMoreError || pendingEndDeckLoad);

  const usableHeight = windowHeight - insets.top - insets.bottom;

  if (!complexityHydrated || (loading && concepts.length === 0)) {
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
          <Text style={styles.retryText}>Tap to retry</Text>
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
          minHeight: windowHeight,
          height: windowHeight,
        },
      ]}
    >
      <StatusBar style="light" />
      <View style={[styles.stackShell, { minHeight: usableHeight, flex: 1 }]}>
        <ConceptCardStack
          concepts={concepts}
          currentIndex={currentIndex}
          onSwipeLeft={onSwipeLeft}
          onSwipeRight={onSwipeRight}
          onSwipeForwardVertical={onSwipeForwardVertical}
          availableHeight={usableHeight}
          preloadedMediaUrls={preloadedMediaUrls}
          showDeckLoading={showDeckLoading}
          loadMoreError={loadMoreError}
          onRetryLoadMore={retryLoadMore}
        />
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
