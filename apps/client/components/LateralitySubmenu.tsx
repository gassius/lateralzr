import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { Palette } from '@/constants/Colors';
import { t } from '@/lib/i18n';
import {
  lateralityGradientStops,
  MAX_LATERALITY,
  MIN_LATERALITY,
  type LateralityGrade,
} from '@/lib/laterality';

export const LATERALITY_SUBMENU_HEIGHT = 56;

type LateralitySubmenuProps = {
  laterality: LateralityGrade | number;
  swapping?: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
};

function LateralityWord({ laterality, swapping }: { laterality: number; swapping: boolean }) {
  const stops = lateralityGradientStops(laterality);
  const gradientId = `laterality-word-${laterality}`;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('lateralityGrade', { grade: String(laterality) })}
      style={[styles.wordWrap, swapping ? styles.wordSwapping : null]}
    >
      <Svg width={132} height={28} viewBox="0 0 132 28">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={stops.start} />
            <Stop offset={stops.mid ? '0.5' : '1'} stopColor={stops.mid ?? stops.end} />
            <Stop offset="1" stopColor={stops.end} />
          </LinearGradient>
        </Defs>
        <SvgText
          x="66"
          y="21"
          textAnchor="middle"
          fill={`url(#${gradientId})`}
          fontSize="20"
          fontWeight="700"
          letterSpacing="0.4"
        >
          Lateralzr
        </SvgText>
      </Svg>
    </View>
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

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onDecrease}
        disabled={!canDecrease}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('decreaseLaterality')}
        accessibilityState={{ disabled: !canDecrease }}
        style={({ pressed }) => [
          styles.step,
          !canDecrease ? styles.stepDisabled : null,
          pressed && canDecrease ? styles.stepPressed : null,
        ]}
      >
        <Text style={styles.stepGlyph}>−</Text>
      </Pressable>

      <LateralityWord laterality={laterality} swapping={swapping} />

      <Pressable
        onPress={onIncrease}
        disabled={!canIncrease}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('increaseLaterality')}
        accessibilityState={{ disabled: !canIncrease }}
        style={({ pressed }) => [
          styles.step,
          !canIncrease ? styles.stepDisabled : null,
          pressed && canIncrease ? styles.stepPressed : null,
        ]}
      >
        <Text style={styles.stepGlyph}>+</Text>
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
    paddingHorizontal: 20,
    gap: 8,
  },
  step: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: {
    opacity: 0.7,
  },
  stepDisabled: {
    opacity: 0.28,
  },
  stepGlyph: {
    color: Palette.offWhite,
    fontSize: 26,
    fontWeight: '400',
    lineHeight: 30,
  },
  wordWrap: {
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordSwapping: {
    opacity: 0.72,
  },
});
