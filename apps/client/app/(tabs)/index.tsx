import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';
import { ConceptCardStack } from '@/components/ConceptCardStack';
import { fetchConceptRelationships, type ConceptItem } from '@/lib/api';

export default function TabOneScreen() {
  const [concepts, setConcepts] = useState<ConceptItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadConcepts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
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
      setRefreshing(false);
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

  if (loading && concepts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.message}>Loading concepts…</Text>
      </View>
    );
  }

  if (error && concepts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Text style={styles.message} onPress={() => loadConcepts()}>
          Tap to retry
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadConcepts(true)} />
      }
    >
      <ConceptCardStack
        concepts={concepts}
        currentIndex={currentIndex}
        onSwipeLeft={onSwipeLeft}
        onSwipeRight={onSwipeRight}
      />
      <Text style={styles.hint}>Swipe left: next · Swipe right: previous</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: { marginTop: 12, fontSize: 16 },
  error: { color: '#c00', textAlign: 'center', fontSize: 16 },
  hint: {
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.7,
    marginTop: 8,
  },
});
