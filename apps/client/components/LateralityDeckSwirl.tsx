import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Palette } from '@/constants/Colors';
import { t } from '@/lib/i18n';
import { lateralityGradientStops } from '@/lib/laterality';
import {
  lateralitySwirlCardCount,
  lateralitySwirlCardPose,
  lateralitySwirlHoldMs,
  lateralitySwirlOverlayOpacity,
  lateralitySwirlSettledPose,
  lateralitySwirlStaticPose,
  LATERALITY_SWIRL_APPEAR_MS,
  LATERALITY_SWIRL_CARD_SIZE,
  LATERALITY_SWIRL_FAN_SPREAD_RATIO,
  LATERALITY_SWIRL_PERIOD_MS,
  LATERALITY_SWIRL_RADIUS_RATIO,
  LATERALITY_SWIRL_SETTLE_MS,
  shouldAnimateLateralitySwirl,
  type LateralitySwirlOutcome,
} from '@/lib/lateralitySwirl';

function initialReduceMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

type LateralityDeckSwirlProps = {
  laterality: number;
  token: number;
  outcome: LateralitySwirlOutcome;
  onExitComplete: () => void;
};

export function LateralityDeckSwirl({
  laterality,
  token,
  outcome,
  onExitComplete,
}: LateralityDeckSwirlProps) {
  const [reduceMotion, setReduceMotion] = useState(initialReduceMotion);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const startedAtRef = useRef(Date.now());
  const onExitCompleteRef = useRef(onExitComplete);
  const animate = shouldAnimateLateralitySwirl(reduceMotion);
  const cardCount = lateralitySwirlCardCount(reduceMotion);
  const progress = useSharedValue(0);
  const settle = useSharedValue(0);
  const appear = useSharedValue(animate ? 0 : 1);
  const radiusSV = useSharedValue(24);

  onExitCompleteRef.current = onExitComplete;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    radiusSV.value = Math.max(16, area.width * LATERALITY_SWIRL_RADIUS_RATIO);
  }, [area.width, radiusSV]);

  useEffect(() => {
    if (!animate) {
      appear.value = 1;
      progress.value = 0;
      return;
    }
    appear.value = withTiming(1, { duration: LATERALITY_SWIRL_APPEAR_MS });
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: LATERALITY_SWIRL_PERIOD_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [animate, appear, progress]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    if (outcome === 'pending') {
      cancelAnimation(settle);
      settle.value = 0;
    }
  }, [outcome, settle, token]);

  useEffect(() => {
    if (outcome === 'pending') return;
    const finish = () => {
      onExitCompleteRef.current();
    };
    const wait = lateralitySwirlHoldMs(outcome, Date.now() - startedAtRef.current, animate);
    const timer = setTimeout(() => {
      if (!animate) {
        finish();
        return;
      }
      settle.value = withTiming(1, { duration: LATERALITY_SWIRL_SETTLE_MS }, (finished) => {
        if (finished) runOnJS(finish)();
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [animate, outcome, settle, token]);

  const washStyle = useAnimatedStyle(() => ({
    opacity: lateralitySwirlOverlayOpacity(appear.value, settle.value),
  }));

  const caption = t('loadingLateralNeighborhood');
  const cardWidth = Math.max(1, area.width * LATERALITY_SWIRL_CARD_SIZE);
  const cardHeight = Math.max(1, area.height * LATERALITY_SWIRL_CARD_SIZE);
  const spread = Math.max(12, area.width * LATERALITY_SWIRL_FAN_SPREAD_RATIO);
  const webBusyProps =
    Platform.OS === 'web' ? ({ 'aria-busy': true } as Record<string, unknown>) : {};

  return (
    <View
      testID="laterality-deck-swirl"
      style={styles.root}
      pointerEvents="auto"
      accessible
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
      accessibilityLabel={caption}
      {...webBusyProps}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== area.width || height !== area.height) {
          setArea({ width, height });
        }
      }}
    >
      <Animated.View style={[styles.wash, washStyle]} pointerEvents="none" />
      {area.width > 0
        ? Array.from({ length: cardCount }, (_, index) => (
            <SwirlGhostCard
              key={index}
              index={index}
              count={cardCount}
              laterality={laterality}
              width={cardWidth}
              height={cardHeight}
              spread={spread}
              animate={animate}
              progress={progress}
              settle={settle}
              appear={appear}
              radiusSV={radiusSV}
            />
          ))
        : null}
      <Animated.View style={[styles.captionWrap, washStyle]} pointerEvents="none">
        <Text style={styles.caption}>{caption}</Text>
      </Animated.View>
    </View>
  );
}

function SwirlGhostCard({
  index,
  count,
  laterality,
  width,
  height,
  spread,
  animate,
  progress,
  settle,
  appear,
  radiusSV,
}: {
  index: number;
  count: number;
  laterality: number;
  width: number;
  height: number;
  spread: number;
  animate: boolean;
  progress: SharedValue<number>;
  settle: SharedValue<number>;
  appear: SharedValue<number>;
  radiusSV: SharedValue<number>;
}) {
  const stops = lateralityGradientStops(laterality);
  const staticPose = lateralitySwirlStaticPose(index, count, spread);
  const cardStyle = useAnimatedStyle(() => {
    const base = animate
      ? lateralitySwirlCardPose(progress.value, index, radiusSV.value, count)
      : {
          x: staticPose.x,
          y: staticPose.y,
          rotateDeg: staticPose.rotateDeg,
          scale: staticPose.scale,
          zIndex: staticPose.zIndex,
        };
    const settled = lateralitySwirlSettledPose(base, settle.value);
    return {
      opacity: settled.opacity * lateralitySwirlOverlayOpacity(appear.value, 0),
      zIndex: settled.zIndex,
      transform: [
        { translateX: settled.x },
        { translateY: settled.y },
        { rotateZ: `${settled.rotateDeg}deg` },
        { scale: settled.scale },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ghost,
        { width, height, marginLeft: -width / 2, marginTop: -height / 2 },
        cardStyle,
      ]}
    >
      <View style={styles.ghostFace}>
        <View
          style={[
            styles.gradeBar,
            { backgroundColor: stops.end },
          ]}
        />
        <View style={[styles.gradeBarMid, { backgroundColor: stops.start }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(19,91,119,0.78)',
  },
  ghost: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  ghostFace: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: Palette.orange,
    borderWidth: 1,
    borderColor: 'rgba(19,91,119,0.35)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  gradeBar: {
    height: 7,
    width: '100%',
  },
  gradeBarMid: {
    height: 3,
    width: '100%',
    opacity: 0.85,
  },
  captionWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    alignItems: 'center',
    zIndex: 40,
    elevation: 40,
  },
  caption: {
    color: Palette.darkBlue,
    backgroundColor: Palette.offWhite,
    overflow: 'hidden',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
});
