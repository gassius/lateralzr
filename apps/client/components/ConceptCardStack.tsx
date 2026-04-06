import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
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
  const [flipped, setFlipped] = useState(false);

  const cardAreaHeight = Math.max(320, availableHeight);

  const isLastCard = concepts.length > 0 && currentIndex === concepts.length - 1;
  const showDeckStatus = useMemo(
    () => isLastCard && (loadingMore || loadMoreError),
    [isLastCard, loadingMore, loadMoreError],
  );

  const deckStatusVariant = loadMoreError ? 'error' : 'loading';

  useEffect(() => {
    translateX.value = 0;
  }, [currentIndex]);

  useEffect(() => {
    setFlipped(false);
  }, [currentIndex]);

  const toggleFlip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  const tap = Gesture.Tap()
    .maxDistance(14)
    .onEnd(() => {
      runOnJS(toggleFlip)();
    });

  const pan = Gesture.Pan()
    .activeOffsetX([-PAN_ACTIVE_OFFSET, PAN_ACTIVE_OFFSET])
    .onUpdate((e: { translationX: number }) => {
      translateX.value = e.translationX;
    })
    .onEnd(
      (e: {
        translationX: number;
        translationY: number;
        velocityX: number;
        velocityY: number;
      }) => {
        const goLeft = e.translationX < -SWIPE_THRESHOLD || e.velocityX < -180;
        const goRight = e.translationX > SWIPE_THRESHOLD || e.velocityX > 180;

        if (goLeft) {
          translateX.value = 0;
          runOnJS(onSwipeLeft)();
          return;
        }
        if (goRight) {
          translateX.value = 0;
          runOnJS(onSwipeRight)();
          return;
        }
        translateX.value = withSpring(0, springConfig);
      },
    );

  const composed = showDeckStatus ? pan : Gesture.Exclusive(tap, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (concepts.length === 0) return null;

  return (
    <View style={styles.outer}>
      <GestureDetector gesture={composed}>
        <Animated.View
          key={showDeckStatus ? `deck-${deckStatusVariant}-${currentIndex}` : currentIndex}
          style={[styles.cardWrap, { height: cardAreaHeight }, animatedStyle]}
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
  },
});
