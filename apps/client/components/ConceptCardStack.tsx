import { useEffect } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';
import { ConceptCard } from './ConceptCard';
import type { ConceptItem } from '@/lib/api';

type ConceptCardStackProps = {
  concepts: ConceptItem[];
  currentIndex: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
};

const SWIPE_THRESHOLD = 60;
const springConfig = { damping: 20, stiffness: 200 };

export function ConceptCardStack({
  concepts,
  currentIndex,
  onSwipeLeft,
  onSwipeRight,
}: ConceptCardStackProps) {
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = 0;
  }, [currentIndex]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const goLeft = e.translationX < -SWIPE_THRESHOLD || e.velocityX < -200;
      const goRight = e.translationX > SWIPE_THRESHOLD || e.velocityX > 200;
      if (goLeft) {
        translateX.value = withSpring(-400, springConfig, () => runOnJS(onSwipeLeft)());
      } else if (goRight) {
        translateX.value = withSpring(400, springConfig, () => runOnJS(onSwipeRight)());
      } else {
        translateX.value = withSpring(0, springConfig);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (concepts.length === 0) return null;

  const item = concepts[currentIndex]!;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.cardWrap, animatedStyle]}>
          <ConceptCard item={item} />
        </Animated.View>
      </GestureDetector>
      <View style={styles.dots}>
        {concepts.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  dotActive: {
    backgroundColor: '#2f95dc',
    width: 24,
  },
});
