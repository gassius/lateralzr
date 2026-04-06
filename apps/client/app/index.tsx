import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConceptCardStack } from '@/components/ConceptCardStack';
import { LateralzrLogo } from '@/components/LateralzrLogo';
import { useConceptMediaPreload } from '@/hooks/useConceptMediaPreload';
import { fetchConceptRelationships, type ConceptItem } from '@/lib/api';
import { Palette } from '@/constants/Colors';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [concepts, setConcepts] = useState<ConceptItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { preloadedMediaUrls } = useConceptMediaPreload(concepts, currentIndex);

  const loadConcepts = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  const onSwipeLeft = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, concepts.length - 1));
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
