import { useMemo, type RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type View as ViewType } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { t } from '@/lib/i18n';
import {
  LATERALITY_SHEET_ROW_MIN_HEIGHT,
  lateralitySheetCommitValue,
  lateralitySheetRows,
} from '@/lib/lateralitySheet';
import type { LateralityGrade } from '@/lib/laterality';
import { color } from '@/theme/tokens';
import { textStyle } from '@/theme/typography';

const RADIO_SIZE = 22;
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

/**
 * Laterality grade picker (guide §12.1). Selection never relies on orange alone —
 * selected rows use selectedSoft + ink centre dot.
 */
export function LateralitySheet({
  visible,
  laterality,
  onDismiss,
  onSelectLaterality,
  returnFocusRef,
}: LateralitySheetProps) {
  const rows = useMemo(() => lateralitySheetRows(laterality), [laterality]);

  return (
    <Sheet
      visible={visible}
      onDismiss={onDismiss}
      title={t('lateralitySheetTitle')}
      helper={t('lateralitySheetHelper')}
      testID="laterality-sheet"
      titleTestID="laterality-sheet-title"
      closeTestID="laterality-sheet-close"
      returnFocusRef={returnFocusRef}
    >
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        testID="laterality-sheet-rows"
      >
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
    gap: 4,
    flexGrow: 1,
  },
  row: {
    minHeight: LATERALITY_SHEET_ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
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
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: RADIO_SIZE / 2,
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
