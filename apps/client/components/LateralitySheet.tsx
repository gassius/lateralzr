import { useMemo, useState, type RefObject } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type View as ViewType,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Sheet } from '@/components/Sheet';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { t } from '@/lib/i18n';
import {
  LATERALITY_MINI_RAIL_DOT_COUNT,
  LATERALITY_MINI_RAIL_HEIGHT,
  LATERALITY_SHEET_RADIO_SIZE,
  LATERALITY_SHEET_ROW_MIN_HEIGHT,
  LATERALITY_SHEET_ROW_RADIUS,
  lateralityMiniRailSelectedDot,
  lateralitySheetCommitValue,
  lateralitySheetRows,
} from '@/lib/lateralitySheet';
import type { LateralityGrade } from '@/lib/laterality';
import { color, layout } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';

const RADIO_DOT = 8;

type LateralitySheetProps = {
  visible: boolean;
  laterality: LateralityGrade | number;
  onDismiss: () => void;
  onSelectLaterality: (grade: LateralityGrade) => void;
  returnFocusRef?: RefObject<ViewType | null>;
};

function LateralityRadio({ checked }: { checked: boolean }) {
  return (
    <View
      style={[
        styles.radio,
        checked ? styles.radioChecked : styles.radioUnchecked,
      ]}
      accessible={false}
    >
      {checked ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

function LateralityMiniRail({ grade }: { grade: LateralityGrade }) {
  const [width, setWidth] = useState(0);
  const selected = lateralityMiniRailSelectedDot(grade);
  const inset = 5;
  const usable = Math.max(0, width - inset * 2);
  const step = LATERALITY_MINI_RAIL_DOT_COUNT > 1 ? usable / (LATERALITY_MINI_RAIL_DOT_COUNT - 1) : 0;
  const cy = LATERALITY_MINI_RAIL_HEIGHT / 2;

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as Record<string, unknown>) : null)}
      onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
      style={styles.miniRail}
      testID="laterality-sheet-mini-rail"
    >
      {width > 0 ? (
        <Svg width={width} height={LATERALITY_MINI_RAIL_HEIGHT} accessible={false}>
          <Line
            x1={inset}
            y1={cy}
            x2={width - inset}
            y2={cy}
            stroke={color.rail}
            strokeWidth={1.75}
            strokeLinecap="round"
          />
          {Array.from({ length: LATERALITY_MINI_RAIL_DOT_COUNT }, (_, i) => {
            const n = (i + 1) as LateralityGrade;
            return (
              <Circle
                key={n}
                cx={inset + step * i}
                cy={cy}
                r={4.5}
                fill={n === selected ? color.front : color.rail}
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Laterality grade picker (guide §12.1). Selection never relies on orange alone —
 * selected rows use selectedSoft + ink centre dot. Mini rail is decorative.
 */
export function LateralitySheet({
  visible,
  laterality,
  onDismiss,
  onSelectLaterality,
  returnFocusRef,
}: LateralitySheetProps) {
  const rows = useMemo(() => lateralitySheetRows(laterality), [laterality]);
  const reduceMotion = useReducedMotion();
  const grade = lateralityMiniRailSelectedDot(laterality);

  return (
    <Sheet
      visible={visible}
      onDismiss={onDismiss}
      title={t('lateralitySheetTitle')}
      helper={t('lateralitySheetHelper')}
      afterHelper={<LateralityMiniRail grade={grade} />}
      testID="laterality-sheet"
      titleTestID="laterality-sheet-title"
      closeTestID="laterality-sheet-close"
      returnFocusRef={returnFocusRef}
      reduceMotion={reduceMotion}
    >
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        testID="laterality-sheet-rows"
      >
        <View style={styles.group} testID="laterality-sheet-group">
          {rows.map((row) => (
            <Pressable
              key={row.grade}
              onPress={() => {
                onSelectLaterality(lateralitySheetCommitValue(row.grade));
                onDismiss();
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: row.checked }}
              accessibilityLabel={row.a11yLabel}
              testID={`laterality-sheet-row-${row.grade}`}
              // RN-web does not always emit aria-checked from accessibilityState (Lz-41 axe).
              {...(Platform.OS === 'web'
                ? ({ 'aria-checked': row.checked, tabIndex: 0 } as Record<string, unknown>)
                : null)}
              style={({ pressed }) => [
                styles.row,
                row.checked ? styles.rowSelected : null,
                pressed ? styles.rowPressed : null,
              ]}
            >
              <LateralityRadio checked={row.checked} />
              <Text
                style={[
                  styles.rowLabel,
                  textStyle('row'),
                  row.checked ? styles.rowLabelSelected : null,
                ]}
              >
                {t(row.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  /** Grow into the panel body; scroll when rows wrap (200% text). */
  list: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  listContent: {
    paddingBottom: 8,
    flexGrow: 1,
  },
  miniRail: {
    paddingHorizontal: layout.screenGutter,
    paddingBottom: 8,
  },
  group: {
    backgroundColor: color.sheetGroup,
    borderRadius: layout.sheetGroupRadius,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  row: {
    minHeight: LATERALITY_SHEET_ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: LATERALITY_SHEET_ROW_RADIUS,
  },
  rowSelected: {
    backgroundColor: color.selectedSoft,
  },
  rowPressed: {
    opacity: 0.88,
  },
  rowLabel: {
    flex: 1,
    color: color.ink,
  },
  rowLabelSelected: {
    color: color.ink,
  },
  radio: {
    width: LATERALITY_SHEET_RADIO_SIZE,
    height: LATERALITY_SHEET_RADIO_SIZE,
    borderRadius: LATERALITY_SHEET_RADIO_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioUnchecked: {
    borderColor: color.controlBorder,
    backgroundColor: 'transparent',
  },
  radioChecked: {
    borderColor: color.front,
    backgroundColor: color.front,
  },
  radioDot: {
    width: RADIO_DOT,
    height: RADIO_DOT,
    borderRadius: RADIO_DOT / 2,
    backgroundColor: color.ink,
  },
});
