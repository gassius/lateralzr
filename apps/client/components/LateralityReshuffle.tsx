import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LoadingCard } from './LoadingCard';
import { cardRadius } from '@/lib/cardLayout';
import {
  RESHUFFLE_RIFFLE_EVERY_MS,
  RESHUFFLE_RIFFLE_MOVE_MS,
  reshuffleCardOffsetY,
  reshuffleCardScale,
  reshufflePhaseTargets,
  reshuffleSilhouetteCount,
  reshuffleSilhouetteOffsetY,
  reshuffleSilhouetteOpacity,
  reshuffleSilhouetteScale,
  riffleFanDeg,
  riffleFanOffset,
  riffleStackZ,
  type LateralityReshufflePhase,
  type ReshuffleCueFrame,
} from '@/lib/lateralityReshuffle';

type LateralityReshuffleProps = {
  phase: LateralityReshufflePhase;
  reduceMotion: boolean;
  cardFrame: ReshuffleCueFrame;
};

export function useReshufflePhaseMotion(
  phase: LateralityReshufflePhase | null,
  reduceMotion: boolean,
) {
  const gather = useSharedValue(0);
  const deal = useSharedValue(0);
  const reverse = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const cueOpacity = useSharedValue(reduceMotion ? 0 : 1);
  const riffle = useSharedValue(0);

  useEffect(() => {
    const next = reshufflePhaseTargets(phase, reduceMotion);
    if (phase == null) {
      gather.value = 0;
      deal.value = 0;
      reverse.value = 0;
      cardOpacity.value = 1;
      cueOpacity.value = 0;
      riffle.value = 0;
      return;
    }
    gather.value =
      next.gatherMs > 0 ? withTiming(next.gather, { duration: next.gatherMs }) : next.gather;
    deal.value = next.dealMs > 0 ? withTiming(next.deal, { duration: next.dealMs }) : next.deal;
    reverse.value =
      next.reverseMs > 0 ? withTiming(next.reverse, { duration: next.reverseMs }) : next.reverse;
    cardOpacity.value =
      next.cardOpacityMs > 0
        ? withTiming(next.cardOpacity, { duration: next.cardOpacityMs })
        : next.cardOpacity;
    cueOpacity.value =
      next.cueOpacityMs > 0
        ? withTiming(next.cueOpacity, { duration: next.cueOpacityMs })
        : next.cueOpacity;
  }, [cardOpacity, cueOpacity, deal, gather, phase, reduceMotion, reverse, riffle]);

  return { gather, deal, reverse, cardOpacity, cueOpacity, riffle };
}

/** Card-rect gather / deal motion. Opacity stays 1 through gather (W1). */
export function useReshuffleCardStyle(
  phase: LateralityReshufflePhase | null,
  reduceMotion: boolean,
) {
  const { gather, deal, reverse, cardOpacity } = useReshufflePhaseMotion(phase, reduceMotion);
  return useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: cardOpacity.value };
    }
    return {
      opacity: cardOpacity.value,
      transform: [
        { translateY: reshuffleCardOffsetY(gather.value, deal.value, reverse.value) },
        { scale: reshuffleCardScale(gather.value, deal.value, reverse.value) },
      ],
    };
  });
}

/**
 * Gather / riffle / deal cue that covers the laterality neighborhood wait (Lz-57).
 * Sized to the card rect. Reduced motion: one silhouette crossfade.
 * Full motion: two silhouettes join behind the dropping card, then riffle;
 * deal sinks the cue under D1 and fades it out by dealMs.
 */
export function LateralityReshuffle({
  phase,
  reduceMotion,
  cardFrame,
}: LateralityReshuffleProps) {
  const count = reshuffleSilhouetteCount(reduceMotion);
  const { gather, deal, reverse, cueOpacity, riffle } = useReshufflePhaseMotion(
    phase,
    reduceMotion,
  );

  useEffect(() => {
    if (reduceMotion || phase !== 'shuffle') return;
    const id = setInterval(() => {
      riffle.value = withTiming(riffle.value + 1, { duration: RESHUFFLE_RIFFLE_MOVE_MS });
    }, RESHUFFLE_RIFFLE_EVERY_MS);
    return () => clearInterval(id);
  }, [phase, reduceMotion, riffle]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: cueOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.root,
        {
          top: cardFrame.top,
          left: cardFrame.left,
          width: cardFrame.width,
          height: cardFrame.height,
          borderRadius: cardRadius(),
        },
        rootStyle,
      ]}
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
        opacity: 1,
        transform: [{ translateY: 0 }, { scale: 1 }, { rotate: '0deg' }],
      };
    }
    const g = gather.value;
    const d = deal.value;
    const r = reverse.value;
    const open = g * (1 - d) * (1 - r);
    const x = riffleFanOffset(index, riffle.value) * open;
    const rotate = riffleFanDeg(index, riffle.value) * open;
    return {
      zIndex: riffleStackZ(index, count, riffle.value),
      opacity: reshuffleSilhouetteOpacity(index, g, d, r),
      transform: [
        { translateY: reshuffleSilhouetteOffsetY(g, d, r) },
        { translateX: x },
        { scale: reshuffleSilhouetteScale(g) },
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
    position: 'absolute',
    zIndex: 1,
    overflow: 'visible',
  },
  silhouette: {
    ...StyleSheet.absoluteFill,
  },
});
