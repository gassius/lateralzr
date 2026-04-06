import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ConceptCard } from './ConceptCard';
import type { ConceptItem } from '@/lib/api';

type ConceptCardStackProps = {
  concepts: ConceptItem[];
  currentIndex: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  availableHeight: number;
  preloadedMediaUrls: ReadonlySet<string>;
};

const SWIPE_THRESHOLD = 56;
const springConfig = { damping: 22, stiffness: 220 };
/** Pan only activates after this horizontal movement so taps go to Gesture.Tap */
const PAN_ACTIVE_OFFSET = 18;

export function ConceptCardStack({
  concepts,
  currentIndex,
  onSwipeLeft,
  onSwipeRight,
  availableHeight,
  preloadedMediaUrls,
}: ConceptCardStackProps) {
  const translateX = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);

  const cardAreaHeight = Math.max(320, availableHeight);

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

  const composed = Gesture.Exclusive(tap, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (concepts.length === 0) return null;

  const item = concepts[currentIndex]!;
  const mediaUri = item.mediaUrl?.trim() ?? '';
  const isMediaPrefetched = mediaUri !== '' && preloadedMediaUrls.has(mediaUri);

  return (
    <View style={styles.outer}>
      <GestureDetector gesture={composed}>
        <Animated.View
          key={currentIndex}
          style={[styles.cardWrap, { height: cardAreaHeight }, animatedStyle]}
        >
          <ConceptCard item={item} flipped={flipped} isMediaPrefetched={isMediaPrefetched} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
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
