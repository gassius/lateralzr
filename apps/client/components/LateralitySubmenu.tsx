import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  WORDMARK_ASPECT,
  WORDMARK_GROUP_TRANSFORM,
  WORDMARK_LETTERS,
  wordmarkViewBoxAttr,
} from '@/assets/images/lateralzrWordmark';
import { Palette } from '@/constants/Colors';
import { t } from '@/lib/i18n';
import {
  LATERALITY_NODES_WIDTH,
  LATERALITY_STEP_SIZE,
  LATERALITY_SUBMENU_HEIGHT,
  LATERALITY_WORDMARK_HEIGHT,
} from '@/lib/lateralityChrome';
import {
  lateralityGradientStops,
  MAX_LATERALITY,
  MIN_LATERALITY,
  type LateralityGrade,
} from '@/lib/laterality';

export { LATERALITY_CARD_GAP, LATERALITY_SUBMENU_HEIGHT } from '@/lib/lateralityChrome';

/** Lightbulb / idea mark stays off this row — reserved for the future feedback CTA. */

type LateralitySubmenuProps = {
  laterality: LateralityGrade | number;
  swapping?: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
};

const WORDMARK_WIDTH = Math.round(LATERALITY_WORDMARK_HEIGHT * WORDMARK_ASPECT);
const STEP_STROKE = 4.25;
const STEP_GLYPH = 32;

function LateralityNodes({ color, testID }: { color: string; testID: string }) {
  return (
    <View testID={testID} accessible={false} importantForAccessibility="no" style={styles.nodes}>
      <Svg width={LATERALITY_NODES_WIDTH} height={16} viewBox="0 0 32 16">
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

function LateralityWordmark({ laterality, swapping }: { laterality: number; swapping: boolean }) {
  const stops = lateralityGradientStops(laterality);
  const gradientId = `laterality-wordmark-${laterality}`;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('lateralityGrade', { grade: String(laterality) })}
      style={[styles.wordWrap, swapping ? styles.wordSwapping : null]}
      testID="laterality-wordmark"
    >
      <Svg
        width={WORDMARK_WIDTH}
        height={LATERALITY_WORDMARK_HEIGHT}
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
            <Path
              key={letter.id}
              d={letter.d}
              transform={letter.transform}
              fill={`url(#${gradientId})`}
            />
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

  return (
    <View style={styles.row} testID="laterality-submenu">
      <Pressable
        onPress={onDecrease}
        disabled={!canDecrease}
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

      <LateralityNodes color={stops.start} testID="laterality-nodes-left" />
      <LateralityWordmark laterality={laterality} swapping={swapping} />
      <LateralityNodes color={stops.end} testID="laterality-nodes-right" />

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
    height: LATERALITY_SUBMENU_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  step: {
    width: LATERALITY_STEP_SIZE,
    height: LATERALITY_STEP_SIZE,
    minWidth: LATERALITY_STEP_SIZE,
    minHeight: LATERALITY_STEP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: {
    opacity: 0.7,
  },
  stepDisabled: {
    opacity: 0.28,
  },
  nodes: {
    width: LATERALITY_NODES_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordWrap: {
    width: WORDMARK_WIDTH,
    height: LATERALITY_WORDMARK_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordSwapping: {
    opacity: 0.72,
  },
});
