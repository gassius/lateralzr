import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LoadingCard } from './LoadingCard';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  RESHUFFLE_FAN_DEG,
  RESHUFFLE_FAN_OFFSET_PX,
  RESHUFFLE_GATHER_DROP_PX,
  RESHUFFLE_GATHER_SCALE,
  RESHUFFLE_RIFFLE_EVERY_MS,
  RESHUFFLE_RIFFLE_MOVE_MS,
  reshuffleDealMs,
  reshuffleGatherMs,
  reshuffleReverseMs,
  reshuffleSilhouetteCount,
  type LateralityReshufflePhase,
} from '@/lib/lateralityReshuffle';
import { motion } from '@/theme/tokens';

type LateralityReshuffleProps = {
  phase: LateralityReshufflePhase;
};

function fanOffset(index: number, riffle: number): number {
  const base = (index - 1) * RESHUFFLE_FAN_OFFSET_PX;
  return riffle % 2 === 0 ? base : -base;
}

function fanDeg(index: number, riffle: number): number {
  const deg = RESHUFFLE_FAN_DEG[index] ?? 0;
  return riffle % 2 === 0 ? deg : -deg;
}

/**
 * Gather / riffle / deal cue that covers the laterality neighborhood wait (Lz-57).
 * Reduced motion: one silhouette crossfade. Full motion: three fanned silhouettes.
 */
export function LateralityReshuffle({ phase }: LateralityReshuffleProps) {
  const reduceMotion = useReducedMotion();
  const count = reshuffleSilhouetteCount(reduceMotion);
  const gatherMs = reshuffleGatherMs(reduceMotion);
  const settleMs =
    phase === 'reverse' ? reshuffleReverseMs(reduceMotion) : reshuffleDealMs(reduceMotion);
  const opacity = useSharedValue(reduceMotion ? 0 : 1);
  const gather = useSharedValue(0);
  const riffle = useSharedValue(0);
  const deal = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = withTiming(phase === 'deal' || phase === 'reverse' ? 0 : 1, {
        duration: motion.reshuffle.reducedMotion.crossfadeMs,
      });
      return;
    }
    opacity.value = 1;
    if (phase === 'gather') {
      gather.value = withTiming(1, { duration: gatherMs });
      deal.value = 0;
    } else if (phase === 'shuffle') {
      gather.value = 1;
      deal.value = 0;
    } else {
      gather.value = 1;
      deal.value = withTiming(1, { duration: settleMs });
    }
  }, [deal, gather, gatherMs, opacity, phase, reduceMotion, settleMs]);

  useEffect(() => {
    if (reduceMotion || phase !== 'shuffle') return;
    const id = setInterval(() => {
      riffle.value = withTiming(riffle.value + 1, { duration: RESHUFFLE_RIFFLE_MOVE_MS });
    }, RESHUFFLE_RIFFLE_EVERY_MS);
    return () => clearInterval(id);
  }, [phase, reduceMotion, riffle]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[styles.root, rootStyle]}
      testID="laterality-reshuffle"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="auto"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as Record<string, unknown>) : null)}
    >
      {Array.from({ length: count }, (_, index) => (
        <Silhouette
          key={index}
          index={index}
          count={count}
          reduceMotion={reduceMotion}
          gather={gather}
          riffle={riffle}
          deal={deal}
          exposeTestId={index === 0}
        />
      ))}
    </Animated.View>
  );
}

function Silhouette({
  index,
  count,
  reduceMotion,
  gather,
  riffle,
  deal,
  exposeTestId,
}: {
  index: number;
  count: number;
  reduceMotion: boolean;
  gather: SharedValue<number>;
  riffle: SharedValue<number>;
  deal: SharedValue<number>;
  exposeTestId: boolean;
}) {
  const style = useAnimatedStyle(() => {
    if (reduceMotion || count === 1) {
      return {
        zIndex: 1,
        transform: [{ translateY: 0 }, { scale: 1 }, { rotate: '0deg' }],
      };
    }
    const g = gather.value;
    const d = deal.value;
    const tick = Math.round(riffle.value);
    const drop = RESHUFFLE_GATHER_DROP_PX * g * (1 - d);
    const scale = 1 - (1 - RESHUFFLE_GATHER_SCALE) * g * (1 - d);
    const x = fanOffset(index, tick) * g * (1 - d);
    const rotate = fanDeg(index, tick) * g * (1 - d);
    return {
      zIndex: count - index,
      transform: [
        { translateY: drop },
        { translateX: x },
        { scale },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.silhouette, style]} pointerEvents="none">
      <LoadingCard exposeTestId={exposeTestId} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  silhouette: {
    ...StyleSheet.absoluteFill,
  },
});
