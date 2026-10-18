import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LoadingCard } from './LoadingCard';
import {
  RESHUFFLE_GATHER_DROP_PX,
  RESHUFFLE_GATHER_SCALE,
  RESHUFFLE_RIFFLE_EVERY_MS,
  RESHUFFLE_RIFFLE_MOVE_MS,
  reshuffleDealMs,
  reshuffleGatherMs,
  reshuffleReverseMs,
  reshuffleSilhouetteCount,
  reshuffleStackFadeMs,
  riffleFanDeg,
  riffleFanOffset,
  type LateralityReshufflePhase,
} from '@/lib/lateralityReshuffle';
import { motion } from '@/theme/tokens';

type LateralityReshuffleProps = {
  phase: LateralityReshufflePhase;
  reduceMotion: boolean;
};

/**
 * Stack opacity crossfade to/from the cue (§12.5). 150 ms under Reduced Motion.
 */
export function ReshuffleStackFade({
  phase,
  reduceMotion,
  children,
}: {
  phase: LateralityReshufflePhase | null;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    const showing = phase == null || phase === 'deal' || phase === 'reverse';
    opacity.value = withTiming(showing ? 1 : 0, {
      duration: reshuffleStackFadeMs(reduceMotion, phase),
    });
  }, [opacity, phase, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View pointerEvents={phase != null ? 'none' : 'auto'} style={style}>
      {children}
    </Animated.View>
  );
}

/**
 * Gather / riffle / deal cue that covers the laterality neighborhood wait (Lz-57).
 * Reduced motion: one silhouette crossfade. Full motion: three fanned silhouettes.
 * Deal lifts D1 into place; reverse collapses back onto C.
 */
export function LateralityReshuffle({ phase, reduceMotion }: LateralityReshuffleProps) {
  const count = reshuffleSilhouetteCount(reduceMotion);
  const gatherMs = reshuffleGatherMs(reduceMotion);
  const dealMs = reshuffleDealMs(reduceMotion);
  const reverseMs = reshuffleReverseMs(reduceMotion);
  const opacity = useSharedValue(reduceMotion ? 0 : 1);
  const gather = useSharedValue(0);
  const riffle = useSharedValue(0);
  const deal = useSharedValue(0);
  const reverse = useSharedValue(0);

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
      reverse.value = 0;
    } else if (phase === 'shuffle') {
      gather.value = 1;
      deal.value = 0;
      reverse.value = 0;
    } else if (phase === 'deal') {
      gather.value = 1;
      reverse.value = 0;
      deal.value = withTiming(1, { duration: dealMs });
    } else {
      gather.value = 1;
      deal.value = 0;
      reverse.value = withTiming(1, { duration: reverseMs });
    }
  }, [deal, dealMs, gather, gatherMs, opacity, phase, reduceMotion, reverse, reverseMs]);

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
          reverse={reverse}
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
  reverse,
  exposeTestId,
}: {
  index: number;
  count: number;
  reduceMotion: boolean;
  gather: SharedValue<number>;
  riffle: SharedValue<number>;
  deal: SharedValue<number>;
  reverse: SharedValue<number>;
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
    const r = reverse.value;
    const open = g * (1 - d) * (1 - r);
    const x = riffleFanOffset(index, riffle.value) * open;
    const rotate = riffleFanDeg(index, riffle.value) * open;
    const drop = RESHUFFLE_GATHER_DROP_PX * g * (1 - d) + RESHUFFLE_GATHER_DROP_PX * r;
    const dealLift = -28 * d;
    const scale =
      1 - (1 - RESHUFFLE_GATHER_SCALE) * g * (1 - d) + 0.05 * d - 0.1 * r;
    return {
      zIndex: count - index,
      transform: [
        { translateY: drop + dealLift },
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
