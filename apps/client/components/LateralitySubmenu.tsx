import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  WORDMARK_GROUP_TRANSFORM,
  WORDMARK_LETTERS,
  wordmarkViewBoxAttr,
} from '@/assets/images/lateralzrWordmark';
import { Palette } from '@/constants/Colors';
import { t } from '@/lib/i18n';
import {
  lateralityBarFit,
  LATERALITY_BAR_MIN_ROW_WIDTH,
  LATERALITY_ROW_GAP,
  LATERALITY_ROW_PADDING_HORIZONTAL,
  LATERALITY_STEP_SIZE,
  LATERALITY_SUBMENU_HEIGHT,
} from '@/lib/lateralityChrome';
import {
  lateralityGradientStops,
  MAX_LATERALITY,
  MIN_LATERALITY,
  type LateralityGrade,
} from '@/lib/laterality';

export { LATERALITY_CARD_GAP, LATERALITY_SUBMENU_HEIGHT } from '@/lib/lateralityChrome';

type LateralitySubmenuProps = {
  laterality: LateralityGrade | number;
  swapping?: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
};

const STEP_STROKE = 4.25;
const STEP_GLYPH = 32;

function LateralityNodes({
  color,
  testID,
  width,
}: {
  color: string;
  testID: string;
  width: number;
}) {
  if (width <= 0) return null;
  return (
    <View testID={testID} accessible={false} importantForAccessibility="no" style={{ width, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={width} height={16} viewBox="0 0 32 16">
        <Line
          x1="4"
          y1="8"
          x2="28"
          y2="8"
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
        />
        <Circle cx="4" cy="8" r="3.25" fill={color} />
        <Circle cx="28" cy="8" r="3.25" fill={color} />
      </Svg>
    </View>
  );
}

function LateralityWordmark({
  laterality,
  swapping,
  width,
  height,
}: {
  laterality: number;
  swapping: boolean;
  width: number;
  height: number;
}) {
  const stops = lateralityGradientStops(laterality);
  const gradientId = `laterality-wordmark-${laterality}`;
  if (width <= 0 || height <= 0) return null;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('lateralityGrade', { grade: String(laterality) })}
      style={[styles.wordWrap, { width, height }, swapping ? styles.wordSwapping : null]}
      testID="laterality-wordmark"
    >
      <Svg
        width={width}
        height={height}
        viewBox={wordmarkViewBoxAttr()}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={stops.start} />
            <Stop offset={stops.mid ? '0.5' : '1'} stopColor={stops.mid ?? stops.end} />
            <Stop offset="1" stopColor={stops.end} />
          </LinearGradient>
        </Defs>
        <G transform={WORDMARK_GROUP_TRANSFORM} fill={`url(#${gradientId})`}>
          {WORDMARK_LETTERS.map((letter) => (
            <Path key={letter.id} d={letter.d} transform={letter.transform} />
          ))}
        </G>
      </Svg>
    </View>
  );
}

function StepGlyph({ kind }: { kind: 'minus' | 'plus' }) {
  const mid = STEP_GLYPH / 2;
  const pad = 7;
  return (
    <Svg width={STEP_GLYPH} height={STEP_GLYPH} viewBox={`0 0 ${STEP_GLYPH} ${STEP_GLYPH}`} accessible={false}>
      <Circle
        cx={mid}
        cy={mid}
        r={mid - 1.25}
        fill="rgba(245,245,242,0.08)"
        stroke="rgba(245,245,242,0.42)"
        strokeWidth={1.75}
      />
      <Line
        x1={pad}
        y1={mid}
        x2={STEP_GLYPH - pad}
        y2={mid}
        stroke={Palette.offWhite}
        strokeWidth={STEP_STROKE}
        strokeLinecap="round"
      />
      {kind === 'plus' ? (
        <Line
          x1={mid}
          y1={pad}
          x2={mid}
          y2={STEP_GLYPH - pad}
          stroke={Palette.offWhite}
          strokeWidth={STEP_STROKE}
          strokeLinecap="round"
        />
      ) : null}
    </Svg>
  );
}

export function LateralitySubmenu({
  laterality,
  swapping = false,
  onDecrease,
  onIncrease,
}: LateralitySubmenuProps) {
  const canDecrease = laterality > MIN_LATERALITY;
  const canIncrease = laterality < MAX_LATERALITY;
  const stops = lateralityGradientStops(laterality);
  const { width: windowWidth } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const rowWidth =
    layoutWidth > 0 ? layoutWidth : windowWidth > 0 ? windowWidth : LATERALITY_BAR_MIN_ROW_WIDTH;
  const fit = lateralityBarFit(rowWidth);

  return (
    <View
      style={styles.row}
      testID="laterality-submenu"
      onLayout={(event) => {
        const next = Math.floor(event.nativeEvent.layout.width);
        if (next > 0 && next !== layoutWidth) setLayoutWidth(next);
      }}
    >
      <Pressable
        onPress={onDecrease}
        disabled={!canDecrease}
        // 48px box already meets ≥44; hitSlop is a small extra, not the reachable area.
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={t('decreaseLaterality')}
        accessibilityState={{ disabled: !canDecrease }}
        testID="laterality-decrease"
        style={({ pressed }) => [
          styles.step,
          !canDecrease ? styles.stepDisabled : null,
          pressed && canDecrease ? styles.stepPressed : null,
        ]}
      >
        <StepGlyph kind="minus" />
      </Pressable>

      <LateralityNodes color={stops.start} testID="laterality-nodes-left" width={fit.nodesWidth} />
      <LateralityWordmark
        laterality={laterality}
        swapping={swapping}
        width={fit.wordmarkWidth}
        height={fit.wordmarkHeight}
      />
      <LateralityNodes color={stops.end} testID="laterality-nodes-right" width={fit.nodesWidth} />

      <Pressable
        onPress={onIncrease}
        disabled={!canIncrease}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={t('increaseLaterality')}
        accessibilityState={{ disabled: !canIncrease }}
        testID="laterality-increase"
        style={({ pressed }) => [
          styles.step,
          !canIncrease ? styles.stepDisabled : null,
          pressed && canIncrease ? styles.stepPressed : null,
        ]}
      >
        <StepGlyph kind="plus" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    height: LATERALITY_SUBMENU_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: LATERALITY_ROW_PADDING_HORIZONTAL,
    gap: LATERALITY_ROW_GAP,
  },
  step: {
    width: LATERALITY_STEP_SIZE,
    height: LATERALITY_STEP_SIZE,
    minWidth: LATERALITY_STEP_SIZE,
    minHeight: LATERALITY_STEP_SIZE,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: {
    opacity: 0.7,
  },
  stepDisabled: {
    opacity: 0.28,
  },
  wordWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  wordSwapping: {
    opacity: 0.72,
  },
});
