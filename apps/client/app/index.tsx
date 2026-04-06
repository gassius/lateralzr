import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConceptCardStack } from '@/components/ConceptCardStack';
import { LateralzrLogo } from '@/components/LateralzrLogo';
import { useConceptMediaPreload } from '@/hooks/useConceptMediaPreload';
import { fetchConceptRelationships, type ConceptItem } from '@/lib/api';
import { mergeUniqueRelated } from '@/lib/mergeConcepts';
import { Palette } from '@/constants/Colors';

/**
 * Prefetch the next API batch when at most this many concepts remain **ahead** of the
 * current card (not counting the card you’re on). So with 2: when you still have two
 * cards to swipe to that you haven’t opened yet, we already request more.
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

  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  const conceptsRef = useRef(concepts);
  const loadMoreInFlightRef = useRef(false);
  const emptyRetryDelayRef = useRef(INITIAL_EMPTY_RETRY_MS);
  const emptyRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreConceptsRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    conceptsRef.current = concepts;
  }, [concepts]);

  const { preloadedMediaUrls } = useConceptMediaPreload(concepts, currentIndex);

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
    clearEmptyRetry();
    emptyRetryDelayRef.current = INITIAL_EMPTY_RETRY_MS;
    try {
      const data = await fetchConceptRelationships({ count: 5 });
      const list: ConceptItem[] = [data.seed, ...data.related_concepts];
      setConcepts(list);
      setCurrentIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load concepts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConcepts();
  }, [loadConcepts]);

  const loadMoreConcepts = useCallback(async () => {
    if (loadMoreInFlightRef.current) return;

    clearEmptyRetry();

    const list = conceptsRef.current;
    if (list.length === 0) return;

    const seed = list[list.length - 1]?.concept?.trim();
    if (!seed) return;

    loadMoreInFlightRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);

    try {
      const data = await fetchConceptRelationships({ seed, count: 5 });
      const related = data.related_concepts ?? [];

      const merged = mergeUniqueRelated(conceptsRef.current, related);

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
          const fresh = mergeUniqueRelated(prev, related);
          if (fresh.length === 0) return prev;
          return [...prev, ...fresh];
        });
      }
    } catch {
      setLoadMoreError(true);
    } finally {
      loadMoreInFlightRef.current = false;
      setLoadingMore(false);
    }
  }, []);

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
    setCurrentIndex((i) => Math.min(i + 1, Math.max(0, concepts.length - 1)));
  }, [concepts.length]);

  const onSwipeRight = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const usableHeight = windowHeight - insets.top - insets.bottom;

  if (loading && concepts.length === 0) {
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
          availableHeight={usableHeight}
          preloadedMediaUrls={preloadedMediaUrls}
          loadingMore={loadingMore}
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
